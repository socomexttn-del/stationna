"""
User-related Pydantic models
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: str
    role: str = "passenger"
    company_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
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
    vehicle_info: Optional[Dict[str, Any]] = None
    location: Optional[Dict[str, float]] = None
    created_at: Optional[datetime] = None
    documents: Optional[List[Dict[str, Any]]] = None

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class LocationModel(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None

class DriverAvailability(BaseModel):
    is_available: bool

class VehicleUpdate(BaseModel):
    brand: str
    model: str
    color: str
    license_plate: str
    year: int
    vehicle_type: str = "standard"

class VehicleDocuments(BaseModel):
    id_card: Optional[str] = None
    driving_license: Optional[str] = None
    vtc_card: Optional[str] = None
    vehicle_registration: Optional[str] = None
    insurance: Optional[str] = None
    proof_of_address: Optional[str] = None
    criminal_record: Optional[str] = None
    technical_inspection: Optional[str] = None
    professional_card: Optional[str] = None
    kbis: Optional[str] = None
    rib: Optional[str] = None

class DriverDocumentsUpdate(BaseModel):
    doc_type: str
    url: str
    expiry_date: Optional[str] = None

class DriverStatusUpdate(BaseModel):
    is_active: bool
