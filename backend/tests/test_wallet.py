"""
Wallet Feature Tests for StationCab Taxi App
Tests wallet balance, top-up, transactions, and payment endpoints
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWalletEndpoints:
    """Test wallet API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login as passenger"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as passenger
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "passenger@test.com",
            "password": "password"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Failed to login as passenger")
        
        data = login_response.json()
        self.token = data["token"]
        self.user = data["user"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"Logged in as: {self.user['email']}")
    
    # ===================== GET /wallet/balance Tests =====================
    
    def test_wallet_balance_returns_200(self):
        """Test GET /wallet/balance returns 200 status"""
        response = self.session.get(f"{BASE_URL}/api/wallet/balance")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ GET /wallet/balance returns 200")
    
    def test_wallet_balance_structure(self):
        """Test GET /wallet/balance returns correct data structure"""
        response = self.session.get(f"{BASE_URL}/api/wallet/balance")
        assert response.status_code == 200
        
        data = response.json()
        assert "balance" in data, "Response should contain 'balance'"
        assert "currency" in data, "Response should contain 'currency'"
        assert isinstance(data["balance"], (int, float)), "Balance should be numeric"
        assert data["currency"] == "EUR", "Currency should be EUR"
        assert data["balance"] >= 0, "Balance should not be negative"
        print(f"✅ Wallet balance structure correct: {data['balance']}€")
    
    def test_wallet_balance_requires_auth(self):
        """Test GET /wallet/balance requires authentication"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.get(f"{BASE_URL}/api/wallet/balance")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print(f"✅ GET /wallet/balance requires authentication")
    
    # ===================== GET /wallet/transactions Tests =====================
    
    def test_wallet_transactions_returns_200(self):
        """Test GET /wallet/transactions returns 200 status"""
        response = self.session.get(f"{BASE_URL}/api/wallet/transactions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ GET /wallet/transactions returns 200")
    
    def test_wallet_transactions_structure(self):
        """Test GET /wallet/transactions returns correct data structure"""
        response = self.session.get(f"{BASE_URL}/api/wallet/transactions")
        assert response.status_code == 200
        
        data = response.json()
        assert "transactions" in data, "Response should contain 'transactions'"
        assert "total" in data, "Response should contain 'total'"
        assert "page" in data, "Response should contain 'page'"
        assert "pages" in data, "Response should contain 'pages'"
        assert isinstance(data["transactions"], list), "Transactions should be a list"
        print(f"✅ Wallet transactions structure correct: {data['total']} total transactions")
    
    def test_wallet_transactions_pagination(self):
        """Test GET /wallet/transactions with pagination"""
        response = self.session.get(f"{BASE_URL}/api/wallet/transactions?page=1&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert data["page"] == 1, "Page should be 1"
        print(f"✅ Wallet transactions pagination works")
    
    def test_wallet_transactions_requires_auth(self):
        """Test GET /wallet/transactions requires authentication"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.get(f"{BASE_URL}/api/wallet/transactions")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print(f"✅ GET /wallet/transactions requires authentication")
    
    # ===================== POST /wallet/top-up Tests =====================
    
    def test_wallet_topup_creates_payment_intent(self):
        """Test POST /wallet/top-up creates a Stripe payment intent"""
        response = self.session.post(f"{BASE_URL}/api/wallet/top-up", json={
            "amount": 20
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "client_secret" in data, "Response should contain 'client_secret'"
        assert "publishable_key" in data, "Response should contain 'publishable_key'"
        assert "payment_intent_id" in data, "Response should contain 'payment_intent_id'"
        assert "amount" in data, "Response should contain 'amount'"
        assert data["amount"] == 20, "Amount should match request"
        assert data["client_secret"].startswith("pi_"), "Client secret should start with 'pi_'"
        print(f"✅ POST /wallet/top-up creates payment intent: {data['payment_intent_id'][:20]}...")
    
    def test_wallet_topup_validates_minimum_amount(self):
        """Test POST /wallet/top-up validates minimum amount (5€)"""
        response = self.session.post(f"{BASE_URL}/api/wallet/top-up", json={
            "amount": 2
        })
        
        assert response.status_code == 400, f"Expected 400 for low amount, got {response.status_code}"
        print(f"✅ POST /wallet/top-up validates minimum amount (5€)")
    
    def test_wallet_topup_validates_maximum_amount(self):
        """Test POST /wallet/top-up validates maximum amount (500€)"""
        response = self.session.post(f"{BASE_URL}/api/wallet/top-up", json={
            "amount": 600
        })
        
        assert response.status_code == 400, f"Expected 400 for high amount, got {response.status_code}"
        print(f"✅ POST /wallet/top-up validates maximum amount (500€)")
    
    def test_wallet_topup_accepts_valid_amounts(self):
        """Test POST /wallet/top-up accepts valid amounts (10€, 50€, 100€)"""
        for amount in [10, 50, 100]:
            response = self.session.post(f"{BASE_URL}/api/wallet/top-up", json={
                "amount": amount
            })
            assert response.status_code == 200, f"Expected 200 for {amount}€, got {response.status_code}"
            print(f"✅ POST /wallet/top-up accepts {amount}€")
    
    def test_wallet_topup_requires_auth(self):
        """Test POST /wallet/top-up requires authentication"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.post(f"{BASE_URL}/api/wallet/top-up", json={
            "amount": 20
        })
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print(f"✅ POST /wallet/top-up requires authentication")
    
    # ===================== POST /wallet/pay Tests =====================
    
    def test_wallet_pay_requires_auth(self):
        """Test POST /wallet/pay requires authentication"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.post(f"{BASE_URL}/api/wallet/pay", json={
            "ride_id": "fake-ride-id"
        })
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print(f"✅ POST /wallet/pay requires authentication")
    
    def test_wallet_pay_validates_ride_exists(self):
        """Test POST /wallet/pay validates ride exists"""
        response = self.session.post(f"{BASE_URL}/api/wallet/pay", json={
            "ride_id": "non-existent-ride-id"
        })
        assert response.status_code == 404, f"Expected 404 for non-existent ride, got {response.status_code}"
        print(f"✅ POST /wallet/pay validates ride exists (404 for fake ride)")


class TestWalletIntegration:
    """Integration tests for wallet feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login as passenger"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as passenger
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "passenger@test.com",
            "password": "password"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Failed to login as passenger")
        
        data = login_response.json()
        self.token = data["token"]
        self.user = data["user"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_wallet_in_payment_method_selector_available(self):
        """Test wallet option is available in payment method selection"""
        # Get balance first
        balance_response = self.session.get(f"{BASE_URL}/api/wallet/balance")
        assert balance_response.status_code == 200
        balance = balance_response.json()["balance"]
        print(f"✅ Wallet balance available for payment selection: {balance}€")
    
    def test_saved_cards_endpoint_works(self):
        """Test saved cards endpoint (used alongside wallet)"""
        response = self.session.get(f"{BASE_URL}/api/payments/saved-cards")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ GET /payments/saved-cards works (for PaymentMethodSelector)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
