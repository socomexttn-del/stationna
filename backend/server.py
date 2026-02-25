from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import asyncio
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

def calculate_fare(distance_km: float) -> float:
    """Calculate fare: base + per km rate"""
    BASE_FARE = 3.50
    PER_KM_RATE = 1.80
    return round(BASE_FARE + (distance_km * PER_KM_RATE), 2)

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

# ======================== RIDE ROUTES ========================

@api_router.post("/rides/estimate")
async def estimate_fare(data: FareEstimateRequest):
    distance = calculate_distance(data.pickup.model_dump(), data.destination.model_dump())
    fare = calculate_fare(distance)
    return {"distance_km": distance, "estimated_fare": fare, "currency": "EUR"}

@api_router.post("/rides", response_model=RideResponse)
async def create_ride(data: RideRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "passenger":
        raise HTTPException(status_code=403, detail="Only passengers can create rides")
    
    pickup = data.pickup.model_dump()
    destination = data.destination.model_dump()
    distance = calculate_distance(pickup, destination)
    fare = calculate_fare(distance)
    
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
        "final_fare": None,
        "status": "pending",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None,
        "completed_at": None
    }
    await db.rides.insert_one(ride)
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
