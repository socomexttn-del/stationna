"""
Shared dependencies for all routers
This module provides database access and authentication helpers
"""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import math

import jwt
import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'volt-taxi-secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', 24))

# Security
security = HTTPBearer()

# Database connection - initialized in main server
_db = None

def init_database(database):
    """Initialize the database connection"""
    global _db
    _db = database

def get_db():
    """Get the database instance"""
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return _db


# ======================== PASSWORD HELPERS ========================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ======================== JWT HELPERS ========================

def create_token(user_id: str, email: str, role: str) -> str:
    """Create a JWT token"""
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ======================== USER DEPENDENCIES ========================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get the current authenticated user"""
    token_data = decode_token(credentials.credentials)
    db = get_db()
    user = await db.users.find_one({"id": token_data["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Verify that the current user is an admin"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def get_driver_user(current_user: dict = Depends(get_current_user)):
    """Verify that the current user is a driver"""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    return current_user


async def get_passenger_user(current_user: dict = Depends(get_current_user)):
    """Verify that the current user is a passenger"""
    if current_user.get("role") != "passenger":
        raise HTTPException(status_code=403, detail="Passenger access required")
    return current_user


# ======================== DISTANCE HELPERS ========================

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
    """Calculate total distance with intermediate stops"""
    if not stops or len(stops) == 0:
        return calculate_distance(pickup, destination), []
    
    total_distance = 0
    stop_distances = []
    current_point = pickup
    
    for stop in stops:
        dist = calculate_distance(current_point, stop)
        stop_distances.append({
            "from": current_point.get("address", ""),
            "to": stop.get("address", ""),
            "distance_km": dist
        })
        total_distance += dist
        current_point = stop
    
    final_dist = calculate_distance(current_point, destination)
    stop_distances.append({
        "from": current_point.get("address", ""),
        "to": destination.get("address", ""),
        "distance_km": final_dist
    })
    total_distance += final_dist
    
    return round(total_distance, 2), stop_distances


def estimate_duration_minutes(distance_km: float) -> int:
    """Estimate trip duration based on average city speed (25 km/h)"""
    AVG_SPEED_KMH = 25
    return max(5, round((distance_km / AVG_SPEED_KMH) * 60))


async def find_nearest_driver(pickup_location: Dict, max_distance_km: float = 15.0) -> Optional[Dict]:
    """Find the nearest available driver to the pickup location"""
    db = get_db()
    available_drivers = await db.users.find({
        "role": "driver",
        "is_available": True,
        "location": {"$ne": None}
    }, {"_id": 0}).to_list(100)
    
    if not available_drivers:
        return None
    
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
    
    drivers_with_distance.sort(key=lambda x: x["distance"])
    nearest = drivers_with_distance[0]
    
    return {
        "driver": nearest["driver"],
        "distance_to_pickup": nearest["distance"],
        "eta_minutes": max(2, round(nearest["distance"] * 2.5))
    }
