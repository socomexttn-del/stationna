"""
Test file for Saved Cards / Payment Methods feature
Tests: SetupIntent, SavedCards list, delete, set-default, pay-with-saved-card
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PASSENGER_EMAIL = "passenger@test.com"
PASSENGER_PASSWORD = "password"

class TestSavedCardsPayments:
    """Test cases for saved cards payment functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login and get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PASSENGER_EMAIL,
            "password": PASSENGER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.user_data = response.json().get("user")
        else:
            pytest.skip("Login failed - cannot proceed with payment tests")
    
    # ====================== SETUP INTENT TESTS ======================
    
    def test_create_setup_intent_success(self):
        """POST /payments/setup-intent - Should create Stripe SetupIntent"""
        response = self.session.post(f"{BASE_URL}/api/payments/setup-intent")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "client_secret" in data, "Missing client_secret in response"
        assert "setup_intent_id" in data, "Missing setup_intent_id in response"
        assert "publishable_key" in data, "Missing publishable_key in response"
        
        # Validate format
        assert data["client_secret"].startswith("seti_"), "client_secret should start with 'seti_'"
        assert data["setup_intent_id"].startswith("seti_"), "setup_intent_id should start with 'seti_'"
        assert data["publishable_key"].startswith("pk_test_"), "publishable_key should be test key"
        print(f"✅ SetupIntent created: {data['setup_intent_id']}")
    
    def test_setup_intent_requires_auth(self):
        """POST /payments/setup-intent - Should require authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/payments/setup-intent")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ SetupIntent correctly requires authentication")
    
    # ====================== SAVED CARDS LIST TESTS ======================
    
    def test_get_saved_cards_success(self):
        """GET /payments/saved-cards - Should return list of saved cards"""
        response = self.session.get(f"{BASE_URL}/api/payments/saved-cards")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are cards, verify structure
        if len(data) > 0:
            card = data[0]
            assert "id" in card, "Card should have id"
            assert "brand" in card, "Card should have brand"
            assert "last4" in card, "Card should have last4"
            assert "exp_month" in card, "Card should have exp_month"
            assert "exp_year" in card, "Card should have exp_year"
            assert "is_default" in card, "Card should have is_default flag"
            print(f"✅ Found {len(data)} saved cards")
        else:
            print("✅ No saved cards found (expected for new user)")
    
    def test_saved_cards_requires_auth(self):
        """GET /payments/saved-cards - Should require authentication"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/payments/saved-cards")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Saved cards correctly requires authentication")
    
    # ====================== DELETE CARD TESTS ======================
    
    def test_delete_nonexistent_card(self):
        """DELETE /payments/saved-cards/{id} - Should fail for invalid card"""
        response = self.session.delete(f"{BASE_URL}/api/payments/saved-cards/pm_nonexistent123")
        
        assert response.status_code == 500, f"Expected 500 (Stripe error), got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Should have error detail"
        assert "No such PaymentMethod" in data["detail"], f"Expected Stripe error, got: {data['detail']}"
        print("✅ Delete non-existent card returns appropriate error")
    
    def test_delete_card_requires_auth(self):
        """DELETE /payments/saved-cards/{id} - Should require authentication"""
        session = requests.Session()
        
        response = session.delete(f"{BASE_URL}/api/payments/saved-cards/pm_test123")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Delete card correctly requires authentication")
    
    # ====================== SET DEFAULT CARD TESTS ======================
    
    def test_set_default_nonexistent_card(self):
        """POST /payments/set-default-card/{id} - Should fail for invalid card"""
        response = self.session.post(f"{BASE_URL}/api/payments/set-default-card/pm_nonexistent456")
        
        assert response.status_code == 500, f"Expected 500 (Stripe error), got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Should have error detail"
        assert "No such PaymentMethod" in data["detail"], f"Expected Stripe error, got: {data['detail']}"
        print("✅ Set default non-existent card returns appropriate error")
    
    def test_set_default_requires_auth(self):
        """POST /payments/set-default-card/{id} - Should require authentication"""
        session = requests.Session()
        
        response = session.post(f"{BASE_URL}/api/payments/set-default-card/pm_test123")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Set default card correctly requires authentication")
    
    # ====================== PAY WITH SAVED CARD TESTS ======================
    
    def test_pay_with_saved_card_invalid_ride(self):
        """POST /payments/pay-with-saved-card - Should fail for invalid ride"""
        response = self.session.post(f"{BASE_URL}/api/payments/pay-with-saved-card", json={
            "ride_id": "invalid-ride-id",
            "payment_method_id": "pm_test123"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Should have error detail"
        assert "Course non trouvée" in data["detail"], f"Expected ride not found error, got: {data['detail']}"
        print("✅ Pay with saved card invalid ride returns 404")
    
    def test_pay_with_saved_card_requires_auth(self):
        """POST /payments/pay-with-saved-card - Should require authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/payments/pay-with-saved-card", json={
            "ride_id": "test",
            "payment_method_id": "pm_test"
        })
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Pay with saved card correctly requires authentication")
    
    def test_pay_with_saved_card_missing_fields(self):
        """POST /payments/pay-with-saved-card - Should validate required fields"""
        response = self.session.post(f"{BASE_URL}/api/payments/pay-with-saved-card", json={})
        
        assert response.status_code == 422, f"Expected 422 (validation error), got {response.status_code}"
        print("✅ Pay with saved card validates required fields")


class TestPaymentIntentFlow:
    """Test PaymentIntent creation flow for new card payments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PASSENGER_EMAIL,
            "password": PASSENGER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Login failed")
    
    def test_create_payment_intent_invalid_ride(self):
        """POST /payments/create-payment-intent - Should fail for invalid ride"""
        response = self.session.post(f"{BASE_URL}/api/payments/create-payment-intent", json={
            "ride_id": "nonexistent-ride"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✅ Create payment intent invalid ride returns 404")
    
    def test_create_payment_intent_requires_auth(self):
        """POST /payments/create-payment-intent - Should require authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/payments/create-payment-intent", json={
            "ride_id": "test"
        })
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Create payment intent requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
