"""
Database connection and utilities
"""
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "allogo_taxi")

client = None
db = None

async def connect_db():
    """Initialize database connection"""
    global client, db
    if MONGO_URL:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        logger.info(f"Connected to MongoDB: {DB_NAME}")
    else:
        logger.warning("MONGO_URL not set, database features disabled")

async def close_db():
    """Close database connection"""
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")

def get_db():
    """Get database instance"""
    return db
