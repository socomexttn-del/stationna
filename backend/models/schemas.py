"""
Pydantic models for StationCab API
"""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict

# ======================== USER MODELS ========================

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: str
    role: str = Field(..., pattern="^(passenger|driver|admin)$")
    company_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    first_name: str
    last_name: str
    phone: str
    role: str
    company_name: Optional[str] = None
    rating: float = 5.0
    total_rides: int = 0
    is_available: bool = False
    vehicle_info: Optional[Dict] = None
    location: Optional[Dict] = None
    driver_vehicle_types: Optional[List[str]] = None
    created_at: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

# ======================== LOCATION MODELS ========================

class LocationModel(BaseModel):
    lat: float
    lng: float
    address: str

# ======================== RIDE MODELS ========================

class RideResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    reservation_number: Optional[str] = None
    passenger_id: str
    passenger_name: str
    passenger_phone: Optional[str] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    driver_company: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_license_plate: Optional[str] = None
    driver_identification: Optional[str] = None
    pickup: Dict
    destination: Dict
    stops: Optional[List[Dict]] = None
    distance_km: float
    estimated_fare: float
    commission_rate: float = 0.18
    commission_amount: Optional[float] = None
    driver_earnings: Optional[float] = None
    final_fare: Optional[float] = None
    status: str
    payment_status: str = "pending"
    payment_method: Optional[str] = None
    payment_intent_id: Optional[str] = None
    scheduled_time: Optional[str] = None
    is_scheduled: Optional[bool] = False
    created_at: str
    accepted_at: Optional[str] = None
    completed_at: Optional[str] = None
    vehicle_type: str = "standard"
    passenger_count: int = 1
    driver_eta_minutes: Optional[int] = None
    driver_distance_km: Optional[float] = None
    driver_arrived: Optional[bool] = False
    driver_arrived_at: Optional[str] = None
    cancelled_by: Optional[str] = None
    cancelled_at: Optional[str] = None
    cancellation_fee: Optional[float] = None
    cancellation_fee_charged: Optional[bool] = None
    authorization_cancelled: Optional[bool] = None

class FareEstimateRequest(BaseModel):
    pickup: LocationModel
    destination: LocationModel
    stops: Optional[List[LocationModel]] = None
    vehicle_type: str = "standard"
    passenger_count: int = 1

class RideRequest(BaseModel):
    pickup: LocationModel
    destination: LocationModel
    stops: Optional[List[LocationModel]] = None
    vehicle_type: str = "standard"
    passenger_count: int = 1
    payment_intent_id: Optional[str] = None
    payment_status: Optional[str] = None

class ScheduledRideRequest(BaseModel):
    pickup: LocationModel
    destination: LocationModel
    scheduled_time: str
    vehicle_type: Optional[str] = "standard"
    passenger_count: Optional[int] = 1
    stops: Optional[List[Dict]] = None

class RatingCreate(BaseModel):
    ride_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

# ======================== DRIVER MODELS ========================

class DriverAvailability(BaseModel):
    is_available: bool
    location: Optional[LocationModel] = None

class VehicleUpdate(BaseModel):
    make: str
    model: str
    year: int
    color: str
    license_plate: str
    vehicle_type: str = "standard"

class VehicleDocuments(BaseModel):
    carte_grise: Optional[str] = None
    assurance: Optional[str] = None
    controle_technique: Optional[str] = None
    permis_conduire: Optional[str] = None
    carte_vtc: Optional[str] = None

class DriverDocumentsUpdate(BaseModel):
    document_type: str
    document_url: str
    expiry_date: Optional[str] = None

# Extended driver document types
DRIVER_DOCUMENT_TYPES = {
    "permis_conduire": {"name": "Permis de Conduire", "category": "personal", "required": True, "has_expiry": True},
    "cni": {"name": "Pièce d'Identité (CNI/Passeport)", "category": "personal", "required": True, "has_expiry": True},
    "photo_visage": {"name": "Photo du Visage", "category": "personal", "required": True, "has_expiry": False},
    "assurance_vehicule": {"name": "Assurance Véhicule", "category": "vehicle", "required": True, "has_expiry": True},
    "controle_technique": {"name": "Contrôle Technique", "category": "vehicle", "required": True, "has_expiry": True},
    "photo_voiture_avant": {"name": "Photo Voiture - Avant", "category": "vehicle", "required": True, "has_expiry": False},
    "photo_voiture_arriere": {"name": "Photo Voiture - Arrière", "category": "vehicle", "required": True, "has_expiry": False},
    "photo_voiture_profil": {"name": "Photo Voiture - Profil", "category": "vehicle", "required": True, "has_expiry": False},
    "carte_professionnelle": {"name": "Carte Professionnelle VTC/Taxi", "category": "professional", "required": True, "has_expiry": True},
    "assurance_transport": {"name": "Assurance Transport à Titre Onéreux", "category": "professional", "required": True, "has_expiry": True},
    "licence_transport": {"name": "Licence de Transport", "category": "professional", "required": True, "has_expiry": True},
    "kbis": {"name": "Extrait KBIS", "category": "professional", "required": True, "has_expiry": True},
    "rib": {"name": "RIB (Relevé d'Identité Bancaire)", "category": "financial", "required": True, "has_expiry": False},
}

# ======================== PAYMENT MODELS ========================

class PaymentCreateRequest(BaseModel):
    ride_id: str
    origin_url: str

class PreBookingPaymentRequest(BaseModel):
    amount: int
    description: str
    success_url: str
    cancel_url: str
    metadata: dict = {}

class PaymentHistoryResponse(BaseModel):
    id: str
    ride_id: str
    amount: float
    currency: str
    status: str
    created_at: str
    ride_pickup: str
    ride_destination: str

# ======================== CHAT MODELS ========================

class ChatMessage(BaseModel):
    ride_id: str
    message: str

class ChatMessageResponse(BaseModel):
    id: str
    ride_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    message: str
    created_at: str

# ======================== FAVORITES MODELS ========================

class FavoriteAddressCreate(BaseModel):
    name: str
    location: LocationModel

class FavoriteAddressResponse(BaseModel):
    id: str
    user_id: str
    name: str
    location: Dict
    created_at: str

class FrequentTripCreate(BaseModel):
    name: str
    pickup: LocationModel
    destination: LocationModel
    vehicle_type: str = "standard"
    passenger_count: int = 1

class FrequentTripResponse(BaseModel):
    id: str
    user_id: str
    name: str
    pickup: Dict
    destination: Dict
    vehicle_type: str
    passenger_count: int
    use_count: int
    created_at: str

# ======================== PROMO MODELS ========================

class PromoCodeCreate(BaseModel):
    code: str
    discount_percent: int = Field(..., ge=1, le=100)
    max_uses: int = 100
    valid_until: str

class PromoCodeApply(BaseModel):
    code: str

# ======================== PASSWORD RESET MODELS ========================

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class AdminPasswordReset(BaseModel):
    user_id: str
    new_password: str

# ======================== WEB PUSH MODELS ========================

class WebPushSubscription(BaseModel):
    endpoint: str
    keys: Dict

class WebPushUnsubscribe(BaseModel):
    endpoint: str

# ======================== FCM MODELS ========================

class FCMTokenUpdate(BaseModel):
    token: str
    device_type: Optional[str] = "web"
