"""
Authentication routes
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from models.user import UserCreate, UserLogin, UserResponse, TokenResponse
from services.auth import hash_password, verify_password, create_token, get_current_user
from database import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
async def register(user: UserCreate):
    db = get_db()
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_data = {
        "id": str(uuid.uuid4()),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "role": user.role,
        "company_name": user.company_name,
        "password": hash_password(user.password),
        "rating": 5.0,
        "total_rides": 0,
        "is_available": False,
        "vehicle_info": None,
        "location": None,
        "documents": [],
        "created_at": datetime.now(timezone.utc),
        "wallet_balance": 0.0,
    }
    
    await db.users.insert_one(user_data)
    del user_data["password"]
    del user_data["_id"] if "_id" in user_data else None
    
    token = create_token(user_data["id"], user_data["email"], user_data["role"])
    return {"token": token, "user": user_data}

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    del user["password"]
    token = create_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": user}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
