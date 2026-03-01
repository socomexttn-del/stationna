"""
Application configuration and constants
"""
import os
from typing import List, Dict

# JWT Settings
JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 30

# Stripe Settings
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Fare calculation constants
FARE_CONFIG = {
    "base_fare": 3.50,
    "base_distance_km": 2.0,
    "price_per_km": 1.80,
    "price_per_minute": 0.35,
    "min_fare": 6.00,
    "night_multiplier": 1.3,
    "night_start_hour": 22,
    "night_end_hour": 6,
    "scheduled_supplement": 5.00,
    "van_multiplier": 1.5,
    "extra_passenger_supplement": 2.00,
    "passenger_threshold": 4,
    "stop_supplement": 3.00,
}

# Wallet bonus tiers
WALLET_BONUS_TIERS: List[Dict] = [
    {"min_amount": 100, "bonus": 15, "label": "+15€ offerts"},
    {"min_amount": 50, "bonus": 5, "label": "+5€ offerts"},
    {"min_amount": 20, "bonus": 2, "label": "+2€ offerts"},
]

# Document types for drivers
DRIVER_DOCUMENT_TYPES = {
    "personal": [
        {"id": "id_card", "name": "Carte d'identité", "required": True, "has_expiry": True},
        {"id": "proof_of_address", "name": "Justificatif de domicile", "required": True, "has_expiry": False},
        {"id": "criminal_record", "name": "Extrait de casier judiciaire", "required": True, "has_expiry": False},
    ],
    "vehicle": [
        {"id": "vehicle_registration", "name": "Carte grise", "required": True, "has_expiry": False},
        {"id": "insurance", "name": "Attestation d'assurance", "required": True, "has_expiry": True},
        {"id": "technical_inspection", "name": "Contrôle technique", "required": True, "has_expiry": True},
    ],
    "professional": [
        {"id": "vtc_card", "name": "Carte VTC", "required": True, "has_expiry": True},
        {"id": "driving_license", "name": "Permis de conduire", "required": True, "has_expiry": True},
        {"id": "professional_card", "name": "Carte professionnelle", "required": False, "has_expiry": True},
    ],
    "financial": [
        {"id": "rib", "name": "RIB", "required": True, "has_expiry": False},
        {"id": "kbis", "name": "Extrait Kbis", "required": False, "has_expiry": False},
    ]
}
