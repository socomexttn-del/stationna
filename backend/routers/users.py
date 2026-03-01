"""
User routes
"""
from fastapi import APIRouter, Depends

from models.user import UserResponse, DriverAvailability, VehicleUpdate
from services.auth import get_current_user
from database import get_db

router = APIRouter(prefix="/users", tags=["Users"])

@router.put("/availability", response_model=UserResponse)
async def update_availability(data: DriverAvailability, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_available": data.is_available}}
    )
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return user

@router.put("/vehicle", response_model=UserResponse)
async def update_vehicle(data: VehicleUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"vehicle_info": data.model_dump()}}
    )
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return user
