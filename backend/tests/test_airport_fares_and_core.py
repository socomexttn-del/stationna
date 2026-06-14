"""
Backend API Tests for StationCab Taxi App
Focus: Airport Flat Rates, Authentication, VTC Fares, Driver Availability, Rides, Wallet, Promo Codes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_PASSENGER = {"email": "passenger@test.com", "password": "password"}
TEST_DRIVER = {"email": "driver@test.com", "password": "password"}
TEST_ADMIN = {"email": "admin@volttaxi.com", "password": "admin123"}

# Airport and Paris coordinates for testing
COORDINATES = {
    # CDG Airport
    "cdg": {"lat": 49.0097, "lng": 2.5479, "address": "Aéroport Charles de Gaulle"},
    # Orly Airport
    "orly": {"lat": 48.7262, "lng": 2.3652, "address": "Aéroport d'Orly"},
    # Tour Eiffel (Rive Gauche - south of Seine, lat < 48.86)
    "tour_eiffel": {"lat": 48.8584, "lng": 2.2945, "address": "Tour Eiffel, Paris"},
    # Champs Élysées (Rive Droite - north of Seine, lat > 48.86)
    "champs_elysees": {"lat": 48.8698, "lng": 2.3077, "address": "Champs Élysées, Paris"},
    # Saint-Germain-des-Prés (Rive Gauche)
    "saint_germain": {"lat": 48.8539, "lng": 2.3331, "address": "Saint-Germain-des-Prés, Paris"},
    # Opera (Rive Droite)
    "opera": {"lat": 48.8719, "lng": 2.3316, "address": "Opéra, Paris"},
}

# Expected Airport Flat Rates (base rate + 4€ immediate booking supplement)
EXPECTED_RATES = {
    "cdg_rive_gauche": 65.0 + 4.0,  # 69€
    "cdg_rive_droite": 56.0 + 4.0,  # 60€
    "orly_rive_gauche": 36.0 + 4.0,  # 40€
    "orly_rive_droite": 45.0 + 4.0,  # 49€
}


class TestApiHealth:
    """Test API availability"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "running"
        print("✅ API root endpoint working")


class TestAuthentication:
    """Authentication tests for all user roles"""
    
    def test_passenger_login(self):
        """Test passenger login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_PASSENGER)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "passenger"
        print(f"✅ Passenger login successful: {data['user']['email']}")
    
    def test_driver_login(self):
        """Test driver login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_DRIVER)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "driver"
        print(f"✅ Driver login successful: {data['user']['email']}")
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ADMIN)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"✅ Admin login successful: {data['user']['email']}")
    
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✅ Invalid login correctly rejected with 401")
    
    def test_auth_me_endpoint(self):
        """Test /auth/me endpoint with valid token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_PASSENGER)
        token = login_response.json()["token"]
        
        # Then call /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_PASSENGER["email"]
        print("✅ /auth/me endpoint working with valid token")


class TestTaxiAirportFlatRates:
    """
    Test Paris taxi airport flat rates (forfaits aéroports)
    Key test: Tour Eiffel (lat 48.8584 < 48.86) = Rive Gauche
    """
    
    def test_tour_eiffel_to_cdg_is_rive_gauche(self):
        """
        Tour Eiffel → CDG should be Rive Gauche rate (65€ + 4€ = 69€)
        Tour Eiffel lat 48.8584 < Seine lat 48.86 = Rive Gauche
        """
        response = requests.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": COORDINATES["tour_eiffel"],
            "destination": COORDINATES["cdg"],
            "vehicle_type": "taxi",
            "passenger_count": 1
        })
        assert response.status_code == 200
        data = response.json()
        
        fare = data["fare_details"]
        assert fare.get("is_airport_flat_rate") == True, "Should be airport flat rate"
        assert fare.get("airport") == "CDG", f"Airport should be CDG, got {fare.get('airport')}"
        assert fare.get("rive") == "rive_gauche", f"Tour Eiffel (lat 48.8584) should be Rive Gauche, got {fare.get('rive')}"
        assert fare.get("flat_rate") == 65.0, f"Base rate should be 65€, got {fare.get('flat_rate')}"
        assert fare.get("total") == EXPECTED_RATES["cdg_rive_gauche"], f"Total should be 69€, got {fare.get('total')}"
        
        print(f"✅ Tour Eiffel → CDG: {fare.get('total')}€ (Rive Gauche - CORRECT)")
        print(f"   Direction: {fare.get('direction_label')}")
    
    def test_champs_elysees_to_cdg_is_rive_droite(self):
        """
        Champs Élysées → CDG should be Rive Droite rate (56€ + 4€ = 60€)
        Champs Élysées lat 48.8698 > Seine lat 48.86 = Rive Droite
        """
        response = requests.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": COORDINATES["champs_elysees"],
            "destination": COORDINATES["cdg"],
            "vehicle_type": "taxi",
            "passenger_count": 1
        })
        assert response.status_code == 200
        data = response.json()
        
        fare = data["fare_details"]
        assert fare.get("is_airport_flat_rate") == True
        assert fare.get("rive") == "rive_droite", f"Champs Élysées (lat 48.8698) should be Rive Droite, got {fare.get('rive')}"
        assert fare.get("flat_rate") == 56.0, f"Base rate should be 56€, got {fare.get('flat_rate')}"
        assert fare.get("total") == EXPECTED_RATES["cdg_rive_droite"], f"Total should be 60€, got {fare.get('total')}"
        
        print(f"✅ Champs Élysées → CDG: {fare.get('total')}€ (Rive Droite - CORRECT)")
    
    def test_orly_to_paris_rive_droite(self):
        """
        Orly → Opera (Rive Droite) should be 45€ + 4€ = 49€
        """
        response = requests.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": COORDINATES["orly"],
            "destination": COORDINATES["opera"],
            "vehicle_type": "taxi",
            "passenger_count": 1
        })
        assert response.status_code == 200
        data = response.json()
        
        fare = data["fare_details"]
        assert fare.get("is_airport_flat_rate") == True
        assert fare.get("airport") == "ORLY"
        assert fare.get("rive") == "rive_droite"
        assert fare.get("total") == EXPECTED_RATES["orly_rive_droite"], f"Total should be 49€, got {fare.get('total')}"
        
        print(f"✅ Orly → Opera (Rive Droite): {fare.get('total')}€ (CORRECT)")
    
    def test_orly_to_paris_rive_gauche(self):
        """
        Orly → Saint-Germain (Rive Gauche) should be 36€ + 4€ = 40€
        """
        response = requests.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": COORDINATES["orly"],
            "destination": COORDINATES["saint_germain"],
            "vehicle_type": "taxi",
            "passenger_count": 1
        })
        assert response.status_code == 200
        data = response.json()
        
        fare = data["fare_details"]
        assert fare.get("is_airport_flat_rate") == True
        assert fare.get("airport") == "ORLY"
        assert fare.get("rive") == "rive_gauche"
        assert fare.get("total") == EXPECTED_RATES["orly_rive_gauche"], f"Total should be 40€, got {fare.get('total')}"
        
        print(f"✅ Orly → Saint-Germain (Rive Gauche): {fare.get('total')}€ (CORRECT)")
    
    def test_cdg_to_tour_eiffel_reverse_direction(self):
        """
        CDG → Tour Eiffel (from airport) should also be Rive Gauche rate
        """
        response = requests.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": COORDINATES["cdg"],
            "destination": COORDINATES["tour_eiffel"],
            "vehicle_type": "taxi",
            "passenger_count": 1
        })
        assert response.status_code == 200
        data = response.json()
        
        fare = data["fare_details"]
        assert fare.get("is_airport_flat_rate") == True
        assert fare.get("direction") == "from_airport"
        assert fare.get("rive") == "rive_gauche"
        assert fare.get("total") == EXPECTED_RATES["cdg_rive_gauche"]
        
        print(f"✅ CDG → Tour Eiffel (from airport): {fare.get('total')}€ (Rive Gauche - CORRECT)")


class TestVTCFareEstimation:
    """Test VTC (non-taxi) fare estimation"""
    
    def test_vtc_standard_fare(self):
        """Test VTC standard fare calculation"""
        response = requests.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": COORDINATES["tour_eiffel"],
            "destination": COORDINATES["champs_elysees"],
            "vehicle_type": "standard",
            "passenger_count": 1
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "fare_details" in data
        assert "estimated_fare" in data
        assert data["fare_details"]["vehicle_type"] == "standard"
        assert data["fare_details"].get("is_airport_flat_rate") != True  # VTC doesn't use airport flat rates
        
        print(f"✅ VTC Standard fare: {data['estimated_fare']}€")
        print(f"   Distance: {data['distance_km']} km")
    
    def test_vtc_van_fare(self):
        """Test VTC van fare calculation (should include van supplement)"""
        response = requests.post(f"{BASE_URL}/api/rides/estimate", json={
            "pickup": COORDINATES["tour_eiffel"],
            "destination": COORDINATES["champs_elysees"],
            "vehicle_type": "van",
            "passenger_count": 5
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["fare_details"]["vehicle_type"] == "van"
        # Van should have 10€ supplement
        supplements = data["fare_details"].get("supplement_details", [])
        van_supplement = next((s for s in supplements if "Van" in s.get("name", "")), None)
        assert van_supplement is not None, "Van supplement should be present"
        assert van_supplement["amount"] == 10.0
        
        print(f"✅ VTC Van fare: {data['estimated_fare']}€ (includes 10€ van supplement)")


class TestDriverAvailability:
    """Test driver availability toggle"""
    
    @pytest.fixture
    def driver_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_DRIVER)
        return response.json()["token"]
    
    def test_set_driver_available(self, driver_token):
        """Test setting driver as available"""
        response = requests.put(
            f"{BASE_URL}/api/users/availability",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "is_available": True,
                "location": {
                    "lat": 48.8566,
                    "lng": 2.3522,
                    "address": "Paris Centre"
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_available"] == True
        print("✅ Driver set as available successfully")
    
    def test_set_driver_unavailable(self, driver_token):
        """Test setting driver as unavailable"""
        response = requests.put(
            f"{BASE_URL}/api/users/availability",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "is_available": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_available"] == False
        print("✅ Driver set as unavailable successfully")
    
    def test_passenger_cannot_update_availability(self):
        """Test that passengers cannot update driver availability"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_PASSENGER)
        token = login_response.json()["token"]
        
        response = requests.put(
            f"{BASE_URL}/api/users/availability",
            headers={"Authorization": f"Bearer {token}"},
            json={"is_available": True}
        )
        assert response.status_code == 403
        print("✅ Passenger correctly rejected from updating availability (403)")


class TestRideCreation:
    """Test ride creation and lifecycle"""
    
    @pytest.fixture
    def passenger_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_PASSENGER)
        return response.json()["token"]
    
    def test_create_ride(self, passenger_token):
        """Test creating a new ride"""
        response = requests.post(
            f"{BASE_URL}/api/rides",
            headers={"Authorization": f"Bearer {passenger_token}"},
            json={
                "pickup": COORDINATES["tour_eiffel"],
                "destination": COORDINATES["champs_elysees"],
                "vehicle_type": "standard",
                "passenger_count": 1
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "reservation_number" in data
        assert data["status"] == "pending"
        assert data["passenger_name"] is not None
        
        print(f"✅ Ride created: {data['reservation_number']}")
        print(f"   ID: {data['id']}")
        print(f"   Estimated fare: {data['estimated_fare']}€")
        return data
    
    def test_get_active_ride(self, passenger_token):
        """Test getting active ride for passenger"""
        response = requests.get(
            f"{BASE_URL}/api/rides/active",
            headers={"Authorization": f"Bearer {passenger_token}"}
        )
        # Can be 200 with ride or 200 with null if no active ride
        assert response.status_code == 200
        print("✅ Get active ride endpoint working")


class TestWalletBalance:
    """Test wallet balance API"""
    
    @pytest.fixture
    def passenger_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_PASSENGER)
        return response.json()["token"]
    
    def test_get_wallet_balance(self, passenger_token):
        """Test getting wallet balance"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/balance",
            headers={"Authorization": f"Bearer {passenger_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "balance" in data
        assert "currency" in data
        assert data["currency"] == "EUR"
        assert isinstance(data["balance"], (int, float))
        
        print(f"✅ Wallet balance: {data['balance']} {data['currency']}")
    
    def test_wallet_requires_auth(self):
        """Test that wallet endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/wallet/balance")
        assert response.status_code in [401, 403]
        print("✅ Wallet endpoint correctly requires authentication")


class TestAdminPromoCodes:
    """Test admin promo codes API"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ADMIN)
        return response.json()["token"]
    
    def test_get_promo_codes_list(self, admin_token):
        """Test getting promo codes list (admin)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/promo-codes",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "promo_codes" in data or isinstance(data, list)
        print(f"✅ Admin promo codes list retrieved")
    
    def test_create_promo_code(self, admin_token):
        """Test creating a promo code (admin)"""
        import random
        code = f"TEST{random.randint(1000, 9999)}"
        
        response = requests.post(
            f"{BASE_URL}/api/admin/promo-codes",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "code": code,
                "discount_percent": 10,
                "max_uses": 100,
                "valid_until": "2026-12-31T23:59:59Z"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Response structure: {"status": "ok", "promo": {...}}
        promo = data.get("promo", data)  # Handle both structures
        assert promo.get("code") == code
        assert promo.get("discount_percent") == 10
        
        print(f"✅ Promo code created: {code} (10% discount)")
    
    def test_non_admin_cannot_access_promo_codes(self):
        """Test that non-admin users cannot access promo codes"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_PASSENGER)
        token = login_response.json()["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/admin/promo-codes",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403
        print("✅ Non-admin correctly rejected from promo codes (403)")


class TestAvailableDrivers:
    """Test available drivers endpoint"""
    
    @pytest.fixture
    def passenger_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_PASSENGER)
        return response.json()["token"]
    
    def test_get_available_drivers(self, passenger_token):
        """Test getting list of available drivers"""
        response = requests.get(
            f"{BASE_URL}/api/drivers/available",
            headers={"Authorization": f"Bearer {passenger_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Available drivers endpoint working ({len(data)} drivers)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
