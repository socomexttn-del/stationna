"""
Chat Router
Handles in-ride messaging between passengers and drivers
"""
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends

from core.deps import get_db, get_current_user
from models.base import ChatMessage, ChatMessageResponse

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get("/{ride_id}", response_model=List[ChatMessageResponse])
async def get_chat_messages(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Get all messages for a ride"""
    db = get_db()
    
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Verify user is part of this ride
    if current_user["id"] not in [ride.get("passenger_id"), ride.get("driver_id")]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    messages = await db.chat_messages.find(
        {"ride_id": ride_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    return [ChatMessageResponse(**m) for m in messages]


@router.post("/{ride_id}", response_model=ChatMessageResponse)
async def send_chat_message(ride_id: str, data: ChatMessage, current_user: dict = Depends(get_current_user)):
    """Send a message in a ride chat"""
    db = get_db()
    
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if current_user["id"] not in [ride.get("passenger_id"), ride.get("driver_id")]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    message = {
        "id": str(uuid.uuid4()),
        "ride_id": ride_id,
        "sender_id": current_user["id"],
        "sender_name": f"{current_user['first_name']} {current_user['last_name']}",
        "sender_role": current_user["role"],
        "message": data.message,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chat_messages.insert_one(message)
    message.pop("_id", None)
    
    return ChatMessageResponse(**message)


@router.post("/{ride_id}/mark-read")
async def mark_messages_read(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Mark all messages in a ride as read"""
    db = get_db()
    
    await db.chat_messages.update_many(
        {
            "ride_id": ride_id,
            "sender_id": {"$ne": current_user["id"]}
        },
        {"$set": {"read": True}}
    )
    
    return {"status": "ok"}


@router.get("/{ride_id}/unread")
async def get_unread_count(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Get count of unread messages"""
    db = get_db()
    
    count = await db.chat_messages.count_documents({
        "ride_id": ride_id,
        "sender_id": {"$ne": current_user["id"]},
        "read": False
    })
    
    return {"unread_count": count}
