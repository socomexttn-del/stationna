from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'volt-taxi-secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', 24))

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Create the main app
app = FastAPI(title="Volt Taxi API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ======================== NOTIFICATION SYSTEM ========================

class NotificationManager:
    """Store notifications in MongoDB for reliable delivery via polling"""
    
    async def create_notification(self, user_id: str, notification_type: str, data: dict, role: str = None):
        """Create a notification for a user or broadcast to all drivers"""
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,  # Can be "broadcast_drivers" for all drivers
            "role": role,
            "type": notification_type,
            "data": data,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        return notification
    
    async def notify_all_drivers(self, notification_type: str, data: dict):
        """Broadcast notification to all available drivers"""
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": "broadcast_drivers",
            "role": "driver",
            "type": notification_type,
            "data": data,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        return notification
    
    async def notify_passenger(self, passenger_id: str, notification_type: str, data: dict):
        """Send notification to specific passenger"""
        return await self.create_notification(passenger_id, notification_type, data, "passenger")
    
    async def get_notifications(self, user_id: str, role: str, since: str = None):
        """Get unread notifications for a user"""
        query = {
            "$or": [
                {"user_id": user_id, "read": False},
                {"user_id": "broadcast_drivers", "role": role, "read": False}
            ]
        }
        if since:
            query["created_at"] = {"$gt": since}
        
        notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
        return notifications
    
    async def mark_as_read(self, notification_ids: list, user_id: str):
        """Mark notifications as read"""
        await db.notifications.update_many(
            {"id": {"$in": notification_ids}},
            {"$set": {"read": True}}
        )

notification_manager = NotificationManager()

# ======================== MODELS ========================

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: str
    role: str = Field(..., pattern="^(passenger|driver)$")

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
    rating: float = 5.0
    total_rides: int = 0
    is_available: bool = False
    vehicle_info: Optional[Dict] = None
    created_at: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class LocationModel(BaseModel):
    lat: float
    lng: float
    address: str

class RideRequest(BaseModel):
    pickup: LocationModel
    destination: LocationModel

class RideResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    passenger_id: str
    passenger_name: str
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    pickup: Dict
    destination: Dict
    distance_km: float
    estimated_fare: float
    final_fare: Optional[float] = None
    status: str
    payment_status: str = "pending"
    scheduled_time: Optional[str] = None
    created_at: str
    accepted_at: Optional[str] = None
    completed_at: Optional[str] = None

class RatingCreate(BaseModel):
    ride_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class DriverAvailability(BaseModel):
    is_available: bool
    location: Optional[LocationModel] = None

class VehicleUpdate(BaseModel):
    make: str
    model: str
    year: int
    color: str
    license_plate: str

class FareEstimateRequest(BaseModel):
    pickup: LocationModel
    destination: LocationModel

class PaymentCreateRequest(BaseModel):
    ride_id: str
    origin_url: str

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

# Models for new features
class ScheduledRideRequest(BaseModel):
    pickup: LocationModel
    destination: LocationModel
    scheduled_time: str  # ISO format datetime

class FavoriteAddressCreate(BaseModel):
    name: str  # "Maison", "Travail", etc.
    location: LocationModel

class FavoriteAddressResponse(BaseModel):
    id: str
    user_id: str
    name: str
    location: Dict
    created_at: str

class PromoCodeCreate(BaseModel):
    code: str
    discount_percent: int = Field(..., ge=1, le=100)
    max_uses: int = 100
    valid_until: str  # ISO format datetime

class PromoCodeApply(BaseModel):
    code: str

class PaymentHistoryResponse(BaseModel):
    id: str
    ride_id: str
    amount: float
    currency: str
    status: str
    created_at: str
    ride_pickup: str
    ride_destination: str

# ======================== HELPERS ========================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token_data = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": token_data["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def calculate_distance(pickup: Dict, destination: Dict) -> float:
    """Calculate distance between two points using Haversine formula"""
    import math
    lat1, lon1 = pickup['lat'], pickup['lng']
    lat2, lon2 = destination['lat'], destination['lng']
    
    R = 6371  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return round(R * c, 2)

def estimate_duration_minutes(distance_km: float) -> int:
    """Estimate trip duration based on average city speed (25 km/h)"""
    AVG_SPEED_KMH = 25
    return max(5, round((distance_km / AVG_SPEED_KMH) * 60))

def calculate_fare(distance_km: float, duration_minutes: int = 0, is_scheduled: bool = False, is_immediate: bool = True, extra_passengers: int = 0) -> dict:
    """
    Calculate fare based on official taxi rates:
    - Prise en charge: 4.48€
    - Prix au km: 1.30€/km
    - Tarif horaire (attente): 42.15€/h = 0.70€/min
    - Tarif minimum: 8€
    - Supplément réservation immédiate: +4€
    - Supplément réservation à l'avance: +7€
    - Supplément 5ème passager+: +5.50€
    """
    # Base rates
    PRISE_EN_CHARGE = 4.48
    PRIX_KM = 1.30
    TARIF_MINUTE = 0.70  # 42.15€/h ÷ 60
    TARIF_MINIMUM = 8.00
    
    # Supplements
    SUPPLEMENT_IMMEDIAT = 4.00
    SUPPLEMENT_AVANCE = 7.00
    SUPPLEMENT_PASSAGER = 5.50
    
    # Calculate base fare
    base = PRISE_EN_CHARGE
    distance_cost = distance_km * PRIX_KM
    time_cost = duration_minutes * TARIF_MINUTE
    
    # Calculate supplements
    supplements = 0
    supplement_details = []
    
    if is_scheduled:
        supplements += SUPPLEMENT_AVANCE
        supplement_details.append({"name": "Réservation à l'avance", "amount": SUPPLEMENT_AVANCE})
    elif is_immediate:
        supplements += SUPPLEMENT_IMMEDIAT
        supplement_details.append({"name": "Réservation immédiate", "amount": SUPPLEMENT_IMMEDIAT})
    
    if extra_passengers > 0:
        passenger_supplement = SUPPLEMENT_PASSAGER * extra_passengers
        supplements += passenger_supplement
        supplement_details.append({"name": f"Supplément {extra_passengers} passager(s) sup.", "amount": passenger_supplement})
    
    # Total before minimum
    subtotal = base + distance_cost + time_cost + supplements
    
    # Apply minimum fare
    total = max(TARIF_MINIMUM, subtotal)
    
    return {
        "prise_en_charge": PRISE_EN_CHARGE,
        "distance_cost": round(distance_cost, 2),
        "time_cost": round(time_cost, 2),
        "supplements": round(supplements, 2),
        "supplement_details": supplement_details,
        "subtotal": round(subtotal, 2),
        "minimum_applied": subtotal < TARIF_MINIMUM,
        "total": round(total, 2)
    }

# ======================== AUTH ROUTES ========================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_dict = {
        "id": user_id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "role": user.role,
        "password_hash": hash_password(user.password),
        "rating": 5.0,
        "total_rides": 0,
        "is_available": False,
        "vehicle_info": None,
        "location": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_dict)
    
    token = create_token(user_id, user.email, user.role)
    user_response = UserResponse(**{k: v for k, v in user_dict.items() if k != "password_hash"})
    return TokenResponse(token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    user_response = UserResponse(**{k: v for k, v in user.items() if k != "password_hash"})
    return TokenResponse(token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**{k: v for k, v in current_user.items() if k != "password_hash"})

# ======================== USER ROUTES ========================

@api_router.put("/users/availability", response_model=UserResponse)
async def update_availability(data: DriverAvailability, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can update availability")
    
    update_data = {"is_available": data.is_available}
    if data.location:
        update_data["location"] = data.location.model_dump()
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return UserResponse(**{k: v for k, v in updated.items() if k != "password_hash"})

@api_router.put("/users/vehicle", response_model=UserResponse)
async def update_vehicle(data: VehicleUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can update vehicle info")
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"vehicle_info": data.model_dump()}})
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return UserResponse(**{k: v for k, v in updated.items() if k != "password_hash"})

@api_router.get("/drivers/available", response_model=List[UserResponse])
async def get_available_drivers(current_user: dict = Depends(get_current_user)):
    drivers = await db.users.find({"role": "driver", "is_available": True}, {"_id": 0, "password_hash": 0}).to_list(100)
    return [UserResponse(**d) for d in drivers]

@api_router.put("/drivers/location")
async def update_driver_location(data: LocationModel, current_user: dict = Depends(get_current_user)):
    """Update driver's current GPS location"""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can update location")
    
    location_data = data.model_dump()
    location_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"id": current_user["id"]}, 
        {"$set": {"location": location_data}}
    )
    
    # Also notify passenger if driver has an active ride
    active_ride = await db.rides.find_one({
        "driver_id": current_user["id"],
        "status": {"$in": ["accepted", "in_progress"]}
    }, {"_id": 0})
    
    if active_ride:
        await notification_manager.notify_passenger(active_ride["passenger_id"], "driver_location", {
            "ride_id": active_ride["id"],
            "location": location_data
        })
    
    return {"status": "ok", "location": location_data}

@api_router.get("/rides/{ride_id}/driver-location")
async def get_driver_location(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Get current location of driver for a specific ride"""
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["passenger_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    if not ride.get("driver_id"):
        return {"location": None}
    
    driver = await db.users.find_one({"id": ride["driver_id"]}, {"_id": 0, "location": 1})
    return {"location": driver.get("location") if driver else None}

# ======================== RIDE ROUTES ========================

@api_router.post("/rides/estimate")
async def estimate_fare(data: FareEstimateRequest):
    distance = calculate_distance(data.pickup.model_dump(), data.destination.model_dump())
    duration = estimate_duration_minutes(distance)
    fare_details = calculate_fare(distance, duration, is_scheduled=False, is_immediate=True)
    
    return {
        "distance_km": distance,
        "duration_minutes": duration,
        "fare_details": fare_details,
        "estimated_fare": fare_details["total"],
        "currency": "EUR"
    }

@api_router.post("/rides", response_model=RideResponse)
async def create_ride(data: RideRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "passenger":
        raise HTTPException(status_code=403, detail="Only passengers can create rides")
    
    pickup = data.pickup.model_dump()
    destination = data.destination.model_dump()
    distance = calculate_distance(pickup, destination)
    duration = estimate_duration_minutes(distance)
    fare_details = calculate_fare(distance, duration, is_scheduled=False, is_immediate=True)
    fare = fare_details["total"]
    
    # Check for available promo code
    discount_applied = 0
    promo_used = None
    user_promo = await db.user_promos.find_one({
        "user_id": current_user["id"],
        "used": False
    }, {"_id": 0})
    
    if user_promo:
        discount_applied = user_promo["discount_percent"]
        fare = round(fare * (1 - discount_applied / 100), 2)
        promo_used = user_promo["id"]
        # Mark promo as used
        await db.user_promos.update_one({"id": user_promo["id"]}, {"$set": {"used": True}})
        # Increment promo code usage
        await db.promo_codes.update_one({"id": user_promo["promo_id"]}, {"$inc": {"used_count": 1}})
    
    ride_id = str(uuid.uuid4())
    ride = {
        "id": ride_id,
        "passenger_id": current_user["id"],
        "passenger_name": f"{current_user['first_name']} {current_user['last_name']}",
        "driver_id": None,
        "driver_name": None,
        "pickup": pickup,
        "destination": destination,
        "distance_km": distance,
        "estimated_fare": fare,
        "discount_applied": discount_applied,
        "promo_used": promo_used,
        "final_fare": None,
        "status": "pending",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None,
        "completed_at": None
    }
    await db.rides.insert_one(ride)
    
    # Notify all drivers about the new ride
    await notification_manager.notify_all_drivers("new_ride", {
        "id": ride_id,
        "passenger_name": ride["passenger_name"],
        "pickup": pickup,
        "destination": destination,
        "distance_km": distance,
        "estimated_fare": fare
    })
    
    return RideResponse(**ride)

@api_router.get("/rides/available", response_model=List[RideResponse])
async def get_available_rides(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can view available rides")
    rides = await db.rides.find({"status": "pending"}, {"_id": 0}).to_list(100)
    return [RideResponse(**r) for r in rides]

@api_router.get("/rides/active", response_model=Optional[RideResponse])
async def get_active_ride(current_user: dict = Depends(get_current_user)):
    query = {"status": {"$in": ["pending", "accepted", "in_progress"]}}
    if current_user["role"] == "passenger":
        query["passenger_id"] = current_user["id"]
    else:
        query["driver_id"] = current_user["id"]
    
    ride = await db.rides.find_one(query, {"_id": 0})
    return RideResponse(**ride) if ride else None

@api_router.post("/rides/{ride_id}/accept", response_model=RideResponse)
async def accept_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can accept rides")
    
    ride = await db.rides.find_one({"id": ride_id, "status": "pending"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or already taken")
    
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "driver_id": current_user["id"],
        "driver_name": f"{current_user['first_name']} {current_user['last_name']}",
        "status": "accepted",
        "accepted_at": datetime.now(timezone.utc).isoformat()
    }})
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"is_available": False}})
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    # Notify passenger that driver accepted
    await notification_manager.notify_passenger(ride["passenger_id"], "ride_accepted", {
        "driver_name": f"{current_user['first_name']} {current_user['last_name']}",
        "driver_id": current_user["id"],
        "ride_id": ride_id
    })
    
    # Notify other drivers that ride is taken
    await notification_manager.notify_all_drivers("ride_taken", {"ride_id": ride_id})
    
    return RideResponse(**updated)

@api_router.post("/rides/{ride_id}/start", response_model=RideResponse)
async def start_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can start rides")
    
    ride = await db.rides.find_one({"id": ride_id, "driver_id": current_user["id"], "status": "accepted"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    await db.rides.update_one({"id": ride_id}, {"$set": {"status": "in_progress"}})
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    # Notify passenger that ride started
    await notification_manager.notify_passenger(ride["passenger_id"], "ride_started", {"ride_id": ride_id})
    
    return RideResponse(**updated)

@api_router.post("/rides/{ride_id}/complete", response_model=RideResponse)
async def complete_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can complete rides")
    
    ride = await db.rides.find_one({"id": ride_id, "driver_id": current_user["id"], "status": "in_progress"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "completed",
        "final_fare": ride["estimated_fare"],
        "completed_at": datetime.now(timezone.utc).isoformat()
    }})
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"is_available": True}})
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"total_rides": 1}})
    await db.users.update_one({"id": ride["passenger_id"]}, {"$inc": {"total_rides": 1}})
    
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    # Notify passenger that ride completed
    await notification_manager.notify_passenger(ride["passenger_id"], "ride_completed", {
        "ride_id": ride_id,
        "final_fare": ride["estimated_fare"]
    })
    
    return RideResponse(**updated)

@api_router.post("/rides/{ride_id}/cancel", response_model=RideResponse)
async def cancel_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["passenger_id"] != current_user["id"] and ride.get("driver_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if ride["status"] in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this ride")
    
    await db.rides.update_one({"id": ride_id}, {"$set": {"status": "cancelled"}})
    
    if ride.get("driver_id"):
        await db.users.update_one({"id": ride["driver_id"]}, {"$set": {"is_available": True}})
    
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    return RideResponse(**updated)

@api_router.get("/rides/{ride_id}", response_model=RideResponse)
async def get_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    return RideResponse(**ride)

@api_router.get("/rides/history/me", response_model=List[RideResponse])
async def get_ride_history(current_user: dict = Depends(get_current_user)):
    query = {"passenger_id": current_user["id"]} if current_user["role"] == "passenger" else {"driver_id": current_user["id"]}
    query["status"] = {"$in": ["completed", "cancelled"]}
    rides = await db.rides.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [RideResponse(**r) for r in rides]

# ======================== RATING ROUTES ========================

@api_router.post("/ratings")
async def create_rating(data: RatingCreate, current_user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": data.ride_id, "status": "completed"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or not completed")
    
    # Determine who is being rated
    if current_user["role"] == "passenger":
        if ride["passenger_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not your ride")
        rated_user_id = ride["driver_id"]
    else:
        if ride["driver_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not your ride")
        rated_user_id = ride["passenger_id"]
    
    # Check if already rated
    existing = await db.ratings.find_one({"ride_id": data.ride_id, "rater_id": current_user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Already rated this ride")
    
    rating = {
        "id": str(uuid.uuid4()),
        "ride_id": data.ride_id,
        "rater_id": current_user["id"],
        "rated_user_id": rated_user_id,
        "rating": data.rating,
        "comment": data.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.ratings.insert_one(rating)
    
    # Update user's average rating
    all_ratings = await db.ratings.find({"rated_user_id": rated_user_id}, {"_id": 0}).to_list(1000)
    avg_rating = sum(r["rating"] for r in all_ratings) / len(all_ratings)
    await db.users.update_one({"id": rated_user_id}, {"$set": {"rating": round(avg_rating, 2)}})
    
    return {"message": "Rating submitted", "rating": rating}

@api_router.get("/ratings/user/{user_id}")
async def get_user_ratings(user_id: str):
    ratings = await db.ratings.find({"rated_user_id": user_id}, {"_id": 0}).to_list(100)
    return ratings

# ======================== PAYMENT ROUTES ========================

@api_router.post("/payments/create-checkout")
async def create_checkout(data: PaymentCreateRequest, request: Request, current_user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": data.ride_id, "status": "completed"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or not completed")
    
    if ride["passenger_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    if ride["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Already paid")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    amount = float(ride["final_fare"] or ride["estimated_fare"])
    success_url = f"{data.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/payment/cancel"
    
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "ride_id": data.ride_id,
            "user_id": current_user["id"],
            "user_email": current_user["email"]
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    transaction = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "ride_id": data.ride_id,
        "user_id": current_user["id"],
        "user_email": current_user["email"],
        "amount": amount,
        "currency": "eur",
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(transaction)
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction and ride if paid
    if status.payment_status == "paid":
        transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if transaction and transaction["payment_status"] != "paid":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            await db.rides.update_one(
                {"id": transaction["ride_id"]},
                {"$set": {"payment_status": "paid"}}
            )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
            if transaction and transaction["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                await db.rides.update_one(
                    {"id": webhook_response.metadata.get("ride_id")},
                    {"$set": {"payment_status": "paid"}}
                )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# ======================== STATS ROUTES ========================

@api_router.get("/stats/driver")
async def get_driver_stats(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can view driver stats")
    
    completed_rides = await db.rides.find({"driver_id": current_user["id"], "status": "completed"}, {"_id": 0}).to_list(1000)
    total_earnings = sum(r.get("final_fare") or r.get("estimated_fare") for r in completed_rides)
    
    today = datetime.now(timezone.utc).date().isoformat()
    today_rides = [r for r in completed_rides if r["completed_at"] and r["completed_at"].startswith(today)]
    today_earnings = sum(r.get("final_fare") or r.get("estimated_fare") for r in today_rides)
    
    return {
        "total_rides": len(completed_rides),
        "total_earnings": round(total_earnings, 2),
        "today_rides": len(today_rides),
        "today_earnings": round(today_earnings, 2),
        "rating": current_user.get("rating", 5.0)
    }

# ======================== SCHEDULED RIDES ========================

@api_router.post("/rides/schedule", response_model=RideResponse)
async def schedule_ride(data: ScheduledRideRequest, current_user: dict = Depends(get_current_user)):
    """Schedule a ride for a future time (with +7€ supplement)"""
    if current_user["role"] != "passenger":
        raise HTTPException(status_code=403, detail="Only passengers can schedule rides")
    
    # Validate scheduled time is in the future
    try:
        scheduled_dt = datetime.fromisoformat(data.scheduled_time.replace('Z', '+00:00'))
        if scheduled_dt <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format")
    
    pickup = data.pickup.model_dump()
    destination = data.destination.model_dump()
    distance = calculate_distance(pickup, destination)
    duration = estimate_duration_minutes(distance)
    fare_details = calculate_fare(distance, duration, is_scheduled=True, is_immediate=False)
    fare = fare_details["total"]
    
    ride_id = str(uuid.uuid4())
    ride = {
        "id": ride_id,
        "passenger_id": current_user["id"],
        "passenger_name": f"{current_user['first_name']} {current_user['last_name']}",
        "driver_id": None,
        "driver_name": None,
        "pickup": pickup,
        "destination": destination,
        "distance_km": distance,
        "duration_minutes": duration,
        "estimated_fare": fare,
        "fare_details": fare_details,
        "final_fare": None,
        "status": "scheduled",
        "payment_status": "pending",
        "scheduled_time": data.scheduled_time,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None,
        "completed_at": None
    }
    await db.rides.insert_one(ride)
    return RideResponse(**ride)

@api_router.get("/rides/scheduled", response_model=List[RideResponse])
async def get_scheduled_rides(current_user: dict = Depends(get_current_user)):
    """Get all scheduled rides for the current user"""
    query = {"status": "scheduled"}
    if current_user["role"] == "passenger":
        query["passenger_id"] = current_user["id"]
    rides = await db.rides.find(query, {"_id": 0}).sort("scheduled_time", 1).to_list(50)
    
    if not rides:
        # Return empty list instead of raising 404
        return []
    
    return [RideResponse(**r) for r in rides]

@api_router.post("/rides/{ride_id}/activate", response_model=RideResponse)
async def activate_scheduled_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Activate a scheduled ride (change status to pending)"""
    ride = await db.rides.find_one({"id": ride_id, "status": "scheduled"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Scheduled ride not found")
    
    if ride["passenger_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    await db.rides.update_one({"id": ride_id}, {"$set": {"status": "pending"}})
    
    # Notify drivers
    await notification_manager.notify_all_drivers("new_ride", {
        "id": ride_id,
        "passenger_name": ride["passenger_name"],
        "pickup": ride["pickup"],
        "destination": ride["destination"],
        "distance_km": ride["distance_km"],
        "estimated_fare": ride["estimated_fare"]
    })
    
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    return RideResponse(**updated)

# ======================== FAVORITE ADDRESSES ========================

@api_router.post("/favorites", response_model=FavoriteAddressResponse)
async def add_favorite_address(data: FavoriteAddressCreate, current_user: dict = Depends(get_current_user)):
    """Add a favorite address"""
    # Check if name already exists
    existing = await db.favorite_addresses.find_one({
        "user_id": current_user["id"],
        "name": data.name
    })
    if existing:
        # Update existing
        await db.favorite_addresses.update_one(
            {"id": existing["id"]},
            {"$set": {"location": data.location.model_dump()}}
        )
        updated = await db.favorite_addresses.find_one({"id": existing["id"]}, {"_id": 0})
        return FavoriteAddressResponse(**updated)
    
    fav_id = str(uuid.uuid4())
    favorite = {
        "id": fav_id,
        "user_id": current_user["id"],
        "name": data.name,
        "location": data.location.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.favorite_addresses.insert_one(favorite)
    return FavoriteAddressResponse(**favorite)

@api_router.get("/favorites", response_model=List[FavoriteAddressResponse])
async def get_favorite_addresses(current_user: dict = Depends(get_current_user)):
    """Get all favorite addresses for current user"""
    favorites = await db.favorite_addresses.find(
        {"user_id": current_user["id"]}, 
        {"_id": 0}
    ).to_list(20)
    return [FavoriteAddressResponse(**f) for f in favorites]

@api_router.delete("/favorites/{favorite_id}")
async def delete_favorite_address(favorite_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a favorite address"""
    result = await db.favorite_addresses.delete_one({
        "id": favorite_id,
        "user_id": current_user["id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    return {"status": "ok"}

# ======================== PROMO CODES ========================

@api_router.post("/promo/create")
async def create_promo_code(data: PromoCodeCreate, current_user: dict = Depends(get_current_user)):
    """Create a promo code (admin only - for demo, any user can create)"""
    existing = await db.promo_codes.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Promo code already exists")
    
    promo = {
        "id": str(uuid.uuid4()),
        "code": data.code.upper(),
        "discount_percent": data.discount_percent,
        "max_uses": data.max_uses,
        "used_count": 0,
        "valid_until": data.valid_until,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.promo_codes.insert_one(promo)
    # Return only serializable data without MongoDB _id
    return {"status": "ok", "promo": {k: v for k, v in promo.items() if k != "_id"}}

@api_router.post("/promo/apply")
async def apply_promo_code(data: PromoCodeApply, current_user: dict = Depends(get_current_user)):
    """Apply a promo code to user's account"""
    promo = await db.promo_codes.find_one({"code": data.code.upper()}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="Code promo invalide")
    
    # Check if still valid
    valid_until = datetime.fromisoformat(promo["valid_until"].replace('Z', '+00:00'))
    if valid_until < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code promo expiré")
    
    # Check max uses
    if promo["used_count"] >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="Code promo épuisé")
    
    # Check if user already used this code
    user_promo = await db.user_promos.find_one({
        "user_id": current_user["id"],
        "promo_id": promo["id"]
    })
    if user_promo:
        raise HTTPException(status_code=400, detail="Vous avez déjà utilisé ce code")
    
    # Add promo to user
    await db.user_promos.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "promo_id": promo["id"],
        "code": promo["code"],
        "discount_percent": promo["discount_percent"],
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "status": "ok",
        "message": f"Code promo appliqué! {promo['discount_percent']}% de réduction sur votre prochaine course",
        "discount_percent": promo["discount_percent"]
    }

@api_router.get("/promo/my-codes")
async def get_my_promo_codes(current_user: dict = Depends(get_current_user)):
    """Get user's available promo codes"""
    promos = await db.user_promos.find(
        {"user_id": current_user["id"], "used": False},
        {"_id": 0}
    ).to_list(20)
    return {"promos": promos}

@api_router.get("/promo/referral")
async def get_referral_code(current_user: dict = Depends(get_current_user)):
    """Get user's referral code"""
    # Create referral code based on user id
    referral_code = f"REF{current_user['id'][:8].upper()}"
    
    # Check if promo exists, if not create it
    existing = await db.promo_codes.find_one({"code": referral_code})
    if not existing:
        promo = {
            "id": str(uuid.uuid4()),
            "code": referral_code,
            "discount_percent": 10,
            "max_uses": 100,
            "used_count": 0,
            "valid_until": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
            "created_by": current_user["id"],
            "is_referral": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.promo_codes.insert_one(promo)
    
    return {"referral_code": referral_code, "discount_percent": 10}

# ======================== PAYMENT HISTORY ========================

@api_router.get("/payments/history")
async def get_payment_history(current_user: dict = Depends(get_current_user)):
    """Get payment history for current user"""
    transactions = await db.payment_transactions.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Enrich with ride info
    result = []
    for t in transactions:
        ride = await db.rides.find_one({"id": t["ride_id"]}, {"_id": 0, "pickup": 1, "destination": 1})
        result.append({
            "id": t["id"],
            "ride_id": t["ride_id"],
            "amount": t["amount"],
            "currency": t.get("currency", "eur"),
            "status": t.get("payment_status", "unknown"),
            "created_at": t["created_at"],
            "ride_pickup": ride["pickup"]["address"] if ride else "N/A",
            "ride_destination": ride["destination"]["address"] if ride else "N/A"
        })
    
    return {"payments": result}

@api_router.get("/payments/summary")
async def get_payment_summary(current_user: dict = Depends(get_current_user)):
    """Get payment summary for current user"""
    transactions = await db.payment_transactions.find(
        {"user_id": current_user["id"], "payment_status": "paid"},
        {"_id": 0}
    ).to_list(1000)
    
    total_spent = sum(t.get("amount", 0) for t in transactions)
    total_rides = len(transactions)
    
    return {
        "total_spent": round(total_spent, 2),
        "total_rides_paid": total_rides,
        "currency": "EUR"
    }

# ======================== NOTIFICATION ROUTES ========================

@api_router.get("/notifications")
async def get_notifications(since: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get unread notifications for the current user"""
    notifications = await notification_manager.get_notifications(
        current_user["id"], 
        current_user["role"],
        since
    )
    return {"notifications": notifications}

@api_router.post("/notifications/read")
async def mark_notifications_read(notification_ids: List[str], current_user: dict = Depends(get_current_user)):
    """Mark notifications as read"""
    await notification_manager.mark_as_read(notification_ids, current_user["id"])
    return {"status": "ok"}

# ======================== CHAT ROUTES ========================

@api_router.post("/chat/send", response_model=ChatMessageResponse)
async def send_chat_message(data: ChatMessage, current_user: dict = Depends(get_current_user)):
    """Send a chat message for a specific ride"""
    ride = await db.rides.find_one({"id": data.ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Verify user is part of this ride
    if ride["passenger_id"] != current_user["id"] and ride.get("driver_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to send messages for this ride")
    
    # Only allow chat during active ride
    if ride["status"] not in ["accepted", "in_progress"]:
        raise HTTPException(status_code=400, detail="Chat only available during active ride")
    
    message_id = str(uuid.uuid4())
    message = {
        "id": message_id,
        "ride_id": data.ride_id,
        "sender_id": current_user["id"],
        "sender_name": f"{current_user['first_name']} {current_user['last_name']}",
        "sender_role": current_user["role"],
        "message": data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chat_messages.insert_one(message)
    
    # Notify the other party
    recipient_id = ride["driver_id"] if current_user["role"] == "passenger" else ride["passenger_id"]
    if recipient_id:
        await notification_manager.create_notification(
            recipient_id, 
            "new_message",
            {
                "ride_id": data.ride_id,
                "sender_name": message["sender_name"],
                "message": data.message[:50] + "..." if len(data.message) > 50 else data.message
            },
            "driver" if current_user["role"] == "passenger" else "passenger"
        )
    
    return ChatMessageResponse(**message)

@api_router.get("/chat/{ride_id}", response_model=List[ChatMessageResponse])
async def get_chat_messages(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Get all chat messages for a specific ride"""
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Verify user is part of this ride
    if ride["passenger_id"] != current_user["id"] and ride.get("driver_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view messages for this ride")
    
    messages = await db.chat_messages.find({"ride_id": ride_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return [ChatMessageResponse(**m) for m in messages]

@api_router.get("/chat/{ride_id}/unread-count")
async def get_unread_message_count(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Get count of unread messages for a ride"""
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        return {"count": 0}
    
    # Count messages from the other party
    other_role = "driver" if current_user["role"] == "passenger" else "passenger"
    count = await db.chat_messages.count_documents({
        "ride_id": ride_id,
        "sender_role": other_role,
        "read_by": {"$ne": current_user["id"]}
    })
    return {"count": count}

@api_router.post("/chat/{ride_id}/mark-read")
async def mark_messages_read(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Mark all messages in a ride as read by current user"""
    await db.chat_messages.update_many(
        {"ride_id": ride_id, "sender_id": {"$ne": current_user["id"]}},
        {"$addToSet": {"read_by": current_user["id"]}}
    )
    return {"status": "ok"}

@api_router.get("/")
async def root():
    return {"message": "Volt Taxi API", "status": "running"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
