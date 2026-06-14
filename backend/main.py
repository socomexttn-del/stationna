"""
StationCab Taxi API - Main Application Entry Point (Refactored)

This is the refactored version of the API using modular routers.
"""
import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database configuration
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

# Initialize database client
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup: Initialize database connection for all routers
    from core.deps import init_database
    init_database(db)
    logger.info(f"Connected to MongoDB: {DB_NAME}")
    
    yield
    
    # Shutdown: Close database connection
    client.close()
    logger.info("MongoDB connection closed")


# Create FastAPI application
app = FastAPI(
    title="StationCab Taxi API",
    description="API for StationCab Taxi application with VTC and regulated Paris taxi services",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from routers.auth_router import router as auth_router
from routers.users_router import router as users_router
from routers.drivers_router import router as drivers_router
from routers.rides_router import router as rides_router
from routers.wallet_router import router as wallet_router
from routers.admin_router import router as admin_router
from routers.payments_router import router as payments_router
from routers.chat_router import router as chat_router
from routers.favorites_router import router as favorites_router
from routers.scheduled_router import router as scheduled_router
from routers.ratings_router import router as ratings_router
from routers.promo_router import router as promo_router

# Include all routers with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(drivers_router, prefix="/api")
app.include_router(rides_router, prefix="/api")
app.include_router(wallet_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(favorites_router, prefix="/api")
app.include_router(scheduled_router, prefix="/api")
app.include_router(ratings_router, prefix="/api")
app.include_router(promo_router, prefix="/api")


# Root endpoint
@app.get("/api/")
async def root():
    """API root endpoint"""
    return {
        "message": "StationCab Taxi API",
        "version": "2.0.0",
        "status": "running"
    }


# Health check
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
