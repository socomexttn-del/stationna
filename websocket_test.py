import asyncio
import websockets
import json
import requests
import sys
from datetime import datetime
import time

class WebSocketTester:
    def __init__(self, base_url="https://taxi-connect-47.preview.emergentagent.com"):
        self.base_url = base_url
        self.ws_base_url = base_url.replace('https://', 'wss://').replace('http://', 'ws://')
        self.passenger_token = None
        self.driver_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.received_messages = []

    def get_tokens(self):
        """Get authentication tokens for passenger and driver"""
        # Login as passenger
        try:
            response = requests.post(f"{self.base_url}/api/auth/login", 
                                   json={"email": "passenger@test.com", "password": "test123"})
            if response.status_code == 200:
                self.passenger_token = response.json()['token']
                print("✅ Passenger token obtained")
            else:
                print(f"❌ Failed to get passenger token: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error getting passenger token: {e}")
            return False

        # Login as driver
        try:
            response = requests.post(f"{self.base_url}/api/auth/login", 
                                   json={"email": "driver@test.com", "password": "test123"})
            if response.status_code == 200:
                self.driver_token = response.json()['token']
                print("✅ Driver token obtained")
            else:
                print(f"❌ Failed to get driver token: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error getting driver token: {e}")
            return False

        return True

    async def test_driver_websocket_connection(self):
        """Test WebSocket connection for driver"""
        self.tests_run += 1
        print(f"\n🔍 Testing driver WebSocket connection...")
        
        try:
            ws_url = f"{self.ws_base_url}/ws/driver/{self.driver_token}"
            
            async with websockets.connect(ws_url) as websocket:
                print("✅ Driver WebSocket connected successfully")
                
                # Send a ping message
                await websocket.send(json.dumps({"type": "ping"}))
                
                # Wait for pong response
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)
                
                if data.get("type") == "pong":
                    print("✅ Ping/Pong test passed")
                    self.tests_passed += 1
                    return True, websocket
                else:
                    print(f"❌ Expected pong, got: {data}")
                    return False, None
                    
        except asyncio.TimeoutError:
            print("❌ WebSocket connection timeout")
            return False, None
        except Exception as e:
            print(f"❌ WebSocket connection failed: {e}")
            return False, None

    async def test_passenger_websocket_connection(self):
        """Test WebSocket connection for passenger"""
        self.tests_run += 1
        print(f"\n🔍 Testing passenger WebSocket connection...")
        
        try:
            ws_url = f"{self.ws_base_url}/ws/passenger/{self.passenger_token}"
            
            async with websockets.connect(ws_url) as websocket:
                print("✅ Passenger WebSocket connected successfully")
                
                # Send a ping message
                await websocket.send(json.dumps({"type": "ping"}))
                
                # Wait for pong response
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)
                
                if data.get("type") == "pong":
                    print("✅ Ping/Pong test passed")
                    self.tests_passed += 1
                    return True, websocket
                else:
                    print(f"❌ Expected pong, got: {data}")
                    return False, None
                    
        except asyncio.TimeoutError:
            print("❌ WebSocket connection timeout")
            return False, None
        except Exception as e:
            print(f"❌ WebSocket connection failed: {e}")
            return False, None

    async def test_new_ride_notification(self):
        """Test real-time ride notifications"""
        self.tests_run += 1
        print(f"\n🔍 Testing new ride notifications...")
        
        try:
            # First set driver as available
            response = requests.put(f"{self.base_url}/api/users/availability",
                                  json={
                                      "is_available": True,
                                      "location": {"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre"}
                                  },
                                  headers={'Authorization': f'Bearer {self.driver_token}'})
            
            if response.status_code != 200:
                print("❌ Failed to set driver available")
                return False

            # Connect driver WebSocket
            driver_ws_url = f"{self.ws_base_url}/ws/driver/{self.driver_token}"
            
            async with websockets.connect(driver_ws_url) as driver_ws:
                print("✅ Driver WebSocket connected")
                
                # Create a ride from passenger - this should trigger notification to driver
                ride_response = requests.post(f"{self.base_url}/api/rides",
                                            json={
                                                "pickup": {"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre"},
                                                "destination": {"lat": 48.8738, "lng": 2.2950, "address": "Arc de Triomphe"}
                                            },
                                            headers={'Authorization': f'Bearer {self.passenger_token}'})
                
                if ride_response.status_code != 200:
                    print(f"❌ Failed to create ride: {ride_response.status_code}")
                    return False
                
                ride_data = ride_response.json()
                print(f"✅ Ride created: {ride_data['id']}")
                
                # Wait for new ride notification
                try:
                    message = await asyncio.wait_for(driver_ws.recv(), timeout=10.0)
                    notification = json.loads(message)
                    
                    if notification.get("type") == "new_ride":
                        print("✅ New ride notification received")
                        print(f"   Ride details: {notification.get('ride', {})}")
                        self.tests_passed += 1
                        return True
                    else:
                        print(f"❌ Expected new_ride notification, got: {notification}")
                        return False
                        
                except asyncio.TimeoutError:
                    print("❌ Timeout waiting for new ride notification")
                    return False
                    
        except Exception as e:
            print(f"❌ Error testing new ride notification: {e}")
            return False

    async def test_ride_acceptance_notification(self):
        """Test ride acceptance notifications to passenger"""
        self.tests_run += 1
        print(f"\n🔍 Testing ride acceptance notifications...")
        
        try:
            # Create a ride first
            ride_response = requests.post(f"{self.base_url}/api/rides",
                                        json={
                                            "pickup": {"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre"},
                                            "destination": {"lat": 48.8738, "lng": 2.2950, "address": "Arc de Triomphe"}
                                        },
                                        headers={'Authorization': f'Bearer {self.passenger_token}'})
            
            if ride_response.status_code != 200:
                print(f"❌ Failed to create ride: {ride_response.status_code}")
                return False
            
            ride_data = ride_response.json()
            ride_id = ride_data['id']
            print(f"✅ Ride created: {ride_id}")
            
            # Connect passenger WebSocket
            passenger_ws_url = f"{self.ws_base_url}/ws/passenger/{self.passenger_token}"
            
            async with websockets.connect(passenger_ws_url) as passenger_ws:
                print("✅ Passenger WebSocket connected")
                
                # Accept the ride as driver
                accept_response = requests.post(f"{self.base_url}/api/rides/{ride_id}/accept",
                                              headers={'Authorization': f'Bearer {self.driver_token}'})
                
                if accept_response.status_code != 200:
                    print(f"❌ Failed to accept ride: {accept_response.status_code}")
                    return False
                
                print("✅ Ride accepted by driver")
                
                # Wait for ride acceptance notification
                try:
                    message = await asyncio.wait_for(passenger_ws.recv(), timeout=10.0)
                    notification = json.loads(message)
                    
                    if notification.get("type") == "ride_accepted":
                        print("✅ Ride acceptance notification received")
                        print(f"   Driver: {notification.get('driver_name')}")
                        self.tests_passed += 1
                        return True
                    else:
                        print(f"❌ Expected ride_accepted notification, got: {notification}")
                        return False
                        
                except asyncio.TimeoutError:
                    print("❌ Timeout waiting for ride acceptance notification")
                    return False
                    
        except Exception as e:
            print(f"❌ Error testing ride acceptance notification: {e}")
            return False

    async def test_ride_status_updates(self):
        """Test ride status update notifications"""
        self.tests_run += 1
        print(f"\n🔍 Testing ride status update notifications...")
        
        try:
            # Create and accept a ride first
            ride_response = requests.post(f"{self.base_url}/api/rides",
                                        json={
                                            "pickup": {"lat": 48.8566, "lng": 2.3522, "address": "Paris Centre"},
                                            "destination": {"lat": 48.8738, "lng": 2.2950, "address": "Arc de Triomphe"}
                                        },
                                        headers={'Authorization': f'Bearer {self.passenger_token}'})
            
            ride_data = ride_response.json()
            ride_id = ride_data['id']
            
            # Accept the ride
            accept_response = requests.post(f"{self.base_url}/api/rides/{ride_id}/accept",
                                          headers={'Authorization': f'Bearer {self.driver_token}'})
            
            if accept_response.status_code != 200:
                print(f"❌ Failed to accept ride: {accept_response.status_code}")
                return False
            
            # Connect passenger WebSocket
            passenger_ws_url = f"{self.ws_base_url}/ws/passenger/{self.passenger_token}"
            
            async with websockets.connect(passenger_ws_url) as passenger_ws:
                print("✅ Passenger WebSocket connected")
                
                # Start the ride
                start_response = requests.post(f"{self.base_url}/api/rides/{ride_id}/start",
                                             headers={'Authorization': f'Bearer {self.driver_token}'})
                
                if start_response.status_code != 200:
                    print(f"❌ Failed to start ride: {start_response.status_code}")
                    return False
                
                print("✅ Ride started by driver")
                
                # Wait for ride start notification
                try:
                    message = await asyncio.wait_for(passenger_ws.recv(), timeout=10.0)
                    notification = json.loads(message)
                    
                    if notification.get("type") == "ride_started":
                        print("✅ Ride start notification received")
                        
                        # Complete the ride
                        complete_response = requests.post(f"{self.base_url}/api/rides/{ride_id}/complete",
                                                        headers={'Authorization': f'Bearer {self.driver_token}'})
                        
                        if complete_response.status_code != 200:
                            print(f"❌ Failed to complete ride: {complete_response.status_code}")
                            return False
                        
                        # Wait for completion notification
                        complete_message = await asyncio.wait_for(passenger_ws.recv(), timeout=10.0)
                        complete_notification = json.loads(complete_message)
                        
                        if complete_notification.get("type") == "ride_completed":
                            print("✅ Ride completion notification received")
                            print(f"   Final fare: {complete_notification.get('final_fare')}€")
                            self.tests_passed += 1
                            return True
                        else:
                            print(f"❌ Expected ride_completed notification, got: {complete_notification}")
                            return False
                        
                    else:
                        print(f"❌ Expected ride_started notification, got: {notification}")
                        return False
                        
                except asyncio.TimeoutError:
                    print("❌ Timeout waiting for ride status notifications")
                    return False
                    
        except Exception as e:
            print(f"❌ Error testing ride status updates: {e}")
            return False

    async def run_all_tests(self):
        """Run all WebSocket tests"""
        print("🔗 Starting WebSocket Tests...")
        
        # Get authentication tokens
        if not self.get_tokens():
            print("❌ Failed to get authentication tokens")
            return 1
        
        # Test WebSocket connections
        driver_success, _ = await self.test_driver_websocket_connection()
        passenger_success, _ = await self.test_passenger_websocket_connection()
        
        if not driver_success or not passenger_success:
            print("❌ WebSocket connection tests failed")
            return 1
        
        # Test real-time notifications
        await self.test_new_ride_notification()
        await self.test_ride_acceptance_notification()
        await self.test_ride_status_updates()
        
        # Print results
        print(f"\n📊 WebSocket Test Results:")
        print(f"Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All WebSocket tests passed!")
            return 0
        else:
            print("⚠️ Some WebSocket tests failed")
            return 1

def main():
    tester = WebSocketTester()
    return asyncio.run(tester.run_all_tests())

if __name__ == "__main__":
    sys.exit(main())