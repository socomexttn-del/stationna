"""
Users Router v2 - StationCab
Refactored from server.py - June 2025

Endpoints:
- PUT /users/profile - Update user profile
- PUT /users/availability - Toggle driver availability
- PUT /users/vehicle - Update vehicle info
- GET /users/my-data - RGPD data export
- DELETE /users/my-account - RGPD account deletion
- POST /users/request-deletion - Request account deletion
"""
import os
import uuid
import logging
import bcrypt
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict
import jwt

# Logger
logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/users", tags=["Users"])

# ======================== DEPENDENCIES ========================
db = None
send_email_smtp = None

def init_router(database, email_function=None):
    """Initialize router with database and email function"""
    global db, send_email_smtp
    db = database
    send_email_smtp = email_function

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'volt-taxi-secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')

security = HTTPBearer()

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

class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    siret: Optional[str] = None
    address: Optional[str] = None
    tva_number: Optional[str] = None
    iban: Optional[str] = None

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

class AvailabilityUpdate(BaseModel):
    is_available: bool

class VehicleUpdate(BaseModel):
    vehicle_info: Dict

# ======================== ROUTES ========================

@router.put("/profile", response_model=UserResponse)
async def update_user_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update user profile information"""
    update_data = {}
    
    if data.first_name is not None:
        update_data["first_name"] = data.first_name
    if data.last_name is not None:
        update_data["last_name"] = data.last_name
    if data.phone is not None:
        update_data["phone"] = data.phone
    if data.company_name is not None:
        update_data["company_name"] = data.company_name
    if data.siret is not None:
        update_data["siret"] = data.siret
    if data.address is not None:
        update_data["address"] = data.address
    if data.tva_number is not None:
        update_data["tva_number"] = data.tva_number
    if data.iban is not None:
        update_data["iban"] = data.iban
    
    if update_data:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    return UserResponse(**updated_user)


@router.put("/availability", response_model=UserResponse)
async def update_availability(data: AvailabilityUpdate, current_user: dict = Depends(get_current_user)):
    """Toggle driver availability status"""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can update availability")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_available": data.is_available}}
    )
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    return UserResponse(**updated_user)


@router.put("/vehicle", response_model=UserResponse)
async def update_vehicle(data: VehicleUpdate, current_user: dict = Depends(get_current_user)):
    """Update driver vehicle information"""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can update vehicle info")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"vehicle_info": data.vehicle_info}}
    )
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    return UserResponse(**updated_user)


# ======================== RGPD ROUTES ========================

@router.get("/my-data")
async def export_my_data(current_user: dict = Depends(get_current_user)):
    """
    RGPD - Right to data portability
    Export all personal data for the current user
    """
    user_id = current_user["id"]
    
    # Get user profile (excluding sensitive fields)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    
    # Get ride history
    rides = await db.rides.find(
        {"$or": [{"passenger_id": user_id}, {"driver_id": user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Get payment transactions
    transactions = await db.payment_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Get wallet transactions
    wallet_transactions = await db.wallet_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Get chat messages
    chat_messages = await db.messages.find(
        {"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # For drivers, get payment history
    driver_payments = []
    if current_user.get("role") == "driver":
        driver_payments = await db.driver_payments.find(
            {"driver_id": user_id},
            {"_id": 0}
        ).to_list(500)
    
    export_data = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "profile": user,
        "rides": rides,
        "payment_transactions": transactions,
        "wallet_transactions": wallet_transactions,
        "chat_messages": chat_messages,
        "driver_payments": driver_payments
    }
    
    logger.info(f"Data export requested by user {user_id}")
    
    return export_data


@router.delete("/my-account")
async def delete_my_account(
    password: str = Query(..., description="User password for confirmation"),
    current_user: dict = Depends(get_current_user)
):
    """
    RGPD - Right to erasure (right to be forgotten)
    Delete user account and anonymize associated data
    """
    user_id = current_user["id"]
    
    # Verify password
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    if not bcrypt.checkpw(password.encode('utf-8'), user["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")
    
    # Check for active rides
    active_ride = await db.rides.find_one({
        "$or": [{"passenger_id": user_id}, {"driver_id": user_id}],
        "status": {"$in": ["pending", "accepted", "arrived", "in_progress"]}
    })
    
    if active_ride:
        raise HTTPException(
            status_code=400, 
            detail="Vous avez une course en cours. Veuillez l'annuler ou la terminer avant de supprimer votre compte."
        )
    
    # For drivers, check unpaid earnings
    if current_user.get("role") == "driver":
        last_monday = datetime.now(timezone.utc) - timedelta(days=datetime.now(timezone.utc).weekday())
        unpaid_rides = await db.rides.count_documents({
            "driver_id": user_id,
            "status": "completed",
            "completed_at": {"$gte": last_monday.isoformat()}
        })
        
        if unpaid_rides > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Vous avez {unpaid_rides} course(s) non encore réglée(s). Attendez le prochain lundi pour supprimer votre compte."
            )
    
    # Anonymize user data in rides (keep rides for accounting)
    anonymized_name = "Utilisateur supprimé"
    await db.rides.update_many(
        {"passenger_id": user_id},
        {"$set": {"passenger_name": anonymized_name, "passenger_phone": None}}
    )
    await db.rides.update_many(
        {"driver_id": user_id},
        {"$set": {"driver_name": anonymized_name, "driver_phone": None}}
    )
    
    # Delete chat messages
    await db.messages.delete_many({
        "$or": [{"sender_id": user_id}, {"receiver_id": user_id}]
    })
    
    # Delete push subscriptions
    await db.push_subscriptions.delete_many({"user_id": user_id})
    
    # Delete user account
    await db.users.delete_one({"id": user_id})
    
    logger.info(f"Account deleted for user {user_id} (RGPD erasure request)")
    
    return {
        "success": True,
        "message": "Votre compte a été supprimé. Vos données personnelles ont été effacées conformément au RGPD."
    }


@router.post("/request-deletion")
async def request_account_deletion(current_user: dict = Depends(get_current_user)):
    """Request account deletion - sends confirmation email"""
    user_id = current_user["id"]
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Send confirmation email
    if send_email_smtp:
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #00a693;">StationCab</h2>
                <p>Bonjour {user.get('first_name', '')},</p>
                <p>Vous avez demandé la suppression de votre compte StationCab.</p>
                <p style="color: #ef4444;"><strong>Attention :</strong> Cette action est irréversible.</p>
                <p>Pour confirmer la suppression :</p>
                <ol>
                    <li>Connectez-vous à votre compte</li>
                    <li>Allez dans Mon Profil → Mes données personnelles</li>
                    <li>Cliquez sur "Supprimer mon compte"</li>
                    <li>Entrez votre mot de passe pour confirmer</li>
                </ol>
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                    Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
                </p>
            </div>
            """
            
            sender_type = "driver" if user.get("role") == "driver" else "client"
            await send_email_smtp(
                to_email=user["email"],
                subject="StationCab - Demande de suppression de compte",
                html_content=html_content,
                sender_type=sender_type
            )
        except Exception as e:
            logger.error(f"Failed to send deletion confirmation email: {e}")
    
    return {
        "success": True,
        "message": "Un email de confirmation vous a été envoyé."
    }
