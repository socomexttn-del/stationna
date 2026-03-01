"""
Ride-related Pydantic models
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class FareEstimateRequest(BaseModel):
    pickup: Dict[str, Any]
    destination: Dict[str, Any]
    is_scheduled: bool = False
    vehicle_type: str = "standard"
    passenger_count: int = 1
    stops: Optional[List[Dict[str, Any]]] = None

class RideRequest(BaseModel):
    pickup: Dict[str, Any]
    destination: Dict[str, Any]
    vehicle_type: str = "standard"
    passenger_count: int = 1
    stops: Optional[List[Dict[str, Any]]] = None

class RideResponse(BaseModel):
    id: str
    passenger_id: str
    driver_id: Optional[str] = None
    pickup: Dict[str, Any]
    destination: Dict[str, Any]
    stops: Optional[List[Dict[str, Any]]] = None
    status: str
    vehicle_type: str = "standard"
    passenger_count: int = 1
    estimated_fare: float
    final_fare: Optional[float] = None
    distance_km: float
    estimated_duration: int
    payment_status: str = "pending"
    payment_method: Optional[str] = None
    created_at: datetime
    accepted_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    driver_info: Optional[Dict[str, Any]] = None
    passenger_info: Optional[Dict[str, Any]] = None
    is_scheduled: bool = False
    scheduled_time: Optional[datetime] = None
    rating: Optional[float] = None
    review: Optional[str] = None
    passenger_rating: Optional[float] = None
    passenger_review: Optional[str] = None

class ScheduledRideRequest(BaseModel):
    pickup: Dict[str, Any]
    destination: Dict[str, Any]
    scheduled_time: str
    vehicle_type: str = "standard"
    passenger_count: int = 1

class RescheduleRideRequest(BaseModel):
    scheduled_time: Optional[str] = None
    pickup: Optional[Dict[str, Any]] = None
    destination: Optional[Dict[str, Any]] = None
    vehicle_type: Optional[str] = None
    passenger_count: Optional[int] = None

class RatingCreate(BaseModel):
    ride_id: str
    rating: float
    review: Optional[str] = None
    rating_type: str = "driver"

class FavoriteAddressCreate(BaseModel):
    label: str
    address: Dict[str, Any]

class FavoriteAddressResponse(BaseModel):
    id: str
    label: str
    address: Dict[str, Any]
    use_count: int = 0
    created_at: datetime

class FrequentTripCreate(BaseModel):
    name: str
    pickup: Dict[str, Any]
    destination: Dict[str, Any]
    vehicle_type: str = "standard"
    passenger_count: int = 1

class FrequentTripResponse(BaseModel):
    id: str
    name: str
    pickup: Dict[str, Any]
    destination: Dict[str, Any]
    vehicle_type: str = "standard"
    passenger_count: int = 1
    use_count: int = 0
    created_at: datetime
