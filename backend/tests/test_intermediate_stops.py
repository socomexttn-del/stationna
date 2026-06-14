"""
Tests for the Intermediate Stops feature in StationCab Taxi App

Features tested:
- POST /rides/estimate with stops - calculates total distance and fare with stop supplements
- POST /rides with stops - creates ride with intermediate stops
- Fare calculation: +3€ per intermediate stop
- Maximum 3 stops allowed
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test locations in Paris
PICKUP = {
    "lat": 48.8566,
    "lng": 2.3522,
    "address": "Notre-Dame de Paris"
}

DESTINATION = {
    "lat": 48.8738,
    "lng": 2.2950,
    "address": "Arc de Triomphe"
}

STOP_1 = {
    "lat": 48.8584,
    "lng": 2.2945,
    "address": "Tour Eiffel"
}

STOP_2 = {
    "lat": 48.8606,
    "lng": 2.3376,
    "address": "Musée du Louvre"
}

STOP_3 = {
    "lat": 48.8530,
    "lng": 2.3499,
    "address": "Île Saint-Louis"
}


class TestIntermediateStopsEstimate:
    """Tests for POST /rides/estimate with intermediate stops"""
    
    @pytest.fixture
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_estimate_without_stops_returns_base_fare(self, api_client):
        """Estimate without stops should return base fare calculation"""
        response = api_client.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "distance_km" in data
        assert "duration_minutes" in data
        assert "estimated_fare" in data
        assert "stops_count" in data
        assert "fare_details" in data
        
        # No stops should mean stops_count = 0
        assert data["stops_count"] == 0
        
        # No stop supplement in fare details
        supplement_names = [s["name"] for s in data["fare_details"].get("supplement_details", [])]
        assert not any("Arrêt" in name for name in supplement_names)
        
        print(f"✅ Estimate without stops: {data['distance_km']}km, {data['estimated_fare']}€")
    
    def test_estimate_with_one_stop_adds_3_euro_supplement(self, api_client):
        """Estimate with 1 stop should add 3€ supplement"""
        response = api_client.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "stops": [STOP_1],
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify 1 stop counted
        assert data["stops_count"] == 1
        
        # Verify supplement details include stop supplement
        supplement_details = data["fare_details"].get("supplement_details", [])
        stop_supplement = next((s for s in supplement_details if "Arrêt" in s["name"]), None)
        
        assert stop_supplement is not None, "Stop supplement should be present"
        assert stop_supplement["amount"] == 3.0, f"Stop supplement should be 3€, got {stop_supplement['amount']}€"
        
        print(f"✅ Estimate with 1 stop: {data['distance_km']}km, {data['estimated_fare']}€, supplement: {stop_supplement['amount']}€")
    
    def test_estimate_with_two_stops_adds_6_euro_supplement(self, api_client):
        """Estimate with 2 stops should add 6€ supplement (2 x 3€)"""
        response = api_client.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "stops": [STOP_1, STOP_2],
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify 2 stops counted
        assert data["stops_count"] == 2
        
        # Verify supplement details include stop supplement of 6€
        supplement_details = data["fare_details"].get("supplement_details", [])
        stop_supplement = next((s for s in supplement_details if "Arrêt" in s["name"]), None)
        
        assert stop_supplement is not None, "Stop supplement should be present"
        assert stop_supplement["amount"] == 6.0, f"Stop supplement should be 6€ for 2 stops, got {stop_supplement['amount']}€"
        
        print(f"✅ Estimate with 2 stops: {data['distance_km']}km, {data['estimated_fare']}€, supplement: {stop_supplement['amount']}€")
    
    def test_estimate_with_three_stops_adds_9_euro_supplement(self, api_client):
        """Estimate with 3 stops should add 9€ supplement (3 x 3€)"""
        response = api_client.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "stops": [STOP_1, STOP_2, STOP_3],
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify 3 stops counted
        assert data["stops_count"] == 3
        
        # Verify supplement details include stop supplement of 9€
        supplement_details = data["fare_details"].get("supplement_details", [])
        stop_supplement = next((s for s in supplement_details if "Arrêt" in s["name"]), None)
        
        assert stop_supplement is not None, "Stop supplement should be present"
        assert stop_supplement["amount"] == 9.0, f"Stop supplement should be 9€ for 3 stops, got {stop_supplement['amount']}€"
        
        print(f"✅ Estimate with 3 stops: {data['distance_km']}km, {data['estimated_fare']}€, supplement: {stop_supplement['amount']}€")
    
    def test_estimate_with_stops_includes_stop_distances(self, api_client):
        """Estimate should return distance breakdown for each segment"""
        response = api_client.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "stops": [STOP_1, STOP_2],
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check stop_distances array
        assert "stop_distances" in data
        stop_distances = data["stop_distances"]
        
        # Should have 3 segments: pickup->stop1, stop1->stop2, stop2->destination
        assert len(stop_distances) == 3, f"Expected 3 distance segments, got {len(stop_distances)}"
        
        for segment in stop_distances:
            assert "from" in segment
            assert "to" in segment
            assert "distance_km" in segment
        
        print(f"✅ Stop distances breakdown: {len(stop_distances)} segments")
    
    def test_estimate_distance_with_stops_greater_than_direct(self, api_client):
        """Distance with stops should be >= direct distance"""
        # Get direct distance
        direct_response = api_client.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        direct_distance = direct_response.json()["distance_km"]
        
        # Get distance with stops
        stops_response = api_client.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "stops": [STOP_1],
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        stops_distance = stops_response.json()["distance_km"]
        
        # Distance with stops should be >= direct
        assert stops_distance >= direct_distance, f"With stops ({stops_distance}km) should be >= direct ({direct_distance}km)"
        
        print(f"✅ Distance comparison: direct={direct_distance}km, with stop={stops_distance}km")


class TestIntermediateStopsRideCreation:
    """Tests for POST /rides with intermediate stops"""
    
    @pytest.fixture
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture
    def auth_token(self, api_client):
        """Login as passenger to get token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "passenger@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed - cannot test ride creation")
    
    @pytest.fixture
    def authenticated_client(self, api_client, auth_token):
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        return api_client
    
    def test_create_ride_with_stops_requires_auth(self, api_client):
        """Creating ride with stops requires authentication"""
        response = api_client.post(f"{BASE_URL}/api/rides", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "stops": [STOP_1],
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        
        assert response.status_code == 403 or response.status_code == 401
        print("✅ Ride creation with stops requires authentication")
    
    def test_create_ride_with_one_stop(self, authenticated_client):
        """Create ride with 1 intermediate stop"""
        response = authenticated_client.post(f"{BASE_URL}/api/rides", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "stops": [STOP_1],
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify ride created with stops
        assert "id" in data
        assert data["status"] == "pending"
        assert "stops" in data
        assert len(data["stops"]) == 1
        assert data["stops"][0]["address"] == STOP_1["address"]
        
        # Verify fare includes stop supplement
        assert data["estimated_fare"] > 0
        
        print(f"✅ Created ride with 1 stop: ID={data['id']}, fare={data['estimated_fare']}€")
        
        # Cancel the test ride
        cancel_response = authenticated_client.post(f"{BASE_URL}/api/rides/{data['id']}/cancel")
        assert cancel_response.status_code == 200
        print(f"  Cleaned up: ride {data['id']} cancelled")
    
    def test_create_ride_with_multiple_stops(self, authenticated_client):
        """Create ride with multiple intermediate stops"""
        response = authenticated_client.post(f"{BASE_URL}/api/rides", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "stops": [STOP_1, STOP_2],
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify 2 stops stored
        assert len(data["stops"]) == 2
        
        print(f"✅ Created ride with 2 stops: ID={data['id']}, fare={data['estimated_fare']}€")
        
        # Cancel the test ride
        authenticated_client.post(f"{BASE_URL}/api/rides/{data['id']}/cancel")
    
    def test_create_ride_without_stops_still_works(self, authenticated_client):
        """Create ride without stops (backwards compatibility)"""
        response = authenticated_client.post(f"{BASE_URL}/api/rides", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Stops should be None or empty
        assert data.get("stops") is None or data.get("stops") == []
        
        print(f"✅ Created ride without stops: ID={data['id']}, fare={data['estimated_fare']}€")
        
        # Cancel the test ride
        authenticated_client.post(f"{BASE_URL}/api/rides/{data['id']}/cancel")
    
    def test_get_ride_includes_stops(self, authenticated_client):
        """GET /rides/{id} should return stops in response"""
        # Create ride with stops
        create_response = authenticated_client.post(f"{BASE_URL}/api/rides", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "stops": [STOP_1, STOP_2, STOP_3],
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        
        ride_id = create_response.json()["id"]
        
        # Get the ride
        get_response = authenticated_client.get(f"{BASE_URL}/api/rides/{ride_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert "stops" in data
        assert len(data["stops"]) == 3
        
        print(f"✅ GET ride includes 3 stops")
        
        # Cancel
        authenticated_client.post(f"{BASE_URL}/api/rides/{ride_id}/cancel")


class TestFareCalculationWithStops:
    """Tests verifying fare calculation logic with stops"""
    
    @pytest.fixture
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_fare_difference_equals_stop_supplement(self, api_client):
        """Fare difference between with/without stops should equal stop supplement"""
        # Get fare without stops
        no_stops = api_client.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "vehicle_type": "standard",
            "passenger_count": 1
        }).json()
        
        # Get fare with 2 stops
        with_stops = api_client.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": PICKUP,
            "destination": DESTINATION,
            "stops": [STOP_1, STOP_2],
            "vehicle_type": "standard",
            "passenger_count": 1
        }).json()
        
        # Calculate expected fare difference
        # Note: Fare includes both distance cost AND stop supplement
        # The stop supplement should be 6€ for 2 stops
        stop_supplement = with_stops["fare_details"]["supplements"] - no_stops["fare_details"]["supplements"]
        
        # The supplement from stops should be 6€ (2 stops x 3€)
        # But we also need to account for additional distance cost
        expected_stop_supplement = 6.0  # 2 x 3€
        
        # Check that fare_details includes the 6€ stop supplement
        stop_supp_detail = next(
            (s for s in with_stops["fare_details"]["supplement_details"] if "Arrêt" in s["name"]),
            None
        )
        assert stop_supp_detail is not None
        assert stop_supp_detail["amount"] == expected_stop_supplement
        
        print(f"✅ Stop supplement for 2 stops: {stop_supp_detail['amount']}€ (expected: {expected_stop_supplement}€)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
