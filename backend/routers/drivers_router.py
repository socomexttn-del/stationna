"""
Drivers Router
Handles driver-specific operations: documents, availability, location
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends

from core.deps import (
    get_db,
    get_current_user,
    get_driver_user,
    get_admin_user,
    calculate_distance,
    logger
)
from models.base import (
    UserResponse,
    VehicleUpdate,
    DriverAvailability,
    DriverDocumentsUpdate,
    LocationModel
)

router = APIRouter(prefix="/drivers", tags=["Drivers"])

# Document types
DRIVER_DOCUMENT_TYPES = {
    "carte_grise": {"name": "Carte Grise", "category": "vehicle", "required": True, "has_expiry": False},
    "assurance": {"name": "Assurance Véhicule", "category": "vehicle", "required": True, "has_expiry": True},
    "controle_technique": {"name": "Contrôle Technique", "category": "vehicle", "required": True, "has_expiry": True},
    "permis_conduire": {"name": "Permis de Conduire", "category": "personal", "required": True, "has_expiry": True},
    "carte_vtc": {"name": "Carte VTC", "category": "professional", "required": True, "has_expiry": True},
    "cni": {"name": "Carte Nationale d'Identité", "category": "personal", "required": True, "has_expiry": True},
    "justificatif_domicile": {"name": "Justificatif de Domicile", "category": "personal", "required": True, "has_expiry": False},
    "rc_pro": {"name": "RC Professionnelle", "category": "professional", "required": True, "has_expiry": True},
    "kbis": {"name": "Extrait KBIS", "category": "professional", "required": False, "has_expiry": False},
    "attestation_vigilance": {"name": "Attestation de Vigilance URSSAF", "category": "professional", "required": False, "has_expiry": True},
    "rib": {"name": "RIB (Relevé d'Identité Bancaire)", "category": "financial", "required": True, "has_expiry": False},
}


@router.get("/available", response_model=List[UserResponse])
async def get_available_drivers(current_user: dict = Depends(get_current_user)):
    """Get all available drivers"""
    db = get_db()
    drivers = await db.users.find({
        "role": "driver", 
        "is_available": True,
        "$or": [{"is_active": True}, {"is_active": {"$exists": False}}]
    }, {"_id": 0, "password_hash": 0}).to_list(100)
    return [UserResponse(**d) for d in drivers]


@router.put("/location")
async def update_driver_location(data: LocationModel, current_user: dict = Depends(get_driver_user)):
    """Update driver's current GPS location"""
    db = get_db()
    location_data = data.model_dump()
    location_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"id": current_user["id"]}, 
        {"$set": {"location": location_data}}
    )
    
    # Update path for active ride
    active_ride = await db.rides.find_one({
        "driver_id": current_user["id"],
        "status": {"$in": ["accepted", "in_progress"]}
    }, {"_id": 0})
    
    if active_ride:
        path_point = {
            "lat": data.lat,
            "lng": data.lng,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.rides.update_one(
            {"id": active_ride["id"]},
            {"$push": {"driver_path": path_point}}
        )
    
    return {"status": "ok", "location": location_data}


@router.put("/documents")
async def update_driver_document(data: DriverDocumentsUpdate, current_user: dict = Depends(get_driver_user)):
    """Update a specific driver document"""
    db = get_db()
    
    if data.document_type not in DRIVER_DOCUMENT_TYPES:
        valid_types = list(DRIVER_DOCUMENT_TYPES.keys())
        raise HTTPException(status_code=400, detail=f"Invalid document type. Must be one of: {valid_types}")
    
    doc_data = {
        "url": data.document_url,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "expiry_date": data.expiry_date,
        "status": "pending"
    }
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {f"documents.{data.document_type}": doc_data}}
    )
    
    return {"status": "ok", "document_type": data.document_type}


@router.delete("/documents/{doc_type}")
async def delete_driver_document(doc_type: str, current_user: dict = Depends(get_driver_user)):
    """Delete a specific driver document"""
    db = get_db()
    
    if doc_type not in DRIVER_DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid document type")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$unset": {f"documents.{doc_type}": ""}}
    )
    
    return {"status": "ok", "deleted": doc_type}


@router.get("/documents")
async def get_driver_documents(current_user: dict = Depends(get_driver_user)):
    """Get all documents for current driver"""
    db = get_db()
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "documents": 1, "vehicle_info": 1})
    
    return {
        "documents": user.get("documents", {}),
        "vehicle_info": user.get("vehicle_info"),
        "document_types": DRIVER_DOCUMENT_TYPES
    }


@router.get("/documents/status")
async def get_driver_documents_status(current_user: dict = Depends(get_driver_user)):
    """Get document completion status for current driver"""
    db = get_db()
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "documents": 1})
    documents = user.get("documents", {})
    
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


@router.get("/documents/expiring")
async def get_expiring_documents(current_user: dict = Depends(get_driver_user)):
    """Get documents that are expiring soon for the current driver"""
    db = get_db()
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "documents": 1})
    documents = user.get("documents", {})
    
    today = datetime.now(timezone.utc).date()
    expiring_soon = []
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
    
    expired.sort(key=lambda x: x["days_until_expiry"])
    expiring_soon.sort(key=lambda x: x["days_until_expiry"])
    
    return {
        "expired": expired,
        "expiring_soon": expiring_soon,
        "total_alerts": len(expired) + len(expiring_soon)
    }
