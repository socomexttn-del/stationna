"""
Pydantic models for StationCab API
"""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime


# ==================== AUTH MODELS ====================

class RegisterModel(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: str = "passenger"


class LoginModel(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    token: str
    user: dict


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    siret: Optional[str] = None
    address: Optional[str] = None
    tva_number: Optional[str] = None
    iban: Optional[str] = None


# ==================== USER MODELS ====================

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: str
    rating: Optional[float] = None
    total_rides: Optional[int] = 0
    is_available: Optional[bool] = False
    vehicle_info: Optional[Dict] = None
    created_at: Optional[str] = None
    company_name: Optional[str] = None
    siret: Optional[str] = None
    address: Optional[str] = None
    tva_number: Optional[str] = None
    iban: Optional[str] = None
    wallet_balance: Optional[float] = 0.0
    # Driver specific
    driver_vehicle_types: Optional[List[str]] = None
    documents: Optional[Dict] = None
    is_active: Optional[bool] = True
    deactivated_at: Optional[str] = None


# ==================== RIDE MODELS ====================

class LocationModel(BaseModel):
    address: str
    lat: float
    lng: float


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
    vehicle_type: str = "standard"
    passenger_count: int = 1
    promo_code: Optional[str] = None


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


class MeterPriceRequest(BaseModel):
    meter_price: float


# ==================== PAYMENT MODELS ====================

class SavedCard(BaseModel):
    brand: str
    last4: str
    exp_month: int
    exp_year: int


class ChargeCardRequest(BaseModel):
    amount: int  # Amount in cents
    description: str
    metadata: dict = {}


class AuthorizePaymentRequest(BaseModel):
    amount: int  # Amount in cents
    description: str
    metadata: dict = {}


class WalletTopUpRequest(BaseModel):
    amount: float


# ==================== PROMO MODELS ====================

class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str  # "percentage" or "fixed"
    discount_value: float
    max_uses: Optional[int] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    min_fare: Optional[float] = None
    max_discount: Optional[float] = None


class PromoCodeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    code: str
    discount_type: str
    discount_value: float
    max_uses: Optional[int] = None
    current_uses: int = 0
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    min_fare: Optional[float] = None
    max_discount: Optional[float] = None
    is_active: bool = True
    created_at: str
