"""
Admin Router
Handles admin operations: stats, driver management, promo codes, clients
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
import asyncio
import os

from core.deps import get_db, get_admin_user, logger
from models.base import PromoCodeCreate, DriverStatusUpdate, EmailNotificationRequest

router = APIRouter(prefix="/admin", tags=["Admin"])

# Document types for reference
DRIVER_DOCUMENT_TYPES = {
    "carte_grise": {"name": "Carte Grise", "category": "vehicle"},
    "assurance": {"name": "Assurance Véhicule", "category": "vehicle"},
    "controle_technique": {"name": "Contrôle Technique", "category": "vehicle"},
    "permis_conduire": {"name": "Permis de Conduire", "category": "personal"},
    "carte_vtc": {"name": "Carte VTC", "category": "professional"},
    "cni": {"name": "Carte Nationale d'Identité", "category": "personal"},
    "justificatif_domicile": {"name": "Justificatif de Domicile", "category": "personal"},
    "rc_pro": {"name": "RC Professionnelle", "category": "professional"},
    "kbis": {"name": "Extrait KBIS", "category": "professional"},
    "attestation_vigilance": {"name": "Attestation de Vigilance URSSAF", "category": "professional"},
    "rib": {"name": "RIB", "category": "financial"},
}


# ======================== STATISTICS ========================

@router.get("/stats/overview")
async def get_overview_stats(admin_user: dict = Depends(get_admin_user)):
    """Get overview statistics"""
    db = get_db()
    
    total_users = await db.users.count_documents({})
    total_passengers = await db.users.count_documents({"role": "passenger"})
    total_drivers = await db.users.count_documents({"role": "driver"})
    active_drivers = await db.users.count_documents({"role": "driver", "is_available": True})
    
    total_rides = await db.rides.count_documents({})
    completed_rides = await db.rides.count_documents({"status": "completed"})
    pending_rides = await db.rides.count_documents({"status": "pending"})
    
    # Revenue calculation
    pipeline = [
        {"$match": {"status": "completed", "payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$estimated_fare"}}}
    ]
    revenue_result = await db.rides.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    rides_today = await db.rides.count_documents({"created_at": {"$gte": today_start}})
    
    return {
        "users": {
            "total": total_users,
            "passengers": total_passengers,
            "drivers": total_drivers,
            "active_drivers": active_drivers
        },
        "rides": {
            "total": total_rides,
            "completed": completed_rides,
            "pending": pending_rides,
            "today": rides_today
        },
        "revenue": {
            "total": round(total_revenue, 2),
            "currency": "EUR"
        }
    }


@router.get("/stats/drivers")
async def get_driver_stats(admin_user: dict = Depends(get_admin_user)):
    """Get detailed driver statistics"""
    db = get_db()
    
    drivers = await db.users.find(
        {"role": "driver"},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    
    driver_stats = []
    for driver in drivers:
        rides_completed = await db.rides.count_documents({
            "driver_id": driver["id"],
            "status": "completed"
        })
        
        pipeline = [
            {"$match": {"driver_id": driver["id"], "status": "completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$driver_earnings"}}}
        ]
        earnings_result = await db.rides.aggregate(pipeline).to_list(1)
        total_earnings = earnings_result[0]["total"] if earnings_result else 0
        
        driver_stats.append({
            "id": driver["id"],
            "name": f"{driver['first_name']} {driver['last_name']}",
            "email": driver["email"],
            "phone": driver.get("phone"),
            "is_available": driver.get("is_available", False),
            "is_active": driver.get("is_active", True),
            "rating": driver.get("rating", 5.0),
            "rides_completed": rides_completed,
            "total_earnings": round(total_earnings, 2),
            "created_at": driver.get("created_at")
        })
    
    return {"drivers": driver_stats, "total": len(driver_stats)}


@router.get("/stats/rides")
async def get_ride_stats(
    days: int = 30,
    admin_user: dict = Depends(get_admin_user)
):
    """Get ride statistics for the last N days"""
    db = get_db()
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    rides = await db.rides.find(
        {"created_at": {"$gte": start_date}},
        {"_id": 0, "status": 1, "estimated_fare": 1, "vehicle_type": 1, "created_at": 1}
    ).to_list(10000)
    
    # Group by status
    status_counts = {}
    vehicle_counts = {}
    total_fare = 0
    
    for ride in rides:
        status = ride.get("status", "unknown")
        vehicle = ride.get("vehicle_type", "standard")
        
        status_counts[status] = status_counts.get(status, 0) + 1
        vehicle_counts[vehicle] = vehicle_counts.get(vehicle, 0) + 1
        
        if ride.get("status") == "completed":
            total_fare += ride.get("estimated_fare", 0)
    
    return {
        "period_days": days,
        "total_rides": len(rides),
        "by_status": status_counts,
        "by_vehicle_type": vehicle_counts,
        "total_revenue": round(total_fare, 2)
    }


# ======================== DRIVER MANAGEMENT ========================

@router.get("/drivers/{driver_id}/documents")
async def get_driver_documents_admin(driver_id: str, admin_user: dict = Depends(get_admin_user)):
    """Get all documents for a specific driver"""
    db = get_db()
    driver = await db.users.find_one({"id": driver_id, "role": "driver"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return {
        "driver_id": driver_id,
        "name": f"{driver['first_name']} {driver['last_name']}",
        "documents": driver.get("documents", {}),
        "vehicle_info": driver.get("vehicle_info")
    }


@router.put("/drivers/{driver_id}/documents/{doc_type}/status")
async def update_document_status(
    driver_id: str, 
    doc_type: str, 
    status: str,
    admin_user: dict = Depends(get_admin_user)
):
    """Approve or reject a driver document"""
    db = get_db()
    
    if status not in ["approved", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Status must be: approved, rejected, or pending")
    
    result = await db.users.update_one(
        {"id": driver_id, "role": "driver"},
        {"$set": {f"documents.{doc_type}.status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return {"status": "ok", "document_status": status}


@router.put("/drivers/{driver_id}/status")
async def update_driver_status(
    driver_id: str,
    data: DriverStatusUpdate,
    admin_user: dict = Depends(get_admin_user)
):
    """Activate or deactivate a driver account"""
    db = get_db()
    
    result = await db.users.update_one(
        {"id": driver_id, "role": "driver"},
        {"$set": {
            "is_active": data.is_active,
            "is_available": False if not data.is_active else False,
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


@router.get("/documents/expiring")
async def get_all_expiring_documents(
    days: int = 30,
    admin_user: dict = Depends(get_admin_user)
):
    """Get all documents expiring within X days across all drivers"""
    db = get_db()
    
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
    
    expiring_docs.sort(key=lambda x: x["days_until_expiry"])
    
    return {
        "documents": expiring_docs,
        "total": len(expiring_docs),
        "expired_count": len([d for d in expiring_docs if d["is_expired"]]),
        "expiring_count": len([d for d in expiring_docs if not d["is_expired"]])
    }


# ======================== PROMO CODES ========================

@router.get("/promo-codes")
async def get_promo_codes(admin_user: dict = Depends(get_admin_user)):
    """Get all promo codes"""
    db = get_db()
    codes = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    total_uses = sum(c.get("used_count", 0) for c in codes)
    active_codes = [c for c in codes if datetime.fromisoformat(c["valid_until"].replace("Z", "+00:00")) > datetime.now(timezone.utc)]
    
    return {
        "codes": codes,
        "stats": {
            "total": len(codes),
            "active": len(active_codes),
            "total_uses": total_uses
        }
    }


@router.post("/promo-codes")
async def create_promo_code(data: PromoCodeCreate, admin_user: dict = Depends(get_admin_user)):
    """Create a new promo code"""
    db = get_db()
    
    existing = await db.promo_codes.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Code already exists")
    
    promo = {
        "id": str(uuid.uuid4()),
        "code": data.code.upper(),
        "discount_percent": data.discount_percent,
        "max_uses": data.max_uses,
        "used_count": 0,
        "valid_until": data.valid_until,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin_user["id"]
    }
    
    await db.promo_codes.insert_one(promo)
    promo.pop("_id", None)
    
    return promo


@router.delete("/promo-codes/{promo_id}")
async def delete_promo_code(promo_id: str, admin_user: dict = Depends(get_admin_user)):
    """Delete a promo code"""
    db = get_db()
    
    result = await db.promo_codes.delete_one({"id": promo_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Promo code not found")
    
    return {"status": "ok", "deleted": promo_id}


@router.get("/promo-codes/{promo_id}/stats")
async def get_promo_code_stats(promo_id: str, admin_user: dict = Depends(get_admin_user)):
    """Get detailed statistics for a promo code"""
    db = get_db()
    
    promo = await db.promo_codes.find_one({"id": promo_id}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")
    
    usages = await db.user_promos.find(
        {"promo_id": promo_id, "used": True},
        {"_id": 0}
    ).to_list(1000)
    
    return {
        "promo": promo,
        "usages": len(usages),
        "usage_details": usages
    }


# ======================== CLIENTS ========================

@router.get("/clients")
async def get_clients(
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    admin_user: dict = Depends(get_admin_user)
):
    """Get all passenger clients"""
    db = get_db()
    
    query = {"role": "passenger"}
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    clients = await db.users.find(
        query,
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.users.count_documents(query)
    
    # Add ride counts
    for client in clients:
        client["rides_count"] = await db.rides.count_documents({"passenger_id": client["id"]})
    
    return {
        "clients": clients,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/clients/{client_id}")
async def get_client_details(client_id: str, admin_user: dict = Depends(get_admin_user)):
    """Get detailed client information"""
    db = get_db()
    
    client = await db.users.find_one(
        {"id": client_id, "role": "passenger"},
        {"_id": 0, "password_hash": 0}
    )
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    rides = await db.rides.find(
        {"passenger_id": client_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    pipeline = [
        {"$match": {"passenger_id": client_id, "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$estimated_fare"}}}
    ]
    spent_result = await db.rides.aggregate(pipeline).to_list(1)
    total_spent = spent_result[0]["total"] if spent_result else 0
    
    return {
        "client": client,
        "recent_rides": rides,
        "stats": {
            "total_rides": await db.rides.count_documents({"passenger_id": client_id}),
            "completed_rides": await db.rides.count_documents({"passenger_id": client_id, "status": "completed"}),
            "total_spent": round(total_spent, 2)
        }
    }


@router.get("/clients/{client_id}/rides")
async def get_client_rides(
    client_id: str,
    limit: int = 50,
    offset: int = 0,
    admin_user: dict = Depends(get_admin_user)
):
    """Get all rides for a specific client"""
    db = get_db()
    
    rides = await db.rides.find(
        {"passenger_id": client_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.rides.count_documents({"passenger_id": client_id})
    
    return {
        "rides": rides,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/recent-rides")
async def get_recent_rides(
    limit: int = 20,
    admin_user: dict = Depends(get_admin_user)
):
    """Get most recent rides"""
    db = get_db()
    
    rides = await db.rides.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"rides": rides, "total": len(rides)}
