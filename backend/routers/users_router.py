"""
Users Router
Handles user profile, availability, vehicle info updates
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from core.deps import get_db, get_current_user, get_driver_user
from models.base import UserResponse, VehicleUpdate, DriverAvailability

router = APIRouter(prefix="/users", tags=["Users"])


@router.put("/availability", response_model=UserResponse)
async def update_availability(data: DriverAvailability, current_user: dict = Depends(get_driver_user)):
    """Update driver availability status"""
    db = get_db()
    
    update_data = {"is_available": data.is_available}
    if data.location:
        update_data["location"] = data.location.model_dump()
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return UserResponse(**{k: v for k, v in updated.items() if k != "password_hash"})


@router.put("/vehicle", response_model=UserResponse)
async def update_vehicle(data: VehicleUpdate, current_user: dict = Depends(get_driver_user)):
    """Update driver vehicle information"""
    db = get_db()
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"vehicle_info": data.model_dump()}})
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return UserResponse(**{k: v for k, v in updated.items() if k != "password_hash"})
