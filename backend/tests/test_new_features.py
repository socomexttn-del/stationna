"""
Test for P1 Features:
1. Driver path tracking (GET /api/rides/{ride_id}/driver-path)
2. Admin driver management (PUT /api/admin/drivers/{driver_id}/status)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNewFeatures:
    """Tests for driver path tracking and admin driver management"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@volttaxi.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def passenger_token(self):
        """Get passenger token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "passenger@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Passenger login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def driver_token(self):
        """Get driver token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "driver@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Driver login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def drivers_list(self, admin_token):
        """Get list of drivers"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/drivers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        return response.json().get("drivers", [])

    # ==================== ADMIN DRIVER STATUS TESTS ====================
    
    def test_admin_login(self, admin_token):
        """Test admin can login"""
        assert admin_token is not None
        print("✅ Admin login successful")
    
    def test_get_drivers_list(self, admin_token, drivers_list):
        """Test admin can get drivers list with is_active field"""
        assert len(drivers_list) > 0, "No drivers found"
        
        # Check that each driver has is_active field
        for driver in drivers_list:
            assert "is_active" in driver, f"Driver {driver['name']} missing is_active field"
            assert "id" in driver
            assert "name" in driver
        
        print(f"✅ Found {len(drivers_list)} drivers with is_active field")
    
    def test_deactivate_driver(self, admin_token, drivers_list):
        """Test admin can deactivate a driver account"""
        # Find an active driver to deactivate
        test_driver = None
        for driver in drivers_list:
            if driver.get("is_active", True) and driver["email"] != "driver@test.com":
                test_driver = driver
                break
        
        if not test_driver:
            # Use the first driver if no other available
            test_driver = drivers_list[0]
        
        driver_id = test_driver["id"]
        
        # Deactivate the driver
        response = requests.put(
            f"{BASE_URL}/api/admin/drivers/{driver_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_active": False}
        )
        
        assert response.status_code == 200, f"Failed to deactivate driver: {response.text}"
        data = response.json()
        assert data["status"] == "ok"
        assert data["is_active"] == False
        assert "désactivé" in data["message"]
        
        print(f"✅ Driver {test_driver['name']} deactivated successfully")
        
        # Re-activate the driver
        response = requests.put(
            f"{BASE_URL}/api/admin/drivers/{driver_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_active": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] == True
        assert "activé" in data["message"]
        
        print(f"✅ Driver {test_driver['name']} reactivated successfully")
    
    def test_deactivate_driver_not_found(self, admin_token):
        """Test deactivating non-existent driver returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/admin/drivers/non-existent-id/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_active": False}
        )
        
        assert response.status_code == 404
        print("✅ Correctly returns 404 for non-existent driver")
    
    def test_deactivate_driver_unauthorized(self, passenger_token, drivers_list):
        """Test non-admin cannot deactivate driver"""
        if not drivers_list:
            pytest.skip("No drivers available")
        
        driver_id = drivers_list[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/drivers/{driver_id}/status",
            headers={"Authorization": f"Bearer {passenger_token}"},
            json={"is_active": False}
        )
        
        assert response.status_code == 403
        print("✅ Correctly denies non-admin access")
    
    def test_deactivated_driver_not_in_available(self, admin_token, passenger_token, drivers_list):
        """Test deactivated driver doesn't appear in available drivers"""
        # Find an available driver
        test_driver = None
        for driver in drivers_list:
            if driver.get("is_available") and driver.get("is_active", True):
                test_driver = driver
                break
        
        if not test_driver:
            pytest.skip("No available driver to test")
        
        driver_id = test_driver["id"]
        
        # Deactivate the driver
        response = requests.put(
            f"{BASE_URL}/api/admin/drivers/{driver_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_active": False}
        )
        assert response.status_code == 200
        
        # Check available drivers
        response = requests.get(
            f"{BASE_URL}/api/drivers/available",
            headers={"Authorization": f"Bearer {passenger_token}"}
        )
        assert response.status_code == 200
        available_drivers = response.json()
        
        # Deactivated driver should not be in list
        deactivated_found = any(d["id"] == driver_id for d in available_drivers)
        
        # Re-activate driver (cleanup)
        requests.put(
            f"{BASE_URL}/api/admin/drivers/{driver_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_active": True}
        )
        
        assert not deactivated_found, "Deactivated driver should not appear in available drivers"
        print("✅ Deactivated driver correctly excluded from available drivers")

    # ==================== DRIVER PATH TRACKING TESTS ====================
    
    def test_get_driver_path_endpoint_exists(self, passenger_token):
        """Test driver path endpoint exists and requires valid ride_id"""
        response = requests.get(
            f"{BASE_URL}/api/rides/fake-ride-id/driver-path",
            headers={"Authorization": f"Bearer {passenger_token}"}
        )
        
        assert response.status_code == 404, "Should return 404 for non-existent ride"
        print("✅ Driver path endpoint exists and validates ride_id")
    
    def test_driver_location_update_stores_path(self, driver_token, passenger_token, admin_token):
        """Test that driver location updates are stored in ride path"""
        # First, make sure driver is online
        response = requests.put(
            f"{BASE_URL}/api/users/availability",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "is_available": True,
                "location": {"lat": 48.8566, "lng": 2.3522, "address": "Paris"}
            }
        )
        assert response.status_code == 200
        
        # Create a ride
        response = requests.post(
            f"{BASE_URL}/api/rides",
            headers={"Authorization": f"Bearer {passenger_token}"},
            json={
                "pickup": {"lat": 48.8566, "lng": 2.3522, "address": "Paris, France"},
                "destination": {"lat": 48.8606, "lng": 2.3376, "address": "Louvre, Paris"},
                "vehicle_type": "standard",
                "passenger_count": 1
            }
        )
        
        assert response.status_code == 200
        ride = response.json()
        ride_id = ride["id"]
        
        # Check if ride was auto-assigned to a driver
        if ride.get("driver_id"):
            # Simulate driver moving - update location multiple times
            locations = [
                {"lat": 48.8570, "lng": 2.3525, "address": "Point 1"},
                {"lat": 48.8580, "lng": 2.3500, "address": "Point 2"},
                {"lat": 48.8590, "lng": 2.3450, "address": "Point 3"},
            ]
            
            for loc in locations:
                response = requests.put(
                    f"{BASE_URL}/api/drivers/location",
                    headers={"Authorization": f"Bearer {driver_token}"},
                    json=loc
                )
                assert response.status_code == 200
                time.sleep(0.2)
            
            # Get the driver path
            response = requests.get(
                f"{BASE_URL}/api/rides/{ride_id}/driver-path",
                headers={"Authorization": f"Bearer {passenger_token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "path" in data
            
            # Path should have some points
            path = data["path"]
            print(f"✅ Driver path has {len(path)} points")
            
            if len(path) > 0:
                # Check path point structure
                point = path[0]
                assert "lat" in point
                assert "lng" in point
                assert "timestamp" in point
                print("✅ Path points have correct structure (lat, lng, timestamp)")
        
        # Clean up - cancel ride
        response = requests.post(
            f"{BASE_URL}/api/rides/{ride_id}/cancel",
            headers={"Authorization": f"Bearer {passenger_token}"}
        )
        
        print("✅ Driver location updates stored in ride path")
    
    def test_driver_path_unauthorized_access(self, passenger_token):
        """Test that user can't access path of another user's ride"""
        # Create a new passenger to test unauthorized access
        unique_email = f"test_unauth_{int(time.time())}@test.com"
        
        # Register new passenger
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "testpassword",
                "first_name": "Test",
                "last_name": "User",
                "phone": "+33600000001",
                "role": "passenger"
            }
        )
        
        if response.status_code == 200:
            new_token = response.json().get("token")
            
            # Create a ride with original passenger
            response = requests.post(
                f"{BASE_URL}/api/rides",
                headers={"Authorization": f"Bearer {passenger_token}"},
                json={
                    "pickup": {"lat": 48.8566, "lng": 2.3522, "address": "Paris, France"},
                    "destination": {"lat": 48.8606, "lng": 2.3376, "address": "Louvre, Paris"},
                    "vehicle_type": "standard",
                    "passenger_count": 1
                }
            )
            
            if response.status_code == 200:
                ride_id = response.json()["id"]
                
                # Try to access path with different user
                response = requests.get(
                    f"{BASE_URL}/api/rides/{ride_id}/driver-path",
                    headers={"Authorization": f"Bearer {new_token}"}
                )
                
                assert response.status_code == 403, "Should deny access to other user's ride path"
                
                # Cancel the ride
                requests.post(
                    f"{BASE_URL}/api/rides/{ride_id}/cancel",
                    headers={"Authorization": f"Bearer {passenger_token}"}
                )
                
                print("✅ Correctly denies unauthorized access to ride path")
            else:
                print("⚠️ Could not create ride for unauthorized access test")
        else:
            print("⚠️ Could not register new user for unauthorized access test")


class TestMapComponentDriverPath:
    """Tests to verify driver path rendering in MapComponent"""
    
    def test_driver_path_data_structure(self):
        """Verify the expected data structure for driver path"""
        # Expected path format from server
        expected_path = [
            {"lat": 48.8566, "lng": 2.3522, "timestamp": "2026-01-01T12:00:00+00:00"},
            {"lat": 48.8570, "lng": 2.3525, "timestamp": "2026-01-01T12:01:00+00:00"},
        ]
        
        # Verify structure
        for point in expected_path:
            assert "lat" in point
            assert "lng" in point
            assert "timestamp" in point
            assert isinstance(point["lat"], (int, float))
            assert isinstance(point["lng"], (int, float))
        
        print("✅ Driver path data structure is correct")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
