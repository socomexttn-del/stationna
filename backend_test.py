import requests
import sys
from datetime import datetime
import time

class TaxiAPITester:
    def __init__(self, base_url="https://taxi-connect-47.preview.emergentagent.com"):
        self.base_url = base_url
        self.passenger_token = None
        self.driver_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_ride_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.text}")
                except:
                    pass
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_login(self, email, password, role_type="passenger"):
        """Test login and get token"""
        success, response = self.run_test(
            f"Login as {role_type}",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            if role_type == "passenger":
                self.passenger_token = response['token']
            else:
                self.driver_token = response['token']
            return True, response
        return False, {}

    def test_register(self, email, password, first_name, last_name, phone, role):
        """Test user registration"""
        success, response = self.run_test(
            f"Register {role}",
            "POST",
            "auth/register",
            200,
            data={
                "email": email, 
                "password": password,
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone,
                "role": role
            }
        )
        return success, response

    def test_get_me(self, token, role_type):
        """Test getting current user info"""
        success, response = self.run_test(
            f"Get {role_type} profile",
            "GET",
            "auth/me",
            200,
            token=token
        )
        return success, response

    def test_ride_estimate(self):
        """Test ride fare estimation"""
        success, response = self.run_test(
            "Ride fare estimation",
            "POST",
            "rides/estimate",
            200,
            data={
                "pickup": {"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre"},
                "destination": {"lat": 48.8738, "lng": 2.2950, "address": "Arc de Triomphe"}
            }
        )
        return success, response

    def test_create_ride(self, token):
        """Test creating a ride as passenger"""
        success, response = self.run_test(
            "Create ride",
            "POST",
            "rides",
            200,
            data={
                "pickup": {"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre"},
                "destination": {"lat": 48.8738, "lng": 2.2950, "address": "Arc de Triomphe"}
            },
            token=token
        )
        if success and 'id' in response:
            self.test_ride_id = response['id']
        return success, response

    def test_driver_availability(self, token, available=True):
        """Test updating driver availability"""
        success, response = self.run_test(
            f"Set driver availability to {available}",
            "PUT",
            "users/availability",
            200,
            data={
                "is_available": available,
                "location": {"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre"}
            },
            token=token
        )
        return success, response

    def test_available_rides(self, token):
        """Test getting available rides for driver"""
        success, response = self.run_test(
            "Get available rides",
            "GET",
            "rides/available",
            200,
            token=token
        )
        return success, response

    def test_accept_ride(self, ride_id, token):
        """Test accepting a ride as driver"""
        success, response = self.run_test(
            "Accept ride",
            "POST",
            f"rides/{ride_id}/accept",
            200,
            token=token
        )
        return success, response

    def test_start_ride(self, ride_id, token):
        """Test starting a ride as driver"""
        success, response = self.run_test(
            "Start ride",
            "POST",
            f"rides/{ride_id}/start",
            200,
            token=token
        )
        return success, response

    def test_complete_ride(self, ride_id, token):
        """Test completing a ride as driver"""
        success, response = self.run_test(
            "Complete ride",
            "POST",
            f"rides/{ride_id}/complete",
            200,
            token=token
        )
        return success, response

    def test_ride_history(self, token, role_type):
        """Test getting ride history"""
        success, response = self.run_test(
            f"Get {role_type} ride history",
            "GET",
            "rides/history/me",
            200,
            token=token
        )
        return success, response

    def test_driver_stats(self, token):
        """Test getting driver statistics"""
        success, response = self.run_test(
            "Get driver stats",
            "GET",
            "stats/driver",
            200,
            token=token
        )
        return success, response

    def test_vehicle_update(self, token):
        """Test updating vehicle information"""
        success, response = self.run_test(
            "Update vehicle info",
            "PUT",
            "users/vehicle",
            200,
            data={
                "make": "Toyota",
                "model": "Prius",
                "year": 2022,
                "color": "White",
                "license_plate": "AB-123-CD"
            },
            token=token
        )
        return success, response

    def test_driver_location_update(self, token):
        """Test driver GPS location update"""
        success, response = self.run_test(
            "Driver location update",
            "PUT",
            "drivers/location",
            200,
            data={
                "lat": 48.8566,
                "lng": 2.3522,
                "address": "Paris Centre - GPS Location"
            },
            token=token
        )
        return success, response

    def test_get_driver_location_for_ride(self, ride_id, token):
        """Test getting driver location for a specific ride"""
        success, response = self.run_test(
            "Get driver location for ride",
            "GET",
            f"rides/{ride_id}/driver-location",
            200,
            token=token
        )
        return success, response

    def test_notifications(self, token, role_type):
        """Test getting notifications"""
        success, response = self.run_test(
            f"Get {role_type} notifications",
            "GET",
            "notifications",
            200,
            token=token
        )
        return success, response

    def test_send_chat_message(self, ride_id, message, token):
        """Test sending a chat message"""
        success, response = self.run_test(
            "Send chat message",
            "POST",
            "chat/send",
            200,
            data={
                "ride_id": ride_id,
                "message": message
            },
            token=token
        )
        return success, response

    def test_get_chat_messages(self, ride_id, token):
        """Test getting chat messages for a ride"""
        success, response = self.run_test(
            "Get chat messages",
            "GET",
            f"chat/{ride_id}",
            200,
            token=token
        )
        return success, response

    def test_get_unread_message_count(self, ride_id, token):
        """Test getting unread message count"""
        success, response = self.run_test(
            "Get unread message count",
            "GET",
            f"chat/{ride_id}/unread-count",
            200,
            token=token
        )
        return success, response

    def test_mark_messages_read(self, ride_id, token):
        """Test marking messages as read"""
        success, response = self.run_test(
            "Mark messages as read",
            "POST",
            f"chat/{ride_id}/mark-read",
            200,
            token=token
        )
        return success, response

    def test_chat_unauthorized_access(self, ride_id, token):
        """Test that users can't access chat for rides they're not part of"""
        # This should fail with 403
        success, response = self.run_test(
            "Chat unauthorized access",
            "GET",
            f"chat/{ride_id}",
            403,
            token=token
        )
        return success, response

    def test_chat_inactive_ride(self, token):
        """Test that chat is only available during active rides"""
        # Create a fake ride ID that doesn't exist or is not active
        fake_ride_id = "fake-ride-id-12345"
        success, response = self.run_test(
            "Chat on inactive/non-existent ride",
            "POST",
            "chat/send",
            404,  # Should return 404 for non-existent ride
            data={
                "ride_id": fake_ride_id,
                "message": "This should fail"
            },
            token=token
        )
        return success, response

def main():
    print("🚕 Starting Volt Taxi API Tests...")
    tester = TaxiAPITester()
    
    # Test credentials from the requirements
    passenger_email = "passenger@test.com"
    passenger_password = "test123"
    driver_email = "driver@test.com"
    driver_password = "test123"

    # Test basic endpoints first
    print("\n=== BASIC ENDPOINT TESTS ===")
    
    # Test root endpoint
    tester.run_test("Root endpoint", "GET", "", 200)
    
    # Test ride estimation (no auth required)
    tester.test_ride_estimate()

    print("\n=== AUTHENTICATION TESTS ===")
    
    # Test passenger login
    passenger_login_success, passenger_data = tester.test_login(passenger_email, passenger_password, "passenger")
    if not passenger_login_success:
        print("❌ Passenger login failed - stopping passenger tests")
        passenger_data = {}

    # Test driver login  
    driver_login_success, driver_data = tester.test_login(driver_email, driver_password, "driver")
    if not driver_login_success:
        print("❌ Driver login failed - stopping driver tests")
        driver_data = {}

    # Test profile retrieval
    if passenger_login_success:
        tester.test_get_me(tester.passenger_token, "passenger")
    
    if driver_login_success:
        tester.test_get_me(tester.driver_token, "driver")

    print("\n=== RIDE WORKFLOW TESTS ===")
    
    # Test passenger ride creation
    if passenger_login_success:
        tester.test_create_ride(tester.passenger_token)
    
    # Test driver functionality
    if driver_login_success:
        # Set driver as available
        tester.test_driver_availability(tester.driver_token, True)
        
        # Get available rides
        tester.test_available_rides(tester.driver_token)
        
        # Test accepting ride if one was created
        if tester.test_ride_id:
            print(f"\n🔄 Testing ride workflow with ride ID: {tester.test_ride_id}")
            
            # Accept the ride
            accept_success, _ = tester.test_accept_ride(tester.test_ride_id, tester.driver_token)
            
            if accept_success:
                print(f"\n💬 Testing chat during accepted ride status...")
                
                # Test chat during accepted phase
                passenger_msg_success, _ = tester.test_send_chat_message(
                    tester.test_ride_id, 
                    "Bonjour, je suis en route vers le point de rendez-vous", 
                    tester.passenger_token
                )
                
                driver_msg_success, _ = tester.test_send_chat_message(
                    tester.test_ride_id,
                    "Parfait, je vous attends. Voiture blanche Toyota Prius",
                    tester.driver_token
                )
                
                # Test getting messages
                if passenger_msg_success:
                    tester.test_get_chat_messages(tester.test_ride_id, tester.passenger_token)
                    tester.test_get_chat_messages(tester.test_ride_id, tester.driver_token)
                
                # Start the ride
                time.sleep(1)
                start_success, _ = tester.test_start_ride(tester.test_ride_id, tester.driver_token)
                
                if start_success:
                    print(f"\n💬 Testing chat during in_progress ride status...")
                    
                    # Test more chat during in_progress phase
                    tester.test_send_chat_message(
                        tester.test_ride_id,
                        "Course démarrée, nous arrivons bientôt!",
                        tester.driver_token
                    )
                    
                    tester.test_send_chat_message(
                        tester.test_ride_id,
                        "Merci, j'ai hâte d'arriver",
                        tester.passenger_token
                    )
                    
                    # Complete the ride
                    time.sleep(1)
                    tester.test_complete_ride(tester.test_ride_id, tester.driver_token)

    print("\n=== GPS LOCATION TRACKING TESTS ===")
    
    # Test driver location updates (key GPS feature)
    if driver_login_success:
        print("\n🌍 Testing GPS location updates...")
        tester.test_driver_location_update(tester.driver_token)
        
        # Test getting driver location for ride
        if tester.test_ride_id:
            tester.test_get_driver_location_for_ride(tester.test_ride_id, tester.passenger_token)
    
    # Test notification system for location updates
    if passenger_login_success:
        tester.test_notifications(tester.passenger_token, "passenger")
    
    if driver_login_success:
        tester.test_notifications(tester.driver_token, "driver")
        
    print("\n=== CHAT FUNCTIONALITY TESTS ===")
    
    # Test chat functionality during active ride
    if driver_login_success and tester.test_ride_id:
        print(f"\n💬 Testing chat functionality with ride ID: {tester.test_ride_id}")
        
        # Test chat during accepted ride status
        print("\n📨 Testing chat during accepted ride...")
        
        # Passenger sends message
        passenger_msg_success, _ = tester.test_send_chat_message(
            tester.test_ride_id, 
            "Bonjour, je suis en route vers le point de rendez-vous", 
            tester.passenger_token
        )
        
        # Driver sends reply  
        driver_msg_success, _ = tester.test_send_chat_message(
            tester.test_ride_id,
            "Parfait, je vous attends. Voiture blanche Toyota Prius",
            tester.driver_token
        )
        
        # Test getting messages for both users
        if passenger_msg_success:
            tester.test_get_chat_messages(tester.test_ride_id, tester.passenger_token)
            tester.test_get_chat_messages(tester.test_ride_id, tester.driver_token)
        
        # Test unread message count
        tester.test_get_unread_message_count(tester.test_ride_id, tester.passenger_token)
        tester.test_get_unread_message_count(tester.test_ride_id, tester.driver_token)
        
        # Test marking messages as read
        tester.test_mark_messages_read(tester.test_ride_id, tester.passenger_token)
        tester.test_mark_messages_read(tester.test_ride_id, tester.driver_token)
    
    # Test unauthorized chat access
    print("\n🔒 Testing chat access control...")
    if passenger_login_success and tester.test_ride_id:
        # Test chat on inactive ride (should fail)
        tester.test_chat_inactive_ride(tester.passenger_token)

    print("\n=== ADDITIONAL FEATURE TESTS ===")
    
    # Test ride history for both users
    if passenger_login_success:
        tester.test_ride_history(tester.passenger_token, "passenger")
    
    if driver_login_success:
        tester.test_ride_history(tester.driver_token, "driver")
        tester.test_driver_stats(tester.driver_token)
        tester.test_vehicle_update(tester.driver_token)

    # Print final results
    print(f"\n📊 Final Results:")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())