"""
Notification management service
"""
import asyncio
import logging
from typing import Dict, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class NotificationManager:
    def __init__(self):
        self.user_notifications: Dict[str, list] = {}
        self.ride_proposals: Dict[str, dict] = {}
    
    def add_notification(self, user_id: str, notification: dict):
        if user_id not in self.user_notifications:
            self.user_notifications[user_id] = []
        notification["id"] = f"notif_{datetime.now(timezone.utc).timestamp()}"
        notification["created_at"] = datetime.now(timezone.utc).isoformat()
        notification["read"] = False
        self.user_notifications[user_id].append(notification)
        # Keep only last 50 notifications
        if len(self.user_notifications[user_id]) > 50:
            self.user_notifications[user_id] = self.user_notifications[user_id][-50:]
    
    def get_notifications(self, user_id: str, since: Optional[str] = None) -> list:
        notifications = self.user_notifications.get(user_id, [])
        if since:
            notifications = [n for n in notifications if n["created_at"] > since]
        return notifications
    
    def mark_as_read(self, user_id: str, notification_ids: list):
        if user_id in self.user_notifications:
            for notif in self.user_notifications[user_id]:
                if notif["id"] in notification_ids:
                    notif["read"] = True
    
    def set_ride_proposal(self, ride_id: str, driver_id: str, proposal_data: dict):
        self.ride_proposals[ride_id] = {
            "driver_id": driver_id,
            "data": proposal_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    def get_ride_proposal(self, ride_id: str) -> Optional[dict]:
        return self.ride_proposals.get(ride_id)
    
    def clear_ride_proposal(self, ride_id: str):
        if ride_id in self.ride_proposals:
            del self.ride_proposals[ride_id]

# Global instance
notification_manager = NotificationManager()
