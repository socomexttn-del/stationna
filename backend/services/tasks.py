"""
Celery tasks for StationCab

These tasks handle background processing for:
- Ride reassignment when drivers refuse
- Scheduled ride processing
- Payment authorization cleanup
- Document expiration alerts
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from services.celery_app import celery_app
import os

logger = logging.getLogger(__name__)

# MongoDB connection for async tasks
def get_db():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    return client[os.environ.get('DB_NAME')]

def run_async(coro):
    """Helper to run async code in sync context"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def reassign_ride(self, ride_id: str, excluded_driver_ids: list = None):
    """
    Reassign a ride to another available driver.
    This is called when a driver refuses or cancels a ride.
    
    Args:
        ride_id: The ride to reassign
        excluded_driver_ids: List of driver IDs to exclude (already refused)
    """
    async def _reassign():
        db = get_db()
        
        ride = await db.rides.find_one({"id": ride_id})
        if not ride:
            logger.error(f"Ride {ride_id} not found for reassignment")
            return False
        
        if ride["status"] not in ["pending", "searching"]:
            logger.info(f"Ride {ride_id} no longer needs reassignment (status: {ride['status']})")
            return False
        
        excluded = excluded_driver_ids or []
        
        # Find available drivers
        query = {
            "role": "driver",
            "is_available": True,
            "driver_status": "approved",
            "id": {"$nin": excluded}
        }
        
        # Filter by vehicle type
        vehicle_type = ride.get("vehicle_type", "standard")
        if vehicle_type == "van":
            query["driver_vehicle_types"] = {"$in": ["van"]}
        elif vehicle_type == "taxi":
            query["driver_vehicle_types"] = {"$in": ["taxi"]}
        else:
            query["driver_vehicle_types"] = {"$in": ["vtc", "standard"]}
        
        available_drivers = await db.users.find(query).to_list(50)
        
        if not available_drivers:
            logger.warning(f"No available drivers for ride {ride_id}")
            # Update ride status to cancelled if no drivers available
            await db.rides.update_one(
                {"id": ride_id},
                {
                    "$set": {
                        "status": "cancelled",
                        "cancelled_by": "system",
                        "cancelled_at": datetime.now(timezone.utc).isoformat(),
                        "cancellation_reason": "No available drivers"
                    }
                }
            )
            return False
        
        # TODO: Sort by proximity to pickup location
        # For now, just update status to trigger notification
        await db.rides.update_one(
            {"id": ride_id},
            {"$set": {"status": "searching", "excluded_drivers": excluded}}
        )
        
        logger.info(f"Ride {ride_id} set to searching, {len(available_drivers)} drivers available")
        return True
    
    try:
        return run_async(_reassign())
    except Exception as e:
        logger.error(f"Error reassigning ride {ride_id}: {e}")
        raise self.retry(exc=e)

@celery_app.task
def process_scheduled_rides():
    """
    Process scheduled rides that should start soon.
    Called every minute by Celery beat.
    """
    async def _process():
        db = get_db()
        
        now = datetime.now(timezone.utc)
        # Find rides scheduled within the next 15 minutes
        threshold = now + timedelta(minutes=15)
        
        rides = await db.rides.find({
            "is_scheduled": True,
            "status": "scheduled",
            "scheduled_time": {
                "$lte": threshold.isoformat(),
                "$gte": now.isoformat()
            }
        }).to_list(100)
        
        for ride in rides:
            # Change status to pending to trigger driver notification
            await db.rides.update_one(
                {"id": ride["id"]},
                {"$set": {"status": "pending"}}
            )
            logger.info(f"Activated scheduled ride {ride['id']}")
        
        return len(rides)
    
    return run_async(_process())

@celery_app.task
def cleanup_expired_authorizations():
    """
    Cancel expired payment authorizations.
    Stripe authorizations expire after 7 days.
    """
    async def _cleanup():
        db = get_db()
        import stripe
        
        expiry_threshold = datetime.now(timezone.utc) - timedelta(days=6)
        
        rides = await db.rides.find({
            "payment_status": "authorized",
            "created_at": {"$lt": expiry_threshold.isoformat()},
            "status": {"$in": ["pending", "searching"]}
        }).to_list(100)
        
        cancelled_count = 0
        for ride in rides:
            try:
                if ride.get("payment_intent_id"):
                    stripe.PaymentIntent.cancel(ride["payment_intent_id"])
                
                await db.rides.update_one(
                    {"id": ride["id"]},
                    {
                        "$set": {
                            "payment_status": "expired",
                            "authorization_cancelled": True,
                            "status": "cancelled",
                            "cancelled_by": "system",
                            "cancellation_reason": "Authorization expired"
                        }
                    }
                )
                cancelled_count += 1
            except Exception as e:
                logger.error(f"Error cancelling authorization for ride {ride['id']}: {e}")
        
        logger.info(f"Cleaned up {cancelled_count} expired authorizations")
        return cancelled_count
    
    return run_async(_cleanup())

@celery_app.task
def check_expiring_documents():
    """
    Check for driver documents expiring soon and send alerts.
    """
    async def _check():
        db = get_db()
        
        # Find documents expiring in the next 30 days
        threshold = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        
        drivers = await db.users.find({
            "role": "driver",
            "driver_status": "approved"
        }).to_list(1000)
        
        alerts_created = 0
        for driver in drivers:
            documents = driver.get("driver_documents", {})
            for doc_type, doc in documents.items():
                if doc.get("expiry_date") and doc["expiry_date"] <= threshold:
                    # Create alert
                    await db.admin_alerts.insert_one({
                        "id": f"doc-expiry-{driver['id']}-{doc_type}",
                        "type": "document_expiring",
                        "driver_id": driver["id"],
                        "driver_name": f"{driver['first_name']} {driver['last_name']}",
                        "document_type": doc_type,
                        "expiry_date": doc["expiry_date"],
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "resolved": False
                    })
                    alerts_created += 1
        
        logger.info(f"Created {alerts_created} document expiry alerts")
        return alerts_created
    
    return run_async(_check())

@celery_app.task
def send_ride_notification(user_id: str, notification_type: str, data: dict):
    """
    Send push notification to a user asynchronously.
    """
    # This would integrate with the existing notification system
    logger.info(f"Sending {notification_type} notification to user {user_id}")
    return True
