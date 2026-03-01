"""
Scheduled Rides Router
Handles scheduled ride booking and management
"""
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends

from core.deps import (
    get_db,
    get_current_user,
    calculate_total_distance_with_stops,
    estimate_duration_minutes
)
from models.base import ScheduledRideRequest, RideResponse
from services.fare_calculator import calculate_fare

router = APIRouter(prefix="/rides/scheduled", tags=["Scheduled Rides"])


@router.post("", response_model=RideResponse)
async def create_scheduled_ride(data: ScheduledRideRequest, current_user: dict = Depends(get_current_user)):
    """Create a scheduled ride"""
    db = get_db()
    
    if current_user["role"] != "passenger":
        raise HTTPException(status_code=403, detail="Only passengers can create rides")
    
    # Parse scheduled time
    try:
        scheduled_dt = datetime.fromisoformat(data.scheduled_time.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    if scheduled_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
    
    pickup = data.pickup.model_dump()
    destination = data.destination.model_dump()
    stops_list = [s.model_dump() for s in data.stops] if data.stops else []
    stops_count = len(stops_list)
    
    distance, stop_distances = calculate_total_distance_with_stops(pickup, destination, stops_list)
    duration = estimate_duration_minutes(distance)
    
    if stops_count > 0:
        duration += stops_count * 3
    
    fare_details = calculate_fare(
        distance,
        duration,
        is_scheduled=True,
        is_immediate=False,
        vehicle_type=data.vehicle_type,
        passenger_count=data.passenger_count,
        stops_count=stops_count,
        scheduled_time=scheduled_dt,
        pickup_coords=pickup,
        dest_coords=destination
    )
    fare = fare_details["total"]
    
    ride_id = str(uuid.uuid4())
    today = datetime.now(timezone.utc).strftime("%y%m%d")
    ride_count_today = await db.rides.count_documents({
        "created_at": {"$regex": f"^{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"}
    })
    reservation_number = f"VT-{today}-{str(ride_count_today + 1).zfill(3)}"
    
    commission_rate = 0.18
    commission_amount = round(fare * commission_rate, 2)
    driver_earnings = round(fare - commission_amount, 2)
    
    ride = {
        "id": ride_id,
        "reservation_number": reservation_number,
        "passenger_id": current_user["id"],
        "passenger_name": f"{current_user['first_name']} {current_user['last_name']}",
        "passenger_phone": current_user.get("phone"),
        "driver_id": None,
        "driver_name": None,
        "pickup": pickup,
        "destination": destination,
        "stops": stops_list if stops_list else None,
        "distance_km": distance,
        "estimated_fare": fare,
        "commission_rate": commission_rate,
        "commission_amount": commission_amount,
        "driver_earnings": driver_earnings,
        "final_fare": None,
        "status": "scheduled",
        "payment_status": "pending",
        "payment_method": None,
        "scheduled_time": data.scheduled_time,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None,
        "completed_at": None,
        "vehicle_type": data.vehicle_type,
        "passenger_count": data.passenger_count
    }
    
    await db.rides.insert_one(ride)
    ride.pop("_id", None)
    
    return RideResponse(**ride)


@router.get("", response_model=List[RideResponse])
async def get_my_scheduled_rides(current_user: dict = Depends(get_current_user)):
    """Get all scheduled rides for current user"""
    db = get_db()
    
    query = {"status": "scheduled"}
    if current_user["role"] == "passenger":
        query["passenger_id"] = current_user["id"]
    elif current_user["role"] == "driver":
        query["driver_id"] = current_user["id"]
    
    rides = await db.rides.find(query, {"_id": 0}).sort("scheduled_time", 1).to_list(50)
    return [RideResponse(**r) for r in rides]


@router.delete("/{ride_id}")
async def cancel_scheduled_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a scheduled ride"""
    db = get_db()
    
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["passenger_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    if ride["status"] != "scheduled":
        raise HTTPException(status_code=400, detail="Can only cancel scheduled rides")
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "ok", "cancelled": ride_id}
