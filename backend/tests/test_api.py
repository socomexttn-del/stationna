"""
Tests for StationCab API
Run with: pytest /app/backend/tests/ -v
"""
import pytest
import httpx
import os

# Get API URL from environment or use default
API_URL = os.environ.get('API_URL', 'http://localhost:8001/api')

# Test credentials
ADMIN_EMAIL = "admin@volttaxi.com"
ADMIN_PASSWORD = "admin123"
TEST_PASSENGER_EMAIL = "passenger@test.com"
TEST_PASSENGER_PASSWORD = "password"
TEST_DRIVER_EMAIL = "driver@test.com"
TEST_DRIVER_PASSWORD = "password"


def get_token(email, password):
    """Helper to get auth token synchronously"""
    with httpx.Client() as client:
        response = client.post(
            f"{API_URL}/auth/login",
            json={"email": email, "password": password}
        )
        if response.status_code == 200:
            return response.json()["token"]
        return None


class TestAuth:
    """Test authentication endpoints"""
    
    def test_login_admin(self):
        """Test admin login"""
        with httpx.Client() as client:
            response = client.post(
                f"{API_URL}/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            assert response.status_code == 200
            data = response.json()
            assert "token" in data
            assert data["user"]["role"] == "admin"
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        with httpx.Client() as client:
            response = client.post(
                f"{API_URL}/auth/login",
                json={"email": ADMIN_EMAIL, "password": "wrongpassword"}
            )
            assert response.status_code == 401
    
    def test_login_passenger(self):
        """Test passenger login"""
        with httpx.Client() as client:
            response = client.post(
                f"{API_URL}/auth/login",
                json={"email": TEST_PASSENGER_EMAIL, "password": TEST_PASSENGER_PASSWORD}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["user"]["role"] == "passenger"
    
    def test_login_driver(self):
        """Test driver login"""
        with httpx.Client() as client:
            response = client.post(
                f"{API_URL}/auth/login",
                json={"email": TEST_DRIVER_EMAIL, "password": TEST_DRIVER_PASSWORD}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["user"]["role"] == "driver"


class TestRides:
    """Test ride endpoints"""
    
    def test_fare_estimate(self):
        """Test fare estimation"""
        token = get_token(TEST_PASSENGER_EMAIL, TEST_PASSENGER_PASSWORD)
        assert token is not None
        
        with httpx.Client() as client:
            response = client.post(
                f"{API_URL}/rides/estimate",
                json={
                    "pickup": {"address": "Paris", "lat": 48.8566, "lng": 2.3522},
                    "destination": {"address": "Orly", "lat": 48.7262, "lng": 2.3652},
                    "vehicle_type": "standard",
                    "passenger_count": 1
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
            data = response.json()
            # Check for fare estimation in response
            assert "estimated_fare" in data or "standard" in data
            if "estimated_fare" in data:
                assert data["estimated_fare"] > 0
            else:
                assert data["standard"]["estimated_fare"] > 0
    
    def test_get_active_ride(self):
        """Test getting active ride"""
        token = get_token(TEST_PASSENGER_EMAIL, TEST_PASSENGER_PASSWORD)
        assert token is not None
        
        with httpx.Client() as client:
            response = client.get(
                f"{API_URL}/rides/active",
                headers={"Authorization": f"Bearer {token}"}
            )
            # May return 200 with null or 404
            assert response.status_code in [200, 404]


class TestAdmin:
    """Test admin endpoints"""
    
    def test_admin_overview(self):
        """Test admin overview endpoint"""
        token = get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None
        
        with httpx.Client() as client:
            response = client.get(
                f"{API_URL}/admin/stats/overview",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "users" in data
            assert "rides" in data
            assert "revenue" in data
    
    def test_admin_drivers_list(self):
        """Test getting drivers list"""
        token = get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None
        
        with httpx.Client() as client:
            response = client.get(
                f"{API_URL}/admin/drivers",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "drivers" in data
    
    def test_admin_weekly_summary(self):
        """Test driver weekly summary"""
        token = get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None
        
        with httpx.Client() as client:
            response = client.get(
                f"{API_URL}/admin/drivers/weekly-summary?week_offset=-1",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "week_start" in data
            assert "totals" in data


class TestPayments:
    """Test payment endpoints"""
    
    def test_saved_card(self):
        """Test checking saved card"""
        token = get_token(TEST_PASSENGER_EMAIL, TEST_PASSENGER_PASSWORD)
        assert token is not None
        
        with httpx.Client() as client:
            response = client.get(
                f"{API_URL}/payments/saved-card",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "has_card" in data


class TestHealth:
    """Test health/status endpoints"""
    
    def test_root_endpoint(self):
        """Test root endpoint"""
        with httpx.Client() as client:
            response = client.get(f"{API_URL}/")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "running"


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
