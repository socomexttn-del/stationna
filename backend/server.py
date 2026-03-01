from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import math
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import stripe
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
stripe.api_key = STRIPE_API_KEY

# Stripe publishable key for frontend (test mode)
STRIPE_PUBLISHABLE_KEY = "pk_test_51J5B0aIhFRBc7tGx0JDKBKeJkqwUnUIud8an11Pw16H2O3zx6OcvobFGwzHMHO1sL2Zf1L9AKW9lLJmDa1Umxzyd00f17O26XT"

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
    
    async def notify_driver(self, driver_id: str, notification_type: str, data: dict):
        """Send notification to specific driver"""
        return await self.create_notification(driver_id, notification_type, data, "driver")
    
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
    role: str = Field(..., pattern="^(passenger|driver|admin)$")
    company_name: Optional[str] = None  # Pour les chauffeurs

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

class LocationModel(BaseModel):
    lat: float
    lng: float
    address: str

class RideResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    reservation_number: Optional[str] = None  # Numéro de réservation court
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
    stops: Optional[List[Dict]] = None  # Intermediate stops
    distance_km: float
    estimated_fare: float
    commission_rate: float = 0.18  # 18% commission
    commission_amount: Optional[float] = None
    driver_earnings: Optional[float] = None  # Montant après commission
    final_fare: Optional[float] = None
    status: str
    payment_status: str = "pending"
    payment_method: Optional[str] = None  # card, cash
    scheduled_time: Optional[str] = None
    created_at: str
    accepted_at: Optional[str] = None
    completed_at: Optional[str] = None
    vehicle_type: str = "standard"
    passenger_count: int = 1
    driver_eta_minutes: Optional[int] = None
    driver_distance_km: Optional[float] = None

class RatingCreate(BaseModel):
    ride_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class DriverAvailability(BaseModel):
    is_available: bool
    location: Optional[LocationModel] = None

class VehicleUpdate(BaseModel):
    make: str  # Marque (Peugeot, Renault, etc.)
    model: str  # Modèle (308, Clio, etc.)
    year: int
    color: str
    license_plate: str  # Plaque d'immatriculation
    vehicle_type: str = "standard"  # standard ou van

class VehicleDocuments(BaseModel):
    carte_grise: Optional[str] = None  # URL du document
    assurance: Optional[str] = None
    controle_technique: Optional[str] = None
    permis_conduire: Optional[str] = None
    carte_vtc: Optional[str] = None  # Carte professionnelle VTC

# Extended driver document types
DRIVER_DOCUMENT_TYPES = {
    # Vehicle documents
    "carte_grise": {"name": "Carte Grise", "category": "vehicle", "required": True, "has_expiry": False},
    "assurance": {"name": "Assurance Véhicule", "category": "vehicle", "required": True, "has_expiry": True},
    "controle_technique": {"name": "Contrôle Technique", "category": "vehicle", "required": True, "has_expiry": True},
    # Personal documents  
    "permis_conduire": {"name": "Permis de Conduire", "category": "personal", "required": True, "has_expiry": True},
    "carte_vtc": {"name": "Carte VTC", "category": "professional", "required": True, "has_expiry": True},
    "cni": {"name": "Carte Nationale d'Identité", "category": "personal", "required": True, "has_expiry": True},
    "justificatif_domicile": {"name": "Justificatif de Domicile", "category": "personal", "required": True, "has_expiry": False},
    # Professional documents
    "rc_pro": {"name": "RC Professionnelle", "category": "professional", "required": True, "has_expiry": True},
    "kbis": {"name": "Extrait KBIS", "category": "professional", "required": False, "has_expiry": False},
    "attestation_vigilance": {"name": "Attestation de Vigilance URSSAF", "category": "professional", "required": False, "has_expiry": True},
    "rib": {"name": "RIB (Relevé d'Identité Bancaire)", "category": "financial", "required": True, "has_expiry": False},
}

class DriverDocumentsUpdate(BaseModel):
    document_type: str
    document_url: str
    expiry_date: Optional[str] = None  # Date d'expiration

class FareEstimateRequest(BaseModel):
    pickup: LocationModel
    destination: LocationModel
    stops: Optional[List[LocationModel]] = None  # Intermediate stops
    vehicle_type: str = "standard"  # "standard" (4 places) or "van" (7 places)
    passenger_count: int = 1

class RideRequest(BaseModel):
    pickup: LocationModel
    destination: LocationModel
    stops: Optional[List[LocationModel]] = None  # Intermediate stops
    vehicle_type: str = "standard"
    passenger_count: int = 1

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

class FrequentTripCreate(BaseModel):
    name: str  # "Maison → Travail", "Domicile → CDG", etc.
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
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Verify that the current user is an admin"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def calculate_distance(pickup: Dict, destination: Dict) -> float:
    """Calculate distance between two points using Haversine formula"""
    lat1, lon1 = pickup['lat'], pickup['lng']
    lat2, lon2 = destination['lat'], destination['lng']
    
    R = 6371  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return round(R * c, 2)

def calculate_total_distance_with_stops(pickup: Dict, destination: Dict, stops: Optional[List[Dict]] = None) -> tuple:
    """Calculate total distance with intermediate stops
    Returns: (total_distance_km, stop_distances list)
    """
    if not stops or len(stops) == 0:
        return calculate_distance(pickup, destination), []
    
    total_distance = 0
    stop_distances = []
    current_point = pickup
    
    # Calculate distance to each stop
    for stop in stops:
        dist = calculate_distance(current_point, stop)
        stop_distances.append({
            "from": current_point.get("address", ""),
            "to": stop.get("address", ""),
            "distance_km": dist
        })
        total_distance += dist
        current_point = stop
    
    # Distance from last stop to destination
    final_dist = calculate_distance(current_point, destination)
    stop_distances.append({
        "from": current_point.get("address", ""),
        "to": destination.get("address", ""),
        "distance_km": final_dist
    })
    total_distance += final_dist
    
    return round(total_distance, 2), stop_distances

async def find_nearest_driver(pickup_location: Dict, max_distance_km: float = 15.0) -> Optional[Dict]:
    """Find the nearest available driver to the pickup location"""
    available_drivers = await db.users.find({
        "role": "driver",
        "is_available": True,
        "location": {"$ne": None}
    }, {"_id": 0}).to_list(100)
    
    if not available_drivers:
        return None
    
    # Calculate distance for each driver and sort
    drivers_with_distance = []
    for driver in available_drivers:
        if driver.get("location") and driver["location"].get("lat") and driver["location"].get("lng"):
            distance = calculate_distance(pickup_location, driver["location"])
            if distance <= max_distance_km:
                drivers_with_distance.append({
                    "driver": driver,
                    "distance": distance
                })
    
    if not drivers_with_distance:
        return None
    
    # Sort by distance and return the nearest
    drivers_with_distance.sort(key=lambda x: x["distance"])
    nearest = drivers_with_distance[0]
    
    return {
        "driver": nearest["driver"],
        "distance_to_pickup": nearest["distance"],
        "eta_minutes": max(2, round(nearest["distance"] * 2.5))  # ~2.5 min per km in city
    }

def estimate_duration_minutes(distance_km: float) -> int:
    """Estimate trip duration based on average city speed (25 km/h)"""
    AVG_SPEED_KMH = 25
    return max(5, round((distance_km / AVG_SPEED_KMH) * 60))

def calculate_fare(distance_km: float, duration_minutes: int = 0, is_scheduled: bool = False, is_immediate: bool = True, vehicle_type: str = "standard", passenger_count: int = 1, stops_count: int = 0) -> dict:
    """
    Calculate fare based on official taxi rates:
    - Prise en charge: 4.48€
    - Prix au km: 1.30€/km
    - Tarif horaire (attente): 42.15€/h = 0.70€/min
    - Tarif minimum: 8€
    - Supplément réservation immédiate: +4€
    - Supplément réservation à l'avance: +7€
    - Supplément 5ème passager+: +5.50€ par passager
    - Van: +10€ de base
    - Supplément arrêt intermédiaire: +3€ par arrêt (temps d'attente)
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
    SUPPLEMENT_VAN = 10.00
    SUPPLEMENT_ARRET = 3.00  # Per intermediate stop
    
    # Calculate base fare
    base = PRISE_EN_CHARGE
    distance_cost = distance_km * PRIX_KM
    time_cost = duration_minutes * TARIF_MINUTE
    
    # Calculate supplements
    supplements = 0
    supplement_details = []
    
    # Vehicle type supplement
    if vehicle_type == "van":
        supplements += SUPPLEMENT_VAN
        supplement_details.append({"name": "Van (7 places)", "amount": SUPPLEMENT_VAN})
    
    if is_scheduled:
        supplements += SUPPLEMENT_AVANCE
        supplement_details.append({"name": "Réservation à l'avance", "amount": SUPPLEMENT_AVANCE})
    elif is_immediate:
        supplements += SUPPLEMENT_IMMEDIAT
        supplement_details.append({"name": "Réservation immédiate", "amount": SUPPLEMENT_IMMEDIAT})
    
    # Extra passengers (5th passenger and above)
    extra_passengers = max(0, passenger_count - 4)
    if extra_passengers > 0:
        passenger_supplement = SUPPLEMENT_PASSAGER * extra_passengers
        supplements += passenger_supplement
        supplement_details.append({"name": f"Supplément {extra_passengers} passager(s) sup.", "amount": round(passenger_supplement, 2)})
    
    # Intermediate stops supplement
    if stops_count > 0:
        stops_supplement = SUPPLEMENT_ARRET * stops_count
        supplements += stops_supplement
        supplement_details.append({"name": f"Arrêt(s) intermédiaire(s) ({stops_count})", "amount": round(stops_supplement, 2)})
    
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

@api_router.put("/drivers/documents")
async def update_driver_document(data: DriverDocumentsUpdate, current_user: dict = Depends(get_current_user)):
    """Update a specific driver document"""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can update documents")
    
    # Use extended document types
    if data.document_type not in DRIVER_DOCUMENT_TYPES:
        valid_types = list(DRIVER_DOCUMENT_TYPES.keys())
        raise HTTPException(status_code=400, detail=f"Invalid document type. Must be one of: {valid_types}")
    
    doc_data = {
        "url": data.document_url,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "expiry_date": data.expiry_date,
        "status": "pending"  # pending, approved, rejected
    }
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {f"documents.{data.document_type}": doc_data}}
    )
    
    return {"status": "ok", "document_type": data.document_type}

@api_router.delete("/drivers/documents/{doc_type}")
async def delete_driver_document(doc_type: str, current_user: dict = Depends(get_current_user)):
    """Delete a specific driver document"""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can delete documents")
    
    if doc_type not in DRIVER_DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid document type")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$unset": {f"documents.{doc_type}": ""}}
    )
    
    return {"status": "ok", "deleted": doc_type}

@api_router.get("/drivers/documents")
async def get_driver_documents(current_user: dict = Depends(get_current_user)):
    """Get all documents for current driver"""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can view their documents")
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "documents": 1, "vehicle_info": 1})
    
    # Return document types info along with uploaded documents
    return {
        "documents": user.get("documents", {}),
        "vehicle_info": user.get("vehicle_info"),
        "document_types": DRIVER_DOCUMENT_TYPES
    }

@api_router.get("/drivers/documents/status")
async def get_driver_documents_status(current_user: dict = Depends(get_current_user)):
    """Get document completion status for current driver"""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can view their documents")
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "documents": 1})
    documents = user.get("documents", {})
    
    # Count required and uploaded documents
    required_docs = [k for k, v in DRIVER_DOCUMENT_TYPES.items() if v["required"]]
    uploaded_docs = [k for k in required_docs if k in documents and documents[k].get("url")]
    approved_docs = [k for k in uploaded_docs if documents.get(k, {}).get("status") == "approved"]
    
    return {
        "total_required": len(required_docs),
        "total_uploaded": len(uploaded_docs),
        "total_approved": len(approved_docs),
        "completion_percentage": round((len(uploaded_docs) / len(required_docs)) * 100) if required_docs else 100,
        "approval_percentage": round((len(approved_docs) / len(required_docs)) * 100) if required_docs else 100,
        "missing_documents": [k for k in required_docs if k not in uploaded_docs],
        "pending_documents": [k for k in uploaded_docs if documents.get(k, {}).get("status") == "pending"],
        "rejected_documents": [k for k in uploaded_docs if documents.get(k, {}).get("status") == "rejected"]
    }

@api_router.get("/admin/drivers/{driver_id}/documents")
async def get_driver_documents_admin(driver_id: str, admin_user: dict = Depends(get_admin_user)):
    """Get all documents for a specific driver (admin only)"""
    driver = await db.users.find_one({"id": driver_id, "role": "driver"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return {
        "driver_id": driver_id,
        "name": f"{driver['first_name']} {driver['last_name']}",
        "documents": driver.get("documents", {}),
        "vehicle_info": driver.get("vehicle_info")
    }

@api_router.put("/admin/drivers/{driver_id}/documents/{doc_type}/status")
async def update_document_status(
    driver_id: str, 
    doc_type: str, 
    status: str,
    admin_user: dict = Depends(get_admin_user)
):
    """Approve or reject a driver document (admin only)"""
    if status not in ["approved", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Status must be: approved, rejected, or pending")
    
    result = await db.users.update_one(
        {"id": driver_id, "role": "driver"},
        {"$set": {f"documents.{doc_type}.status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return {"status": "ok", "document_status": status}

@api_router.get("/drivers/documents/expiring")
async def get_expiring_documents(current_user: dict = Depends(get_current_user)):
    """Get documents that are expiring soon for the current driver"""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can view their documents")
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "documents": 1})
    documents = user.get("documents", {})
    
    today = datetime.now(timezone.utc).date()
    expiring_soon = []  # Within 30 days
    expired = []
    
    for doc_type, doc_data in documents.items():
        if not doc_data or not doc_data.get("expiry_date"):
            continue
        
        try:
            expiry_date = datetime.fromisoformat(doc_data["expiry_date"].replace("Z", "+00:00")).date()
            days_until_expiry = (expiry_date - today).days
            
            doc_info = {
                "doc_type": doc_type,
                "doc_name": DRIVER_DOCUMENT_TYPES.get(doc_type, {}).get("name", doc_type),
                "expiry_date": doc_data["expiry_date"],
                "days_until_expiry": days_until_expiry,
                "status": doc_data.get("status", "pending")
            }
            
            if days_until_expiry < 0:
                expired.append(doc_info)
            elif days_until_expiry <= 30:
                expiring_soon.append(doc_info)
        except (ValueError, TypeError):
            continue
    
    # Sort by days until expiry
    expired.sort(key=lambda x: x["days_until_expiry"])
    expiring_soon.sort(key=lambda x: x["days_until_expiry"])
    
    return {
        "expired": expired,
        "expiring_soon": expiring_soon,
        "total_alerts": len(expired) + len(expiring_soon)
    }

@api_router.get("/admin/documents/expiring")
async def get_all_expiring_documents(
    days: int = 30,
    admin_user: dict = Depends(get_admin_user)
):
    """Get all documents expiring within X days across all drivers (admin only)"""
    drivers = await db.users.find(
        {"role": "driver"},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "documents": 1}
    ).to_list(1000)
    
    today = datetime.now(timezone.utc).date()
    expiring_docs = []
    
    for driver in drivers:
        documents = driver.get("documents", {})
        for doc_type, doc_data in documents.items():
            if not doc_data or not doc_data.get("expiry_date"):
                continue
            
            try:
                expiry_date = datetime.fromisoformat(doc_data["expiry_date"].replace("Z", "+00:00")).date()
                days_until_expiry = (expiry_date - today).days
                
                if days_until_expiry <= days:
                    expiring_docs.append({
                        "driver_id": driver["id"],
                        "driver_name": f"{driver['first_name']} {driver['last_name']}",
                        "driver_email": driver["email"],
                        "doc_type": doc_type,
                        "doc_name": DRIVER_DOCUMENT_TYPES.get(doc_type, {}).get("name", doc_type),
                        "expiry_date": doc_data["expiry_date"],
                        "days_until_expiry": days_until_expiry,
                        "is_expired": days_until_expiry < 0
                    })
            except (ValueError, TypeError):
                continue
    
    # Sort by days until expiry
    expiring_docs.sort(key=lambda x: x["days_until_expiry"])
    
    return {
        "documents": expiring_docs,
        "total": len(expiring_docs),
        "expired_count": len([d for d in expiring_docs if d["is_expired"]]),
        "expiring_count": len([d for d in expiring_docs if not d["is_expired"]])
    }

class DriverStatusUpdate(BaseModel):
    is_active: bool

@api_router.put("/admin/drivers/{driver_id}/status")
async def update_driver_status(
    driver_id: str,
    data: DriverStatusUpdate,
    admin_user: dict = Depends(get_admin_user)
):
    """Activate or deactivate a driver account (admin only)"""
    result = await db.users.update_one(
        {"id": driver_id, "role": "driver"},
        {"$set": {
            "is_active": data.is_active,
            "is_available": False if not data.is_active else False,  # Force offline if deactivated
            "status_updated_at": datetime.now(timezone.utc).isoformat(),
            "status_updated_by": admin_user["id"]
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return {
        "status": "ok", 
        "driver_id": driver_id,
        "is_active": data.is_active,
        "message": f"Chauffeur {'activé' if data.is_active else 'désactivé'}"
    }

@api_router.get("/drivers/available", response_model=List[UserResponse])
async def get_available_drivers(current_user: dict = Depends(get_current_user)):
    # Only return drivers who are available AND active (not deactivated by admin)
    drivers = await db.users.find({
        "role": "driver", 
        "is_available": True,
        "$or": [{"is_active": True}, {"is_active": {"$exists": False}}]  # Include drivers without is_active field (backwards compatible)
    }, {"_id": 0, "password_hash": 0}).to_list(100)
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
        # Store location in path history for the ride
        path_point = {
            "lat": data.lat,
            "lng": data.lng,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.rides.update_one(
            {"id": active_ride["id"]},
            {"$push": {"driver_path": path_point}}
        )
        
        await notification_manager.notify_passenger(active_ride["passenger_id"], "driver_location", {
            "ride_id": active_ride["id"],
            "location": location_data
        })
    
    return {"status": "ok", "location": location_data}

@api_router.get("/rides/{ride_id}/driver-path")
async def get_driver_path(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Get the driver's path history for a ride"""
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0, "driver_path": 1, "passenger_id": 1, "driver_id": 1})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Allow passenger or driver to view
    if ride.get("passenger_id") != current_user["id"] and ride.get("driver_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    return {"path": ride.get("driver_path", [])}

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
    # Calculate distance with stops if provided
    stops_list = [s.model_dump() for s in data.stops] if data.stops else []
    stops_count = len(stops_list)
    
    distance, stop_distances = calculate_total_distance_with_stops(
        data.pickup.model_dump(), 
        data.destination.model_dump(),
        stops_list
    )
    duration = estimate_duration_minutes(distance)
    
    # Add extra time for stops (3 min per stop for pickup)
    if stops_count > 0:
        duration += stops_count * 3
    
    fare_details = calculate_fare(
        distance, 
        duration, 
        is_scheduled=False, 
        is_immediate=True,
        vehicle_type=data.vehicle_type,
        passenger_count=data.passenger_count,
        stops_count=stops_count
    )
    
    return {
        "distance_km": distance,
        "duration_minutes": duration,
        "vehicle_type": data.vehicle_type,
        "passenger_count": data.passenger_count,
        "stops_count": stops_count,
        "stop_distances": stop_distances,
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
    stops_list = [s.model_dump() for s in data.stops] if data.stops else []
    stops_count = len(stops_list)
    
    # Calculate total distance with stops
    distance, stop_distances = calculate_total_distance_with_stops(pickup, destination, stops_list)
    duration = estimate_duration_minutes(distance)
    
    # Add extra time for stops
    if stops_count > 0:
        duration += stops_count * 3
    
    fare_details = calculate_fare(
        distance, 
        duration, 
        is_scheduled=False, 
        is_immediate=True,
        vehicle_type=data.vehicle_type,
        passenger_count=data.passenger_count,
        stops_count=stops_count
    )
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
    # Generate short reservation number (e.g., VT-240225-001)
    today = datetime.now(timezone.utc).strftime("%y%m%d")
    ride_count_today = await db.rides.count_documents({"created_at": {"$regex": f"^{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"}})
    reservation_number = f"VT-{today}-{str(ride_count_today + 1).zfill(3)}"
    
    # Calculate commission (18%)
    commission_rate = 0.18
    commission_amount = round(fare * commission_rate, 2)
    driver_earnings = round(fare - commission_amount, 2)
    
    # Find nearest available driver
    nearest_driver_info = await find_nearest_driver(pickup)
    
    ride = {
        "id": ride_id,
        "reservation_number": reservation_number,
        "passenger_id": current_user["id"],
        "passenger_name": f"{current_user['first_name']} {current_user['last_name']}",
        "passenger_phone": current_user.get("phone"),
        "driver_id": None,
        "driver_name": None,
        "driver_company": None,
        "driver_phone": None,
        "driver_license_plate": None,
        "driver_identification": None,
        "pickup": pickup,
        "destination": destination,
        "stops": stops_list if stops_list else None,  # Intermediate stops
        "distance_km": distance,
        "estimated_fare": fare,
        "commission_rate": commission_rate,
        "commission_amount": commission_amount,
        "driver_earnings": driver_earnings,
        "discount_applied": discount_applied,
        "promo_used": promo_used,
        "final_fare": None,
        "status": "pending",  # Always starts as pending - driver must accept
        "payment_status": "pending",
        "payment_method": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None,
        "completed_at": None,
        "vehicle_type": data.vehicle_type,
        "passenger_count": data.passenger_count,
        "notified_drivers": []  # Track which drivers have been notified
    }
    
    await db.rides.insert_one(ride)
    
    # Find nearby drivers and notify them about the new ride
    available_drivers = await db.users.find({
        "role": "driver", 
        "is_available": True,
        "location": {"$exists": True},
        "$or": [{"is_active": True}, {"is_active": {"$exists": False}}]
    }, {"_id": 0, "password_hash": 0}).to_list(20)
    
    # Calculate distance and notify drivers within 10km
    notified_driver_ids = []
    for driver in available_drivers:
        if driver.get("location"):
            dist = calculate_distance(pickup, driver["location"])
            if dist <= 10.0:  # Within 10km
                eta = max(2, round(dist * 2.5))
                await notification_manager.notify_driver(driver["id"], "ride_available", {
                    "id": ride_id,
                    "passenger_name": ride["passenger_name"],
                    "pickup": pickup,
                    "destination": destination,
                    "distance_km": distance,
                    "estimated_fare": fare,
                    "driver_earnings": driver_earnings,
                    "distance_to_pickup": round(dist, 1),
                    "eta_minutes": eta
                })
                notified_driver_ids.append(driver["id"])
    
    # Update ride with notified drivers
    await db.rides.update_one({"id": ride_id}, {"$set": {"notified_drivers": notified_driver_ids}})
    
    ride["notified_drivers"] = notified_driver_ids
    
    # Return the ride
    ride_copy = {k: v for k, v in ride.items() if k != "notified_drivers"}
    return RideResponse(**ride_copy)

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

# Move /rides/scheduled BEFORE /rides/{ride_id} to avoid route conflict
@api_router.get("/rides/scheduled", response_model=List[RideResponse])
async def get_scheduled_rides_early(current_user: dict = Depends(get_current_user)):
    """Get all scheduled rides for the current user"""
    query = {"status": "scheduled"}
    if current_user["role"] == "passenger":
        query["passenger_id"] = current_user["id"]
    rides = await db.rides.find(query, {"_id": 0}).sort("scheduled_time", 1).to_list(50)
    return [RideResponse(**r) for r in rides]

@api_router.post("/rides/{ride_id}/accept", response_model=RideResponse)
async def accept_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can accept rides")
    
    ride = await db.rides.find_one({"id": ride_id, "status": "pending"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or already taken")
    
    # Get driver's vehicle info and location
    driver = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    vehicle = driver.get("vehicle_info", {}) if driver else {}
    driver_location = driver.get("location", {}) if driver else {}
    
    # Calculate ETA if driver has location
    eta_minutes = 5  # Default
    distance_to_pickup = 0
    if driver_location and driver_location.get("lat"):
        distance_to_pickup = calculate_distance(ride["pickup"], driver_location)
        eta_minutes = max(2, round(distance_to_pickup * 2.5))
    
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "driver_id": current_user["id"],
        "driver_name": f"{current_user['first_name']} {current_user['last_name']}",
        "driver_company": current_user.get("company_name", "Indépendant"),
        "driver_phone": current_user.get("phone"),
        "driver_license_plate": vehicle.get("license_plate") if vehicle else "Non renseigné",
        "driver_identification": current_user["id"][:8].upper(),
        "driver_eta_minutes": eta_minutes,
        "driver_distance_km": round(distance_to_pickup, 1),
        "status": "accepted",
        "accepted_at": datetime.now(timezone.utc).isoformat()
    }})
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"is_available": False}})
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    # Notify passenger that driver accepted
    await notification_manager.notify_passenger(ride["passenger_id"], "ride_accepted", {
        "driver_name": f"{current_user['first_name']} {current_user['last_name']}",
        "driver_id": current_user["id"],
        "driver_phone": current_user.get("phone"),
        "eta_minutes": eta_minutes,
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

@api_router.post("/rides/{ride_id}/reject")
async def reject_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Driver rejects a ride - it will be re-dispatched to the next nearest driver"""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can reject rides")
    
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride.get("driver_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="This ride is not assigned to you")
    
    if ride["status"] not in ["accepted", "pending"]:
        raise HTTPException(status_code=400, detail="Cannot reject this ride")
    
    # Track rejected drivers to avoid re-assigning to them
    rejected_drivers = ride.get("rejected_drivers", [])
    rejected_drivers.append(current_user["id"])
    
    # Make current driver available again
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"is_available": True}})
    
    # Find next nearest available driver (excluding rejected ones)
    pickup = ride["pickup"]
    available_drivers = await db.users.find({
        "role": "driver", 
        "is_available": True,
        "id": {"$nin": rejected_drivers},
        "location": {"$exists": True},
        "$or": [{"is_active": True}, {"is_active": {"$exists": False}}]
    }, {"_id": 0, "password_hash": 0}).to_list(50)
    
    nearest_driver_info = None
    if available_drivers:
        for driver in available_drivers:
            if driver.get("location"):
                dist = calculate_distance(pickup, driver["location"])
                eta = max(2, round(dist * 2.5))
                if nearest_driver_info is None or dist < nearest_driver_info["distance_to_pickup"]:
                    nearest_driver_info = {
                        "driver": driver,
                        "distance_to_pickup": round(dist, 1),
                        "eta_minutes": eta
                    }
    
    if nearest_driver_info:
        # Re-assign to new driver
        new_driver = nearest_driver_info["driver"]
        vehicle = new_driver.get("vehicle_info", {})
        
        await db.rides.update_one(
            {"id": ride_id},
            {"$set": {
                "driver_id": new_driver["id"],
                "driver_name": f"{new_driver['first_name']} {new_driver['last_name']}",
                "driver_company": new_driver.get("company_name", "Indépendant"),
                "driver_phone": new_driver.get("phone"),
                "driver_license_plate": vehicle.get("license_plate") if vehicle else "Non renseigné",
                "driver_identification": new_driver["id"][:8].upper(),
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc).isoformat(),
                "driver_eta_minutes": nearest_driver_info["eta_minutes"],
                "driver_distance_km": nearest_driver_info["distance_to_pickup"],
                "rejected_drivers": rejected_drivers
            }}
        )
        
        # Mark new driver as unavailable
        await db.users.update_one({"id": new_driver["id"]}, {"$set": {"is_available": False}})
        
        # Notify new driver
        await notification_manager.notify_driver(new_driver["id"], "ride_assigned", {
            "id": ride_id,
            "passenger_name": ride["passenger_name"],
            "pickup": ride["pickup"],
            "destination": ride["destination"],
            "estimated_fare": ride["estimated_fare"]
        })
        
        # Notify passenger about new driver
        await notification_manager.notify_passenger(ride["passenger_id"], "driver_changed", {
            "ride_id": ride_id,
            "driver_name": f"{new_driver['first_name']} {new_driver['last_name']}",
            "eta_minutes": nearest_driver_info["eta_minutes"],
            "message": "Un nouveau chauffeur a été assigné à votre course"
        })
        
        return {
            "status": "reassigned",
            "message": "Course transférée à un autre chauffeur",
            "new_driver_name": f"{new_driver['first_name']} {new_driver['last_name']}",
            "eta_minutes": nearest_driver_info["eta_minutes"]
        }
    else:
        # No driver available - put ride back to pending
        await db.rides.update_one(
            {"id": ride_id},
            {"$set": {
                "driver_id": None,
                "driver_name": None,
                "status": "pending",
                "rejected_drivers": rejected_drivers
            }}
        )
        
        # Notify passenger
        await notification_manager.notify_passenger(ride["passenger_id"], "searching_driver", {
            "ride_id": ride_id,
            "message": "Recherche d'un nouveau chauffeur en cours..."
        })
        
        return {
            "status": "pending",
            "message": "Recherche d'un nouveau chauffeur en cours"
        }

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
        "rater_name": f"{current_user['first_name']} {current_user['last_name']}",
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
    """Get all ratings for a user with rater names"""
    ratings = await db.ratings.find(
        {"rated_user_id": user_id}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return ratings

@api_router.get("/ratings/my-ratings")
async def get_my_ratings(current_user: dict = Depends(get_current_user)):
    """Get all ratings received by the current user"""
    ratings = await db.ratings.find(
        {"rated_user_id": current_user["id"]}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate stats
    total = len(ratings)
    avg = sum(r["rating"] for r in ratings) / total if total > 0 else 5.0
    distribution = {i: sum(1 for r in ratings if r["rating"] == i) for i in range(1, 6)}
    
    return {
        "ratings": ratings,
        "stats": {
            "total": total,
            "average": round(avg, 2),
            "distribution": distribution
        }
    }

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

# Payment Intent endpoint for inline card form
class PaymentIntentRequest(BaseModel):
    ride_id: str

class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: float
    currency: str
    publishable_key: str

@api_router.post("/payments/create-payment-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(data: PaymentIntentRequest, current_user: dict = Depends(get_current_user)):
    """Create a Stripe Payment Intent for inline card payment"""
    ride = await db.rides.find_one({"id": data.ride_id, "status": "completed"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Course non trouvée ou non terminée")
    
    if ride["passenger_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Ce n'est pas votre course")
    
    if ride.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Course déjà payée")
    
    amount = float(ride.get("final_fare") or ride.get("estimated_fare", 0))
    amount_cents = int(amount * 100)  # Stripe expects amount in cents
    
    try:
        # Create Payment Intent
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="eur",
            metadata={
                "ride_id": data.ride_id,
                "user_id": current_user["id"],
                "user_email": current_user["email"]
            },
            automatic_payment_methods={"enabled": True}
        )
        
        # Create payment transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "payment_intent_id": intent.id,
            "ride_id": data.ride_id,
            "user_id": current_user["id"],
            "user_email": current_user["email"],
            "amount": amount,
            "currency": "eur",
            "payment_status": "pending",
            "payment_method": "card",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return PaymentIntentResponse(
            client_secret=intent.client_secret,
            payment_intent_id=intent.id,
            amount=amount,
            currency="eur",
            publishable_key=STRIPE_PUBLISHABLE_KEY
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur de paiement: {str(e)}")

@api_router.post("/payments/confirm-payment")
async def confirm_payment(payment_intent_id: str, current_user: dict = Depends(get_current_user)):
    """Confirm payment after successful card submission"""
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if intent.status == "succeeded":
            # Update transaction status
            transaction = await db.payment_transactions.find_one(
                {"payment_intent_id": payment_intent_id}, 
                {"_id": 0}
            )
            
            if transaction and transaction["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"payment_intent_id": payment_intent_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                await db.rides.update_one(
                    {"id": transaction["ride_id"]},
                    {"$set": {"payment_status": "paid", "payment_method": "card"}}
                )
            
            return {"status": "succeeded", "message": "Paiement confirmé avec succès"}
        else:
            return {"status": intent.status, "message": "Paiement en attente de confirmation"}
            
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

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

# ======================== SAVED PAYMENT METHODS ========================

async def get_or_create_stripe_customer(user: dict) -> str:
    """Get existing or create new Stripe Customer for user"""
    # Check if user already has a Stripe customer ID
    if user.get("stripe_customer_id"):
        return user["stripe_customer_id"]
    
    # Create new Stripe customer
    try:
        customer = stripe.Customer.create(
            email=user["email"],
            name=f"{user['first_name']} {user['last_name']}",
            metadata={"user_id": user["id"]}
        )
        
        # Save customer ID to user
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"stripe_customer_id": customer.id}}
        )
        
        return customer.id
    except stripe.error.StripeError as e:
        logger.error(f"Error creating Stripe customer: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la création du compte de paiement")

class SetupIntentResponse(BaseModel):
    client_secret: str
    setup_intent_id: str
    publishable_key: str

@api_router.post("/payments/setup-intent", response_model=SetupIntentResponse)
async def create_setup_intent(current_user: dict = Depends(get_current_user)):
    """Create a SetupIntent to save a payment method"""
    try:
        customer_id = await get_or_create_stripe_customer(current_user)
        
        setup_intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=["card"],
            metadata={
                "user_id": current_user["id"],
                "user_email": current_user["email"]
            }
        )
        
        return SetupIntentResponse(
            client_secret=setup_intent.client_secret,
            setup_intent_id=setup_intent.id,
            publishable_key=STRIPE_PUBLISHABLE_KEY
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating SetupIntent: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

class SavedCard(BaseModel):
    id: str
    brand: str
    last4: str
    exp_month: int
    exp_year: int
    is_default: bool = False

@api_router.get("/payments/saved-cards", response_model=List[SavedCard])
async def get_saved_cards(current_user: dict = Depends(get_current_user)):
    """Get list of saved payment methods for the user"""
    if not current_user.get("stripe_customer_id"):
        return []
    
    try:
        payment_methods = stripe.PaymentMethod.list(
            customer=current_user["stripe_customer_id"],
            type="card"
        )
        
        # Get default payment method
        customer = stripe.Customer.retrieve(current_user["stripe_customer_id"])
        default_pm = customer.invoice_settings.default_payment_method if customer.invoice_settings else None
        
        cards = []
        for pm in payment_methods.data:
            cards.append(SavedCard(
                id=pm.id,
                brand=pm.card.brand,
                last4=pm.card.last4,
                exp_month=pm.card.exp_month,
                exp_year=pm.card.exp_year,
                is_default=(pm.id == default_pm)
            ))
        
        return cards
    except stripe.error.StripeError as e:
        logger.error(f"Error fetching payment methods: {e}")
        return []

@api_router.delete("/payments/saved-cards/{payment_method_id}")
async def delete_saved_card(payment_method_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a saved payment method"""
    try:
        # Verify the payment method belongs to the user
        pm = stripe.PaymentMethod.retrieve(payment_method_id)
        if pm.customer != current_user.get("stripe_customer_id"):
            raise HTTPException(status_code=403, detail="Cette carte ne vous appartient pas")
        
        stripe.PaymentMethod.detach(payment_method_id)
        return {"status": "success", "message": "Carte supprimée"}
    except stripe.error.StripeError as e:
        logger.error(f"Error deleting payment method: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@api_router.post("/payments/set-default-card/{payment_method_id}")
async def set_default_card(payment_method_id: str, current_user: dict = Depends(get_current_user)):
    """Set a payment method as default"""
    if not current_user.get("stripe_customer_id"):
        raise HTTPException(status_code=400, detail="Aucun compte de paiement")
    
    try:
        # Verify the payment method belongs to the user
        pm = stripe.PaymentMethod.retrieve(payment_method_id)
        if pm.customer != current_user.get("stripe_customer_id"):
            raise HTTPException(status_code=403, detail="Cette carte ne vous appartient pas")
        
        stripe.Customer.modify(
            current_user["stripe_customer_id"],
            invoice_settings={"default_payment_method": payment_method_id}
        )
        return {"status": "success", "message": "Carte par défaut mise à jour"}
    except stripe.error.StripeError as e:
        logger.error(f"Error setting default card: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

class PayWithSavedCardRequest(BaseModel):
    ride_id: str
    payment_method_id: str

@api_router.post("/payments/pay-with-saved-card")
async def pay_with_saved_card(data: PayWithSavedCardRequest, current_user: dict = Depends(get_current_user)):
    """Pay for a ride using a saved payment method"""
    ride = await db.rides.find_one({"id": data.ride_id, "status": "completed"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Course non trouvée ou non terminée")
    
    if ride["passenger_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Ce n'est pas votre course")
    
    if ride.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Course déjà payée")
    
    if not current_user.get("stripe_customer_id"):
        raise HTTPException(status_code=400, detail="Aucune carte enregistrée")
    
    try:
        # Verify payment method belongs to user
        pm = stripe.PaymentMethod.retrieve(data.payment_method_id)
        if pm.customer != current_user["stripe_customer_id"]:
            raise HTTPException(status_code=403, detail="Cette carte ne vous appartient pas")
        
        amount = float(ride.get("final_fare") or ride.get("estimated_fare", 0))
        amount_cents = int(amount * 100)
        
        # Create and confirm payment intent in one step
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="eur",
            customer=current_user["stripe_customer_id"],
            payment_method=data.payment_method_id,
            off_session=True,
            confirm=True,
            metadata={
                "ride_id": data.ride_id,
                "user_id": current_user["id"],
                "user_email": current_user["email"]
            }
        )
        
        if intent.status == "succeeded":
            # Update ride and transaction
            await db.rides.update_one(
                {"id": data.ride_id},
                {"$set": {"payment_status": "paid", "payment_method": "saved_card"}}
            )
            
            # Create transaction record
            transaction = {
                "id": str(uuid.uuid4()),
                "payment_intent_id": intent.id,
                "ride_id": data.ride_id,
                "user_id": current_user["id"],
                "user_email": current_user["email"],
                "amount": amount,
                "currency": "eur",
                "payment_status": "paid",
                "payment_method": "saved_card",
                "payment_method_id": data.payment_method_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.payment_transactions.insert_one(transaction)
            
            return {"status": "succeeded", "message": "Paiement effectué avec succès"}
        else:
            return {"status": intent.status, "message": "Paiement en attente"}
            
    except stripe.error.CardError as e:
        logger.error(f"Card error: {e}")
        raise HTTPException(status_code=400, detail=f"Erreur de carte: {e.user_message}")
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur de paiement: {str(e)}")

# ======================== WALLET SYSTEM ========================

class WalletTopUpRequest(BaseModel):
    amount: float  # Amount in euros

class WalletPaymentRequest(BaseModel):
    ride_id: str

@api_router.get("/wallet/balance")
async def get_wallet_balance(current_user: dict = Depends(get_current_user)):
    """Get current wallet balance"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "wallet_balance": 1})
    balance = user.get("wallet_balance", 0.0)
    return {"balance": round(balance, 2), "currency": "EUR"}

@api_router.get("/wallet/transactions")
async def get_wallet_transactions(
    page: int = 1, 
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get wallet transaction history"""
    total = await db.wallet_transactions.count_documents({"user_id": current_user["id"]})
    transactions = await db.wallet_transactions.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.post("/wallet/top-up")
async def create_wallet_topup(data: WalletTopUpRequest, current_user: dict = Depends(get_current_user)):
    """Create a payment intent to top up wallet"""
    if data.amount < 5:
        raise HTTPException(status_code=400, detail="Montant minimum: 5€")
    if data.amount > 500:
        raise HTTPException(status_code=400, detail="Montant maximum: 500€")
    
    try:
        customer_id = await get_or_create_stripe_customer(current_user)
        amount_cents = int(data.amount * 100)
        
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="eur",
            customer=customer_id,
            metadata={
                "type": "wallet_topup",
                "user_id": current_user["id"],
                "user_email": current_user["email"]
            }
        )
        
        # Create pending transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "type": "topup",
            "amount": data.amount,
            "status": "pending",
            "payment_intent_id": intent.id,
            "description": f"Rechargement portefeuille +{data.amount}€",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.wallet_transactions.insert_one(transaction)
        
        return {
            "client_secret": intent.client_secret,
            "publishable_key": STRIPE_PUBLISHABLE_KEY,
            "payment_intent_id": intent.id,
            "amount": data.amount
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@api_router.post("/wallet/confirm-topup")
async def confirm_wallet_topup(payment_intent_id: str, current_user: dict = Depends(get_current_user)):
    """Confirm wallet top-up after successful payment"""
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if intent.status != "succeeded":
            return {"status": intent.status, "message": "Paiement en attente"}
        
        # Find the transaction
        transaction = await db.wallet_transactions.find_one(
            {"payment_intent_id": payment_intent_id, "user_id": current_user["id"]},
            {"_id": 0}
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction non trouvée")
        
        if transaction["status"] == "completed":
            return {"status": "already_processed", "message": "Déjà traité"}
        
        # Update wallet balance
        amount = transaction["amount"]
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"wallet_balance": amount}}
        )
        
        # Update transaction status
        await db.wallet_transactions.update_one(
            {"id": transaction["id"]},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Get new balance
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "wallet_balance": 1})
        new_balance = user.get("wallet_balance", 0.0)
        
        return {
            "status": "succeeded",
            "message": f"Portefeuille rechargé de {amount}€",
            "new_balance": round(new_balance, 2)
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@api_router.post("/wallet/pay")
async def pay_with_wallet(data: WalletPaymentRequest, current_user: dict = Depends(get_current_user)):
    """Pay for a ride using wallet balance"""
    ride = await db.rides.find_one({"id": data.ride_id, "status": "completed"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Course non trouvée ou non terminée")
    
    if ride["passenger_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Ce n'est pas votre course")
    
    if ride.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Course déjà payée")
    
    # Get wallet balance
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "wallet_balance": 1})
    balance = user.get("wallet_balance", 0.0)
    
    amount = float(ride.get("final_fare") or ride.get("estimated_fare", 0))
    
    if balance < amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Solde insuffisant. Solde: {balance:.2f}€, Montant: {amount:.2f}€"
        )
    
    # Deduct from wallet
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"wallet_balance": -amount}}
    )
    
    # Update ride
    await db.rides.update_one(
        {"id": data.ride_id},
        {"$set": {"payment_status": "paid", "payment_method": "wallet"}}
    )
    
    # Create wallet transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "payment",
        "amount": -amount,
        "status": "completed",
        "ride_id": data.ride_id,
        "description": f"Paiement course #{ride.get('reservation_number', data.ride_id[:8])}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wallet_transactions.insert_one(transaction)
    
    # Get new balance
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "wallet_balance": 1})
    new_balance = user.get("wallet_balance", 0.0)
    
    return {
        "status": "succeeded",
        "message": "Paiement effectué avec le portefeuille",
        "amount_paid": amount,
        "new_balance": round(new_balance, 2)
    }

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

class RescheduleRideRequest(BaseModel):
    scheduled_time: str
    pickup: Optional[LocationModel] = None
    destination: Optional[LocationModel] = None
    vehicle_type: Optional[str] = None
    passenger_count: Optional[int] = None

@api_router.put("/rides/{ride_id}/reschedule", response_model=RideResponse)
async def reschedule_ride(ride_id: str, data: RescheduleRideRequest, current_user: dict = Depends(get_current_user)):
    """Modify a scheduled ride"""
    ride = await db.rides.find_one({"id": ride_id, "status": "scheduled"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Scheduled ride not found")
    
    if ride["passenger_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    # Validate scheduled time
    try:
        scheduled_dt = datetime.fromisoformat(data.scheduled_time.replace('Z', '+00:00'))
        if scheduled_dt <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="La date doit être dans le futur")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Build update data
    update_data = {"scheduled_time": data.scheduled_time}
    
    # Update pickup if provided
    new_pickup = data.pickup.model_dump() if data.pickup else ride["pickup"]
    new_destination = data.destination.model_dump() if data.destination else ride["destination"]
    new_vehicle_type = data.vehicle_type if data.vehicle_type else ride.get("vehicle_type", "standard")
    new_passenger_count = data.passenger_count if data.passenger_count else ride.get("passenger_count", 1)
    
    # Recalculate fare if route changed
    if data.pickup or data.destination:
        distance = calculate_distance(new_pickup, new_destination)
        duration = estimate_duration_minutes(distance)
        fare_details = calculate_fare(
            distance, 
            duration, 
            is_scheduled=True, 
            is_immediate=False,
            vehicle_type=new_vehicle_type,
            passenger_count=new_passenger_count
        )
        update_data["pickup"] = new_pickup
        update_data["destination"] = new_destination
        update_data["distance_km"] = distance
        update_data["estimated_fare"] = fare_details["total"]
    
    if data.vehicle_type:
        update_data["vehicle_type"] = new_vehicle_type
    if data.passenger_count:
        update_data["passenger_count"] = new_passenger_count
    
    await db.rides.update_one({"id": ride_id}, {"$set": update_data})
    
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

# ======================== FREQUENT TRIPS ========================

@api_router.post("/frequent-trips", response_model=FrequentTripResponse)
async def create_frequent_trip(data: FrequentTripCreate, current_user: dict = Depends(get_current_user)):
    """Create a frequent trip for quick booking"""
    trip = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "name": data.name,
        "pickup": data.pickup.model_dump(),
        "destination": data.destination.model_dump(),
        "vehicle_type": data.vehicle_type,
        "passenger_count": data.passenger_count,
        "use_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.frequent_trips.insert_one(trip)
    return FrequentTripResponse(**trip)

@api_router.get("/frequent-trips", response_model=List[FrequentTripResponse])
async def get_frequent_trips(current_user: dict = Depends(get_current_user)):
    """Get all frequent trips for current user, sorted by most used"""
    trips = await db.frequent_trips.find(
        {"user_id": current_user["id"]}, 
        {"_id": 0}
    ).sort("use_count", -1).to_list(10)
    return [FrequentTripResponse(**t) for t in trips]

@api_router.post("/frequent-trips/{trip_id}/use")
async def use_frequent_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Increment use count when a frequent trip is used"""
    result = await db.frequent_trips.update_one(
        {"id": trip_id, "user_id": current_user["id"]},
        {"$inc": {"use_count": 1}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"status": "ok"}

@api_router.delete("/frequent-trips/{trip_id}")
async def delete_frequent_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a frequent trip"""
    result = await db.frequent_trips.delete_one({
        "id": trip_id,
        "user_id": current_user["id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
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

# ======================== ADMIN DASHBOARD ========================

@api_router.get("/admin/stats/overview")
async def get_admin_overview(admin_user: dict = Depends(get_admin_user)):
    """Get overall platform statistics (admin only)"""
    # Get date ranges
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    # Total users
    total_passengers = await db.users.count_documents({"role": "passenger"})
    total_drivers = await db.users.count_documents({"role": "driver"})
    
    # Rides stats
    total_rides = await db.rides.count_documents({})
    completed_rides = await db.rides.count_documents({"status": "completed"})
    rides_today = await db.rides.count_documents({
        "created_at": {"$gte": today.isoformat()}
    })
    
    # Revenue
    all_completed = await db.rides.find(
        {"status": "completed", "final_fare": {"$ne": None}},
        {"_id": 0, "final_fare": 1, "created_at": 1}
    ).to_list(10000)
    
    total_revenue = sum(r.get("final_fare", 0) for r in all_completed)
    revenue_today = sum(
        r.get("final_fare", 0) for r in all_completed 
        if r.get("created_at", "") >= today.isoformat()
    )
    revenue_week = sum(
        r.get("final_fare", 0) for r in all_completed 
        if r.get("created_at", "") >= week_ago.isoformat()
    )
    
    return {
        "users": {
            "total_passengers": total_passengers,
            "total_drivers": total_drivers
        },
        "rides": {
            "total": total_rides,
            "completed": completed_rides,
            "today": rides_today,
            "completion_rate": round(completed_rides / total_rides * 100, 1) if total_rides > 0 else 0
        },
        "revenue": {
            "total": round(total_revenue, 2),
            "today": round(revenue_today, 2),
            "week": round(revenue_week, 2),
            "currency": "EUR"
        }
    }

@api_router.get("/admin/stats/drivers")
async def get_admin_driver_stats(admin_user: dict = Depends(get_admin_user)):
    """Get detailed driver statistics (admin only)"""
    drivers = await db.users.find(
        {"role": "driver"},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    driver_stats = []
    for driver in drivers:
        # Get driver's completed rides
        rides = await db.rides.find(
            {"driver_id": driver["id"], "status": "completed"},
            {"_id": 0, "final_fare": 1, "created_at": 1, "distance_km": 1}
        ).to_list(1000)
        
        total_revenue = sum(r.get("final_fare", 0) for r in rides)
        total_distance = sum(r.get("distance_km", 0) for r in rides)
        
        # Get ratings
        ratings = await db.ratings.find(
            {"rated_user_id": driver["id"]},
            {"_id": 0, "rating": 1}
        ).to_list(1000)
        avg_rating = sum(r["rating"] for r in ratings) / len(ratings) if ratings else 5.0
        
        # Today's stats
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        rides_today = [r for r in rides if r.get("created_at", "") >= today.isoformat()]
        revenue_today = sum(r.get("final_fare", 0) for r in rides_today)
        
        driver_stats.append({
            "id": driver["id"],
            "name": f"{driver['first_name']} {driver['last_name']}",
            "email": driver["email"],
            "phone": driver["phone"],
            "is_available": driver.get("is_available", False),
            "is_active": driver.get("is_active", True),  # Default to True for backwards compatibility
            "vehicle": driver.get("vehicle_info"),
            "stats": {
                "total_rides": len(rides),
                "total_revenue": round(total_revenue, 2),
                "total_distance_km": round(total_distance, 1),
                "avg_rating": round(avg_rating, 2),
                "total_ratings": len(ratings),
                "rides_today": len(rides_today),
                "revenue_today": round(revenue_today, 2)
            },
            "created_at": driver.get("created_at")
        })
    
    # Sort by total revenue
    driver_stats.sort(key=lambda x: x["stats"]["total_revenue"], reverse=True)
    
    return {"drivers": driver_stats}

@api_router.get("/admin/stats/rides")
async def get_admin_ride_stats(
    days: int = 7,
    admin_user: dict = Depends(get_admin_user)
):
    """Get ride statistics over time (admin only)"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    rides = await db.rides.find(
        {"created_at": {"$gte": start_date.isoformat()}},
        {"_id": 0, "status": 1, "final_fare": 1, "estimated_fare": 1, "created_at": 1, "distance_km": 1}
    ).to_list(10000)
    
    # Group by day
    daily_stats = {}
    for ride in rides:
        day = ride["created_at"][:10]  # YYYY-MM-DD
        if day not in daily_stats:
            daily_stats[day] = {"rides": 0, "completed": 0, "revenue": 0, "distance": 0}
        daily_stats[day]["rides"] += 1
        if ride["status"] == "completed":
            daily_stats[day]["completed"] += 1
            daily_stats[day]["revenue"] += ride.get("final_fare", 0)
        daily_stats[day]["distance"] += ride.get("distance_km", 0)
    
    # Convert to list and sort
    daily_list = [
        {
            "date": day,
            "rides": stats["rides"],
            "completed": stats["completed"],
            "revenue": round(stats["revenue"], 2),
            "distance": round(stats["distance"], 1)
        }
        for day, stats in sorted(daily_stats.items())
    ]
    
    return {"daily_stats": daily_list, "days": days}

@api_router.get("/admin/recent-rides")
async def get_admin_recent_rides(
    limit: int = 20,
    admin_user: dict = Depends(get_admin_user)
):
    """Get recent rides for admin dashboard"""
    rides = await db.rides.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"rides": rides}

# ======================== ADMIN CLIENT DATABASE ========================

class ClientResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone: str
    created_at: str
    total_rides: int
    completed_rides: int
    total_spent: float
    last_ride_date: Optional[str] = None
    rating: float

@api_router.get("/admin/clients")
async def get_admin_clients(
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    limit: int = 20,
    admin_user: dict = Depends(get_admin_user)
):
    """Get all clients (passengers) with their stats"""
    # Build query
    query = {"role": "passenger"}
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total_count = await db.users.count_documents(query)
    
    # Sort direction
    sort_dir = -1 if sort_order == "desc" else 1
    
    # Get clients
    clients = await db.users.find(
        query,
        {"_id": 0, "password_hash": 0}
    ).sort(sort_by, sort_dir).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    # Enrich with ride stats
    client_list = []
    for client in clients:
        # Get ride stats for this client
        rides = await db.rides.find(
            {"passenger_id": client["id"]},
            {"_id": 0, "status": 1, "final_fare": 1, "estimated_fare": 1, "created_at": 1}
        ).sort("created_at", -1).to_list(1000)
        
        total_rides = len(rides)
        completed_rides = len([r for r in rides if r["status"] == "completed"])
        total_spent = sum(r.get("final_fare", r.get("estimated_fare", 0)) for r in rides if r["status"] == "completed")
        last_ride = rides[0] if rides else None
        
        # Get average rating
        ratings = await db.ratings.find(
            {"rated_user_id": client["id"]},
            {"_id": 0, "rating": 1}
        ).to_list(100)
        avg_rating = sum(r["rating"] for r in ratings) / len(ratings) if ratings else 5.0
        
        client_list.append({
            "id": client["id"],
            "email": client["email"],
            "first_name": client["first_name"],
            "last_name": client["last_name"],
            "phone": client.get("phone", ""),
            "created_at": client.get("created_at", ""),
            "total_rides": total_rides,
            "completed_rides": completed_rides,
            "total_spent": round(total_spent, 2),
            "last_ride_date": last_ride["created_at"] if last_ride else None,
            "rating": round(avg_rating, 1)
        })
    
    return {
        "clients": client_list,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": (total_count + limit - 1) // limit
    }

@api_router.get("/admin/clients/{client_id}")
async def get_client_details(client_id: str, admin_user: dict = Depends(get_admin_user)):
    """Get detailed information about a specific client"""
    client = await db.users.find_one(
        {"id": client_id, "role": "passenger"},
        {"_id": 0, "password_hash": 0}
    )
    
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    
    # Get all rides for this client
    rides = await db.rides.find(
        {"passenger_id": client_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate stats
    total_spent = sum(r.get("final_fare", r.get("estimated_fare", 0)) for r in rides if r["status"] == "completed")
    total_distance = sum(r.get("distance_km", 0) for r in rides if r["status"] == "completed")
    
    # Get ratings given and received
    ratings_given = await db.ratings.find(
        {"user_id": client_id},
        {"_id": 0}
    ).to_list(100)
    
    ratings_received = await db.ratings.find(
        {"rated_user_id": client_id},
        {"_id": 0}
    ).to_list(100)
    
    avg_rating = sum(r["rating"] for r in ratings_received) / len(ratings_received) if ratings_received else 5.0
    
    return {
        "client": {
            **client,
            "total_spent": round(total_spent, 2),
            "total_distance": round(total_distance, 1),
            "avg_rating": round(avg_rating, 1),
            "ratings_given": len(ratings_given),
            "ratings_received": len(ratings_received)
        },
        "rides": rides
    }

@api_router.get("/admin/clients/{client_id}/rides")
async def get_client_rides(
    client_id: str,
    page: int = 1,
    limit: int = 10,
    admin_user: dict = Depends(get_admin_user)
):
    """Get paginated ride history for a client"""
    # Verify client exists
    client = await db.users.find_one({"id": client_id, "role": "passenger"}, {"_id": 0, "id": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    
    total = await db.rides.count_documents({"passenger_id": client_id})
    rides = await db.rides.find(
        {"passenger_id": client_id},
        {"_id": 0}
    ).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    return {
        "rides": rides,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

class InvoiceData(BaseModel):
    ride_id: str
    invoice_number: str
    date: str
    client_name: str
    client_email: str
    client_phone: str
    pickup_address: str
    destination_address: str
    stops: Optional[List[str]] = None
    distance_km: float
    duration_minutes: Optional[int] = None
    vehicle_type: str
    passenger_count: int
    fare_details: dict
    total_amount: float
    payment_status: str
    driver_name: Optional[str] = None
    driver_company: Optional[str] = None

@api_router.get("/admin/rides/{ride_id}/invoice")
async def generate_invoice(ride_id: str, admin_user: dict = Depends(get_admin_user)):
    """Generate invoice data for a specific ride"""
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Course non trouvée")
    
    # Get client info
    client = await db.users.find_one(
        {"id": ride["passenger_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    # Generate invoice number (format: INV-YYYYMMDD-XXXX)
    ride_date = ride.get("created_at", "")[:10].replace("-", "")
    invoice_number = f"INV-{ride_date}-{ride_id[:8].upper()}"
    
    # Build fare details
    fare = ride.get("final_fare") or ride.get("estimated_fare", 0)
    fare_details = {
        "base_fare": round(fare * 0.85, 2),  # Approximation
        "supplements": round(fare * 0.15, 2),
        "subtotal": fare,
        "tax_rate": 20,
        "tax_amount": round(fare * 0.20, 2),
        "total": fare
    }
    
    # Extract stop addresses
    stop_addresses = None
    if ride.get("stops"):
        stop_addresses = [s.get("address", "") for s in ride["stops"]]
    
    invoice_data = {
        "ride_id": ride_id,
        "invoice_number": invoice_number,
        "date": ride.get("created_at", "")[:10],
        "client_name": ride.get("passenger_name", f"{client['first_name']} {client['last_name']}" if client else ""),
        "client_email": client.get("email", "") if client else "",
        "client_phone": client.get("phone", "") if client else "",
        "pickup_address": ride.get("pickup", {}).get("address", ""),
        "destination_address": ride.get("destination", {}).get("address", ""),
        "stops": stop_addresses,
        "distance_km": ride.get("distance_km", 0),
        "duration_minutes": None,  # Not stored in ride
        "vehicle_type": ride.get("vehicle_type", "standard"),
        "passenger_count": ride.get("passenger_count", 1),
        "fare_details": fare_details,
        "total_amount": fare,
        "payment_status": ride.get("payment_status", "pending"),
        "driver_name": ride.get("driver_name"),
        "driver_company": ride.get("driver_company"),
        "company_info": {
            "name": "Allogo",
            "address": "Paris, France",
            "siret": "XXX XXX XXX XXXXX",
            "tva": "FR XX XXXXXXXXX"
        }
    }
    
    return invoice_data

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
