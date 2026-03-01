"""
Authentication Router
Handles user registration, login, and profile retrieval
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from core.deps import (
    get_db, 
    hash_password, 
    verify_password, 
    create_token, 
    get_current_user
)
from models.base import UserCreate, UserLogin, UserResponse, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
async def register(user: UserCreate):
    """Register a new user"""
    db = get_db()
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
        "company_name": user.company_name,
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


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login with email and password"""
    db = get_db()
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    user_response = UserResponse(**{k: v for k, v in user.items() if k != "password_hash"})
    return TokenResponse(token=token, user=user_response)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return UserResponse(**{k: v for k, v in current_user.items() if k != "password_hash"})
