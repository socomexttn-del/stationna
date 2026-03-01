"""
Rides Router
Handles ride estimation, creation, and lifecycle management
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends

from core.deps import (
    get_db,
    get_current_user,
    get_driver_user,
    calculate_distance,
    calculate_total_distance_with_stops,
    estimate_duration_minutes,
    find_nearest_driver,
    logger
)
from models.base import (
    FareEstimateRequest,
    RideRequest,
    RideResponse,
    LocationModel
)
from services.fare_calculator import calculate_fare

router = APIRouter(prefix="/rides", tags=["Rides"])


@router.post("/estimate")
async def estimate_fare(data: FareEstimateRequest):
    """Estimate fare for a ride"""
    stops_list = [s.model_dump() for s in data.stops] if data.stops else []
    stops_count = len(stops_list)
    
    distance, stop_distances = calculate_total_distance_with_stops(
        data.pickup.model_dump(), 
        data.destination.model_dump(),
        stops_list
    )
    duration = estimate_duration_minutes(distance)
    
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


@router.post("", response_model=RideResponse)
async def create_ride(data: RideRequest, current_user: dict = Depends(get_current_user)):
    """Create a new ride request"""
    if current_user["role"] != "passenger":
        raise HTTPException(status_code=403, detail="Only passengers can create rides")
    
    db = get_db()
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
        is_scheduled=False, 
        is_immediate=True,
        vehicle_type=data.vehicle_type,
        passenger_count=data.passenger_count,
        stops_count=stops_count,
        pickup_coords=pickup,
        dest_coords=destination
    )
    fare = fare_details["total"]
    
    # Check for promo
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
        await db.user_promos.update_one({"id": user_promo["id"]}, {"$set": {"used": True}})
        await db.promo_codes.update_one({"id": user_promo["promo_id"]}, {"$inc": {"used_count": 1}})
    
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
        "driver_company": None,
        "driver_phone": None,
        "driver_license_plate": None,
        "driver_identification": None,
        "pickup": pickup,
        "destination": destination,
        "stops": stops_list if stops_list else None,
        "distance_km": distance,
        "estimated_fare": fare,
        "commission_rate": commission_rate,
        "commission_amount": commission_amount,
        "driver_earnings": driver_earnings,
        "discount_applied": discount_applied,
        "promo_used": promo_used,
        "final_fare": None,
        "status": "pending",
        "payment_status": "pending",
        "payment_method": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None,
        "completed_at": None,
        "vehicle_type": data.vehicle_type,
        "passenger_count": data.passenger_count,
        "notified_drivers": []
    }
    
    await db.rides.insert_one(ride)
    
    # Notify nearby drivers
    available_drivers = await db.users.find({
        "role": "driver", 
        "is_available": True,
        "location": {"$exists": True},
        "$or": [{"is_active": True}, {"is_active": {"$exists": False}}]
    }, {"_id": 0, "password_hash": 0}).to_list(20)
    
    notified_driver_ids = []
    for driver in available_drivers:
        if driver.get("location"):
            dist = calculate_distance(pickup, driver["location"])
            if dist <= 10.0:
                notified_driver_ids.append(driver["id"])
    
    await db.rides.update_one({"id": ride_id}, {"$set": {"notified_drivers": notified_driver_ids}})
    
    ride_copy = {k: v for k, v in ride.items() if k != "notified_drivers"}
    return RideResponse(**ride_copy)


@router.get("/available", response_model=List[RideResponse])
async def get_available_rides(current_user: dict = Depends(get_driver_user)):
    """Get available rides for drivers"""
    db = get_db()
    rides = await db.rides.find({"status": "pending"}, {"_id": 0}).to_list(100)
    return [RideResponse(**r) for r in rides]


@router.get("/active", response_model=Optional[RideResponse])
async def get_active_ride(current_user: dict = Depends(get_current_user)):
    """Get current active ride"""
    db = get_db()
    query = {"status": {"$in": ["pending", "accepted", "in_progress"]}}
    if current_user["role"] == "passenger":
        query["passenger_id"] = current_user["id"]
    else:
        query["driver_id"] = current_user["id"]
    
    ride = await db.rides.find_one(query, {"_id": 0})
    return RideResponse(**ride) if ride else None


@router.get("/scheduled", response_model=List[RideResponse])
async def get_scheduled_rides(current_user: dict = Depends(get_current_user)):
    """Get scheduled rides"""
    db = get_db()
    query = {"status": "scheduled"}
    if current_user["role"] == "passenger":
        query["passenger_id"] = current_user["id"]
    rides = await db.rides.find(query, {"_id": 0}).sort("scheduled_time", 1).to_list(50)
    return [RideResponse(**r) for r in rides]


@router.post("/{ride_id}/accept", response_model=RideResponse)
async def accept_ride(ride_id: str, current_user: dict = Depends(get_driver_user)):
    """Accept a ride as a driver"""
    db = get_db()
    ride = await db.rides.find_one({"id": ride_id, "status": "pending"}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or already taken")
    
    driver = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    vehicle = driver.get("vehicle_info", {}) if driver else {}
    driver_location = driver.get("location", {}) if driver else {}
    
    eta_minutes = 5
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
    return RideResponse(**updated)


@router.post("/{ride_id}/start", response_model=RideResponse)
async def start_ride(ride_id: str, current_user: dict = Depends(get_driver_user)):
    """Start a ride"""
    db = get_db()
    ride = await db.rides.find_one({
        "id": ride_id,
        "driver_id": current_user["id"],
        "status": "accepted"
    }, {"_id": 0})
    
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or not in accepted status")
    
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc).isoformat()
    }})
    
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    return RideResponse(**updated)


@router.post("/{ride_id}/complete", response_model=RideResponse)
async def complete_ride(ride_id: str, final_fare: Optional[float] = None, current_user: dict = Depends(get_driver_user)):
    """Complete a ride"""
    db = get_db()
    ride = await db.rides.find_one({
        "id": ride_id,
        "driver_id": current_user["id"],
        "status": "in_progress"
    }, {"_id": 0})
    
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or not in progress")
    
    update_data = {
        "status": "completed",
        "completed_at": datetime.now(timezone.utc).isoformat()
    }
    
    # For taxi rides, use the meter price
    if final_fare is not None and ride.get("vehicle_type") == "taxi":
        update_data["final_fare"] = final_fare
        commission_rate = ride.get("commission_rate", 0.18)
        update_data["commission_amount"] = round(final_fare * commission_rate, 2)
        update_data["driver_earnings"] = round(final_fare - update_data["commission_amount"], 2)
    
    await db.rides.update_one({"id": ride_id}, {"$set": update_data})
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"is_available": True}})
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"total_rides": 1}})
    await db.users.update_one({"id": ride["passenger_id"]}, {"$inc": {"total_rides": 1}})
    
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    return RideResponse(**updated)


@router.post("/{ride_id}/cancel", response_model=RideResponse)
async def cancel_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a ride"""
    db = get_db()
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["status"] in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this ride")
    
    if current_user["role"] == "passenger" and ride["passenger_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    if current_user["role"] == "driver" and ride.get("driver_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "cancelled",
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "cancelled_by": current_user["id"]
    }})
    
    if ride.get("driver_id"):
        await db.users.update_one({"id": ride["driver_id"]}, {"$set": {"is_available": True}})
    
    updated = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    return RideResponse(**updated)


@router.get("/{ride_id}", response_model=RideResponse)
async def get_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific ride"""
    db = get_db()
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    return RideResponse(**ride)


@router.get("/history/me", response_model=List[RideResponse])
async def get_ride_history(current_user: dict = Depends(get_current_user)):
    """Get ride history for current user"""
    db = get_db()
    query = {"passenger_id": current_user["id"]} if current_user["role"] == "passenger" else {"driver_id": current_user["id"]}
    rides = await db.rides.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [RideResponse(**r) for r in rides]
