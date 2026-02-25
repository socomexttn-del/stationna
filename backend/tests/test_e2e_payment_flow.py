"""
E2E Test: Complete Volt Taxi Payment Flow
==========================================
Tests the full ride flow from creation to payment:
1. Passenger login and ride creation
2. Driver login, going online, and accepting ride
3. Driver starting and completing ride
4. Passenger initiating payment
5. Stripe payment intent creation
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://taxi-connect-47.preview.emergentagent.com').rstrip('/')

# Test credentials
PASSENGER_EMAIL = "passenger@test.com"
PASSENGER_PASSWORD = "password"
DRIVER_EMAIL = "driver@test.com"
DRIVER_PASSWORD = "password"

class TestE2EPaymentFlow:
    """Complete E2E test for taxi ride and payment flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.passenger_token = None
        self.driver_token = None
        self.ride_id = None
    
    def test_01_passenger_login(self):
        """Step 1: Passenger logs in"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PASSENGER_EMAIL,
            "password": PASSENGER_PASSWORD
        })
        
        assert response.status_code == 200, f"Passenger login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data["user"]["role"] == "passenger", "User is not a passenger"
        print(f"✅ Passenger login successful: {data['user']['first_name']} {data['user']['last_name']}")
        return data["token"]
    
    def test_02_driver_login(self):
        """Step 2: Driver logs in"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DRIVER_EMAIL,
            "password": DRIVER_PASSWORD
        })
        
        assert response.status_code == 200, f"Driver login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data["user"]["role"] == "driver", "User is not a driver"
        print(f"✅ Driver login successful: {data['user']['first_name']} {data['user']['last_name']}")
        return data["token"]
    
    def test_03_driver_go_online(self, driver_token=None):
        """Step 3: Driver goes online"""
        if not driver_token:
            driver_token = self.test_02_driver_login()
        
        headers = {"Authorization": f"Bearer {driver_token}"}
        
        # Set driver as available with location
        response = requests.put(f"{BASE_URL}/api/users/availability", 
            headers=headers,
            json={
                "is_available": True,
                "location": {
                    "lat": 48.8800,
                    "lng": 2.3550,
                    "address": "Gare du Nord, Paris"
                }
            }
        )
        
        assert response.status_code == 200, f"Driver availability update failed: {response.text}"
        data = response.json()
        assert data["is_available"] == True, "Driver not marked as available"
        print(f"✅ Driver is now online at: {data.get('location', {}).get('address', 'Unknown location')}")
        return driver_token
    
    def test_04_passenger_create_ride(self, passenger_token=None):
        """Step 4: Passenger creates a ride (Gare du Nord → Champs-Élysées)"""
        if not passenger_token:
            passenger_token = self.test_01_passenger_login()
        
        headers = {"Authorization": f"Bearer {passenger_token}"}
        
        # Create ride from Gare du Nord to Champs-Élysées
        ride_data = {
            "pickup": {
                "lat": 48.8809,
                "lng": 2.3553,
                "address": "Gare du Nord, Paris"
            },
            "destination": {
                "lat": 48.8738,
                "lng": 2.2950,
                "address": "Avenue des Champs-Élysées, Paris"
            },
            "vehicle_type": "standard",
            "passenger_count": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/rides", 
            headers=headers,
            json=ride_data
        )
        
        assert response.status_code == 200, f"Ride creation failed: {response.text}"
        ride = response.json()
        assert "id" in ride, "No ride ID in response"
        assert ride["status"] in ["pending", "accepted"], f"Unexpected ride status: {ride['status']}"
        print(f"✅ Ride created: {ride['id'][:8]}... Status: {ride['status']}")
        print(f"   Route: {ride['pickup']['address']} → {ride['destination']['address']}")
        print(f"   Distance: {ride['distance_km']} km, Fare: {ride['estimated_fare']}€")
        return ride["id"], passenger_token
    
    def test_05_driver_accept_ride(self, ride_id=None, driver_token=None):
        """Step 5: Driver accepts the ride (if not auto-assigned)"""
        if not driver_token:
            driver_token = self.test_03_driver_go_online()
        
        headers = {"Authorization": f"Bearer {driver_token}"}
        
        # Check for available rides first
        response = requests.get(f"{BASE_URL}/api/rides/available", headers=headers)
        assert response.status_code == 200, f"Failed to get available rides: {response.text}"
        available_rides = response.json()
        
        # If there's a pending ride, accept it
        if available_rides:
            ride_id = available_rides[0]["id"]
            response = requests.post(f"{BASE_URL}/api/rides/{ride_id}/accept", headers=headers)
            if response.status_code == 200:
                ride = response.json()
                print(f"✅ Driver accepted ride: {ride['id'][:8]}...")
                return ride["id"], driver_token
            elif response.status_code == 404:
                # Ride may have been auto-assigned
                print(f"ℹ️ Ride may have been auto-assigned to nearest driver")
        
        # Check for active ride (might have been auto-assigned)
        response = requests.get(f"{BASE_URL}/api/rides/active", headers=headers)
        if response.status_code == 200 and response.json():
            ride = response.json()
            print(f"✅ Driver has active ride: {ride['id'][:8]}... (auto-assigned)")
            return ride["id"], driver_token
        
        print("ℹ️ No ride to accept (may have been auto-assigned to another driver)")
        return None, driver_token
    
    def test_06_driver_start_ride(self, ride_id=None, driver_token=None):
        """Step 6: Driver starts the ride"""
        if not driver_token:
            driver_token = self.test_02_driver_login()
        
        headers = {"Authorization": f"Bearer {driver_token}"}
        
        # Get active ride if no ride_id provided
        if not ride_id:
            response = requests.get(f"{BASE_URL}/api/rides/active", headers=headers)
            if response.status_code == 200 and response.json():
                ride_id = response.json()["id"]
            else:
                pytest.skip("No active ride to start")
        
        response = requests.post(f"{BASE_URL}/api/rides/{ride_id}/start", headers=headers)
        
        assert response.status_code == 200, f"Failed to start ride: {response.text}"
        ride = response.json()
        assert ride["status"] == "in_progress", f"Ride status not in_progress: {ride['status']}"
        print(f"✅ Ride started: {ride['id'][:8]}... Status: {ride['status']}")
        return ride_id, driver_token
    
    def test_07_driver_complete_ride(self, ride_id=None, driver_token=None):
        """Step 7: Driver completes the ride"""
        if not driver_token:
            driver_token = self.test_02_driver_login()
        
        headers = {"Authorization": f"Bearer {driver_token}"}
        
        # Get active ride if no ride_id provided
        if not ride_id:
            response = requests.get(f"{BASE_URL}/api/rides/active", headers=headers)
            if response.status_code == 200 and response.json():
                ride = response.json()
                ride_id = ride["id"]
                # If ride is accepted but not started, start it first
                if ride["status"] == "accepted":
                    response = requests.post(f"{BASE_URL}/api/rides/{ride_id}/start", headers=headers)
                    assert response.status_code == 200, f"Failed to start ride: {response.text}"
                    print(f"✅ Ride started first: {ride_id[:8]}...")
            else:
                pytest.skip("No active ride to complete")
        
        response = requests.post(f"{BASE_URL}/api/rides/{ride_id}/complete", headers=headers)
        
        assert response.status_code == 200, f"Failed to complete ride: {response.text}"
        ride = response.json()
        assert ride["status"] == "completed", f"Ride status not completed: {ride['status']}"
        assert ride["final_fare"] is not None, "No final fare set"
        print(f"✅ Ride completed: {ride['id'][:8]}...")
        print(f"   Final fare: {ride['final_fare']}€")
        print(f"   Payment status: {ride['payment_status']}")
        return ride_id, driver_token, ride["final_fare"]
    
    def test_08_passenger_initiate_payment(self, ride_id=None, passenger_token=None):
        """Step 8: Passenger initiates payment with Stripe"""
        if not passenger_token:
            passenger_token = self.test_01_passenger_login()
        
        headers = {"Authorization": f"Bearer {passenger_token}"}
        
        # Get ride info to find a completed ride that needs payment
        response = requests.get(f"{BASE_URL}/api/rides/history/me", headers=headers)
        assert response.status_code == 200, f"Failed to get ride history: {response.text}"
        
        rides = response.json()
        completed_unpaid_ride = None
        for ride in rides:
            if ride["status"] == "completed" and ride.get("payment_status") != "paid":
                completed_unpaid_ride = ride
                break
        
        if not completed_unpaid_ride and ride_id:
            # Get specific ride
            response = requests.get(f"{BASE_URL}/api/rides/{ride_id}", headers=headers)
            if response.status_code == 200:
                completed_unpaid_ride = response.json()
        
        if not completed_unpaid_ride:
            pytest.skip("No completed unpaid ride to pay for")
        
        ride_id = completed_unpaid_ride["id"]
        
        # Create payment intent
        response = requests.post(f"{BASE_URL}/api/payments/create-payment-intent",
            headers=headers,
            json={"ride_id": ride_id}
        )
        
        assert response.status_code == 200, f"Failed to create payment intent: {response.text}"
        payment_data = response.json()
        assert "client_secret" in payment_data, "No client_secret in response"
        assert "payment_intent_id" in payment_data, "No payment_intent_id in response"
        assert "amount" in payment_data, "No amount in response"
        assert "publishable_key" in payment_data, "No publishable_key in response"
        
        print(f"✅ Payment intent created:")
        print(f"   Amount: {payment_data['amount']}€")
        print(f"   Currency: {payment_data['currency']}")
        print(f"   Publishable key: {payment_data['publishable_key']}")
        print(f"   Client secret starts with: {payment_data['client_secret'][:20]}...")
        
        return payment_data
    
    def test_full_e2e_flow(self):
        """Full E2E test running all steps in sequence"""
        print("\n" + "="*60)
        print("E2E Payment Flow Test - Volt Taxi")
        print("="*60 + "\n")
        
        # Step 1: Passenger login
        print("--- Step 1: Passenger Login ---")
        passenger_token = self.test_01_passenger_login()
        
        # Step 2: Driver login
        print("\n--- Step 2: Driver Login ---")
        driver_token = self.test_02_driver_login()
        
        # Step 3: Driver goes online
        print("\n--- Step 3: Driver Goes Online ---")
        driver_token = self.test_03_driver_go_online(driver_token)
        
        # Step 4: Passenger creates ride
        print("\n--- Step 4: Passenger Creates Ride ---")
        ride_id, passenger_token = self.test_04_passenger_create_ride(passenger_token)
        
        # Small delay for ride assignment
        time.sleep(1)
        
        # Step 5: Driver accepts ride (if needed)
        print("\n--- Step 5: Driver Accepts Ride ---")
        ride_id, driver_token = self.test_05_driver_accept_ride(ride_id, driver_token)
        
        if not ride_id:
            # Get active ride for this driver
            headers = {"Authorization": f"Bearer {driver_token}"}
            response = requests.get(f"{BASE_URL}/api/rides/active", headers=headers)
            if response.status_code == 200 and response.json():
                ride_id = response.json()["id"]
        
        # Step 6: Driver starts ride
        print("\n--- Step 6: Driver Starts Ride ---")
        if ride_id:
            ride_id, driver_token = self.test_06_driver_start_ride(ride_id, driver_token)
        
        # Step 7: Driver completes ride
        print("\n--- Step 7: Driver Completes Ride ---")
        if ride_id:
            ride_id, driver_token, final_fare = self.test_07_driver_complete_ride(ride_id, driver_token)
        
        # Step 8: Passenger initiates payment
        print("\n--- Step 8: Passenger Initiates Payment ---")
        payment_data = self.test_08_passenger_initiate_payment(ride_id, passenger_token)
        
        print("\n" + "="*60)
        print("✅ E2E Flow Test COMPLETED SUCCESSFULLY")
        print("="*60 + "\n")
        
        return {
            "ride_id": ride_id,
            "final_fare": final_fare,
            "payment_data": payment_data
        }


class TestAPIEndpoints:
    """Test individual API endpoints related to payment flow"""
    
    def test_fare_estimate(self):
        """Test fare estimation endpoint"""
        response = requests.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": {
                "lat": 48.8809,
                "lng": 2.3553,
                "address": "Gare du Nord, Paris"
            },
            "destination": {
                "lat": 48.8738,
                "lng": 2.2950,
                "address": "Avenue des Champs-Élysées, Paris"
            },
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        
        assert response.status_code == 200, f"Fare estimate failed: {response.text}"
        data = response.json()
        assert "estimated_fare" in data, "No estimated_fare in response"
        assert "distance_km" in data, "No distance_km in response"
        assert "fare_details" in data, "No fare_details in response"
        print(f"✅ Fare estimate: {data['estimated_fare']}€ for {data['distance_km']} km")
        print(f"   Details: Prise en charge: {data['fare_details']['prise_en_charge']}€")
        print(f"   Distance cost: {data['fare_details']['distance_cost']}€")
    
    def test_available_drivers(self):
        """Test available drivers endpoint"""
        # Login as passenger first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PASSENGER_EMAIL,
            "password": PASSENGER_PASSWORD
        })
        token = login_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/drivers/available", headers=headers)
        
        assert response.status_code == 200, f"Failed to get available drivers: {response.text}"
        drivers = response.json()
        print(f"✅ Found {len(drivers)} available drivers")
        for driver in drivers[:3]:  # Show first 3
            print(f"   - {driver['first_name']} {driver['last_name']} (Rating: {driver['rating']})")
    
    def test_payment_history(self):
        """Test payment history endpoint"""
        # Login as passenger
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PASSENGER_EMAIL,
            "password": PASSENGER_PASSWORD
        })
        token = login_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/payments/history", headers=headers)
        
        assert response.status_code == 200, f"Failed to get payment history: {response.text}"
        data = response.json()
        print(f"✅ Payment history retrieved: {len(data.get('payments', []))} payments")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
