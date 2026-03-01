"""
Chat-related Pydantic models
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ChatMessage(BaseModel):
    ride_id: str
    content: str

class ChatMessageResponse(BaseModel):
    id: str
    ride_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    content: str
    created_at: datetime
    read: bool = False
