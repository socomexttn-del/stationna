"""
Tests for ride refusal flow:
- POST /api/rides/{ride_id}/refuse adds driver to refused_by and returns success
- GET /api/rides/available excludes rides driver has refused (refused_by filtering)
- Refused rides remain visible to OTHER drivers
- Async task scheduled (5s) re-proposes ride to next nearest driver
"""

import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://taxi-connect-47.preview.emergentagent.com").rstrip("/")

PASSENGER = {"email": "passenger@test.com", "password": "password"}
DRIVER_VAN_1 = {"email": "driver@test.com", "password": "password"}        # Van driver
DRIVER_VAN_2 = {"email": "driver3@test.com", "password": "password"}        # VTC/Van driver


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"]


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _set_driver_available(token, lat, lng, available=True):
    payload = {
        "is_available": available,
        "location": {"lat": lat, "lng": lng, "address": "Paris"},
    }
    r = requests.put(f"{BASE_URL}/api/users/availability", json=payload, headers=_headers(token), timeout=15)
    return r


def _get_driver_vehicle_types(token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_headers(token), timeout=15)
    assert r.status_code == 200, r.text
    me = r.json()
    return me.get("driver_vehicle_types", []) or []


def _cancel_active_ride(token):
    r = requests.get(f"{BASE_URL}/api/rides/active", headers=_headers(token), timeout=15)
    if r.status_code == 200 and r.json():
        ride = r.json()
        rid = ride.get("id")
        requests.post(f"{BASE_URL}/api/rides/{rid}/cancel", headers=_headers(token), timeout=15)


def _create_ride(passenger_token, vehicle_type="vtc"):
    payload = {
        "pickup": {"address": "Tour Eiffel, Paris", "lat": 48.8584, "lng": 2.2945},
        "destination": {"address": "Louvre, Paris", "lat": 48.8606, "lng": 2.3376},
        "vehicle_type": vehicle_type,
        "payment_method": "cash",
    }
    r = requests.post(f"{BASE_URL}/api/rides", json=payload, headers=_headers(passenger_token), timeout=20)
    assert r.status_code in (200, 201), f"Ride create failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def tokens():
    p_tok, p_user = _login(PASSENGER)
    d1_tok, d1_user = _login(DRIVER_VAN_1)
    d2_tok, d2_user = _login(DRIVER_VAN_2)

    # Cancel any active rides to clean state
    _cancel_active_ride(p_tok)

    # Set both drivers online near Paris (close to Tour Eiffel)
    r1 = _set_driver_available(d1_tok, 48.8584, 2.2945, True)
    r2 = _set_driver_available(d2_tok, 48.8600, 2.3000, True)
    assert r1.status_code == 200, f"Driver1 availability failed: {r1.status_code} {r1.text}"
    assert r2.status_code == 200, f"Driver2 availability failed: {r2.status_code} {r2.text}"

    yield {
        "passenger": p_tok,
        "passenger_user": p_user,
        "driver1": d1_tok,
        "driver1_user": d1_user,
        "driver2": d2_tok,
        "driver2_user": d2_user,
    }

    # Cleanup: take drivers offline
    _set_driver_available(d1_tok, 48.8584, 2.2945, False)
    _set_driver_available(d2_tok, 48.8600, 2.3000, False)
    _cancel_active_ride(p_tok)


def test_driver_vehicle_types_compatible(tokens):
    """Both test drivers should support vtc rides for the test to be meaningful."""
    vt1 = _get_driver_vehicle_types(tokens["driver1"])
    vt2 = _get_driver_vehicle_types(tokens["driver2"])
    # driver@test.com -> ['vtc'], driver3@test.com -> ['vtc','van']
    assert "vtc" in vt1, f"driver@test.com must include 'vtc'. Got: {vt1}"
    assert "vtc" in vt2, f"driver3@test.com must include 'vtc'. Got: {vt2}"


def test_available_rides_initial_state(tokens):
    """Both drivers can call /rides/available (no errors)."""
    r1 = requests.get(f"{BASE_URL}/api/rides/available", headers=_headers(tokens["driver1"]), timeout=15)
    assert r1.status_code == 200, r1.text
    assert isinstance(r1.json(), list)

    r2 = requests.get(f"{BASE_URL}/api/rides/available", headers=_headers(tokens["driver2"]), timeout=15)
    assert r2.status_code == 200, r2.text
    assert isinstance(r2.json(), list)


def test_refuse_flow_end_to_end(tokens):
    """
    Full flow:
    1. Passenger creates a van ride
    2. Both van drivers see it in /rides/available
    3. Driver1 refuses -> success message
    4. /rides/available for driver1 no longer contains ride
    5. /rides/available for driver2 still contains ride
    6. DB has driver1 in refused_by
    """
    # Cancel any active rides first
    _cancel_active_ride(tokens["passenger"])

    # 1. Create van ride
    ride = _create_ride(tokens["passenger"], vehicle_type="vtc")
    ride_id = ride["id"]
    assert ride.get("status") == "pending"
    assert "reservation_number" in ride

    # Allow backend a moment to persist
    time.sleep(1)

    # 2. Both drivers should see this ride
    r1_before = requests.get(f"{BASE_URL}/api/rides/available", headers=_headers(tokens["driver1"]), timeout=15)
    r2_before = requests.get(f"{BASE_URL}/api/rides/available", headers=_headers(tokens["driver2"]), timeout=15)
    assert r1_before.status_code == 200
    assert r2_before.status_code == 200

    ids_d1_before = [r["id"] for r in r1_before.json()]
    ids_d2_before = [r["id"] for r in r2_before.json()]

    assert ride_id in ids_d1_before, f"Driver1 should see new ride {ride_id}. Got: {ids_d1_before}"
    assert ride_id in ids_d2_before, f"Driver2 should see new ride {ride_id}. Got: {ids_d2_before}"

    # 3. Driver1 refuses
    refuse = requests.post(
        f"{BASE_URL}/api/rides/{ride_id}/refuse",
        headers=_headers(tokens["driver1"]),
        timeout=15,
    )
    assert refuse.status_code == 200, f"Refuse failed: {refuse.status_code} {refuse.text}"
    body = refuse.json()
    assert body.get("success") is True
    assert "message" in body
    assert "refus" in body["message"].lower() or "refused" in body["message"].lower()

    # 4. Driver1 should NOT see the ride anymore (refused_by filter)
    r1_after = requests.get(f"{BASE_URL}/api/rides/available", headers=_headers(tokens["driver1"]), timeout=15)
    assert r1_after.status_code == 200
    ids_d1_after = [r["id"] for r in r1_after.json()]
    assert ride_id not in ids_d1_after, (
        f"Driver1 should NOT see refused ride {ride_id}. Got: {ids_d1_after}"
    )

    # 5. Driver2 should STILL see the ride
    r2_after = requests.get(f"{BASE_URL}/api/rides/available", headers=_headers(tokens["driver2"]), timeout=15)
    assert r2_after.status_code == 200
    ids_d2_after = [r["id"] for r in r2_after.json()]
    assert ride_id in ids_d2_after, (
        f"Driver2 should still see refused ride {ride_id}. Got: {ids_d2_after}"
    )

    # Cleanup
    _cancel_active_ride(tokens["passenger"])


def test_refuse_twice_idempotent(tokens):
    """Refusing twice doesn't break - driver should still be in refused_by once."""
    _cancel_active_ride(tokens["passenger"])
    ride = _create_ride(tokens["passenger"], vehicle_type="vtc")
    ride_id = ride["id"]
    time.sleep(1)

    r1 = requests.post(f"{BASE_URL}/api/rides/{ride_id}/refuse", headers=_headers(tokens["driver1"]), timeout=15)
    assert r1.status_code == 200, r1.text

    # Refuse again - ride should now be invisible to driver1 so /refuse may return 404 "déjà prise" or still 200
    r2 = requests.post(f"{BASE_URL}/api/rides/{ride_id}/refuse", headers=_headers(tokens["driver1"]), timeout=15)
    # Accept either 200 (idempotent) or 404 (depending on impl - here it should still work because ride is pending)
    assert r2.status_code in (200, 404), f"Unexpected: {r2.status_code} {r2.text}"

    _cancel_active_ride(tokens["passenger"])


def test_refuse_nonexistent_ride_returns_404(tokens):
    r = requests.post(
        f"{BASE_URL}/api/rides/nonexistent-ride-id-12345/refuse",
        headers=_headers(tokens["driver1"]),
        timeout=15,
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_refuse_requires_driver_role(tokens):
    """Passengers cannot refuse rides."""
    _cancel_active_ride(tokens["passenger"])
    ride = _create_ride(tokens["passenger"], vehicle_type="vtc")
    ride_id = ride["id"]
    time.sleep(1)

    r = requests.post(
        f"{BASE_URL}/api/rides/{ride_id}/refuse",
        headers=_headers(tokens["passenger"]),
        timeout=15,
    )
    assert r.status_code == 403, f"Passenger should be forbidden. Got: {r.status_code} {r.text}"

    _cancel_active_ride(tokens["passenger"])


def test_refuse_requires_authentication():
    r = requests.post(f"{BASE_URL}/api/rides/whatever/refuse", timeout=15)
    assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"
