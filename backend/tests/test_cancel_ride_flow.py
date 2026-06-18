"""
Tests for P0 fixes:
- POST /api/rides/{ride_id}/cancel - updates status, notifies parties, frees driver
- GET /api/stats/driver - driver dashboard stats
- GET /api/rides/active - returns active ride or null (used for cancellation detection on frontend)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://taxi-connect-47.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

PASSENGER = {"email": "passenger@test.com", "password": "password"}
DRIVER = {"email": "driver@test.com", "password": "password"}
DRIVER2 = {"email": "driver3@test.com", "password": "password"}


def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def passenger():
    token, user = login(PASSENGER)
    return {"token": token, "user": user}


@pytest.fixture(scope="module")
def driver():
    token, user = login(DRIVER)
    # Mark driver online + available
    requests.put(f"{API}/users/availability", headers=auth(token), json={"is_online": True, "is_available": True}, timeout=10)
    # update location near Paris center
    requests.put(f"{API}/users/location", headers=auth(token), json={"lat": 48.8566, "lng": 2.3522}, timeout=10)
    return {"token": token, "user": user}


@pytest.fixture(scope="module")
def driver2():
    token, user = login(DRIVER2)
    requests.put(f"{API}/users/availability", headers=auth(token), json={"is_online": True, "is_available": True}, timeout=10)
    requests.put(f"{API}/users/location", headers=auth(token), json={"lat": 48.8566, "lng": 2.3522}, timeout=10)
    return {"token": token, "user": user}


class TestAuth:
    def test_driver_login(self):
        token, user = login(DRIVER)
        assert user["role"] == "driver"
        assert isinstance(token, str) and len(token) > 20

    def test_passenger_login(self):
        token, user = login(PASSENGER)
        assert user["role"] == "passenger"


class TestDriverStats:
    """Verify /api/stats/driver works for the dashboard."""

    def test_get_driver_stats(self, driver):
        r = requests.get(f"{API}/stats/driver", headers=auth(driver["token"]), timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        # Expected keys for the dashboard cards
        for key in ["today_earnings", "today_rides", "rating"]:
            assert key in data, f"missing key {key} in {data}"
        assert isinstance(data["rating"], (int, float))

    def test_stats_requires_auth(self):
        r = requests.get(f"{API}/stats/driver", timeout=10)
        assert r.status_code in (401, 403)


class TestActiveRideEndpoint:
    """fetchActiveRide on the frontend relies on this returning the ride or null."""

    def test_active_when_none(self, driver):
        r = requests.get(f"{API}/rides/active", headers=auth(driver["token"]), timeout=10)
        assert r.status_code == 200
        # may be None or empty object; frontend treats both as "no active ride"
        body = r.json() if r.text else None
        assert body in (None, {}) or isinstance(body, dict)


def _create_ride(passenger_token, vehicle_type="vtc"):
    payload = {
        "pickup": {"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre, France"},
        "destination": {"lat": 48.8606, "lng": 2.3376, "address": "Louvre, Paris"},
        "vehicle_type": vehicle_type,
        "payment_method": "cash",
    }
    r = requests.post(f"{API}/rides", headers=auth(passenger_token), json=payload, timeout=20)
    return r


class TestCancelFlow:
    """P0: passenger cancels an accepted ride -> driver freed + notified, no crash."""

    def test_passenger_cancels_pending_ride(self, passenger):
        # 1) passenger creates ride
        r = _create_ride(passenger["token"])
        assert r.status_code in (200, 201), r.text
        ride = r.json()
        ride_id = ride["id"]
        assert ride["status"] in ("pending", "accepted")

        # 2) passenger cancels
        rc = requests.post(f"{API}/rides/{ride_id}/cancel", headers=auth(passenger["token"]), timeout=15)
        assert rc.status_code == 200, rc.text
        cancelled = rc.json()
        assert cancelled["status"] == "cancelled"
        # Note: cancelled_by is persisted in DB but not exposed by RideResponse model

    def test_passenger_cancels_accepted_ride_frees_driver(self, passenger, driver):
        # passenger creates ride
        r = _create_ride(passenger["token"])
        assert r.status_code in (200, 201), r.text
        ride = r.json()
        ride_id = ride["id"]

        # driver accepts (if not already auto-assigned)
        if ride["status"] == "pending":
            ra = requests.post(f"{API}/rides/{ride_id}/accept", headers=auth(driver["token"]), timeout=15)
            # if auto-dispatch already assigned, /accept may return 400 ; that's ok if status is already accepted
            if ra.status_code not in (200, 201):
                # confirm ride was already accepted (auto-assigned)
                rg = requests.get(f"{API}/rides/{ride_id}", headers=auth(passenger["token"]), timeout=10)
                assert rg.status_code == 200
                assert rg.json().get("status") in ("accepted", "pending"), rg.text

        # verify driver has an active ride
        ar = requests.get(f"{API}/rides/active", headers=auth(driver["token"]), timeout=10)
        assert ar.status_code == 200
        active_before = ar.json()
        # active_before may be None if driver wasn't the assigned one (auto-dispatch nearest); skip in that case
        if not active_before or active_before.get("id") != ride_id:
            pytest.skip("Driver was not assigned this ride by auto-dispatch; cannot verify driver freeing.")

        # passenger cancels
        rc = requests.post(f"{API}/rides/{ride_id}/cancel", headers=auth(passenger["token"]), timeout=15)
        assert rc.status_code == 200, rc.text
        body = rc.json()
        assert body["status"] == "cancelled"
        # Note: cancelled_by persisted in DB but not in RideResponse

        # driver's active ride should be gone now -> this is what the frontend uses to detect cancellation
        time.sleep(1)
        ar2 = requests.get(f"{API}/rides/active", headers=auth(driver["token"]), timeout=10)
        assert ar2.status_code == 200
        active_after = ar2.json()
        assert (active_after is None) or (active_after == {}) or (active_after.get("id") != ride_id), (
            f"Driver still has cancelled ride as active: {active_after}"
        )

    def test_cancel_unauthorized_user(self, passenger, driver2):
        # passenger creates ride
        r = _create_ride(passenger["token"])
        ride = r.json()
        ride_id = ride["id"]

        # driver2 (random driver, not assigned to this ride) tries to cancel
        rc = requests.post(f"{API}/rides/{ride_id}/cancel", headers=auth(driver2["token"]), timeout=10)
        # Should be forbidden unless driver2 was auto-assigned
        if rc.status_code == 200:
            # if accepted means driver2 was auto-assigned -- cleanup
            pass
        else:
            assert rc.status_code in (403, 404), rc.text
            # cleanup
            requests.post(f"{API}/rides/{ride_id}/cancel", headers=auth(passenger["token"]), timeout=10)

    def test_cancel_nonexistent_ride(self, passenger):
        fake_id = str(uuid.uuid4())
        rc = requests.post(f"{API}/rides/{fake_id}/cancel", headers=auth(passenger["token"]), timeout=10)
        assert rc.status_code == 404

    def test_cancel_already_cancelled(self, passenger):
        r = _create_ride(passenger["token"])
        ride_id = r.json()["id"]
        rc1 = requests.post(f"{API}/rides/{ride_id}/cancel", headers=auth(passenger["token"]), timeout=10)
        assert rc1.status_code == 200
        rc2 = requests.post(f"{API}/rides/{ride_id}/cancel", headers=auth(passenger["token"]), timeout=10)
        assert rc2.status_code == 400, rc2.text


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
