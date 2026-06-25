from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import math
import asyncio
import io
import json
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import stripe
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pywebpush import webpush, WebPushException
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# SMTP Configuration (Zembra/OVH)
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'ssl0.ovh.net')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '465'))
SMTP_CLIENT_EMAIL = os.environ.get('SMTP_CLIENT_EMAIL', 'contact@stationcab.fr')
SMTP_CLIENT_PASSWORD = os.environ.get('SMTP_CLIENT_PASSWORD', '')
SMTP_DRIVER_EMAIL = os.environ.get('SMTP_DRIVER_EMAIL', 'driver@stationcab.fr')
SMTP_DRIVER_PASSWORD = os.environ.get('SMTP_DRIVER_PASSWORD', '')

# Email sending function using SMTP
async def send_email_smtp(to_email: str, subject: str, html_content: str, sender_type: str = "client"):
    """
    Send email via SMTP (Zembra/OVH)
    sender_type: "client" uses contact@stationcab.fr, "driver" uses driver@stationcab.fr
    """
    if sender_type == "driver":
        from_email = SMTP_DRIVER_EMAIL
        password = SMTP_DRIVER_PASSWORD
    else:
        from_email = SMTP_CLIENT_EMAIL
        password = SMTP_CLIENT_PASSWORD
    
    if not password:
        logger.warning(f"SMTP password not configured for {from_email}")
        return False
    
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["From"] = f"StationCab <{from_email}>"
        message["To"] = to_email
        message["Subject"] = subject
        
        # Attach HTML content
        html_part = MIMEText(html_content, "html", "utf-8")
        message.attach(html_part)
        
        # Send via SMTP with SSL
        await aiosmtplib.send(
            message,
            hostname=SMTP_SERVER,
            port=SMTP_PORT,
            username=from_email,
            password=password,
            use_tls=True  # SSL/TLS on port 465
        )
        
        logger.info(f"Email sent successfully to {to_email} from {from_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'volt-taxi-secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', 24))

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_SECRET_KEY') or os.environ.get('STRIPE_API_KEY')
stripe.api_key = STRIPE_API_KEY

# Stripe publishable key for frontend
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', "pk_live_51J5B0aIhFRBc7tGxbkNUnMyYfrSEGJpSc1DzoxUASi6guCIYeaYGEeA2Cf9Ce7ZiYa2vSJEsjtnvJ1mKxQc8xhJI006tIB0hKE")

# Web Push VAPID Keys (for push notifications even when phone is in sleep mode)
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', 'BDCbQxC5k4UrbdizRop8uCR-33wtwazA7uIfpBAWqJUSfJG8tzJwRrcXS_HXXCmZfo2l_Buf_zLLHeHAtF8BU54')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', 'Et9fgI_HxcyPRlFfOt0uXUeMn7z7C2zKPGXl0uBDGGs')
VAPID_CLAIMS = {"sub": "mailto:contact@stationcab.fr"}

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

# Import Firebase service for push notifications
from services.firebase_service import (
    send_push_notification, 
    send_push_to_multiple, 
    is_firebase_initialized
)

# Notification title/body templates for different notification types
NOTIFICATION_TEMPLATES = {
    "new_ride": {
        "title": "🚖 Nouvelle course disponible!",
        "body": "Course de {pickup} à {destination} - {price}€"
    },
    "ride_available": {
        "title": "🚖 Nouvelle course disponible!",
        "body": "Course de {pickup} à {destination}"
    },
    "scheduled_ride_available": {
        "title": "📅 Course réservée à l'avance!",
        "body": "Prise en charge à {scheduled_time} - {pickup} → {destination}"
    },
    "ride_accepted": {
        "title": "✅ Course acceptée!",
        "body": "Votre chauffeur {driver_name} arrive"
    },
    "ride_taken": {
        "title": "❌ Course déjà prise",
        "body": "Cette course a été acceptée par un autre chauffeur"
    },
    "driver_arrived": {
        "title": "🚗 Chauffeur arrivé!",
        "body": "Votre chauffeur est arrivé au point de prise en charge"
    },
    "ride_started": {
        "title": "🚀 Course démarrée!",
        "body": "Votre course est en cours"
    },
    "ride_completed": {
        "title": "🏁 Course terminée!",
        "body": "Merci d'avoir utilisé StationCab"
    },
    "ride_assigned": {
        "title": "📋 Course assignée!",
        "body": "Une nouvelle course vous a été assignée"
    },
    "scheduled_ride_assigned": {
        "title": "📅 Course planifiée assignée!",
        "body": "Course à {scheduled_time} - {pickup}"
    },
    "driver_changed": {
        "title": "🔄 Changement de chauffeur",
        "body": "Un nouveau chauffeur a été assigné à votre course"
    },
    "searching_driver": {
        "title": "🔍 Recherche en cours",
        "body": "Nous recherchons un nouveau chauffeur"
    }
}

class NotificationManager:
    """Store notifications in MongoDB and send push notifications via Firebase"""
    
    def _get_notification_content(self, notification_type: str, data: dict) -> tuple:
        """Get title and body for push notification based on type"""
        template = NOTIFICATION_TEMPLATES.get(notification_type, {})
        title = template.get("title", "StationCab")
        body = template.get("body", "Vous avez une nouvelle notification")
        
        # Format body with data if available
        try:
            body = body.format(**data) if data else body
        except (KeyError, ValueError):
            pass
        
        return title, body
    
    async def _get_user_fcm_tokens(self, user_id: str) -> list:
        """Get all FCM tokens for a user"""
        tokens = await db.fcm_tokens.find(
            {"user_id": user_id, "active": True},
            {"_id": 0, "token": 1}
        ).to_list(10)
        return [t["token"] for t in tokens]
    
    async def _get_all_driver_fcm_tokens(self, vehicle_type: str = None) -> list:
        """Get FCM tokens for all available drivers, optionally filtered by vehicle type"""
        # Build query based on vehicle type filter
        query = {"role": "driver", "is_available": True}
        
        # If vehicle_type is specified, filter drivers who can handle this type
        # Van rides -> only drivers with "van" in their vehicle_types
        # Taxi rides -> only drivers with "taxi" in their vehicle_types
        # VTC/Standard rides -> drivers with "vtc" OR "taxi" (taxi can do VTC)
        if vehicle_type:
            if vehicle_type == "van":
                # Van rides: only drivers configured for van
                query["driver_vehicle_types"] = {"$in": ["van"]}
            elif vehicle_type == "taxi":
                # Taxi rides: only drivers configured for taxi
                query["driver_vehicle_types"] = {"$in": ["taxi"]}
            else:
                # VTC/Standard rides: drivers with vtc OR taxi (taxi can do VTC)
                query["driver_vehicle_types"] = {"$in": ["vtc", "taxi"]}
        
        available_drivers = await db.users.find(
            query,
            {"_id": 0, "id": 1}
        ).to_list(1000)
        
        driver_ids = [d["id"] for d in available_drivers]
        
        if not driver_ids:
            return []
        
        # Get all active tokens for these drivers
        tokens = await db.fcm_tokens.find(
            {"user_id": {"$in": driver_ids}, "active": True},
            {"_id": 0, "token": 1}
        ).to_list(1000)
        
        return [t["token"] for t in tokens]
    
    async def _send_push(self, user_id: str, notification_type: str, data: dict):
        """Send push notification to a specific user via FCM and Web Push"""
        title, body = self._get_notification_content(notification_type, data)
        
        # Send via Firebase (for apps)
        if is_firebase_initialized():
            tokens = await self._get_user_fcm_tokens(user_id)
            if tokens:
                for token in tokens:
                    await send_push_notification(
                        token=token,
                        title=title,
                        body=body,
                        data={"type": notification_type, **{k: str(v) for k, v in data.items() if v is not None}}
                    )
        
        # Also send via Web Push (for web browser - works in sleep mode!)
        try:
            await send_web_push_notification(
                user_id=user_id,
                title=title,
                body=body,
                data={"type": notification_type, **{k: str(v) for k, v in data.items() if v is not None}}
            )
        except Exception as e:
            logger.debug(f"Web Push error (non-critical): {e}")
    
    async def _send_push_to_all_drivers(self, notification_type: str, data: dict, vehicle_type: str = None, exclude_driver_ids: list = None):
        """Send push notification to all available drivers filtered by vehicle type"""
        title, body = self._get_notification_content(notification_type, data)
        
        # Send via Firebase (for apps)
        if is_firebase_initialized():
            tokens = await self._get_all_driver_fcm_tokens(vehicle_type, exclude_driver_ids)
            if tokens:
                await send_push_to_multiple(
                    tokens=tokens,
                    title=title,
                    body=body,
                    data={"type": notification_type, **{k: str(v) for k, v in data.items() if v is not None}}
                )
        
        # Also send Web Push to all available drivers (works in sleep mode!)
        try:
            query = {"role": "driver", "is_available": True}
            if vehicle_type:
                if vehicle_type == "van":
                    query["driver_vehicle_types"] = {"$in": ["van"]}
                elif vehicle_type == "taxi":
                    query["driver_vehicle_types"] = {"$in": ["taxi"]}
                else:
                    query["driver_vehicle_types"] = {"$in": ["vtc", "taxi"]}
            
            available_drivers = await db.users.find(query, {"_id": 0, "id": 1}).to_list(500)
            driver_ids = [d["id"] for d in available_drivers]
            
            if exclude_driver_ids:
                driver_ids = [d for d in driver_ids if d not in exclude_driver_ids]
            
            # Send Web Push to each driver
            for driver_id in driver_ids:
                try:
                    await send_web_push_notification(
                        user_id=driver_id,
                        title=title,
                        body=body,
                        data={"type": notification_type, **{k: str(v) for k, v in data.items() if v is not None}}
                    )
                except Exception as e:
                    logger.debug(f"Web Push error for driver {driver_id}: {e}")
        except Exception as e:
            logger.error(f"Error sending Web Push to drivers: {e}")
    
    async def create_notification(self, user_id: str, notification_type: str, data: dict, role: str = None):
        """Create a notification for a user or broadcast to all drivers"""
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "role": role,
            "type": notification_type,
            "data": data,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        # Send push notification
        await self._send_push(user_id, notification_type, data)
        
        return notification
    
    async def notify_all_drivers(self, notification_type: str, data: dict, vehicle_type: str = None, exclude_driver_ids: list = None):
        """Broadcast notification to available drivers filtered by vehicle type"""
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": "broadcast_drivers",
            "role": "driver",
            "type": notification_type,
            "data": data,
            "vehicle_type_filter": vehicle_type,  # Track which type this notification is for
            "exclude_driver_ids": exclude_driver_ids or [],  # Drivers who refused
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        # Send push notification to filtered drivers
        await self._send_push_to_all_drivers(notification_type, data, vehicle_type, exclude_driver_ids)
        
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

# ======================== SCHEDULED RIDES PROCESSOR ========================

async def process_scheduled_rides():
    """
    Check for scheduled rides that should be proposed to drivers.
    Rides are proposed 15 minutes before their scheduled pickup time.
    """
    try:
        now = datetime.now(timezone.utc)
        # Find rides scheduled for 15 minutes from now (with 2 min tolerance)
        target_time_start = now + timedelta(minutes=13)
        target_time_end = now + timedelta(minutes=17)
        
        # Find scheduled rides that haven't been proposed yet
        scheduled_rides = await db.rides.find({
            "status": "scheduled",
            "proposed_to_drivers": {"$ne": True},
            "scheduled_time": {
                "$gte": target_time_start.isoformat(),
                "$lte": target_time_end.isoformat()
            }
        }, {"_id": 0}).to_list(50)
        
        for ride in scheduled_rides:
            await propose_scheduled_ride_to_drivers(ride)
            
        return len(scheduled_rides)
        
    except Exception as e:
        logger.error(f"Error processing scheduled rides: {e}")
        return 0

async def propose_scheduled_ride_to_drivers(ride: dict):
    """
    Propose a scheduled ride to the nearest available driver.
    If no driver accepts within 5 minutes, propose to the next nearest.
    """
    try:
        ride_id = ride["id"]
        pickup = ride["pickup"]
        vehicle_type = ride.get("vehicle_type", "standard")
        
        # Parse scheduled time for display
        scheduled_dt = datetime.fromisoformat(ride["scheduled_time"].replace('Z', '+00:00'))
        scheduled_time_str = scheduled_dt.strftime("%H:%M")
        
        # Find nearest available driver filtered by vehicle type
        nearest_driver = await find_nearest_driver(pickup, max_distance_km=20.0, vehicle_type=vehicle_type)
        
        if nearest_driver:
            # Propose to nearest driver first
            driver_id = nearest_driver["driver"]["id"]
            
            # Update ride to track proposed driver
            await db.rides.update_one(
                {"id": ride_id},
                {
                    "$set": {
                        "proposed_to_drivers": True,
                        "proposed_driver_id": driver_id,
                        "proposed_at": datetime.now(timezone.utc).isoformat(),
                        "status": "pending"  # Change status so driver can accept
                    }
                }
            )
            
            # Notify the specific driver about the scheduled ride
            await notification_manager.notify_driver(driver_id, "scheduled_ride_available", {
                "ride_id": ride_id,
                "pickup": pickup.get("address", ""),
                "destination": ride["destination"].get("address", ""),
                "scheduled_time": scheduled_time_str,
                "distance_km": ride.get("distance_km", 0),
                "estimated_fare": ride.get("estimated_fare", 0),
                "passenger_name": ride.get("passenger_name", ""),
                "is_scheduled": True,
                "vehicle_type": vehicle_type
            })
            
            logger.info(f"Scheduled ride {ride_id} ({vehicle_type}) proposed to driver {driver_id}")
            
        else:
            # No driver available - notify all drivers matching vehicle type
            await db.rides.update_one(
                {"id": ride_id},
                {
                    "$set": {
                        "proposed_to_drivers": True,
                        "status": "pending"
                    }
                }
            )
            
            await notification_manager.notify_all_drivers("scheduled_ride_available", {
                "ride_id": ride_id,
                "pickup": pickup.get("address", ""),
                "destination": ride["destination"].get("address", ""),
                "scheduled_time": scheduled_time_str,
                "distance_km": ride.get("distance_km", 0),
                "estimated_fare": ride.get("estimated_fare", 0),
                "passenger_name": ride.get("passenger_name", ""),
                "is_scheduled": True,
                "vehicle_type": vehicle_type
            }, vehicle_type=vehicle_type)
            
            logger.info(f"Scheduled ride {ride_id} ({vehicle_type}) broadcast to all drivers matching vehicle type")
            
    except Exception as e:
        logger.error(f"Error proposing scheduled ride {ride.get('id')}: {e}")

# Background task to check scheduled rides every minute
scheduled_rides_task = None

async def scheduled_rides_checker():
    """Background task that runs every minute to check for scheduled rides"""
    while True:
        try:
            count = await process_scheduled_rides()
            if count > 0:
                logger.info(f"Processed {count} scheduled ride(s)")
        except Exception as e:
            logger.error(f"Scheduled rides checker error: {e}")
        await asyncio.sleep(60)  # Check every minute

@app.on_event("startup")
async def start_scheduled_rides_checker():
    """Start the background task on app startup"""
    global scheduled_rides_task
    scheduled_rides_task = asyncio.create_task(scheduled_rides_checker())
    logger.info("Scheduled rides checker started")

@app.on_event("shutdown")
async def stop_scheduled_rides_checker():
    """Stop the background task on app shutdown"""
    global scheduled_rides_task
    if scheduled_rides_task:
        scheduled_rides_task.cancel()
        logger.info("Scheduled rides checker stopped")

# ======================== MODELS ========================

async def generate_driver_code() -> str:
    """Generate unique driver code like SC-0001, SC-0002, etc."""
    # Find the highest existing driver code
    last_driver = await db.users.find_one(
        {"role": "driver", "driver_code": {"$exists": True, "$ne": None}},
        {"driver_code": 1},
        sort=[("driver_code", -1)]
    )
    
    if last_driver and last_driver.get("driver_code"):
        # Extract number from code like "SC-0001"
        try:
            last_number = int(last_driver["driver_code"].split("-")[1])
            new_number = last_number + 1
        except:
            new_number = 1
    else:
        new_number = 1
    
    return f"SC-{new_number:04d}"

def get_driver_commission_rate(referral_points: int) -> float:
    """Get commission rate based on referral points. 18% default, 10% at 3000+ points"""
    if referral_points >= 3000:
        return 0.10  # 10% commission
    return 0.18  # 18% commission (default)

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
    driver_vehicle_types: Optional[List[str]] = None  # ["taxi", "vtc", "van"] - Types de véhicules que le chauffeur peut accepter
    driver_code: Optional[str] = None  # Code unique chauffeur (ex: SC-0001) - visible admin/chauffeur uniquement
    referral_points: Optional[int] = 0  # Points de parrainage (1 point par client parrainé avec course terminée)
    commission_rate: Optional[float] = 0.18  # Taux de commission (18% par défaut, 10% à 3000 points)
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
    payment_intent_id: Optional[str] = None  # Stripe PaymentIntent ID for authorization
    scheduled_time: Optional[str] = None
    is_scheduled: Optional[bool] = False  # Flag for scheduled rides
    created_at: str
    accepted_at: Optional[str] = None
    completed_at: Optional[str] = None
    vehicle_type: str = "standard"
    passenger_count: int = 1
    driver_eta_minutes: Optional[int] = None
    driver_distance_km: Optional[float] = None
    driver_arrived: Optional[bool] = False  # Driver has arrived at pickup
    driver_arrived_at: Optional[str] = None
    # Cancellation fields
    cancelled_by: Optional[str] = None  # "passenger" or "driver"
    cancelled_at: Optional[str] = None
    cancellation_fee: Optional[float] = None  # VTC/Taxi: 8€, Van: 15€
    cancellation_fee_charged: Optional[bool] = None
    authorization_cancelled: Optional[bool] = None  # If payment authorization was cancelled

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
    # Personal documents  
    "permis_conduire": {"name": "Permis de Conduire", "category": "personal", "required": True, "has_expiry": True},
    "cni": {"name": "Pièce d'Identité (CNI/Passeport)", "category": "personal", "required": True, "has_expiry": True},
    "photo_visage": {"name": "Photo du Visage", "category": "personal", "required": True, "has_expiry": False},
    
    # Vehicle documents
    "assurance_vehicule": {"name": "Assurance Véhicule", "category": "vehicle", "required": True, "has_expiry": True},
    "controle_technique": {"name": "Contrôle Technique", "category": "vehicle", "required": True, "has_expiry": True},
    "photo_voiture_avant": {"name": "Photo Voiture - Avant", "category": "vehicle", "required": True, "has_expiry": False},
    "photo_voiture_arriere": {"name": "Photo Voiture - Arrière", "category": "vehicle", "required": True, "has_expiry": False},
    "photo_voiture_profil": {"name": "Photo Voiture - Profil", "category": "vehicle", "required": True, "has_expiry": False},
    
    # Professional documents
    "carte_professionnelle": {"name": "Carte Professionnelle VTC/Taxi", "category": "professional", "required": True, "has_expiry": True},
    "assurance_transport": {"name": "Assurance Transport à Titre Onéreux", "category": "professional", "required": True, "has_expiry": True},
    "licence_transport": {"name": "Licence de Transport", "category": "professional", "required": True, "has_expiry": True},
    "kbis": {"name": "Extrait KBIS", "category": "professional", "required": True, "has_expiry": True},
    
    # Financial documents
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
    payment_intent_id: Optional[str] = None  # Stripe PaymentIntent ID from authorization
    payment_status: Optional[str] = None  # 'authorized' when using auth flow
    referral_driver_code: Optional[str] = None  # Code chauffeur parrain (ex: SC-0001)

class PaymentCreateRequest(BaseModel):
    ride_id: str
    origin_url: str

class PreBookingPaymentRequest(BaseModel):
    amount: int  # Amount in cents
    description: str
    success_url: str
    cancel_url: str
    metadata: dict = {}

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
    vehicle_type: Optional[str] = "standard"
    passenger_count: Optional[int] = 1
    stops: Optional[List[Dict]] = None

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

# Password Reset Models
class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class AdminPasswordReset(BaseModel):
    user_id: str
    new_password: str

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

async def find_nearest_driver(pickup_location: Dict, max_distance_km: float = 15.0, vehicle_type: str = None, exclude_driver_ids: list = None) -> Optional[Dict]:
    """Find the nearest available driver to the pickup location, optionally filtered by vehicle type"""
    query = {
        "role": "driver",
        "is_available": True,
        "location": {"$ne": None}
    }
    
    # Exclude drivers who refused
    if exclude_driver_ids:
        query["id"] = {"$nin": exclude_driver_ids}
    
    # Filter by vehicle type capability
    if vehicle_type:
        if vehicle_type == "van":
            # Van rides: only drivers with "van" capability
            query["driver_vehicle_types"] = {"$in": ["van"]}
        elif vehicle_type == "taxi":
            # Taxi rides: only drivers with "taxi"
            query["driver_vehicle_types"] = {"$in": ["taxi"]}
        else:
            # VTC/Standard rides: drivers with "vtc" OR "taxi" (taxi can do VTC)
            query["driver_vehicle_types"] = {"$in": ["vtc", "taxi"]}
    
    available_drivers = await db.users.find(query, {"_id": 0}).to_list(100)
    
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

def get_paris_taxi_tariff(scheduled_time: datetime = None) -> dict:
    """
    Determine which Paris taxi tariff applies (A, B, or C) based on time/day
    Tarifs officiels taxis parisiens 2025 (Arrêté 2025-00248)
    
    Tarif A: Jour (10h-17h) Lundi-Samedi, intra-muros
    Tarif B: Nuit (17h-10h) OU Dimanche/Jours fériés (7h-24h), intra-muros
    Tarif C: Banlieue / courses suburbaines
    """
    check_time = scheduled_time if scheduled_time else datetime.now(timezone.utc)
    
    # Get hour and day of week (0=Monday, 6=Sunday)
    hour = check_time.hour
    day_of_week = check_time.weekday()
    
    # French public holidays 2025 (simplified - main ones)
    holidays_2025 = [
        (1, 1), (4, 21), (5, 1), (5, 8), (5, 29), (6, 9),
        (7, 14), (8, 15), (11, 1), (11, 11), (12, 25)
    ]
    is_holiday = (check_time.month, check_time.day) in holidays_2025
    
    is_sunday = day_of_week == 6
    is_night = hour >= 17 or hour < 10
    
    # Tarif B applies for nights or Sundays/holidays
    if is_sunday or is_holiday:
        return {
            "tariff": "B",
            "label": "Tarif B (Dim/Férié)",
            "price_per_km": 1.64,
            "price_per_hour": 51.79,
            "prise_en_charge": 3.00
        }
    elif is_night:
        return {
            "tariff": "B", 
            "label": "Tarif B (Nuit)",
            "price_per_km": 1.64,
            "price_per_hour": 51.79,
            "prise_en_charge": 3.00
        }
    else:
        # Tarif A - Jour (10h-17h) Lundi-Samedi
        return {
            "tariff": "A",
            "label": "Tarif A (Jour)",
            "price_per_km": 1.25,
            "price_per_hour": 38.85,
            "prise_en_charge": 3.00
        }

# Airport coordinates for flat rate detection
AIRPORTS = {
    "cdg": {
        "name": "Charles de Gaulle",
        "lat": 49.0097,
        "lng": 2.5479,
        "radius_km": 5  # Detection radius
    },
    "orly": {
        "name": "Orly",
        "lat": 48.7262,
        "lng": 2.3652,
        "radius_km": 3
    }
}

# Seine river approximate latitude in Paris (separates Rive Droite from Rive Gauche)
# The Seine curves through Paris - using 48.86 as a practical dividing line
# North of 48.86 = Rive Droite (1er, 2e, 3e, 4e, 8e, 9e, 10e, 11e, 12e, 17e, 18e, 19e, 20e)
# South of 48.86 = Rive Gauche (5e, 6e, 7e, 13e, 14e, 15e)
SEINE_LATITUDE = 48.86

# Airport flat rates (forfaits) 2025
AIRPORT_FLAT_RATES = {
    "cdg": {
        "rive_droite": 56.00,  # CDG → Paris Rive Droite
        "rive_gauche": 65.00   # CDG → Paris Rive Gauche
    },
    "orly": {
        "rive_droite": 45.00,  # Orly → Paris Rive Droite  
        "rive_gauche": 36.00   # Orly → Paris Rive Gauche
    }
}

def calculate_distance_simple(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Simple distance calculation in km using Haversine formula"""
    R = 6371
    lat1_rad, lng1_rad = math.radians(lat1), math.radians(lng1)
    lat2_rad, lng2_rad = math.radians(lat2), math.radians(lng2)
    
    dlat = lat2_rad - lat1_rad
    dlng = lng2_rad - lng1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

# Paris city boundaries (approximate bounding box for Paris intra-muros)
PARIS_BOUNDS = {
    "lat_min": 48.815,   # South boundary (Porte d'Orléans area)
    "lat_max": 48.902,   # North boundary (Porte de la Chapelle area)
    "lng_min": 2.225,    # West boundary (Bois de Boulogne)
    "lng_max": 2.470     # East boundary (Bois de Vincennes)
}

def is_in_paris(lat: float, lng: float) -> bool:
    """Check if coordinates are within Paris intra-muros"""
    return (PARIS_BOUNDS["lat_min"] <= lat <= PARIS_BOUNDS["lat_max"] and
            PARIS_BOUNDS["lng_min"] <= lng <= PARIS_BOUNDS["lng_max"])

def detect_airport_trip(pickup_lat: float, pickup_lng: float, dest_lat: float, dest_lng: float) -> dict:
    """
    Detect if the trip is to/from an airport and determine the applicable flat rate.
    IMPORTANT: Flat rate ONLY applies for trips between PARIS INTRA-MUROS and airports.
    If the non-airport point is outside Paris, regular metered fare applies.
    """
    result = {
        "is_airport_trip": False,
        "airport": None,
        "direction": None,  # "to_airport" or "from_airport"
        "rive": None,       # "rive_droite" or "rive_gauche"
        "flat_rate": None
    }
    
    for airport_code, airport_info in AIRPORTS.items():
        airport_lat = airport_info["lat"]
        airport_lng = airport_info["lng"]
        radius = airport_info["radius_km"]
        
        # Check if pickup is near airport
        pickup_to_airport = calculate_distance_simple(pickup_lat, pickup_lng, airport_lat, airport_lng)
        # Check if destination is near airport
        dest_to_airport = calculate_distance_simple(dest_lat, dest_lng, airport_lat, airport_lng)
        
        if pickup_to_airport <= radius:
            # Trip FROM airport - check if destination is IN PARIS
            if not is_in_paris(dest_lat, dest_lng):
                # Destination is NOT in Paris - no flat rate, use metered fare
                continue
            
            result["is_airport_trip"] = True
            result["airport"] = airport_code
            result["airport_name"] = airport_info["name"]
            result["direction"] = "from_airport"
            # Determine Rive based on destination latitude
            result["rive"] = "rive_droite" if dest_lat > SEINE_LATITUDE else "rive_gauche"
            result["flat_rate"] = AIRPORT_FLAT_RATES[airport_code][result["rive"]]
            return result
            
        elif dest_to_airport <= radius:
            # Trip TO airport - check if pickup is IN PARIS
            if not is_in_paris(pickup_lat, pickup_lng):
                # Pickup is NOT in Paris - no flat rate, use metered fare
                continue
            
            result["is_airport_trip"] = True
            result["airport"] = airport_code
            result["airport_name"] = airport_info["name"]
            result["direction"] = "to_airport"
            # Determine Rive based on pickup latitude
            result["rive"] = "rive_droite" if pickup_lat > SEINE_LATITUDE else "rive_gauche"
            result["flat_rate"] = AIRPORT_FLAT_RATES[airport_code][result["rive"]]
            return result
    
    return result

def calculate_taxi_fare(distance_km: float, duration_minutes: int = 0, is_scheduled: bool = False, 
                        passenger_count: int = 1, stops_count: int = 0, scheduled_time: datetime = None,
                        is_suburban: bool = False, pickup_coords: dict = None, dest_coords: dict = None) -> dict:
    """
    Calculate fare for official Paris taxi with regulated pricing
    Tarifs officiels taxis parisiens 2025
    
    Special case: Airport flat rates (forfaits) apply ONLY for DIRECT trips Paris ↔ CDG/Orly
    With intermediate stops, the fare is metered (au compteur)
    """
    # Constants for supplements
    SUPPLEMENT_IMMEDIAT = 4.00
    SUPPLEMENT_AVANCE = 7.00
    
    # Check for airport flat rate - ONLY if there are NO intermediate stops
    # According to Paris taxi regulations, flat rates only apply for direct trips
    airport_trip = {"is_airport_trip": False}
    if pickup_coords and dest_coords and stops_count == 0:
        airport_trip = detect_airport_trip(
            pickup_coords.get("lat", 0), pickup_coords.get("lng", 0),
            dest_coords.get("lat", 0), dest_coords.get("lng", 0)
        )
    
    # If airport trip WITH NO STOPS, apply flat rate
    if airport_trip["is_airport_trip"]:
        flat_rate = airport_trip["flat_rate"]
        
        # Only add booking supplement
        booking_supplement = SUPPLEMENT_AVANCE if is_scheduled else SUPPLEMENT_IMMEDIAT
        booking_label = "Réservation à l'avance" if is_scheduled else "Réservation immédiate"
        
        total = flat_rate + booking_supplement
        
        rive_label = "Rive Droite" if airport_trip["rive"] == "rive_droite" else "Rive Gauche"
        direction_label = f"Aéroport {airport_trip['airport_name']} → Paris {rive_label}" if airport_trip["direction"] == "from_airport" else f"Paris {rive_label} → Aéroport {airport_trip['airport_name']}"
        
        return {
            "vehicle_type": "taxi",
            "is_airport_flat_rate": True,
            "airport": airport_trip["airport"].upper(),
            "airport_name": airport_trip["airport_name"],
            "direction": airport_trip["direction"],
            "direction_label": direction_label,
            "rive": airport_trip["rive"],
            "rive_label": rive_label,
            "flat_rate": flat_rate,
            "booking_supplement": booking_supplement,
            "booking_supplement_label": booking_label,
            "supplement_details": [
                {"name": f"Forfait {airport_trip['airport_name']} ↔ Paris {rive_label}", "amount": flat_rate},
                {"name": booking_label, "amount": booking_supplement}
            ],
            "total": round(total, 2),
            "regulated": True,
            "regulation_text": "Forfait aéroport réglementé - Préfecture de Police de Paris 2025"
        }
    
    # Standard taxi fare calculation (non-airport)
    # Get applicable tariff
    if is_suburban:
        tariff_info = {
            "tariff": "C",
            "label": "Tarif C (Banlieue)",
            "price_per_km": 1.74,
            "price_per_hour": 42.52,
            "prise_en_charge": 3.00
        }
    else:
        tariff_info = get_paris_taxi_tariff(scheduled_time)
    
    # Constants
    TARIF_MINIMUM = 8.00
    SUPPLEMENT_IMMEDIAT = 4.00
    SUPPLEMENT_AVANCE = 7.00
    SUPPLEMENT_PASSAGER = 5.50  # Per passenger from 5th
    SUPPLEMENT_ARRET = 3.00
    
    # Base calculation (horokilométrique)
    prise_en_charge = tariff_info["prise_en_charge"]
    distance_cost = distance_km * tariff_info["price_per_km"]
    time_cost = (duration_minutes / 60) * tariff_info["price_per_hour"]
    
    # Supplements
    supplements = 0
    supplement_details = []
    
    # Booking supplement
    if is_scheduled:
        supplements += SUPPLEMENT_AVANCE
        supplement_details.append({"name": "Réservation à l'avance", "amount": SUPPLEMENT_AVANCE})
    else:
        supplements += SUPPLEMENT_IMMEDIAT
        supplement_details.append({"name": "Réservation immédiate", "amount": SUPPLEMENT_IMMEDIAT})
    
    # Extra passengers (5th+)
    extra_passengers = max(0, passenger_count - 4)
    if extra_passengers > 0:
        passenger_supplement = SUPPLEMENT_PASSAGER * extra_passengers
        supplements += passenger_supplement
        supplement_details.append({"name": f"Passager(s) supplémentaire(s) ({extra_passengers})", "amount": round(passenger_supplement, 2)})
    
    # Intermediate stops - No extra fee, price is calculated on total route distance
    
    subtotal = prise_en_charge + distance_cost + time_cost + supplements
    total = max(TARIF_MINIMUM, subtotal)
    
    return {
        "vehicle_type": "taxi",
        "tariff": tariff_info["tariff"],
        "tariff_label": tariff_info["label"],
        "price_per_km": tariff_info["price_per_km"],
        "price_per_hour": tariff_info["price_per_hour"],
        "prise_en_charge": prise_en_charge,
        "distance_cost": round(distance_cost, 2),
        "time_cost": round(time_cost, 2),
        "supplements": round(supplements, 2),
        "supplement_details": supplement_details,
        "subtotal": round(subtotal, 2),
        "minimum_applied": subtotal < TARIF_MINIMUM,
        "total": round(total, 2),
        "regulated": True,
        "regulation_text": "Tarification réglementée - Préfecture de Police de Paris 2025"
    }

def calculate_vtc_fare(distance_km: float, duration_minutes: int = 0, is_scheduled: bool = False, 
                       vehicle_type: str = "standard", passenger_count: int = 1, stops_count: int = 0) -> dict:
    """
    Calculate fare for VTC (standard or van)
    """
    # VTC rates (non-regulated, competitive pricing)
    PRISE_EN_CHARGE = 4.48
    PRIX_KM = 1.30
    TARIF_MINUTE = 0.70
    TARIF_MINIMUM = 8.00
    SUPPLEMENT_IMMEDIAT = 4.00
    SUPPLEMENT_AVANCE = 7.00
    SUPPLEMENT_PASSAGER = 5.50
    SUPPLEMENT_VAN = 10.00
    SUPPLEMENT_ARRET = 3.00
    
    base = PRISE_EN_CHARGE
    distance_cost = distance_km * PRIX_KM
    time_cost = duration_minutes * TARIF_MINUTE
    
    supplements = 0
    supplement_details = []
    
    if vehicle_type == "van":
        supplements += SUPPLEMENT_VAN
        supplement_details.append({"name": "Van (7 places)", "amount": SUPPLEMENT_VAN})
    
    if is_scheduled:
        supplements += SUPPLEMENT_AVANCE
        supplement_details.append({"name": "Réservation à l'avance", "amount": SUPPLEMENT_AVANCE})
    else:
        supplements += SUPPLEMENT_IMMEDIAT
        supplement_details.append({"name": "Réservation immédiate", "amount": SUPPLEMENT_IMMEDIAT})
    
    extra_passengers = max(0, passenger_count - 4)
    if extra_passengers > 0:
        passenger_supplement = SUPPLEMENT_PASSAGER * extra_passengers
        supplements += passenger_supplement
        supplement_details.append({"name": f"Passager(s) supplémentaire(s) ({extra_passengers})", "amount": round(passenger_supplement, 2)})
    
    # Intermediate stops - No extra fee for VTC, price is calculated on total route distance
    
    subtotal = base + distance_cost + time_cost + supplements
    total = max(TARIF_MINIMUM, subtotal)
    
    return {
        "vehicle_type": vehicle_type,
        "prise_en_charge": PRISE_EN_CHARGE,
        "price_per_km": PRIX_KM,
        "distance_cost": round(distance_cost, 2),
        "time_cost": round(time_cost, 2),
        "supplements": round(supplements, 2),
        "supplement_details": supplement_details,
        "subtotal": round(subtotal, 2),
        "minimum_applied": subtotal < TARIF_MINIMUM,
        "total": round(total, 2),
        "regulated": False
    }

def calculate_fare(distance_km: float, duration_minutes: int = 0, is_scheduled: bool = False, is_immediate: bool = True, vehicle_type: str = "standard", passenger_count: int = 1, stops_count: int = 0, scheduled_time: datetime = None, pickup_coords: dict = None, dest_coords: dict = None) -> dict:
    """
    Calculate fare based on vehicle type:
    - taxi: Official Paris taxi rates (regulated) with airport flat rates
    - standard: VTC standard rates
    - van: VTC van rates
    """
    if vehicle_type == "taxi":
        return calculate_taxi_fare(
            distance_km=distance_km,
            duration_minutes=duration_minutes,
            is_scheduled=is_scheduled,
            passenger_count=passenger_count,
            stops_count=stops_count,
            scheduled_time=scheduled_time,
            pickup_coords=pickup_coords,
            dest_coords=dest_coords
        )
    else:
        return calculate_vtc_fare(
            distance_km=distance_km,
            duration_minutes=duration_minutes,
            is_scheduled=is_scheduled,
            vehicle_type=vehicle_type,
            passenger_count=passenger_count,
            stops_count=stops_count
        )

# ======================== AUTH ROUTES ========================

# ======================== EMAIL VERIFICATION OTP ========================

import random
import string

class EmailVerificationRequest(BaseModel):
    email: EmailStr

class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str

class UserCreateWithVerification(UserBase):
    password: str
    verification_code: str  # Code OTP reçu par email

def generate_otp_code() -> str:
    """Generate a 6-digit OTP code"""
    return ''.join(random.choices(string.digits, k=6))

async def send_verification_email(email: str, code: str, first_name: str = ""):
    """Send verification code via email"""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }}
            .container {{ max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
            .logo {{ text-align: center; margin-bottom: 20px; }}
            .logo h1 {{ color: #00a693; margin: 0; font-size: 28px; }}
            .code {{ background: linear-gradient(135deg, #00a693, #1f3f6b); color: white; font-size: 32px; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0; font-weight: bold; }}
            .message {{ color: #333; font-size: 16px; line-height: 1.6; text-align: center; }}
            .footer {{ text-align: center; margin-top: 30px; color: #888; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <h1>🚖 StationCab</h1>
            </div>
            <p class="message">Bonjour{' ' + first_name if first_name else ''} !</p>
            <p class="message">Voici votre code de vérification pour créer votre compte StationCab :</p>
            <div class="code">{code}</div>
            <p class="message">Ce code expire dans <strong>10 minutes</strong>.</p>
            <p class="message">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
            <div class="footer">
                <p>© 2024 StationCab - Service de taxi à Paris</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email_smtp(
        to_email=email,
        subject="🔐 Code de vérification StationCab",
        html_content=html_content,
        sender_type="client"
    )

@api_router.post("/auth/send-verification-code")
async def send_verification_code(request: EmailVerificationRequest):
    """Send a verification code to the email address"""
    # Check if email already registered
    existing = await db.users.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà enregistré")
    
    # Generate OTP code
    code = generate_otp_code()
    
    # Store the code with expiration (10 minutes)
    await db.verification_codes.delete_many({"email": request.email})  # Remove old codes
    await db.verification_codes.insert_one({
        "email": request.email,
        "code": code,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    })
    
    # Send email
    email_sent = await send_verification_email(request.email, code)
    
    if not email_sent:
        raise HTTPException(status_code=500, detail="Erreur lors de l'envoi de l'email")
    
    return {"status": "success", "message": f"Code de vérification envoyé à {request.email}"}

@api_router.post("/auth/verify-code")
async def verify_code(request: VerifyCodeRequest):
    """Verify the OTP code"""
    # Find the verification code
    verification = await db.verification_codes.find_one({
        "email": request.email,
        "code": request.code
    })
    
    if not verification:
        raise HTTPException(status_code=400, detail="Code invalide")
    
    # Check expiration
    if datetime.now(timezone.utc) > verification["expires_at"].replace(tzinfo=timezone.utc):
        await db.verification_codes.delete_one({"email": request.email})
        raise HTTPException(status_code=400, detail="Code expiré. Demandez un nouveau code.")
    
    return {"status": "success", "message": "Code vérifié avec succès", "verified": True}

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserCreate, verification_code: Optional[str] = None):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Verify the OTP code before registration
    if verification_code:
        verification = await db.verification_codes.find_one({
            "email": user.email,
            "code": verification_code
        })
        
        if not verification:
            raise HTTPException(status_code=400, detail="Code de vérification invalide")
        
        # Check expiration
        expires_at = verification["expires_at"]
        if hasattr(expires_at, 'replace'):
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            await db.verification_codes.delete_one({"email": user.email})
            raise HTTPException(status_code=400, detail="Code expiré. Demandez un nouveau code.")
        
        # Delete the used code
        await db.verification_codes.delete_one({"email": user.email})
    
    user_id = str(uuid.uuid4())
    
    # For drivers, account is pending validation until admin approves all documents
    validation_status = "pending_validation" if user.role == "driver" else "active"
    
    # Generate unique driver code for drivers
    driver_code = None
    if user.role == "driver":
        driver_code = await generate_driver_code()
    
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
        "driver_vehicle_types": ["vtc"] if user.role == "driver" else None,
        "validation_status": validation_status,  # pending_validation, active, suspended
        "documents": {},  # Will store document info with validation status
        "company_name": None,
        "siret": None,
        "address": None,
        "tva_number": None,
        "driver_code": driver_code,  # Code unique chauffeur (SC-0001, etc.)
        "referral_points": 0,  # Points de parrainage
        "referred_clients": [],  # Liste des IDs clients parrainés
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

# ======================== USER PROFILE UPDATE ========================

class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    siret: Optional[str] = None
    address: Optional[str] = None
    tva_number: Optional[str] = None
    iban: Optional[str] = None

@api_router.put("/users/profile", response_model=UserResponse)
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

# ======================== PASSWORD RESET ROUTES ========================

@api_router.post("/auth/forgot-password")
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
    await db.password_resets.delete_many({"user_id": user["id"]})  # Remove old tokens
    await db.password_resets.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "token": reset_token,
        "expires_at": expires_at,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Send email with reset link via SMTP
    try:
        frontend_url = os.environ.get('FRONTEND_URL', 'https://stationcab.fr')
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"
        
        # Determine sender based on user role
        sender_type = "driver" if user.get("role") == "driver" else "client"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">StationCab</h2>
            <p>Bonjour {user.get('first_name', '')},</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
            <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
            <a href="{reset_link}" style="display: inline-block; background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
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

@api_router.post("/auth/reset-password")
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

@api_router.post("/admin/reset-user-password")
async def admin_reset_user_password(data: AdminPasswordReset, admin_user: dict = Depends(get_admin_user)):
    """Admin can reset any user's password"""
    user = await db.users.find_one({"id": data.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Validate password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    
    # Update password
    hashed = hash_password(data.new_password)
    await db.users.update_one(
        {"id": data.user_id},
        {"$set": {"password_hash": hashed}}
    )
    
    logger.info(f"Admin {admin_user['email']} reset password for user {user['email']}")
    
    return {
        "success": True,
        "message": f"Mot de passe réinitialisé pour {user['email']}",
        "user_email": user["email"]
    }

# ======================== FCM TOKEN ROUTES ========================

class FCMTokenRegister(BaseModel):
    token: str
    device_info: Optional[dict] = None

class FCMTokenResponse(BaseModel):
    success: bool
    message: str

@api_router.post("/fcm/register", response_model=FCMTokenResponse)
async def register_fcm_token(data: FCMTokenRegister, current_user: dict = Depends(get_current_user)):
    """Register or update FCM token for push notifications"""
    # Deactivate any existing tokens with the same token value (from other users)
    await db.fcm_tokens.update_many(
        {"token": data.token, "user_id": {"$ne": current_user["id"]}},
        {"$set": {"active": False}}
    )
    
    # Update or insert token for current user
    await db.fcm_tokens.update_one(
        {"user_id": current_user["id"], "token": data.token},
        {
            "$set": {
                "user_id": current_user["id"],
                "token": data.token,
                "device_info": data.device_info,
                "active": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    logger.info(f"FCM token registered for user {current_user['id']}")
    return FCMTokenResponse(success=True, message="Token registered successfully")

@api_router.delete("/fcm/unregister")
async def unregister_fcm_token(data: FCMTokenRegister, current_user: dict = Depends(get_current_user)):
    """Unregister FCM token (e.g., on logout)"""
    await db.fcm_tokens.update_one(
        {"user_id": current_user["id"], "token": data.token},
        {"$set": {"active": False}}
    )
    return {"success": True, "message": "Token unregistered"}

@api_router.get("/fcm/status")
async def get_fcm_status():
    """Check if Firebase push notifications are enabled"""
    from services.firebase_service import is_firebase_initialized
    return {
        "enabled": is_firebase_initialized(),
        "message": "Firebase push notifications are " + ("enabled" if is_firebase_initialized() else "disabled")
    }

# ======================== WEB PUSH NOTIFICATIONS ========================

class WebPushSubscription(BaseModel):
    subscription: dict  # Contains endpoint, keys.p256dh, keys.auth

class WebPushUnsubscribe(BaseModel):
    endpoint: str

@api_router.get("/push/vapid-key")
async def get_vapid_public_key():
    """Get VAPID public key for Web Push subscription"""
    return {"publicKey": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def subscribe_to_web_push(data: WebPushSubscription, current_user: dict = Depends(get_current_user)):
    """Subscribe to Web Push notifications"""
    try:
        subscription = data.subscription
        
        # Deactivate any existing subscriptions with the same endpoint
        await db.web_push_subscriptions.update_many(
            {"endpoint": subscription.get("endpoint"), "user_id": {"$ne": current_user["id"]}},
            {"$set": {"active": False}}
        )
        
        # Save or update subscription
        await db.web_push_subscriptions.update_one(
            {"user_id": current_user["id"], "endpoint": subscription.get("endpoint")},
            {
                "$set": {
                    "user_id": current_user["id"],
                    "endpoint": subscription.get("endpoint"),
                    "keys": subscription.get("keys"),
                    "active": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$setOnInsert": {
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        logger.info(f"Web Push subscription saved for user {current_user['id']}")
        return {"success": True, "message": "Subscription saved"}
        
    except Exception as e:
        logger.error(f"Error saving Web Push subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/push/unsubscribe")
async def unsubscribe_from_web_push(data: WebPushUnsubscribe, current_user: dict = Depends(get_current_user)):
    """Unsubscribe from Web Push notifications"""
    await db.web_push_subscriptions.update_one(
        {"user_id": current_user["id"], "endpoint": data.endpoint},
        {"$set": {"active": False}}
    )
    return {"success": True, "message": "Unsubscribed"}

async def send_web_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send a Web Push notification to a user"""
    try:
        # Get all active subscriptions for this user
        subscriptions = await db.web_push_subscriptions.find(
            {"user_id": user_id, "active": True}
        ).to_list(10)
        
        if not subscriptions:
            logger.debug(f"No Web Push subscriptions for user {user_id}")
            return False
        
        payload = json.dumps({
            "title": title,
            "body": body,
            "icon": "/logo192.png",
            "badge": "/logo192.png",
            "tag": f"stationcab-{datetime.now().timestamp()}",
            "data": data or {}
        })
        
        success_count = 0
        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"]
                }
                
                webpush(
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims=VAPID_CLAIMS
                )
                success_count += 1
                logger.info(f"Web Push sent to user {user_id}")
                
            except WebPushException as e:
                logger.error(f"Web Push error for user {user_id}: {e}")
                # If subscription is invalid, deactivate it
                if e.response and e.response.status_code in [404, 410]:
                    await db.web_push_subscriptions.update_one(
                        {"_id": sub["_id"]},
                        {"$set": {"active": False}}
                    )
            except Exception as e:
                logger.error(f"Web Push error: {e}")
        
        return success_count > 0
        
    except Exception as e:
        logger.error(f"Error sending Web Push: {e}")
        return False

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

# ======================== EMAIL NOTIFICATIONS ========================

class EmailNotificationRequest(BaseModel):
    driver_id: Optional[str] = None  # If None, send to all drivers with expiring docs

def create_expiry_email_html(driver_name: str, documents: List[dict]) -> str:
    """Create HTML email for document expiry notification"""
    expired = [d for d in documents if d.get("is_expired") or d.get("days_until_expiry", 0) < 0]
    expiring = [d for d in documents if not d.get("is_expired") and d.get("days_until_expiry", 0) >= 0]
    
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #ffffff; padding: 20px; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #facc15; margin: 0;">🚕 StationCab</h1>
            <p style="color: #9ca3af; margin: 5px 0;">Notification Documents</p>
        </div>
        
        <p style="margin-bottom: 20px;">Bonjour <strong>{driver_name}</strong>,</p>
        
        <p style="margin-bottom: 20px;">Certains de vos documents nécessitent votre attention :</p>
    """
    
    if expired:
        html += """
        <div style="background: #7f1d1d; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #fca5a5; margin: 0 0 10px 0;">⚠️ Documents expirés</h3>
            <ul style="margin: 0; padding-left: 20px;">
        """
        for doc in expired:
            html += f'<li style="margin-bottom: 5px;">{doc.get("doc_name", doc.get("doc_type"))} - Expiré depuis {abs(doc.get("days_until_expiry", 0))} jours</li>'
        html += "</ul></div>"
    
    if expiring:
        html += """
        <div style="background: #78350f; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #fcd34d; margin: 0 0 10px 0;">📅 Documents à renouveler</h3>
            <ul style="margin: 0; padding-left: 20px;">
        """
        for doc in expiring:
            html += f'<li style="margin-bottom: 5px;">{doc.get("doc_name", doc.get("doc_type"))} - Expire dans {doc.get("days_until_expiry", 0)} jours</li>'
        html += "</ul></div>"
    
    html += """
        <p style="margin-top: 20px;">Veuillez mettre à jour vos documents dès que possible pour continuer à utiliser StationCab.</p>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="#" style="background: #facc15; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">Mettre à jour mes documents</a>
        </div>
        
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center;">
            Cet email a été envoyé automatiquement par StationCab.<br>
            © 2025 StationCab - Votre partenaire VTC
        </p>
    </div>
    """
    return html

@api_router.post("/admin/notifications/send-expiry-alerts")
async def send_expiry_email_alerts(
    data: EmailNotificationRequest,
    admin_user: dict = Depends(get_admin_user)
):
    """Send email notifications to drivers with expiring documents (admin only)"""
    if not RESEND_API_KEY:
        raise HTTPException(status_code=503, detail="Service email non configuré")
    
    today = datetime.now(timezone.utc).date()
    emails_sent = []
    errors = []
    
    # Build query
    query = {"role": "driver"}
    if data.driver_id:
        query["id"] = data.driver_id
    
    drivers = await db.users.find(
        query,
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "documents": 1}
    ).to_list(1000)
    
    for driver in drivers:
        documents = driver.get("documents", {})
        expiring_docs = []
        
        for doc_type, doc_data in documents.items():
            if not doc_data or not doc_data.get("expiry_date"):
                continue
            
            try:
                expiry_date = datetime.fromisoformat(doc_data["expiry_date"].replace("Z", "+00:00")).date()
                days_until_expiry = (expiry_date - today).days
                
                if days_until_expiry <= 30:
                    expiring_docs.append({
                        "doc_type": doc_type,
                        "doc_name": DRIVER_DOCUMENT_TYPES.get(doc_type, {}).get("name", doc_type),
                        "expiry_date": doc_data["expiry_date"],
                        "days_until_expiry": days_until_expiry,
                        "is_expired": days_until_expiry < 0
                    })
            except (ValueError, TypeError):
                continue
        
        if not expiring_docs:
            continue
        
        # Sort by urgency
        expiring_docs.sort(key=lambda x: x["days_until_expiry"])
        
        driver_name = f"{driver['first_name']} {driver['last_name']}"
        html_content = create_expiry_email_html(driver_name, expiring_docs)
        
        expired_count = len([d for d in expiring_docs if d["is_expired"]])
        subject = f"⚠️ {'Documents expirés' if expired_count else 'Documents à renouveler'} - StationCab"
        
        try:
            # Send via SMTP (driver mailbox)
            email_success = await send_email_smtp(
                to_email=driver["email"],
                subject=subject,
                html_content=html_content,
                sender_type="driver"
            )
            
            if email_success:
                emails_sent.append({
                    "driver_id": driver["id"],
                    "driver_name": driver_name,
                    "email": driver["email"],
                    "documents_count": len(expiring_docs)
                })
                
                # Log notification sent
                await db.email_logs.insert_one({
                    "id": str(uuid.uuid4()),
                    "type": "document_expiry",
                    "recipient_id": driver["id"],
                    "recipient_email": driver["email"],
                    "subject": subject,
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "sent_by": admin_user["id"]
                })
            else:
                errors.append({
                    "driver_id": driver["id"],
                    "email": driver["email"],
                    "error": "Email send failed"
                })
            
        except Exception as e:
            logger.error(f"Failed to send email to {driver['email']}: {e}")
            errors.append({
                "driver_id": driver["id"],
                "email": driver["email"],
                "error": str(e)
            })
    
    return {
        "status": "ok",
        "emails_sent": len(emails_sent),
        "details": emails_sent,
        "errors": errors if errors else None
    }

@api_router.get("/admin/notifications/email-logs")
async def get_email_logs(
    limit: int = 50,
    admin_user: dict = Depends(get_admin_user)
):
    """Get email notification logs (admin only)"""
    logs = await db.email_logs.find(
        {},
        {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(limit)
    
    return {"logs": logs, "total": len(logs)}

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

@api_router.put("/admin/drivers/{driver_id}/validate")
async def validate_driver_account(
    driver_id: str,
    admin_user: dict = Depends(get_admin_user)
):
    """Validate a driver account after all documents are approved (admin only)"""
    driver = await db.users.find_one({"id": driver_id, "role": "driver"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Chauffeur non trouvé")
    
    # Check if all required documents are approved
    documents = driver.get("documents", {})
    required_docs = [k for k, v in DRIVER_DOCUMENT_TYPES.items() if v["required"]]
    
    missing_docs = []
    pending_docs = []
    rejected_docs = []
    
    for doc_type in required_docs:
        doc = documents.get(doc_type)
        if not doc or not doc.get("url"):
            missing_docs.append(DRIVER_DOCUMENT_TYPES[doc_type]["name"])
        elif doc.get("status") == "pending":
            pending_docs.append(DRIVER_DOCUMENT_TYPES[doc_type]["name"])
        elif doc.get("status") == "rejected":
            rejected_docs.append(DRIVER_DOCUMENT_TYPES[doc_type]["name"])
    
    if missing_docs:
        raise HTTPException(
            status_code=400, 
            detail=f"Documents manquants: {', '.join(missing_docs)}"
        )
    
    if rejected_docs:
        raise HTTPException(
            status_code=400, 
            detail=f"Documents rejetés: {', '.join(rejected_docs)}"
        )
    
    if pending_docs:
        raise HTTPException(
            status_code=400, 
            detail=f"Documents en attente de validation: {', '.join(pending_docs)}"
        )
    
    # All documents approved - activate the account
    await db.users.update_one(
        {"id": driver_id},
        {"$set": {
            "validation_status": "active",
            "is_active": True,
            "validated_at": datetime.now(timezone.utc).isoformat(),
            "validated_by": admin_user["id"]
        }}
    )
    
    # Notify driver
    await notification_manager.notify_driver(driver_id, "account_validated", {
        "message": "Votre compte a été validé ! Vous pouvez maintenant recevoir des courses."
    })
    
    return {
        "status": "ok",
        "driver_id": driver_id,
        "message": "Compte chauffeur validé et activé"
    }

@api_router.get("/admin/drivers/pending-validation")
async def get_pending_validation_drivers(admin_user: dict = Depends(get_admin_user)):
    """Get all drivers pending account validation (admin only)"""
    drivers = await db.users.find(
        {
            "role": "driver",
            "$or": [
                {"validation_status": "pending_validation"},
                {"validation_status": {"$exists": False}}
            ]
        },
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    # Enrich with document status
    for driver in drivers:
        documents = driver.get("documents", {})
        required_docs = [k for k, v in DRIVER_DOCUMENT_TYPES.items() if v["required"]]
        
        uploaded = sum(1 for d in required_docs if d in documents and documents[d].get("url"))
        approved = sum(1 for d in required_docs if documents.get(d, {}).get("status") == "approved")
        
        driver["document_progress"] = {
            "total_required": len(required_docs),
            "uploaded": uploaded,
            "approved": approved,
            "completion_percent": round((approved / len(required_docs)) * 100) if required_docs else 0
        }
    
    return {
        "total": len(drivers),
        "drivers": drivers
    }

@api_router.get("/admin/drivers/referral-stats")
async def get_drivers_referral_stats(admin_user: dict = Depends(get_admin_user)):
    """Get all drivers with their referral codes and points (admin only)"""
    drivers = await db.users.find(
        {"role": "driver"},
        {
            "_id": 0, 
            "password_hash": 0,
            "id": 1,
            "email": 1,
            "first_name": 1,
            "last_name": 1,
            "phone": 1,
            "driver_code": 1,
            "referral_points": 1,
            "commission_rate": 1,
            "referred_clients": 1,
            "validation_status": 1,
            "created_at": 1
        }
    ).sort("referral_points", -1).to_list(1000)
    
    # Calculate stats
    total_drivers = len(drivers)
    total_points = sum(d.get("referral_points", 0) for d in drivers)
    drivers_with_reduced_commission = sum(1 for d in drivers if d.get("referral_points", 0) >= 3000)
    
    # Enrich with calculated commission rate
    for driver in drivers:
        points = driver.get("referral_points", 0)
        driver["commission_rate"] = get_driver_commission_rate(points)
        driver["referred_clients_count"] = len(driver.get("referred_clients", []))
        driver["points_to_reduced_commission"] = max(0, 3000 - points)
        del driver["referred_clients"]  # Don't expose client IDs
    
    return {
        "total_drivers": total_drivers,
        "total_referral_points": total_points,
        "drivers_with_reduced_commission": drivers_with_reduced_commission,
        "drivers": drivers
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
        "status": {"$in": ["accepted", "arrived", "in_progress"]}
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
        stops_count=stops_count,
        pickup_coords={"lat": data.pickup.lat, "lng": data.pickup.lng},
        dest_coords={"lat": data.destination.lat, "lng": data.destination.lng}
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
        stops_count=stops_count,
        pickup_coords=pickup,
        dest_coords=destination
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
    
    # Check referral driver code if provided
    referral_driver_id = None
    referral_driver_code = data.referral_driver_code
    if referral_driver_code:
        referral_driver = await db.users.find_one({
            "role": "driver",
            "driver_code": referral_driver_code.upper()
        }, {"_id": 0, "id": 1, "first_name": 1, "last_name": 1})
        if referral_driver:
            referral_driver_id = referral_driver["id"]
            logger.info(f"Referral code {referral_driver_code} validated for driver {referral_driver_id}")
        else:
            logger.warning(f"Invalid referral code: {referral_driver_code}")
            referral_driver_code = None  # Reset if invalid
    
    # Calculate commission (18%)
    commission_rate = 0.18
    commission_amount = round(fare * commission_rate, 2)
    driver_earnings = round(fare - commission_amount, 2)
    
    # Find nearest available driver filtered by vehicle type
    nearest_driver_info = await find_nearest_driver(pickup, vehicle_type=data.vehicle_type)
    
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
        "payment_status": data.payment_status or "pending",  # 'authorized' if using auth flow
        "payment_intent_id": data.payment_intent_id,  # Stripe PaymentIntent ID for later capture
        "payment_method": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None,
        "completed_at": None,
        "vehicle_type": data.vehicle_type,
        "passenger_count": data.passenger_count,
        "notified_drivers": [],  # Track which drivers have been notified
        "referral_driver_code": referral_driver_code,  # Code du chauffeur parrain
        "referral_driver_id": referral_driver_id,  # ID du chauffeur parrain
        "referral_point_awarded": False  # True quand le point a été attribué (course terminée)
    }
    
    await db.rides.insert_one(ride)
    
    # Build driver query with vehicle type filter
    driver_query = {
        "role": "driver", 
        "is_available": True,
        "location": {"$exists": True},
        "$or": [{"is_active": True}, {"is_active": {"$exists": False}}]
    }
    
    # Filter drivers by vehicle type capability
    vehicle_type = data.vehicle_type
    if vehicle_type == "van":
        # Van rides: only drivers with "van" capability
        driver_query["driver_vehicle_types"] = {"$in": ["van"]}
    elif vehicle_type == "taxi":
        # Taxi rides: only drivers with "taxi" in their vehicle_types
        driver_query["driver_vehicle_types"] = {"$in": ["taxi"]}
    else:
        # VTC/Standard rides: drivers with "vtc" OR "taxi" (taxi can do VTC)
        driver_query["driver_vehicle_types"] = {"$in": ["vtc", "taxi"]}
    
    # Find nearby drivers filtered by vehicle type and notify them
    available_drivers = await db.users.find(
        driver_query, 
        {"_id": 0, "password_hash": 0}
    ).to_list(20)
    
    # Calculate distance and notify drivers within 10km
    notified_driver_ids = []
    for driver in available_drivers:
        if driver.get("location"):
            dist = calculate_distance(pickup, driver["location"])
            if dist <= 10.0:  # Within 10km
                eta = max(2, round(dist * 2.5))
                await notification_manager.notify_driver(driver["id"], "ride_available", {
                    "id": ride_id,
                    "ride_id": ride_id,
                    "passenger_name": ride["passenger_name"],
                    "pickup": pickup,
                    "destination": destination,
                    "distance_km": distance,
                    "estimated_fare": fare,
                    "driver_earnings": driver_earnings,
                    "distance_to_pickup": round(dist, 1),
                    "eta_minutes": eta,
                    "vehicle_type": vehicle_type
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
    
    # Don't show available rides if driver already has an active ride
    active_ride = await db.rides.find_one({
        "driver_id": current_user["id"],
        "status": {"$in": ["accepted", "arrived", "in_progress"]}
    })
    if active_ride:
        return []  # Driver has an active ride, don't show new ones
    
    # Check if driver is available
    if not current_user.get("is_available", False):
        return []  # Driver is offline
    
    # Get driver's vehicle types
    driver_vehicle_types = current_user.get("driver_vehicle_types", ["vtc"])
    
    # Build query to filter rides by vehicle type compatibility
    # Van rides -> only if driver has "van"
    # Taxi rides -> only if driver has "taxi"
    # VTC/Standard rides -> if driver has "vtc" OR "taxi"
    vehicle_type_conditions = []
    
    if "van" in driver_vehicle_types:
        vehicle_type_conditions.append({"vehicle_type": "van"})
    
    if "taxi" in driver_vehicle_types:
        vehicle_type_conditions.append({"vehicle_type": "taxi"})
    
    if "vtc" in driver_vehicle_types or "taxi" in driver_vehicle_types:
        # VTC drivers can take VTC/standard rides, Taxi drivers can also take VTC rides
        vehicle_type_conditions.append({"vehicle_type": {"$in": ["vtc", "standard", None]}})
    
    if not vehicle_type_conditions:
        return []  # Driver has no valid vehicle types configured
    
    # Query for pending rides matching driver's vehicle types
    # Also exclude rides this driver has already refused
    # $nin works correctly: returns true if refused_by doesn't exist OR doesn't contain driver id
    rides = await db.rides.find({
        "status": "pending",
        "$or": vehicle_type_conditions,
        "refused_by": {"$nin": [current_user["id"]]}
    }, {"_id": 0}).to_list(100)
    
    return [RideResponse(**r) for r in rides]

@api_router.get("/rides/active", response_model=Optional[RideResponse])
async def get_active_ride(current_user: dict = Depends(get_current_user)):
    query = {"status": {"$in": ["pending", "accepted", "arrived", "in_progress"]}}
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

@api_router.post("/rides/{ride_id}/refuse")
async def refuse_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Driver refuses a ride - it will be offered to the next nearest driver after 5 seconds"""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can refuse rides")
    
    ride = await db.rides.find_one({"id": ride_id, "status": "pending"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Course non trouvée ou déjà prise")
    
    # Add this driver to the list of drivers who refused
    refused_by = ride.get("refused_by", [])
    if current_user["id"] not in refused_by:
        refused_by.append(current_user["id"])
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {"refused_by": refused_by}}
    )
    
    # Find next nearest driver (excluding those who refused)
    async def propose_to_next_driver():
        await asyncio.sleep(5)  # Wait 5 seconds
        
        # Check if ride is still pending
        current_ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
        if not current_ride or current_ride.get("status") != "pending":
            return  # Ride already taken or cancelled
        
        refused_list = current_ride.get("refused_by", [])
        pickup = current_ride.get("pickup", {})
        vehicle_type = current_ride.get("vehicle_type", "standard")
        
        # Count all available drivers for this vehicle type
        driver_query = {
            "role": "driver", 
            "is_available": True,
            "location": {"$exists": True},
            "$or": [{"is_active": True}, {"is_active": {"$exists": False}}]
        }
        
        # Filter by vehicle type
        if vehicle_type == "van":
            driver_query["driver_vehicle_types"] = {"$in": ["van"]}
        elif vehicle_type == "taxi":
            driver_query["driver_vehicle_types"] = {"$in": ["taxi"]}
        else:
            driver_query["driver_vehicle_types"] = {"$in": ["vtc", "taxi"]}
        
        all_available_drivers = await db.users.find(driver_query, {"_id": 0, "id": 1}).to_list(100)
        all_driver_ids = [d["id"] for d in all_available_drivers]
        
        # Check if all available drivers have refused
        remaining_drivers = [d for d in all_driver_ids if d not in refused_list]
        
        if not remaining_drivers:
            # ALL drivers have refused or no drivers available - cancel the ride
            logger.info(f"Ride {ride_id}: All drivers refused or none available. Auto-cancelling.")
            
            # Cancel the payment authorization if exists
            payment_intent_id = current_ride.get("payment_intent_id")
            if payment_intent_id:
                try:
                    intent = stripe.PaymentIntent.retrieve(payment_intent_id)
                    if intent.status == "requires_capture":
                        stripe.PaymentIntent.cancel(payment_intent_id)
                        await db.payment_transactions.update_one(
                            {"payment_intent_id": payment_intent_id},
                            {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
                        )
                        logger.info(f"Payment authorization cancelled for ride {ride_id}")
                except Exception as e:
                    logger.error(f"Error cancelling payment for ride {ride_id}: {e}")
            
            # Update ride status to cancelled
            await db.rides.update_one(
                {"id": ride_id},
                {"$set": {
                    "status": "cancelled",
                    "cancelled_by": "system",
                    "cancelled_at": datetime.now(timezone.utc).isoformat(),
                    "cancellation_reason": "no_drivers_available"
                }}
            )
            
            # Notify passenger
            await notification_manager.notify_passenger(current_ride["passenger_id"], "ride_cancelled", {
                "ride_id": ride_id,
                "message": "Aucun chauffeur disponible pour le moment. Veuillez réessayer."
            })
            return
        
        # Find next nearest available driver from remaining
        next_driver = await find_nearest_driver(
            pickup, 
            max_distance_km=20.0, 
            vehicle_type=vehicle_type,
            exclude_driver_ids=refused_list
        )
        
        if next_driver:
            # Notify the next driver
            await notification_manager.notify_driver(next_driver["driver"]["id"], "ride_available", {
                "ride_id": ride_id,
                "pickup": pickup.get("address", ""),
                "destination": current_ride.get("destination", {}).get("address", ""),
                "estimated_fare": current_ride.get("estimated_fare", 0),
                "distance_km": current_ride.get("distance_km", 0),
                "vehicle_type": vehicle_type
            })
            logger.info(f"Ride {ride_id} proposed to next driver {next_driver['driver']['id']} after refusal")
        else:
            # No more drivers available - notify all remaining drivers
            await notification_manager.notify_all_drivers("ride_available", {
                "ride_id": ride_id,
                "pickup": pickup.get("address", ""),
                "destination": current_ride.get("destination", {}).get("address", ""),
                "estimated_fare": current_ride.get("estimated_fare", 0),
                "distance_km": current_ride.get("distance_km", 0),
                "vehicle_type": vehicle_type
            }, vehicle_type=vehicle_type, exclude_driver_ids=refused_list)
            logger.info(f"Ride {ride_id} broadcast to all drivers after refusal")
    
    # Schedule the task
    asyncio.create_task(propose_to_next_driver())
    
    return {"success": True, "message": "Course refusée. Elle sera proposée à un autre chauffeur."}

@api_router.post("/rides/{ride_id}/accept", response_model=RideResponse)
async def accept_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can accept rides")
    
    # Check if driver already has an active ride
    existing_active = await db.rides.find_one({
        "driver_id": current_user["id"],
        "status": {"$in": ["accepted", "arrived", "in_progress"]}
    })
    if existing_active:
        raise HTTPException(status_code=400, detail="Vous avez déjà une course en cours. Terminez-la d'abord.")
    
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

@api_router.post("/rides/{ride_id}/arrived", response_model=RideResponse)
async def driver_arrived(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Driver signals arrival at pickup location"""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can signal arrival")
    
    ride = await db.rides.find_one({"id": ride_id, "driver_id": current_user["id"], "status": "accepted"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "arrived",
        "driver_arrived": True,
        "driver_arrived_at": datetime.now(timezone.utc).isoformat()
    }})
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    # Notify passenger that driver has arrived
    await notification_manager.notify_passenger(ride["passenger_id"], "driver_arrived", {
        "ride_id": ride_id,
        "driver_name": ride.get("driver_name", "Votre chauffeur")
    })
    
    return RideResponse(**updated)

@api_router.post("/rides/{ride_id}/no-show", response_model=RideResponse)
async def client_no_show(ride_id: str, current_user: dict = Depends(get_current_user)):
    """
    Driver reports client no-show after waiting at pickup location.
    Client is charged cancellation fee if driver has been waiting >= 3 minutes.
    """
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Seuls les chauffeurs peuvent signaler un client absent")
    
    ride = await db.rides.find_one({
        "id": ride_id, 
        "driver_id": current_user["id"], 
        "status": "arrived"
    }, {"_id": 0})
    
    if not ride:
        raise HTTPException(status_code=404, detail="Course non trouvée ou vous n'êtes pas encore arrivé")
    
    # Check if driver has been waiting for at least 3 minutes
    driver_arrived_at = ride.get("driver_arrived_at")
    if not driver_arrived_at:
        raise HTTPException(status_code=400, detail="Heure d'arrivée non enregistrée")
    
    try:
        arrived_time = datetime.fromisoformat(driver_arrived_at.replace('Z', '+00:00'))
        time_waiting = datetime.now(timezone.utc) - arrived_time
        minutes_waiting = time_waiting.total_seconds() / 60
        
        if minutes_waiting < 3:
            remaining = 3 - minutes_waiting
            raise HTTPException(
                status_code=400, 
                detail=f"Vous devez attendre encore {remaining:.0f} minute(s) avant de signaler le client absent"
            )
    except ValueError:
        raise HTTPException(status_code=400, detail="Erreur de calcul du temps d'attente")
    
    # Charge cancellation fee
    cancellation_fee = 0.0
    cancellation_fee_charged = False
    vehicle_type = ride.get("vehicle_type", "standard")
    
    if vehicle_type == "van":
        cancellation_fee = 15.0
    else:
        cancellation_fee = 8.0
    
    # Try to capture from existing authorization or charge new
    payment_intent_id = ride.get("payment_intent_id")
    
    if payment_intent_id:
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            if intent.status == "requires_capture":
                # Capture only the cancellation fee
                cancellation_fee_cents = int(cancellation_fee * 100)
                captured_intent = stripe.PaymentIntent.capture(
                    payment_intent_id,
                    amount_to_capture=cancellation_fee_cents
                )
                if captured_intent.status == "succeeded":
                    cancellation_fee_charged = True
                    logger.info(f"No-show fee {cancellation_fee}€ captured for ride {ride_id}")
                    
                    await db.payment_transactions.update_one(
                        {"payment_intent_id": payment_intent_id},
                        {"$set": {
                            "status": "partial_capture",
                            "captured_amount": cancellation_fee,
                            "type": "no_show_fee",
                            "captured_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
        except stripe.error.StripeError as e:
            logger.error(f"Error capturing no-show fee: {e}")
    
    # If no authorization or capture failed, try direct charge
    if not cancellation_fee_charged:
        passenger = await db.users.find_one({"id": ride["passenger_id"]}, {"_id": 0})
        if passenger and passenger.get("stripe_customer_id"):
            try:
                customer = stripe.Customer.retrieve(passenger["stripe_customer_id"])
                default_pm = customer.get("invoice_settings", {}).get("default_payment_method")
                
                if default_pm:
                    fee_intent = stripe.PaymentIntent.create(
                        amount=int(cancellation_fee * 100),
                        currency="eur",
                        customer=passenger["stripe_customer_id"],
                        payment_method=default_pm,
                        off_session=True,
                        confirm=True,
                        description=f"Frais client absent - course {ride_id}",
                        metadata={
                            "ride_id": ride_id,
                            "type": "no_show_fee",
                            "vehicle_type": vehicle_type
                        }
                    )
                    if fee_intent.status == "succeeded":
                        cancellation_fee_charged = True
                        logger.info(f"No-show fee {cancellation_fee}€ charged directly for ride {ride_id}")
            except Exception as e:
                logger.error(f"Error charging no-show fee: {e}")
    
    # Update ride status
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "cancelled",
        "cancelled_by": "no_show",
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "cancellation_fee": cancellation_fee,
        "cancellation_fee_charged": cancellation_fee_charged,
        "no_show": True,
        "minutes_waited": round(minutes_waiting, 1)
    }})
    
    # Make driver available again
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"is_available": True}})
    
    # Notify passenger
    await notification_manager.notify_passenger(ride["passenger_id"], "ride_cancelled", {
        "ride_id": ride_id,
        "message": f"Course annulée - Client absent. Frais: {cancellation_fee}€",
        "cancellation_fee": cancellation_fee,
        "no_show": True
    })
    
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    fee_status = "prélevés" if cancellation_fee_charged else "à prélever"
    logger.info(f"No-show reported for ride {ride_id}: {cancellation_fee}€ ({fee_status})")
    
    return RideResponse(**updated)

@api_router.post("/rides/{ride_id}/start", response_model=RideResponse)
async def start_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can start rides")
    
    # Accept both "accepted" and "arrived" statuses
    ride = await db.rides.find_one({
        "id": ride_id, 
        "driver_id": current_user["id"], 
        "status": {"$in": ["accepted", "arrived"]}
    }, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    await db.rides.update_one({"id": ride_id}, {"$set": {"status": "in_progress"}})
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    # Notify passenger that ride started
    await notification_manager.notify_passenger(ride["passenger_id"], "ride_started", {"ride_id": ride_id})
    
    return RideResponse(**updated)

class MeterPriceRequest(BaseModel):
    meter_price: Optional[float] = None

@api_router.post("/rides/{ride_id}/complete", response_model=RideResponse)
async def complete_ride(ride_id: str, data: Optional[MeterPriceRequest] = None, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can complete rides")
    
    ride = await db.rides.find_one({"id": ride_id, "driver_id": current_user["id"], "status": "in_progress"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # For taxi rides, use meter price if provided
    final_fare = ride["estimated_fare"]
    if ride.get("vehicle_type") == "taxi" and data and data.meter_price:
        final_fare = data.meter_price
    
    # CAPTURE THE PAYMENT if there's an authorized payment intent
    payment_captured = False
    payment_intent_id = ride.get("payment_intent_id")
    
    if payment_intent_id:
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            if intent.status == "requires_capture":
                # Calculate amount to capture (final fare in cents)
                amount_to_capture = int(final_fare * 100)
                
                # For taxi with meter price different from estimate, capture the actual amount
                # But cannot capture more than authorized, so use min
                authorized_amount = intent.amount
                capture_amount = min(amount_to_capture, authorized_amount)
                
                # Capture the payment
                captured_intent = stripe.PaymentIntent.capture(
                    payment_intent_id,
                    amount_to_capture=capture_amount
                )
                
                if captured_intent.status == "succeeded":
                    payment_captured = True
                    logger.info(f"Payment captured for ride {ride_id}: {capture_amount/100}€")
                    
                    # Update transaction record
                    await db.payment_transactions.update_one(
                        {"payment_intent_id": payment_intent_id},
                        {"$set": {
                            "status": "captured",
                            "captured_amount": capture_amount / 100,
                            "captured_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
            elif intent.status == "succeeded":
                # Already captured (shouldn't happen with new flow, but handle legacy)
                payment_captured = True
                logger.info(f"Payment already captured for ride {ride_id}")
                
        except stripe.error.StripeError as e:
            logger.error(f"Error capturing payment for ride {ride_id}: {e}")
            # Don't fail the ride completion, but log the issue
    
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "completed",
        "final_fare": final_fare,
        "meter_price": data.meter_price if data else None,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "payment_status": "paid" if payment_captured else ride.get("payment_status", "pending"),
        "payment_captured": payment_captured
    }})
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"is_available": True}})
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"total_rides": 1}})
    await db.users.update_one({"id": ride["passenger_id"]}, {"$inc": {"total_rides": 1}})
    
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    # Notify passenger that ride completed with final price
    await notification_manager.notify_passenger(ride["passenger_id"], "ride_completed", {
        "ride_id": ride_id,
        "driver_name": f"{current_user['first_name']} {current_user['last_name']}",
        "final_fare": final_fare,
        "is_taxi": ride.get("vehicle_type") == "taxi",
        "meter_price": data.meter_price if data else None,
        "payment_captured": payment_captured
    })
    
    # Award referral point if this ride has a referral driver and point not yet awarded
    if ride.get("referral_driver_id") and not ride.get("referral_point_awarded"):
        referral_driver_id = ride["referral_driver_id"]
        passenger_id = ride["passenger_id"]
        
        # Check if this passenger has already been counted for this driver
        referral_driver = await db.users.find_one({"id": referral_driver_id}, {"_id": 0})
        if referral_driver:
            referred_clients = referral_driver.get("referred_clients", [])
            
            # Only award point if this is a NEW client (first completed ride with this referral code)
            if passenger_id not in referred_clients:
                # Add point and track client
                new_points = referral_driver.get("referral_points", 0) + 1
                new_commission_rate = get_driver_commission_rate(new_points)
                
                await db.users.update_one(
                    {"id": referral_driver_id},
                    {
                        "$inc": {"referral_points": 1},
                        "$push": {"referred_clients": passenger_id},
                        "$set": {"commission_rate": new_commission_rate}
                    }
                )
                
                # Mark the ride as having awarded the point
                await db.rides.update_one(
                    {"id": ride_id},
                    {"$set": {"referral_point_awarded": True}}
                )
                
                logger.info(f"Referral point awarded to driver {referral_driver_id} (code: {ride.get('referral_driver_code')}). New total: {new_points}")
                
                # Check if driver just reached 3000 points milestone
                if new_points == 3000:
                    logger.info(f"Driver {referral_driver_id} reached 3000 points! Commission reduced to 10%")
                    # Could send a notification here to congratulate the driver
    
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
    
    # Determine who cancelled (passenger or driver)
    cancelled_by = "passenger" if current_user["id"] == ride["passenger_id"] else "driver"
    
    # Calculate cancellation fee (only if passenger cancels after driver accepted)
    cancellation_fee = 0.0
    cancellation_fee_charged = False
    authorization_cancelled = False
    
    # Handle the payment authorization
    payment_intent_id = ride.get("payment_intent_id")
    
    if payment_intent_id:
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            if intent.status == "requires_capture":
                # Determine if we need to charge cancellation fee or just cancel
                # Cancellation fee applies ONLY if:
                # 1. Passenger cancels (not driver)
                # 2. Driver has accepted the ride
                # 3. Ride is in accepted/arrived/in_progress status
                # 4. MORE than 2 minutes have passed since acceptance
                
                should_charge_cancellation_fee = False
                
                if cancelled_by == "passenger" and ride.get("driver_id") and ride["status"] in ["accepted", "arrived", "in_progress"]:
                    # Check if 2 minutes have passed since acceptance
                    accepted_at = ride.get("accepted_at")
                    if accepted_at:
                        try:
                            accepted_time = datetime.fromisoformat(accepted_at.replace('Z', '+00:00'))
                            time_since_acceptance = datetime.now(timezone.utc) - accepted_time
                            minutes_since_acceptance = time_since_acceptance.total_seconds() / 60
                            
                            if minutes_since_acceptance >= 2:
                                # More than 2 minutes since acceptance - charge cancellation fee
                                should_charge_cancellation_fee = True
                                logger.info(f"Ride {ride_id}: Cancellation after {minutes_since_acceptance:.1f} minutes - fee applies")
                            else:
                                # Within 2 minutes grace period - no fee
                                logger.info(f"Ride {ride_id}: Cancellation within grace period ({minutes_since_acceptance:.1f} min) - no fee")
                        except (ValueError, TypeError) as e:
                            # If we can't parse the date, assume fee applies for safety
                            logger.warning(f"Could not parse accepted_at for ride {ride_id}: {e}")
                            should_charge_cancellation_fee = True
                    else:
                        # No accepted_at timestamp (shouldn't happen), charge fee for safety
                        should_charge_cancellation_fee = True
                
                if should_charge_cancellation_fee:
                    # Passenger cancels after driver accepted AND after 2 min grace period
                    vehicle_type = ride.get("vehicle_type", "standard")
                    if vehicle_type == "van":
                        cancellation_fee = 15.0
                    else:
                        cancellation_fee = 8.0
                    
                    # Capture only the cancellation fee from the authorized amount
                    cancellation_fee_cents = int(cancellation_fee * 100)
                    
                    try:
                        captured_intent = stripe.PaymentIntent.capture(
                            payment_intent_id,
                            amount_to_capture=cancellation_fee_cents
                        )
                        if captured_intent.status == "succeeded":
                            cancellation_fee_charged = True
                            logger.info(f"Cancellation fee {cancellation_fee}€ captured from authorization for ride {ride_id}")
                            
                            # Update transaction record
                            await db.payment_transactions.update_one(
                                {"payment_intent_id": payment_intent_id},
                                {"$set": {
                                    "status": "partial_capture",
                                    "captured_amount": cancellation_fee,
                                    "type": "cancellation_fee",
                                    "captured_at": datetime.now(timezone.utc).isoformat()
                                }}
                            )
                    except stripe.error.StripeError as e:
                        logger.error(f"Error capturing cancellation fee from authorization: {e}")
                        # Fall back to separate charge
                        try:
                            passenger = await db.users.find_one({"id": ride["passenger_id"]}, {"_id": 0})
                            if passenger and passenger.get("stripe_customer_id"):
                                customer = stripe.Customer.retrieve(passenger["stripe_customer_id"])
                                default_pm = customer.get("invoice_settings", {}).get("default_payment_method")
                                if default_pm:
                                    fee_intent = stripe.PaymentIntent.create(
                                        amount=cancellation_fee_cents,
                                        currency="eur",
                                        customer=passenger["stripe_customer_id"],
                                        payment_method=default_pm,
                                        off_session=True,
                                        confirm=True,
                                        description=f"Frais d'annulation course {ride_id}",
                                        metadata={"ride_id": ride_id, "type": "cancellation_fee"}
                                    )
                                    if fee_intent.status == "succeeded":
                                        cancellation_fee_charged = True
                        except Exception as fallback_err:
                            logger.error(f"Fallback cancellation fee charge failed: {fallback_err}")
                else:
                    # No fee - cancel the authorization (within grace period, or no driver, or driver cancelled)
                    try:
                        stripe.PaymentIntent.cancel(payment_intent_id)
                        authorization_cancelled = True
                        logger.info(f"Payment authorization cancelled for ride {ride_id} - no charge")
                        
                        # Update transaction record
                        await db.payment_transactions.update_one(
                            {"payment_intent_id": payment_intent_id},
                            {"$set": {
                                "status": "cancelled",
                                "cancelled_at": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                    except stripe.error.StripeError as e:
                        logger.error(f"Error cancelling authorization: {e}")
                        
            elif intent.status == "succeeded":
                # Payment was already captured (legacy flow) - need to refund
                logger.warning(f"Ride {ride_id} was cancelled but payment already captured. May need refund.")
                
        except stripe.error.StripeError as e:
            logger.error(f"Error handling payment during cancellation: {e}")
    else:
        # No payment intent (old rides or edge cases) - use old logic for cancellation fee
        # But still apply the 2-minute grace period
        if cancelled_by == "passenger" and ride.get("driver_id") and ride["status"] in ["accepted", "arrived", "in_progress"]:
            # Check if 2 minutes have passed since acceptance
            should_charge = False
            accepted_at = ride.get("accepted_at")
            if accepted_at:
                try:
                    accepted_time = datetime.fromisoformat(accepted_at.replace('Z', '+00:00'))
                    time_since_acceptance = datetime.now(timezone.utc) - accepted_time
                    minutes_since_acceptance = time_since_acceptance.total_seconds() / 60
                    
                    if minutes_since_acceptance >= 2:
                        should_charge = True
                        logger.info(f"Ride {ride_id} (legacy): Cancellation after {minutes_since_acceptance:.1f} minutes - fee applies")
                    else:
                        logger.info(f"Ride {ride_id} (legacy): Cancellation within grace period ({minutes_since_acceptance:.1f} min) - no fee")
                except (ValueError, TypeError):
                    should_charge = True  # If can't parse date, charge for safety
            else:
                should_charge = True
            
            if should_charge:
                vehicle_type = ride.get("vehicle_type", "standard")
                if vehicle_type == "van":
                    cancellation_fee = 15.0
                else:
                    cancellation_fee = 8.0
                
                # Try to charge the cancellation fee via Stripe
                passenger = await db.users.find_one({"id": ride["passenger_id"]}, {"_id": 0})
                if passenger and passenger.get("stripe_customer_id"):
                    try:
                        customer = stripe.Customer.retrieve(passenger["stripe_customer_id"])
                        default_pm = customer.get("invoice_settings", {}).get("default_payment_method")
                        
                        if default_pm:
                            payment_intent = stripe.PaymentIntent.create(
                                amount=int(cancellation_fee * 100),
                                currency="eur",
                                customer=passenger["stripe_customer_id"],
                                payment_method=default_pm,
                                off_session=True,
                                confirm=True,
                                description=f"Frais d'annulation course {ride_id}",
                                metadata={
                                    "ride_id": ride_id,
                                    "type": "cancellation_fee",
                                    "vehicle_type": vehicle_type
                                }
                            )
                            if payment_intent.status == "succeeded":
                                cancellation_fee_charged = True
                                logger.info(f"Cancellation fee {cancellation_fee}€ charged for ride {ride_id}")
                    except stripe.error.CardError as e:
                        logger.error(f"Card error charging cancellation fee: {e}")
                    except Exception as e:
                        logger.error(f"Error charging cancellation fee: {e}")
    
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "cancelled",
        "cancelled_by": cancelled_by,
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "cancellation_fee": cancellation_fee,
        "cancellation_fee_charged": cancellation_fee_charged,
        "authorization_cancelled": authorization_cancelled
    }})
    
    # If there was a driver assigned, make them available again and notify them
    if ride.get("driver_id"):
        await db.users.update_one({"id": ride["driver_id"]}, {"$set": {"is_available": True}})
        
        # Notify the driver that the ride was cancelled (if cancelled by passenger)
        if cancelled_by == "passenger":
            fee_msg = f" (frais: {cancellation_fee}€)" if cancellation_fee > 0 else ""
            try:
                await notification_manager.notify_driver(
                    ride["driver_id"],
                    "ride_cancelled",
                    {
                        "ride_id": ride_id,
                        "message": f"Le client a annulé la course{fee_msg}",
                        "pickup_address": ride.get("pickup", {}).get("address", ""),
                        "cancellation_fee": cancellation_fee
                    }
                )
            except Exception as e:
                logger.error(f"Error notifying driver of cancellation: {e}")
    
    # If cancelled by driver, notify the passenger
    if cancelled_by == "driver" and ride.get("passenger_id"):
        try:
            await notification_manager.notify_passenger(
                ride["passenger_id"],
                "ride_cancelled",
                {
                    "ride_id": ride_id,
                    "message": "Le chauffeur a annulé la course"
                }
            )
        except Exception as e:
            logger.error(f"Error notifying passenger of cancellation: {e}")
    
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

@api_router.get("/rides/history/export-pdf")
async def export_ride_history_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export ride history as PDF"""
    # Build query
    query = {"passenger_id": current_user["id"]} if current_user["role"] == "passenger" else {"driver_id": current_user["id"]}
    query["status"] = {"$in": ["completed", "cancelled"]}
    
    # Date filters
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    rides = await db.rides.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#facc15'), alignment=TA_CENTER, spaceAfter=10)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, textColor=colors.grey, alignment=TA_CENTER, spaceAfter=20)
    header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#1a1a1a'), spaceBefore=15, spaceAfter=10)
    
    # Title
    elements.append(Paragraph("🚕 StationCab", title_style))
    elements.append(Paragraph(f"Historique des courses - {current_user['first_name']} {current_user['last_name']}", subtitle_style))
    elements.append(Paragraph(f"Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')}", subtitle_style))
    elements.append(Spacer(1, 10*mm))
    
    # Summary
    completed_rides = [r for r in rides if r.get("status") == "completed"]
    total_spent = sum(r.get("final_fare") or r.get("estimated_fare", 0) for r in completed_rides)
    total_distance = sum(r.get("distance_km", 0) for r in completed_rides)
    
    summary_data = [
        ["Statistiques", ""],
        ["Courses terminées", str(len(completed_rides))],
        ["Distance totale", f"{total_distance:.1f} km"],
        ["Montant total", f"{total_spent:.2f} €"],
    ]
    
    summary_table = Table(summary_data, colWidths=[100*mm, 60*mm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#facc15')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f5f5f5')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 10*mm))
    
    # Rides table
    if rides:
        elements.append(Paragraph("Détail des courses", header_style))
        
        table_data = [["Date", "Départ", "Destination", "Distance", "Montant", "Statut"]]
        
        for ride in rides[:50]:  # Limit to 50 rides for PDF
            date_str = ride.get("created_at", "")[:10] if ride.get("created_at") else "-"
            pickup = ride.get("pickup", {}).get("address", "-")[:30]
            dest = ride.get("destination", {}).get("address", "-")[:30]
            distance = f"{ride.get('distance_km', 0):.1f} km"
            fare = ride.get("final_fare") or ride.get("estimated_fare", 0)
            fare_str = f"{fare:.2f} €"
            status = "✓" if ride.get("status") == "completed" else "✗"
            
            table_data.append([date_str, pickup, dest, distance, fare_str, status])
        
        rides_table = Table(table_data, colWidths=[25*mm, 45*mm, 45*mm, 20*mm, 20*mm, 15*mm])
        rides_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a1a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ALIGN', (3, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(rides_table)
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"allogo_historique_{current_user['id'][:8]}_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

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
    
    # Remove _id added by MongoDB before returning
    rating.pop("_id", None)
    
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

# Pre-booking payment endpoint - payment BEFORE ride creation
@api_router.post("/payments/pre-booking-checkout")
async def create_pre_booking_checkout(data: PreBookingPaymentRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """Create a Stripe checkout session for payment BEFORE booking a ride"""
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    try:
        # Create Stripe checkout session directly
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': 'Course StationCab',
                        'description': data.description,
                    },
                    'unit_amount': data.amount,  # Amount in cents
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=data.success_url,
            cancel_url=data.cancel_url,
            metadata={
                **data.metadata,
                'user_id': current_user['id'],
                'user_email': current_user['email'],
                'type': 'pre_booking'
            }
        )
        
        # Create payment transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "user_id": current_user["id"],
            "user_email": current_user["email"],
            "amount": data.amount / 100,  # Convert back to euros for storage
            "currency": "eur",
            "payment_status": "pending",
            "type": "pre_booking",
            "metadata": data.metadata,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "checkout_url": session.url, 
            "session_id": session.id
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")

# ======================== SAVED PAYMENT METHODS ========================

class SetupIntentResponse(BaseModel):
    client_secret: str
    setup_intent_id: str
    stripe_customer_id: str = ""
    publishable_key: str

@api_router.post("/payments/create-setup-intent")
async def create_setup_intent(current_user: dict = Depends(get_current_user)):
    """Create a Setup Intent to save a card for future payments"""
    try:
        # Check if user already has a Stripe customer ID
        stripe_customer_id = current_user.get("stripe_customer_id")
        
        if not stripe_customer_id:
            # Create a new Stripe customer
            customer = stripe.Customer.create(
                email=current_user["email"],
                name=f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
                metadata={
                    "user_id": current_user["id"],
                    "role": current_user["role"]
                }
            )
            stripe_customer_id = customer.id
            
            # Save Stripe customer ID to user
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {"stripe_customer_id": stripe_customer_id}}
            )
        
        # Create a Setup Intent
        setup_intent = stripe.SetupIntent.create(
            customer=stripe_customer_id,
            payment_method_types=["card"],
            metadata={
                "user_id": current_user["id"]
            }
        )
        
        return {
            "client_secret": setup_intent.client_secret,
            "setup_intent_id": setup_intent.id,
            "stripe_customer_id": stripe_customer_id,
            "publishable_key": STRIPE_PUBLISHABLE_KEY
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")

class SavePaymentMethodRequest(BaseModel):
    payment_method_id: str

@api_router.post("/payments/save-payment-method")
async def save_payment_method(data: SavePaymentMethodRequest, current_user: dict = Depends(get_current_user)):
    """Save a payment method as the default for the user"""
    try:
        stripe_customer_id = current_user.get("stripe_customer_id")
        if not stripe_customer_id:
            raise HTTPException(status_code=400, detail="No Stripe customer found. Please create a setup intent first.")
        
        # Attach the payment method to the customer
        stripe.PaymentMethod.attach(
            data.payment_method_id,
            customer=stripe_customer_id,
        )
        
        # Set as default payment method
        stripe.Customer.modify(
            stripe_customer_id,
            invoice_settings={"default_payment_method": data.payment_method_id}
        )
        
        # Get card details
        payment_method = stripe.PaymentMethod.retrieve(data.payment_method_id)
        card_info = {
            "payment_method_id": data.payment_method_id,
            "brand": payment_method.card.brand,
            "last4": payment_method.card.last4,
            "exp_month": payment_method.card.exp_month,
            "exp_year": payment_method.card.exp_year
        }
        
        # Save to user
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"default_payment_method": card_info}}
        )
        
        return {
            "success": True,
            "card": card_info
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")

@api_router.get("/payments/saved-card")
async def get_saved_card(current_user: dict = Depends(get_current_user)):
    """Get the user's saved card info"""
    card_info = current_user.get("default_payment_method")
    if not card_info:
        return {"has_card": False, "card": None}
    
    return {
        "has_card": True,
        "card": {
            "brand": card_info.get("brand"),
            "last4": card_info.get("last4"),
            "exp_month": card_info.get("exp_month"),
            "exp_year": card_info.get("exp_year")
        }
    }

@api_router.delete("/payments/remove-card")
async def remove_saved_card(current_user: dict = Depends(get_current_user)):
    """Remove the user's saved card"""
    card_info = current_user.get("default_payment_method")
    if card_info and card_info.get("payment_method_id"):
        try:
            stripe.PaymentMethod.detach(card_info["payment_method_id"])
        except:
            pass  # Ignore errors if card already detached
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$unset": {"default_payment_method": 1}}
    )
    
    return {"success": True}

class ChargeCardRequest(BaseModel):
    amount: int  # Amount in cents
    description: str
    metadata: dict = {}

class AuthorizePaymentRequest(BaseModel):
    amount: int  # Amount in cents
    description: str
    metadata: dict = {}

@api_router.post("/payments/authorize")
async def authorize_payment(data: AuthorizePaymentRequest, current_user: dict = Depends(get_current_user)):
    """
    Authorize a payment WITHOUT capturing it.
    The amount is reserved on the customer's card but NOT charged.
    Use /payments/capture to actually charge, or /payments/cancel-authorization to release.
    """
    card_info = current_user.get("default_payment_method")
    stripe_customer_id = current_user.get("stripe_customer_id")
    
    if not card_info or not stripe_customer_id:
        raise HTTPException(status_code=400, detail="Aucune carte enregistrée. Veuillez ajouter un moyen de paiement.")
    
    try:
        # Create a PaymentIntent with capture_method='manual' - this AUTHORIZES but does NOT charge
        payment_intent = stripe.PaymentIntent.create(
            amount=data.amount,
            currency="eur",
            customer=stripe_customer_id,
            payment_method=card_info["payment_method_id"],
            off_session=True,
            confirm=True,
            capture_method="manual",  # KEY: This makes it an authorization only!
            description=data.description,
            metadata={
                **data.metadata,
                "user_id": current_user["id"]
            }
        )
        
        # Record the authorization (not a charge yet)
        transaction = {
            "id": str(uuid.uuid4()),
            "payment_intent_id": payment_intent.id,
            "user_id": current_user["id"],
            "amount": data.amount / 100,
            "currency": "eur",
            "status": "authorized",  # Not captured yet
            "description": data.description,
            "metadata": data.metadata,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        logger.info(f"Payment authorized (not captured): {payment_intent.id} for {data.amount/100}€")
        
        return {
            "success": True,
            "payment_intent_id": payment_intent.id,
            "status": payment_intent.status,  # Should be "requires_capture"
            "amount": data.amount / 100
        }
        
    except stripe.error.CardError as e:
        raise HTTPException(status_code=400, detail=f"Erreur de carte: {e.user_message}")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Erreur de paiement: {str(e)}")

@api_router.post("/payments/capture/{payment_intent_id}")
async def capture_payment(payment_intent_id: str, amount_to_capture: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    """
    Capture an authorized payment.
    If amount_to_capture is provided (in cents), only that amount will be captured.
    Otherwise, the full authorized amount is captured.
    """
    try:
        # Retrieve the payment intent to verify it belongs to this user
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if intent.metadata.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Ce paiement ne vous appartient pas")
        
        if intent.status != "requires_capture":
            raise HTTPException(status_code=400, detail=f"Ce paiement ne peut pas être capturé (statut: {intent.status})")
        
        # Capture the payment (full or partial)
        if amount_to_capture:
            captured_intent = stripe.PaymentIntent.capture(payment_intent_id, amount_to_capture=amount_to_capture)
        else:
            captured_intent = stripe.PaymentIntent.capture(payment_intent_id)
        
        # Update transaction record
        await db.payment_transactions.update_one(
            {"payment_intent_id": payment_intent_id},
            {"$set": {
                "status": "captured",
                "captured_amount": (amount_to_capture or intent.amount) / 100,
                "captured_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Payment captured: {payment_intent_id} for {(amount_to_capture or intent.amount)/100}€")
        
        return {
            "success": True,
            "status": captured_intent.status,
            "amount_captured": (amount_to_capture or intent.amount) / 100
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Error capturing payment: {e}")
        raise HTTPException(status_code=400, detail=f"Erreur de capture: {str(e)}")

@api_router.post("/payments/cancel-authorization/{payment_intent_id}")
async def cancel_authorization(payment_intent_id: str, current_user: dict = Depends(get_current_user)):
    """
    Cancel an authorized payment (release the hold on the customer's card).
    No money is charged.
    """
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if intent.metadata.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Ce paiement ne vous appartient pas")
        
        if intent.status not in ["requires_capture", "requires_confirmation", "requires_payment_method"]:
            raise HTTPException(status_code=400, detail=f"Cette autorisation ne peut pas être annulée (statut: {intent.status})")
        
        # Cancel the payment intent (releases the authorization)
        cancelled_intent = stripe.PaymentIntent.cancel(payment_intent_id)
        
        # Update transaction record
        await db.payment_transactions.update_one(
            {"payment_intent_id": payment_intent_id},
            {"$set": {
                "status": "cancelled",
                "cancelled_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Payment authorization cancelled: {payment_intent_id}")
        
        return {
            "success": True,
            "status": cancelled_intent.status,
            "message": "Autorisation annulée - aucun prélèvement effectué"
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Error cancelling authorization: {e}")
        raise HTTPException(status_code=400, detail=f"Erreur d'annulation: {str(e)}")

@api_router.post("/payments/charge-saved-card")
async def charge_saved_card(data: ChargeCardRequest, current_user: dict = Depends(get_current_user)):
    """
    DEPRECATED: Use /payments/authorize instead for ride payments.
    This endpoint still charges immediately - only use for wallet top-ups or similar.
    """
    card_info = current_user.get("default_payment_method")
    stripe_customer_id = current_user.get("stripe_customer_id")
    
    if not card_info or not stripe_customer_id:
        raise HTTPException(status_code=400, detail="Aucune carte enregistrée. Veuillez ajouter un moyen de paiement.")
    
    try:
        # Create a PaymentIntent with the saved payment method
        payment_intent = stripe.PaymentIntent.create(
            amount=data.amount,
            currency="eur",
            customer=stripe_customer_id,
            payment_method=card_info["payment_method_id"],
            off_session=True,
            confirm=True,
            description=data.description,
            metadata={
                **data.metadata,
                "user_id": current_user["id"]
            }
        )
        
        # Record the transaction
        transaction = {
            "id": str(uuid.uuid4()),
            "payment_intent_id": payment_intent.id,
            "user_id": current_user["id"],
            "amount": data.amount / 100,
            "currency": "eur",
            "status": payment_intent.status,
            "description": data.description,
            "metadata": data.metadata,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "success": True,
            "payment_intent_id": payment_intent.id,
            "status": payment_intent.status,
            "amount": data.amount / 100
        }
        
    except stripe.error.CardError as e:
        raise HTTPException(status_code=400, detail=f"Erreur de carte: {e.user_message}")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Erreur de paiement: {str(e)}")

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

# Wallet bonus tiers
WALLET_BONUS_TIERS = [
    {"min_amount": 100, "bonus": 15, "label": "+15€ offerts"},
    {"min_amount": 50, "bonus": 5, "label": "+5€ offerts"},
    {"min_amount": 20, "bonus": 2, "label": "+2€ offerts"},
]

def calculate_wallet_bonus(amount: float) -> dict:
    """Calculate bonus based on top-up amount"""
    for tier in WALLET_BONUS_TIERS:
        if amount >= tier["min_amount"]:
            return {"bonus": tier["bonus"], "label": tier["label"], "total": amount + tier["bonus"]}
    return {"bonus": 0, "label": None, "total": amount}

@api_router.get("/wallet/bonus-tiers")
async def get_wallet_bonus_tiers():
    """Get wallet bonus tiers for display"""
    return {"tiers": WALLET_BONUS_TIERS}

@api_router.post("/wallet/top-up")
async def create_wallet_topup(data: WalletTopUpRequest, current_user: dict = Depends(get_current_user)):
    """Create a payment intent to top up wallet"""
    if data.amount < 5:
        raise HTTPException(status_code=400, detail="Montant minimum: 5€")
    if data.amount > 500:
        raise HTTPException(status_code=400, detail="Montant maximum: 500€")
    
    # Calculate bonus
    bonus_info = calculate_wallet_bonus(data.amount)
    
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
                "user_email": current_user["email"],
                "bonus_amount": str(bonus_info["bonus"])
            }
        )
        
        # Create pending transaction record with bonus info
        transaction = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "type": "topup",
            "amount": data.amount,
            "bonus": bonus_info["bonus"],
            "total_credit": bonus_info["total"],
            "status": "pending",
            "payment_intent_id": intent.id,
            "description": f"Rechargement +{data.amount}€" + (f" (bonus +{bonus_info['bonus']}€)" if bonus_info["bonus"] > 0 else ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.wallet_transactions.insert_one(transaction)
        
        return {
            "client_secret": intent.client_secret,
            "publishable_key": STRIPE_PUBLISHABLE_KEY,
            "payment_intent_id": intent.id,
            "amount": data.amount,
            "bonus": bonus_info["bonus"],
            "total_credit": bonus_info["total"]
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
        
        # Get total credit (amount + bonus)
        amount = transaction["amount"]
        bonus = transaction.get("bonus", 0)
        total_credit = transaction.get("total_credit", amount)
        
        # Update wallet balance with total (amount + bonus)
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"wallet_balance": total_credit}}
        )
        
        # Update transaction status
        await db.wallet_transactions.update_one(
            {"id": transaction["id"]},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # If there was a bonus, create a bonus transaction record
        if bonus > 0:
            bonus_transaction = {
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "type": "bonus",
                "amount": bonus,
                "status": "completed",
                "description": f"Bonus rechargement +{bonus}€",
                "related_transaction_id": transaction["id"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.wallet_transactions.insert_one(bonus_transaction)
        
        # Get new balance
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "wallet_balance": 1})
        new_balance = user.get("wallet_balance", 0.0)
        
        message = f"Portefeuille rechargé de {amount}€"
        if bonus > 0:
            message += f" + {bonus}€ de bonus !"
        
        return {
            "status": "succeeded",
            "message": message,
            "amount": amount,
            "bonus": bonus,
            "total_credit": total_credit,
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
    
    # Process stops if provided
    stops_list = data.stops if data.stops else []
    
    ride = {
        "id": ride_id,
        "passenger_id": current_user["id"],
        "passenger_name": f"{current_user['first_name']} {current_user['last_name']}",
        "passenger_phone": current_user.get("phone"),
        "driver_id": None,
        "driver_name": None,
        "pickup": pickup,
        "destination": destination,
        "stops": stops_list,
        "distance_km": distance,
        "duration_minutes": duration,
        "estimated_fare": fare,
        "fare_details": fare_details,
        "final_fare": None,
        "status": "scheduled",
        "is_scheduled": True,  # Flag to indicate this is a scheduled ride
        "proposed_to_drivers": False,  # Will be set to True 15 min before
        "payment_status": "pending",
        "scheduled_time": data.scheduled_time,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None,
        "completed_at": None,
        "vehicle_type": data.vehicle_type,
        "passenger_count": data.passenger_count
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
    
    # Notify drivers filtered by vehicle type
    await notification_manager.notify_all_drivers("new_ride", {
        "id": ride_id,
        "passenger_name": ride["passenger_name"],
        "pickup": ride["pickup"],
        "destination": ride["destination"],
        "distance_km": ride["distance_km"],
        "estimated_fare": ride["estimated_fare"],
        "vehicle_type": ride.get("vehicle_type", "standard")
    }, vehicle_type=ride.get("vehicle_type", "standard"))
    
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

# ======================== ADMIN PROMO CODES ========================

@api_router.get("/admin/promo-codes")
async def get_all_promo_codes(
    page: int = 1,
    limit: int = 20,
    admin_user: dict = Depends(get_admin_user)
):
    """Get all promo codes (admin only)"""
    skip = (page - 1) * limit
    
    promos = await db.promo_codes.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.promo_codes.count_documents({})
    
    # Add usage stats
    for promo in promos:
        promo["usage_percent"] = round((promo.get("used_count", 0) / max(promo.get("max_uses", 1), 1)) * 100, 1)
        # Check if expired
        try:
            valid_until = datetime.fromisoformat(promo["valid_until"].replace('Z', '+00:00'))
            promo["is_expired"] = valid_until < datetime.now(timezone.utc)
        except:
            promo["is_expired"] = False
    
    return {
        "promo_codes": promos,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.post("/admin/promo-codes")
async def admin_create_promo_code(
    data: PromoCodeCreate,
    admin_user: dict = Depends(get_admin_user)
):
    """Create a promo code (admin only)"""
    existing = await db.promo_codes.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Ce code existe déjà")
    
    promo = {
        "id": str(uuid.uuid4()),
        "code": data.code.upper(),
        "discount_percent": data.discount_percent,
        "max_uses": data.max_uses,
        "used_count": 0,
        "valid_until": data.valid_until,
        "created_by": admin_user["id"],
        "is_referral": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.promo_codes.insert_one(promo)
    if "_id" in promo:
        del promo["_id"]
    
    return {"status": "ok", "promo": promo}

@api_router.delete("/admin/promo-codes/{promo_id}")
async def delete_promo_code(
    promo_id: str,
    admin_user: dict = Depends(get_admin_user)
):
    """Delete a promo code (admin only)"""
    result = await db.promo_codes.delete_one({"id": promo_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Code promo non trouvé")
    
    # Also delete user_promos that reference this code
    await db.user_promos.delete_many({"promo_id": promo_id})
    
    return {"status": "ok", "message": "Code promo supprimé"}

@api_router.get("/admin/promo-codes/{promo_id}/stats")
async def get_promo_code_stats(
    promo_id: str,
    admin_user: dict = Depends(get_admin_user)
):
    """Get detailed stats for a promo code (admin only)"""
    promo = await db.promo_codes.find_one({"id": promo_id}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="Code promo non trouvé")
    
    # Get usage details
    usages = await db.user_promos.find(
        {"promo_id": promo_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get user details for each usage
    for usage in usages:
        user = await db.users.find_one(
            {"id": usage["user_id"]},
            {"_id": 0, "first_name": 1, "last_name": 1, "email": 1}
        )
        if user:
            usage["user_name"] = f"{user['first_name']} {user['last_name']}"
            usage["user_email"] = user["email"]
    
    return {
        "promo": promo,
        "usages": usages,
        "total_usages": len(usages),
        "used_usages": len([u for u in usages if u.get("used")])
    }

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

# ======================== ADMIN CANCELLATION FEES ========================

@api_router.get("/admin/cancellation-fees")
async def get_admin_cancellation_fees(
    page: int = 1,
    limit: int = 20,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    admin_user: dict = Depends(get_admin_user)
):
    """Get all cancelled rides with fees for accounting"""
    query = {
        "status": "cancelled",
        "cancellation_fee": {"$gt": 0}
    }
    
    # Date filters
    if date_from or date_to:
        query["cancelled_at"] = {}
        if date_from:
            query["cancelled_at"]["$gte"] = date_from
        if date_to:
            query["cancelled_at"]["$lte"] = date_to
    
    # Get total count
    total_count = await db.rides.count_documents(query)
    
    # Get paginated results
    skip = (page - 1) * limit
    cancellations = await db.rides.find(
        query,
        {"_id": 0}
    ).sort("cancelled_at", -1).skip(skip).to_list(limit)
    
    # Calculate totals
    totals_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_fees": {"$sum": "$cancellation_fee"},
            "total_charged": {"$sum": {"$cond": [{"$eq": ["$cancellation_fee_charged", True]}, "$cancellation_fee", 0]}},
            "total_not_charged": {"$sum": {"$cond": [{"$ne": ["$cancellation_fee_charged", True]}, "$cancellation_fee", 0]}},
            "count": {"$sum": 1}
        }}
    ]
    totals_result = await db.rides.aggregate(totals_pipeline).to_list(1)
    totals = totals_result[0] if totals_result else {
        "total_fees": 0,
        "total_charged": 0,
        "total_not_charged": 0,
        "count": 0
    }
    
    # Group by vehicle type
    by_vehicle_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$vehicle_type",
            "count": {"$sum": 1},
            "total_fees": {"$sum": "$cancellation_fee"},
            "charged": {"$sum": {"$cond": [{"$eq": ["$cancellation_fee_charged", True]}, 1, 0]}}
        }}
    ]
    by_vehicle = await db.rides.aggregate(by_vehicle_pipeline).to_list(10)
    
    return {
        "cancellations": cancellations,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_count,
            "pages": (total_count + limit - 1) // limit
        },
        "totals": {
            "total_fees": totals.get("total_fees", 0),
            "total_charged": totals.get("total_charged", 0),
            "total_not_charged": totals.get("total_not_charged", 0),
            "count": totals.get("count", 0)
        },
        "by_vehicle_type": {item["_id"]: item for item in by_vehicle}
    }

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
            "name": "StationCab",
            "address": "Paris, France",
            "siret": "XXX XXX XXX XXXXX",
            "tva": "FR XX XXXXXXXXX"
        }
    }
    
    return invoice_data

# ======================== DRIVER INVOICE & REFUND ========================

@api_router.get("/rides/{ride_id}/invoice/pdf")
async def generate_driver_invoice_pdf(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Generate PDF invoice from driver's company to the client"""
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Course non trouvée")
    
    # Only completed rides can have invoices
    if ride.get("status") != "completed":
        raise HTTPException(status_code=400, detail="La course doit être terminée pour générer une facture")
    
    # Get driver info with company details
    driver = await db.users.find_one(
        {"id": ride.get("driver_id")},
        {"_id": 0, "password_hash": 0}
    )
    
    # Get client info
    client = await db.users.find_one(
        {"id": ride["passenger_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    if not driver:
        raise HTTPException(status_code=404, detail="Chauffeur non trouvé")
    
    # Generate invoice number
    ride_date = ride.get("created_at", "")[:10].replace("-", "")
    invoice_number = f"FACT-{ride_date}-{ride_id[:8].upper()}"
    
    # Get fare
    fare = ride.get("final_fare") or ride.get("estimated_fare", 0)
    
    # Calculate TVA (20% for transport services)
    ht_amount = round(fare / 1.20, 2)  # Prix HT
    tva_amount = round(fare - ht_amount, 2)  # TVA
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#FFD700'), alignment=TA_CENTER)
    header_style = ParagraphStyle('Header', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#666666'))
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10)
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold')
    
    # Header - Driver Company Info
    driver_company = driver.get("company_name") or f"{driver.get('first_name', '')} {driver.get('last_name', '')} (Auto-entrepreneur)"
    driver_siret = driver.get("siret", "SIRET à renseigner")
    driver_address = driver.get("address", "Adresse à renseigner")
    driver_tva = driver.get("tva_number", "TVA non applicable (Article 293B du CGI)")
    
    elements.append(Paragraph(driver_company, title_style))
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph(f"SIRET: {driver_siret}", header_style))
    elements.append(Paragraph(f"Adresse: {driver_address}", header_style))
    elements.append(Paragraph(f"TVA: {driver_tva}", header_style))
    elements.append(Spacer(1, 10*mm))
    
    # Invoice Title
    elements.append(Paragraph(f"FACTURE N° {invoice_number}", ParagraphStyle('InvoiceTitle', parent=styles['Heading2'], fontSize=14, alignment=TA_CENTER)))
    elements.append(Paragraph(f"Date: {ride.get('completed_at', ride.get('created_at', ''))[:10]}", ParagraphStyle('Date', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER)))
    elements.append(Spacer(1, 10*mm))
    
    # Client Info
    client_name = ride.get("passenger_name") or (f"{client.get('first_name', '')} {client.get('last_name', '')}" if client else "Client")
    client_phone = client.get("phone", "") if client else ""
    client_email = client.get("email", "") if client else ""
    
    elements.append(Paragraph("FACTURÉ À:", bold_style))
    elements.append(Paragraph(client_name, normal_style))
    if client_phone:
        elements.append(Paragraph(f"Tél: {client_phone}", normal_style))
    if client_email:
        elements.append(Paragraph(f"Email: {client_email}", normal_style))
    elements.append(Spacer(1, 10*mm))
    
    # Ride Details
    elements.append(Paragraph("DÉTAILS DE LA PRESTATION:", bold_style))
    elements.append(Spacer(1, 3*mm))
    
    # Table with ride details
    ride_data = [
        ["Description", "Détails"],
        ["Date de la course", ride.get("created_at", "")[:10]],
        ["Prise en charge", ride.get("pickup", {}).get("address", "")],
        ["Destination", ride.get("destination", {}).get("address", "")],
        ["Distance", f"{ride.get('distance_km', 0)} km"],
        ["Type de véhicule", ride.get("vehicle_type", "standard").upper()],
        ["Passagers", str(ride.get("passenger_count", 1))],
    ]
    
    # Add intermediate stops if any
    if ride.get("stops"):
        for i, stop in enumerate(ride["stops"]):
            ride_data.append([f"Arrêt {i+1}", stop.get("address", "")])
    
    ride_table = Table(ride_data, colWidths=[150, 300])
    ride_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FFD700')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(ride_table)
    elements.append(Spacer(1, 10*mm))
    
    # Pricing Table
    elements.append(Paragraph("FACTURATION:", bold_style))
    elements.append(Spacer(1, 3*mm))
    
    pricing_data = [
        ["Désignation", "Montant"],
        ["Transport de personnes", f"{ht_amount:.2f} €"],
        ["TVA (20%)", f"{tva_amount:.2f} €"],
        ["TOTAL TTC", f"{fare:.2f} €"],
    ]
    
    pricing_table = Table(pricing_data, colWidths=[350, 100])
    pricing_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#333333')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#FFD700')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.black),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(pricing_table)
    elements.append(Spacer(1, 15*mm))
    
    # Payment Status
    payment_status = "Payé" if ride.get("payment_status") == "completed" else "En attente de paiement"
    elements.append(Paragraph(f"Statut du paiement: {payment_status}", bold_style))
    elements.append(Spacer(1, 10*mm))
    
    # Footer
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=TA_CENTER)
    elements.append(Paragraph("Facture générée automatiquement par la plateforme StationCab", footer_style))
    elements.append(Paragraph(f"N° de course: {ride.get('reservation_number', ride_id)}", footer_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    # Return PDF
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=facture_{invoice_number}.pdf"}
    )

class RefundRequest(BaseModel):
    reason: str
    amount: Optional[float] = None  # If None, full refund

@api_router.post("/rides/{ride_id}/refund")
async def request_refund(ride_id: str, data: RefundRequest, current_user: dict = Depends(get_current_user)):
    """Request a refund for a completed ride"""
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Course non trouvée")
    
    # Check if user is authorized (passenger or admin)
    if current_user["role"] == "passenger" and ride.get("passenger_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas demander un remboursement pour cette course")
    
    # Only completed and paid rides can be refunded
    if ride.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Seules les courses terminées peuvent être remboursées")
    
    if ride.get("payment_status") != "completed":
        raise HTTPException(status_code=400, detail="Le paiement n'a pas été effectué pour cette course")
    
    # Check if already refunded
    if ride.get("refund_status") == "refunded":
        raise HTTPException(status_code=400, detail="Cette course a déjà été remboursée")
    
    # Calculate refund amount
    total_fare = ride.get("final_fare") or ride.get("estimated_fare", 0)
    refund_amount = data.amount if data.amount and data.amount <= total_fare else total_fare
    
    # Create refund request
    refund_id = str(uuid.uuid4())
    refund_data = {
        "id": refund_id,
        "ride_id": ride_id,
        "passenger_id": ride.get("passenger_id"),
        "passenger_name": ride.get("passenger_name"),
        "driver_id": ride.get("driver_id"),
        "driver_name": ride.get("driver_name"),
        "original_amount": total_fare,
        "refund_amount": refund_amount,
        "reason": data.reason,
        "status": "pending",  # pending, approved, rejected, processed
        "requested_by": current_user["id"],
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None,
        "processed_by": None
    }
    
    await db.refunds.insert_one(refund_data)
    
    # Update ride with refund info
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {
            "refund_status": "pending",
            "refund_id": refund_id,
            "refund_requested_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify admin
    await notification_manager.notify_user("admin", "refund_requested", {
        "ride_id": ride_id,
        "passenger_name": ride.get("passenger_name"),
        "amount": refund_amount,
        "reason": data.reason
    })
    
    return {
        "status": "pending",
        "refund_id": refund_id,
        "message": "Demande de remboursement envoyée. Un administrateur la traitera sous peu.",
        "refund_amount": refund_amount
    }

@api_router.get("/admin/refunds")
async def get_refund_requests(admin_user: dict = Depends(get_admin_user)):
    """Get all refund requests"""
    refunds = await db.refunds.find({}, {"_id": 0}).sort("requested_at", -1).to_list(100)
    
    pending = [r for r in refunds if r.get("status") == "pending"]
    processed = [r for r in refunds if r.get("status") != "pending"]
    
    return {
        "pending": pending,
        "processed": processed,
        "total_pending": len(pending)
    }

@api_router.post("/admin/refunds/{refund_id}/process")
async def process_refund(refund_id: str, approved: bool, admin_user: dict = Depends(get_admin_user)):
    """Approve or reject a refund request"""
    refund = await db.refunds.find_one({"id": refund_id}, {"_id": 0})
    if not refund:
        raise HTTPException(status_code=404, detail="Demande de remboursement non trouvée")
    
    if refund.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Cette demande a déjà été traitée")
    
    new_status = "approved" if approved else "rejected"
    
    # Update refund
    await db.refunds.update_one(
        {"id": refund_id},
        {"$set": {
            "status": new_status,
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "processed_by": admin_user["id"]
        }}
    )
    
    # Update ride
    ride_refund_status = "refunded" if approved else "refund_rejected"
    await db.rides.update_one(
        {"id": refund["ride_id"]},
        {"$set": {"refund_status": ride_refund_status}}
    )
    
    # If approved, process the actual refund (add to wallet or Stripe refund)
    if approved:
        # Add refund amount to passenger's wallet
        await db.users.update_one(
            {"id": refund["passenger_id"]},
            {"$inc": {"wallet_balance": refund["refund_amount"]}}
        )
        
        # Deduct from driver's earnings (if applicable)
        if refund.get("driver_id"):
            driver_deduction = round(refund["refund_amount"] * 0.82, 2)  # Driver's share (minus commission)
            await db.users.update_one(
                {"id": refund["driver_id"]},
                {"$inc": {"total_earnings": -driver_deduction}}
            )
    
    # Notify passenger
    notification_type = "refund_approved" if approved else "refund_rejected"
    await notification_manager.notify_passenger(refund["passenger_id"], notification_type, {
        "ride_id": refund["ride_id"],
        "amount": refund["refund_amount"],
        "status": new_status
    })
    
    return {
        "status": new_status,
        "message": f"Remboursement {'approuvé' if approved else 'rejeté'}",
        "refund_amount": refund["refund_amount"] if approved else 0
    }

@api_router.get("/scheduled-rides")
async def get_scheduled_rides(admin_user: dict = Depends(get_admin_user)):
    """Get all scheduled rides with their status"""
    rides = await db.rides.find(
        {"status": {"$in": ["scheduled", "pending"]}, "is_scheduled": True},
        {"_id": 0}
    ).sort("scheduled_time", 1).to_list(100)
    
    return {
        "total": len(rides),
        "rides": rides
    }

@api_router.post("/admin/process-scheduled-rides")
async def manually_process_scheduled_rides(admin_user: dict = Depends(get_admin_user)):
    """Manually trigger scheduled rides processing (for testing)"""
    count = await process_scheduled_rides()
    return {
        "processed": count,
        "message": f"{count} course(s) planifiée(s) proposée(s) aux chauffeurs"
    }

class DriverVehicleTypesUpdate(BaseModel):
    driver_id: str
    vehicle_types: List[str]  # ["vtc", "van", "taxi"] - independent types

@api_router.put("/admin/drivers/vehicle-types")
async def update_driver_vehicle_types(data: DriverVehicleTypesUpdate, admin_user: dict = Depends(get_admin_user)):
    """Update which vehicle types a driver can accept (vtc, van, taxi - independent)"""
    # Validate vehicle types - now 3 independent types
    valid_types = ["vtc", "van", "taxi"]
    for vt in data.vehicle_types:
        if vt not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid vehicle type: {vt}. Valid types are: {valid_types}")
    
    # Check driver exists
    driver = await db.users.find_one({"id": data.driver_id, "role": "driver"})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Update driver's vehicle types
    await db.users.update_one(
        {"id": data.driver_id},
        {"$set": {"driver_vehicle_types": data.vehicle_types}}
    )
    
    return {
        "success": True,
        "driver_id": data.driver_id,
        "vehicle_types": data.vehicle_types,
        "message": f"Chauffeur configuré pour: {', '.join(data.vehicle_types)}"
    }

@api_router.get("/admin/drivers")
async def get_all_drivers(admin_user: dict = Depends(get_admin_user)):
    """Get all drivers with their vehicle type configuration"""
    drivers = await db.users.find(
        {"role": "driver"},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    return {
        "total": len(drivers),
        "drivers": drivers
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
    if ride["status"] not in ["accepted", "arrived", "in_progress"]:
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

# ============ DRIVER WEEKLY EARNINGS & INVOICES ============

@api_router.get("/admin/drivers/weekly-summary")
async def get_drivers_weekly_summary(
    week_offset: int = 0,  # 0 = current week, -1 = last week, etc.
    admin_user: dict = Depends(get_admin_user)
):
    """
    Get weekly earnings summary for all drivers.
    week_offset: 0 for current week, -1 for last week, etc.
    """
    # Calculate week start (Monday) and end (Sunday)
    today = datetime.now(timezone.utc)
    # Find Monday of the target week
    days_since_monday = today.weekday()
    current_monday = today - timedelta(days=days_since_monday)
    target_monday = current_monday + timedelta(weeks=week_offset)
    target_sunday = target_monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    
    week_start = target_monday.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_end = target_sunday.isoformat()
    
    # Get all completed rides for this week
    completed_rides = await db.rides.find({
        "status": "completed",
        "completed_at": {"$gte": week_start, "$lte": week_end},
        "driver_id": {"$exists": True, "$ne": None}
    }, {"_id": 0}).to_list(1000)
    
    # Group by driver
    driver_earnings = {}
    for ride in completed_rides:
        driver_id = ride.get("driver_id")
        if not driver_id:
            continue
        
        if driver_id not in driver_earnings:
            driver_earnings[driver_id] = {
                "driver_id": driver_id,
                "driver_name": ride.get("driver_name", "Inconnu"),
                "total_rides": 0,
                "total_fare": 0.0,
                "total_commission": 0.0,
                "total_earnings": 0.0,
                "rides": []
            }
        
        fare = ride.get("final_fare") or ride.get("estimated_fare", 0)
        commission = ride.get("commission_amount", fare * 0.18)
        earnings = ride.get("driver_earnings", fare - commission)
        
        driver_earnings[driver_id]["total_rides"] += 1
        driver_earnings[driver_id]["total_fare"] += fare
        driver_earnings[driver_id]["total_commission"] += commission
        driver_earnings[driver_id]["total_earnings"] += earnings
        driver_earnings[driver_id]["rides"].append({
            "id": ride.get("id"),
            "reservation_number": ride.get("reservation_number"),
            "completed_at": ride.get("completed_at"),
            "pickup": ride.get("pickup", {}).get("address", ""),
            "destination": ride.get("destination", {}).get("address", ""),
            "fare": fare,
            "commission": commission,
            "earnings": earnings,
            "vehicle_type": ride.get("vehicle_type", "standard")
        })
    
    # Get driver details (IBAN, email, etc.)
    for driver_id in driver_earnings:
        driver = await db.users.find_one({"id": driver_id}, {"_id": 0, "email": 1, "phone": 1, "iban": 1, "company_name": 1})
        if driver:
            driver_earnings[driver_id]["email"] = driver.get("email")
            driver_earnings[driver_id]["phone"] = driver.get("phone")
            driver_earnings[driver_id]["iban"] = driver.get("iban")
            driver_earnings[driver_id]["company_name"] = driver.get("company_name")
    
    # Sort by earnings descending
    sorted_drivers = sorted(driver_earnings.values(), key=lambda x: x["total_earnings"], reverse=True)
    
    # Calculate totals
    total_all_fares = sum(d["total_fare"] for d in sorted_drivers)
    total_all_commissions = sum(d["total_commission"] for d in sorted_drivers)
    total_all_earnings = sum(d["total_earnings"] for d in sorted_drivers)
    total_all_rides = sum(d["total_rides"] for d in sorted_drivers)
    
    return {
        "week_start": week_start[:10],
        "week_end": week_end[:10],
        "week_offset": week_offset,
        "drivers": sorted_drivers,
        "totals": {
            "total_rides": total_all_rides,
            "total_fare": round(total_all_fares, 2),
            "total_commission": round(total_all_commissions, 2),
            "total_earnings": round(total_all_earnings, 2)
        }
    }

@api_router.get("/admin/drivers/{driver_id}/weekly-invoice")
async def get_driver_weekly_invoice_pdf(
    driver_id: str,
    week_start: str,  # Format: YYYY-MM-DD
    admin_user: dict = Depends(get_admin_user)
):
    """Generate a PDF invoice for a driver's weekly earnings"""
    
    # Parse week dates
    try:
        start_date = datetime.fromisoformat(week_start + "T00:00:00+00:00")
        end_date = start_date + timedelta(days=6, hours=23, minutes=59, seconds=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide. Utilisez YYYY-MM-DD")
    
    # Get driver info
    driver = await db.users.find_one({"id": driver_id, "role": "driver"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Chauffeur non trouvé")
    
    # Get completed rides for this driver this week
    rides = await db.rides.find({
        "driver_id": driver_id,
        "status": "completed",
        "completed_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    }, {"_id": 0}).sort("completed_at", 1).to_list(500)
    
    if not rides:
        raise HTTPException(status_code=404, detail="Aucune course pour cette semaine")
    
    # Calculate totals
    total_fare = 0
    total_commission = 0
    total_earnings = 0
    
    ride_data = []
    for ride in rides:
        fare = ride.get("final_fare") or ride.get("estimated_fare", 0)
        commission = ride.get("commission_amount", fare * 0.18)
        earnings = ride.get("driver_earnings", fare - commission)
        
        total_fare += fare
        total_commission += commission
        total_earnings += earnings
        
        ride_data.append({
            "date": ride.get("completed_at", "")[:10],
            "ref": ride.get("reservation_number", ride.get("id", "")[:8]),
            "pickup": (ride.get("pickup", {}).get("address", ""))[:30],
            "destination": (ride.get("destination", {}).get("address", ""))[:30],
            "fare": fare,
            "commission": commission,
            "earnings": earnings
        })
    
    # Generate PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
    elements = []
    styles = getSampleStyleSheet()
    
    # Header
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#f59e0b'), alignment=TA_CENTER)
    elements.append(Paragraph("RELEVÉ DE COURSES HEBDOMADAIRE", title_style))
    elements.append(Spacer(1, 10*mm))
    
    # Company info
    company_style = ParagraphStyle('Company', parent=styles['Normal'], fontSize=9, textColor=colors.gray)
    elements.append(Paragraph("StationCab - A&S Prestige SASU", company_style))
    elements.append(Paragraph("9 rue Victor Baltard, 77410 Claye-Souilly", company_style))
    elements.append(Paragraph("SIRET: 827 808 866 00012", company_style))
    elements.append(Spacer(1, 8*mm))
    
    # Driver info
    driver_name = f"{driver.get('first_name', '')} {driver.get('last_name', '')}"
    company_name = driver.get('company_name', '')
    info_style = ParagraphStyle('Info', parent=styles['Normal'], fontSize=10)
    elements.append(Paragraph(f"<b>Chauffeur:</b> {driver_name}", info_style))
    if company_name:
        elements.append(Paragraph(f"<b>Société:</b> {company_name}", info_style))
    elements.append(Paragraph(f"<b>Email:</b> {driver.get('email', '')}", info_style))
    elements.append(Paragraph(f"<b>Période:</b> {start_date.strftime('%d/%m/%Y')} au {end_date.strftime('%d/%m/%Y')}", info_style))
    elements.append(Spacer(1, 8*mm))
    
    # Rides table
    table_data = [["Date", "Réf.", "Départ", "Arrivée", "Prix", "Com. 18%", "Net"]]
    for r in ride_data:
        table_data.append([
            r["date"],
            r["ref"],
            r["pickup"],
            r["destination"],
            f"{r['fare']:.2f}€",
            f"-{r['commission']:.2f}€",
            f"{r['earnings']:.2f}€"
        ])
    
    # Add totals row
    table_data.append(["", "", "", "TOTAL", f"{total_fare:.2f}€", f"-{total_commission:.2f}€", f"{total_earnings:.2f}€"])
    
    table = Table(table_data, colWidths=[55, 45, 85, 85, 50, 55, 50])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fef3c7')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.gray),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 10*mm))
    
    # Summary box
    summary_style = ParagraphStyle('Summary', parent=styles['Normal'], fontSize=12, alignment=TA_RIGHT)
    elements.append(Paragraph(f"<b>MONTANT À VERSER: {total_earnings:.2f} €</b>", summary_style))
    elements.append(Spacer(1, 5*mm))
    
    # IBAN info
    iban = driver.get('iban', 'Non renseigné')
    elements.append(Paragraph(f"<b>IBAN:</b> {iban}", info_style))
    elements.append(Spacer(1, 10*mm))
    
    # Footer note
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.gray, alignment=TA_CENTER)
    elements.append(Paragraph("Ce document est un relevé de courses. Les virements sont effectués chaque lundi.", footer_style))
    elements.append(Paragraph(f"Document généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')}", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"releve_{driver_name.replace(' ', '_')}_{start_date.strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.post("/admin/drivers/{driver_id}/mark-paid")
async def mark_driver_paid(
    driver_id: str,
    week_start: str,  # Format: YYYY-MM-DD
    admin_user: dict = Depends(get_admin_user)
):
    """Mark a driver's weekly earnings as paid"""
    
    try:
        start_date = datetime.fromisoformat(week_start + "T00:00:00+00:00")
        end_date = start_date + timedelta(days=6, hours=23, minutes=59, seconds=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    # Get driver info
    driver = await db.users.find_one({"id": driver_id, "role": "driver"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Chauffeur non trouvé")
    
    # Get rides to calculate amount
    rides = await db.rides.find({
        "driver_id": driver_id,
        "status": "completed",
        "completed_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    total_earnings = sum(
        r.get("driver_earnings", (r.get("final_fare") or r.get("estimated_fare", 0)) * 0.82)
        for r in rides
    )
    
    # Record the payment
    payment_record = {
        "id": str(uuid.uuid4()),
        "driver_id": driver_id,
        "week_start": week_start,
        "week_end": end_date.strftime("%Y-%m-%d"),
        "amount": round(total_earnings, 2),
        "rides_count": len(rides),
        "paid_at": datetime.now(timezone.utc).isoformat(),
        "paid_by": admin_user["id"],
        "status": "paid"
    }
    
    await db.driver_payments.insert_one(payment_record)
    del payment_record["_id"]
    
    logger.info(f"Driver {driver_id} marked as paid for week {week_start}: {total_earnings}€")
    
    # Send confirmation email to driver
    driver_name = f"{driver.get('first_name', '')} {driver.get('last_name', '')}"
    driver_email = driver.get('email')
    
    if driver_email:
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">StationCab</h2>
                <p>Bonjour {driver.get('first_name', '')},</p>
                <p>Votre règlement pour la semaine du <strong>{start_date.strftime('%d/%m/%Y')}</strong> au <strong>{end_date.strftime('%d/%m/%Y')}</strong> a été effectué.</p>
                
                <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">Montant viré :</p>
                    <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #10b981;">{total_earnings:.2f} €</p>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">({len(rides)} course(s))</p>
                </div>
                
                <p style="color: #6b7280; font-size: 14px;">
                    Le virement devrait apparaître sur votre compte sous 1-2 jours ouvrés.
                </p>
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                    Ceci est un email automatique. Pour toute question, contactez-nous à driver@stationcab.fr
                </p>
            </div>
            """
            
            await send_email_smtp(
                to_email=driver_email,
                subject=f"StationCab - Virement effectué ({total_earnings:.2f}€)",
                html_content=html_content,
                sender_type="driver"
            )
            logger.info(f"Payment confirmation email sent to {driver_email}")
        except Exception as e:
            logger.error(f"Failed to send payment confirmation email: {e}")
    
    return {"status": "ok", "payment": payment_record}

@api_router.get("/admin/drivers/payment-history")
async def get_driver_payment_history(
    driver_id: Optional[str] = None,
    admin_user: dict = Depends(get_admin_user)
):
    """Get payment history for drivers"""
    query = {}
    if driver_id:
        query["driver_id"] = driver_id
    
    payments = await db.driver_payments.find(query, {"_id": 0}).sort("paid_at", -1).to_list(100)
    
    # Enrich with driver names
    for payment in payments:
        driver = await db.users.find_one({"id": payment["driver_id"]}, {"_id": 0, "first_name": 1, "last_name": 1})
        if driver:
            payment["driver_name"] = f"{driver.get('first_name', '')} {driver.get('last_name', '')}"
    
    return {"payments": payments}

# ============ RGPD - DATA PRIVACY ENDPOINTS ============

@api_router.get("/users/my-data")
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

@api_router.delete("/users/my-account")
async def delete_my_account(
    password: str,
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
        # Check for completed rides not yet paid
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
    anonymized_name = f"Utilisateur supprimé"
    await db.rides.update_many(
        {"passenger_id": user_id},
        {"$set": {
            "passenger_name": anonymized_name,
            "passenger_phone": None
        }}
    )
    await db.rides.update_many(
        {"driver_id": user_id},
        {"$set": {
            "driver_name": anonymized_name,
            "driver_phone": None
        }}
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

@api_router.post("/users/request-deletion")
async def request_account_deletion(current_user: dict = Depends(get_current_user)):
    """
    Request account deletion - sends confirmation email
    """
    user_id = current_user["id"]
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Send confirmation email
    try:
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">StationCab</h2>
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

# Temporary endpoint to serve frontend backup
from fastapi.responses import FileResponse
import os

@app.get("/download-frontend-backup")
async def download_frontend_backup():
    file_path = "/app/backend/static/frontend_backup.tar.gz"
    if os.path.exists(file_path):
        return FileResponse(file_path, filename="frontend_backup.tar.gz", media_type="application/gzip")
    return {"error": "File not found"}
