"""
Ratings Router
Handles ride ratings between passengers and drivers
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from core.deps import get_db, get_current_user
from models.base import RatingCreate

router = APIRouter(prefix="/ratings", tags=["Ratings"])


@router.post("")
async def submit_rating(data: RatingCreate, current_user: dict = Depends(get_current_user)):
    """Submit a rating for a completed ride"""
    db = get_db()
    
    ride = await db.rides.find_one({"id": data.ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed rides")
    
    # Determine who is being rated
    if current_user["role"] == "passenger":
        if ride["passenger_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not your ride")
        rated_user_id = ride["driver_id"]
        rating_type = "driver_rating"
    else:
        if ride.get("driver_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not your ride")
        rated_user_id = ride["passenger_id"]
        rating_type = "passenger_rating"
    
    if not rated_user_id:
        raise HTTPException(status_code=400, detail="No user to rate")
    
    # Check if already rated
    existing = await db.ratings.find_one({
        "ride_id": data.ride_id,
        "rater_id": current_user["id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already rated this ride")
    
    # Save rating
    rating = {
        "id": str(uuid.uuid4()),
        "ride_id": data.ride_id,
        "rater_id": current_user["id"],
        "rated_id": rated_user_id,
        "rating": data.rating,
        "comment": data.comment,
        "type": rating_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.ratings.insert_one(rating)
    
    # Update ride with rating
    await db.rides.update_one(
        {"id": data.ride_id},
        {"$set": {rating_type: data.rating}}
    )
    
    # Update user's average rating
    all_ratings = await db.ratings.find(
        {"rated_id": rated_user_id},
        {"_id": 0, "rating": 1}
    ).to_list(1000)
    
    if all_ratings:
        avg_rating = sum(r["rating"] for r in all_ratings) / len(all_ratings)
        await db.users.update_one(
            {"id": rated_user_id},
            {"$set": {"rating": round(avg_rating, 2)}}
        )
    
    return {"status": "ok", "rating": data.rating}


@router.get("/ride/{ride_id}")
async def get_ride_ratings(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Get ratings for a specific ride"""
    db = get_db()
    
    ratings = await db.ratings.find(
        {"ride_id": ride_id},
        {"_id": 0}
    ).to_list(10)
    
    return {"ratings": ratings}


@router.get("/user/{user_id}")
async def get_user_ratings(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get all ratings for a user"""
    db = get_db()
    
    ratings = await db.ratings.find(
        {"rated_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"ratings": ratings}
