"""
Base models and shared types
"""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, Dict, List
from datetime import datetime


class LocationModel(BaseModel):
    lat: float
    lng: float
    address: str


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
    created_at: str


class TokenResponse(BaseModel):
    token: str
    user: UserResponse


class VehicleUpdate(BaseModel):
    make: str
    model: str
    year: int
    color: str
    license_plate: str
    vehicle_type: str = "standard"


class DriverAvailability(BaseModel):
    is_available: bool
    location: Optional[LocationModel] = None


class DriverDocumentsUpdate(BaseModel):
    document_type: str
    document_url: str
    expiry_date: Optional[str] = None


# Ride Models
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
    scheduled_time: Optional[str] = None
    created_at: str
    accepted_at: Optional[str] = None
    completed_at: Optional[str] = None
    vehicle_type: str = "standard"
    passenger_count: int = 1
    driver_eta_minutes: Optional[int] = None
    driver_distance_km: Optional[float] = None


# Rating Models
class RatingCreate(BaseModel):
    ride_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


# Payment Models
class PaymentCreateRequest(BaseModel):
    ride_id: str
    origin_url: str


class PaymentIntentRequest(BaseModel):
    amount: int
    currency: str = "eur"
    payment_method_id: Optional[str] = None
    ride_id: Optional[str] = None


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: int
    currency: str


class SetupIntentResponse(BaseModel):
    client_secret: str
    setup_intent_id: str


class SavedCard(BaseModel):
    id: str
    brand: str
    last4: str
    exp_month: int
    exp_year: int
    is_default: bool = False


# Chat Models
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


# Promo Models
class PromoCodeCreate(BaseModel):
    code: str
    discount_percent: int = Field(..., ge=1, le=100)
    max_uses: int = 100
    valid_until: str


class PromoCodeApply(BaseModel):
    code: str


# Favorite & Frequent Trip Models
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


# Scheduled Ride Models  
class ScheduledRideRequest(BaseModel):
    pickup: LocationModel
    destination: LocationModel
    scheduled_time: str
    vehicle_type: str = "standard"
    passenger_count: int = 1
    stops: Optional[List[LocationModel]] = None


# Payment History
class PaymentHistoryResponse(BaseModel):
    id: str
    ride_id: str
    amount: float
    currency: str
    status: str
    created_at: str
    ride_pickup: str
    ride_destination: str


# Wallet Models
class WalletTopUpRequest(BaseModel):
    amount: int
    origin_url: str


class WalletPayRequest(BaseModel):
    ride_id: str
    amount: float


# Email Notification
class EmailNotificationRequest(BaseModel):
    driver_id: Optional[str] = None


# Driver Status
class DriverStatusUpdate(BaseModel):
    is_active: bool
