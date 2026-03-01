"""
Allogo Taxi App - Core Backend API Tests
Tests: Authentication, Passenger booking, Driver operations, Admin dashboard
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PASSENGER_CREDS = {"email": "passenger@test.com", "password": "password"}
DRIVER_CREDS = {"email": "driver@test.com", "password": "password"}
ADMIN_CREDS = {"email": "admin@volttaxi.com", "password": "admin123"}


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_passenger_login_success(self):
        """Test passenger login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PASSENGER_CREDS)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["role"] == "passenger"
        print(f"✅ Passenger login successful - role: {data['user']['role']}")
    
    def test_driver_login_success(self):
        """Test driver login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DRIVER_CREDS)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "driver"
        print(f"✅ Driver login successful - role: {data['user']['role']}")
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"✅ Admin login successful - role: {data['user']['role']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid credentials correctly rejected (401)")
    
    def test_auth_me_with_token(self):
        """Test /auth/me endpoint with valid token"""
        # First login
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json=PASSENGER_CREDS)
        token = login_res.json()["token"]
        
        # Then get user info
        response = requests.get(f"{BASE_URL}/api/auth/me", 
                               headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == PASSENGER_CREDS["email"]
        print(f"✅ /auth/me returned user: {data['email']}")


class TestPassengerOperations:
    """Passenger booking flow tests"""
    
    @pytest.fixture
    def passenger_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PASSENGER_CREDS)
        return response.json()["token"]
    
    def test_fare_estimate(self, passenger_token):
        """Test fare estimation endpoint"""
        response = requests.post(f"{BASE_URL}/api/rides/estimate", 
            json={
                "pickup": {"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre"},
                "destination": {"lat": 48.8738, "lng": 2.2950, "address": "Arc de Triomphe"},
                "vehicle_type": "standard",
                "passenger_count": 1
            },
            headers={"Authorization": f"Bearer {passenger_token}"})
        
        assert response.status_code == 200, f"Got {response.status_code}: {response.text}"
        data = response.json()
        assert "estimated_fare" in data
        assert "distance_km" in data
        assert "duration_minutes" in data
        assert data["estimated_fare"] > 0
        print(f"✅ Fare estimate: {data['estimated_fare']}€ for {data['distance_km']}km")
    
    def test_fare_estimate_van(self, passenger_token):
        """Test fare estimation for van with multiple passengers"""
        response = requests.post(f"{BASE_URL}/api/rides/estimate", 
            json={
                "pickup": {"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre"},
                "destination": {"lat": 48.8738, "lng": 2.2950, "address": "Arc de Triomphe"},
                "vehicle_type": "van",
                "passenger_count": 5
            },
            headers={"Authorization": f"Bearer {passenger_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert "fare_details" in data
        # Van should have supplement
        print(f"✅ Van fare estimate: {data['estimated_fare']}€ (vehicle_type: {data['vehicle_type']}, passengers: {data['passenger_count']})")
    
    def test_get_available_drivers(self, passenger_token):
        """Test fetching available drivers"""
        response = requests.get(f"{BASE_URL}/api/drivers/available",
                               headers={"Authorization": f"Bearer {passenger_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Available drivers count: {len(data)}")
    
    def test_ride_history(self, passenger_token):
        """Test fetching ride history"""
        response = requests.get(f"{BASE_URL}/api/rides/history/me",
                               headers={"Authorization": f"Bearer {passenger_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Ride history count: {len(data)}")
    
    def test_active_ride_check(self, passenger_token):
        """Test checking for active ride"""
        response = requests.get(f"{BASE_URL}/api/rides/active",
                               headers={"Authorization": f"Bearer {passenger_token}"})
        # Could be 200 with ride or None
        assert response.status_code == 200
        print(f"✅ Active ride check: {response.json()}")
    
    def test_frequent_trips(self, passenger_token):
        """Test frequent trips endpoint"""
        response = requests.get(f"{BASE_URL}/api/frequent-trips",
                               headers={"Authorization": f"Bearer {passenger_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Frequent trips count: {len(data)}")
    
    def test_scheduled_rides(self, passenger_token):
        """Test scheduled rides endpoint"""
        response = requests.get(f"{BASE_URL}/api/rides/scheduled",
                               headers={"Authorization": f"Bearer {passenger_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Scheduled rides count: {len(data)}")


class TestDriverOperations:
    """Driver operations tests"""
    
    @pytest.fixture
    def driver_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DRIVER_CREDS)
        return response.json()["token"]
    
    def test_driver_stats(self, driver_token):
        """Test driver stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/stats/driver",
                               headers={"Authorization": f"Bearer {driver_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "today_earnings" in data
        assert "total_earnings" in data
        assert "today_rides" in data
        assert "rating" in data
        print(f"✅ Driver stats: {data['today_earnings']}€ today, {data['total_rides']} total rides, rating: {data['rating']}")
    
    def test_update_availability_online(self, driver_token):
        """Test updating driver availability to online"""
        response = requests.put(f"{BASE_URL}/api/users/availability",
            json={
                "is_available": True,
                "location": {"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre"}
            },
            headers={"Authorization": f"Bearer {driver_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_available"] == True
        print(f"✅ Driver now online, location: {data.get('location', {}).get('address', 'N/A')}")
    
    def test_update_driver_location(self, driver_token):
        """Test updating driver GPS location"""
        response = requests.put(f"{BASE_URL}/api/drivers/location",
            json={"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre Updated"},
            headers={"Authorization": f"Bearer {driver_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✅ Driver location updated")
    
    def test_get_available_rides(self, driver_token):
        """Test fetching available rides"""
        response = requests.get(f"{BASE_URL}/api/rides/available",
                               headers={"Authorization": f"Bearer {driver_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Available rides count: {len(data)}")
    
    def test_driver_active_ride(self, driver_token):
        """Test checking for active ride"""
        response = requests.get(f"{BASE_URL}/api/rides/active",
                               headers={"Authorization": f"Bearer {driver_token}"})
        assert response.status_code == 200
        print(f"✅ Driver active ride check: {response.json()}")


class TestAdminOperations:
    """Admin dashboard and management tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_admin_stats_overview(self, admin_token):
        """Test admin overview statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/stats/overview",
                               headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "rides" in data
        assert "revenue" in data
        print(f"✅ Admin overview: {data['users']['total_passengers']} passengers, {data['users']['total_drivers']} drivers, {data['revenue']['total']}€ total revenue")
    
    def test_admin_driver_stats(self, admin_token):
        """Test admin driver statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/stats/drivers",
                               headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "drivers" in data
        print(f"✅ Admin driver stats: {len(data['drivers'])} drivers")
    
    def test_admin_ride_stats(self, admin_token):
        """Test admin ride statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/stats/rides?days=7",
                               headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "daily_stats" in data
        print(f"✅ Admin ride stats: {len(data['daily_stats'])} days of data")
    
    def test_admin_recent_rides(self, admin_token):
        """Test admin recent rides endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/recent-rides?limit=10",
                               headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "rides" in data
        print(f"✅ Admin recent rides: {len(data['rides'])} rides")
    
    def test_admin_non_admin_access_denied(self):
        """Test that non-admin users cannot access admin endpoints"""
        # Login as passenger
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json=PASSENGER_CREDS)
        passenger_token = login_res.json()["token"]
        
        # Try to access admin endpoint
        response = requests.get(f"{BASE_URL}/api/admin/stats/overview",
                               headers={"Authorization": f"Bearer {passenger_token}"})
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✅ Admin endpoints correctly deny non-admin access (403)")


class TestRatingsAndPayments:
    """Ratings and payment endpoints tests"""
    
    @pytest.fixture
    def passenger_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PASSENGER_CREDS)
        return response.json()["token"]
    
    def test_get_my_ratings(self, passenger_token):
        """Test getting user's ratings"""
        response = requests.get(f"{BASE_URL}/api/ratings/my-ratings",
                               headers={"Authorization": f"Bearer {passenger_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "ratings" in data
        assert "stats" in data
        print(f"✅ My ratings: {len(data['ratings'])} ratings, avg: {data['stats']['average']}")
    
    def test_get_favorite_addresses(self, passenger_token):
        """Test getting favorite addresses"""
        response = requests.get(f"{BASE_URL}/api/favorites",
                               headers={"Authorization": f"Bearer {passenger_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Favorite addresses: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
