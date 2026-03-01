"""
Favorites Router
Handles favorite addresses and frequent trips
"""
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends

from core.deps import get_db, get_current_user
from models.base import (
    FavoriteAddressCreate,
    FavoriteAddressResponse,
    FrequentTripCreate,
    FrequentTripResponse
)

router = APIRouter(tags=["Favorites"])


# ======================== FAVORITE ADDRESSES ========================

@router.get("/favorites", response_model=List[FavoriteAddressResponse])
async def get_favorites(current_user: dict = Depends(get_current_user)):
    """Get all favorite addresses for current user"""
    db = get_db()
    
    favorites = await db.favorites.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return [FavoriteAddressResponse(**f) for f in favorites]


@router.post("/favorites", response_model=FavoriteAddressResponse)
async def add_favorite(data: FavoriteAddressCreate, current_user: dict = Depends(get_current_user)):
    """Add a new favorite address"""
    db = get_db()
    
    favorite = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "name": data.name,
        "location": data.location.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.favorites.insert_one(favorite)
    favorite.pop("_id", None)
    
    return FavoriteAddressResponse(**favorite)


@router.delete("/favorites/{favorite_id}")
async def delete_favorite(favorite_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a favorite address"""
    db = get_db()
    
    result = await db.favorites.delete_one({
        "id": favorite_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    return {"status": "ok", "deleted": favorite_id}


# ======================== FREQUENT TRIPS ========================

@router.get("/frequent-trips", response_model=List[FrequentTripResponse])
async def get_frequent_trips(current_user: dict = Depends(get_current_user)):
    """Get frequent trips for current user"""
    db = get_db()
    
    trips = await db.frequent_trips.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("use_count", -1).to_list(20)
    
    return [FrequentTripResponse(**t) for t in trips]


@router.post("/frequent-trips", response_model=FrequentTripResponse)
async def create_frequent_trip(data: FrequentTripCreate, current_user: dict = Depends(get_current_user)):
    """Save a trip as a frequent trip"""
    db = get_db()
    
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
    trip.pop("_id", None)
    
    return FrequentTripResponse(**trip)


@router.post("/frequent-trips/{trip_id}/use")
async def use_frequent_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Increment use count when a frequent trip is used"""
    db = get_db()
    
    result = await db.frequent_trips.update_one(
        {"id": trip_id, "user_id": current_user["id"]},
        {"$inc": {"use_count": 1}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    return {"status": "ok"}


@router.delete("/frequent-trips/{trip_id}")
async def delete_frequent_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a frequent trip"""
    db = get_db()
    
    result = await db.frequent_trips.delete_one({
        "id": trip_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    return {"status": "ok", "deleted": trip_id}
