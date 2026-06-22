"""
Authentication Router v2 - StationCab
Refactored from server.py - June 2025

Endpoints:
- POST /auth/register - User registration
- POST /auth/login - User login
- GET /auth/me - Get current user
- POST /auth/forgot-password - Request password reset
- POST /auth/reset-password - Reset password with token
"""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
import jwt
import bcrypt

# Logger
logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/auth", tags=["Authentication"])

# ======================== DEPENDENCIES ========================
# These will be injected from server.py or core modules

# Database reference (will be set during initialization)
db = None
send_email_smtp = None

def init_router(database, email_function):
    """Initialize router with database and email function"""
    global db, send_email_smtp
    db = database
    send_email_smtp = email_function

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'volt-taxi-secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', 24))

security = HTTPBearer()

# ======================== HELPERS ========================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    """Create JWT token"""
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ======================== MODELS ========================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str
    role: str = "passenger"

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
    rating: Optional[float] = 5.0
    total_rides: Optional[int] = 0
    is_available: Optional[bool] = False
    vehicle_info: Optional[dict] = None
    location: Optional[dict] = None
    driver_vehicle_types: Optional[List[str]] = None
    validation_status: Optional[str] = None
    documents: Optional[dict] = None
    company_name: Optional[str] = None
    siret: Optional[str] = None
    address: Optional[str] = None
    tva_number: Optional[str] = None
    iban: Optional[str] = None
    wallet_balance: Optional[float] = None
    created_at: Optional[str] = None

    model_config = {"extra": "ignore"}

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

# ======================== ROUTES ========================

@router.post("/register", response_model=TokenResponse)
async def register(user: UserCreate):
    """Register a new user"""
    existing = await db.users.find_one({"email": user.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    
    # For drivers, account is pending validation until admin approves all documents
    validation_status = "pending_validation" if user.role == "driver" else "active"
    
    user_dict = {
        "id": user_id,
        "email": user.email.lower(),
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
        "driver_vehicle_types": ["vtc"] if user.role == "driver" else None,
        "validation_status": validation_status,
        "documents": {},
        "company_name": None,
        "siret": None,
        "address": None,
        "tva_number": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_dict)
    
    token = create_token(user_id, user.email.lower(), user.role)
    user_response = UserResponse(**{k: v for k, v in user_dict.items() if k != "password_hash"})
    return TokenResponse(token=token, user=user_response)


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login with email and password"""
    user = await db.users.find_one({"email": credentials.email.lower()}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    user_response = UserResponse(**{k: v for k, v in user.items() if k != "password_hash"})
    return TokenResponse(token=token, user=user_response)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user"""
    return UserResponse(**{k: v for k, v in current_user.items() if k != "password_hash"})


@router.post("/forgot-password")
async def forgot_password(data: PasswordResetRequest):
    """Request password reset - sends email with reset link"""
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    
    # Always return success to prevent email enumeration
    if not user:
        return {"success": True, "message": "Si cet email existe, un lien de réinitialisation a été envoyé"}
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    
    # Store reset token
    await db.password_resets.delete_many({"user_id": user["id"]})
    await db.password_resets.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "token": reset_token,
        "expires_at": expires_at,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Send email with reset link
    if send_email_smtp:
        try:
            frontend_url = os.environ.get('FRONTEND_URL', 'https://stationcab.fr')
            reset_link = f"{frontend_url}/reset-password?token={reset_token}"
            
            sender_type = "driver" if user.get("role") == "driver" else "client"
            
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #00a693;">StationCab</h2>
                <p>Bonjour {user.get('first_name', '')},</p>
                <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
                <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                <a href="{reset_link}" style="display: inline-block; background-color: #00a693; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
                    Réinitialiser mon mot de passe
                </a>
                <p style="color: #666; font-size: 12px;">Ce lien expire dans 1 heure.</p>
                <p style="color: #666; font-size: 12px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
            </div>
            """
            
            await send_email_smtp(
                to_email=user["email"],
                subject="StationCab - Réinitialisation de votre mot de passe",
                html_content=html_content,
                sender_type=sender_type
            )
            logger.info(f"Password reset email sent to {user['email']}")
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
    
    return {"success": True, "message": "Si cet email existe, un lien de réinitialisation a été envoyé"}


@router.post("/reset-password")
async def reset_password(data: PasswordResetConfirm):
    """Reset password using token from email"""
    reset_record = await db.password_resets.find_one({
        "token": data.token,
        "used": False
    }, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré")
    
    # Check expiration
    expires_at = datetime.fromisoformat(reset_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Ce lien a expiré. Veuillez faire une nouvelle demande.")
    
    # Validate password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    
    # Update password
    hashed = hash_password(data.new_password)
    await db.users.update_one(
        {"id": reset_record["user_id"]},
        {"$set": {"password_hash": hashed}}
    )
    
    # Mark token as used
    await db.password_resets.update_one(
        {"token": data.token},
        {"$set": {"used": True}}
    )
    
    return {"success": True, "message": "Mot de passe modifié avec succès"}
