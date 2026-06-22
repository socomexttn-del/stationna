"""
Test script for new routers v2
Run this to verify routers work correctly before integration
"""
import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

# Import routers
from routers.auth_v2 import router as auth_router, init_router as init_auth
from routers.users_v2 import router as users_router, init_router as init_users

async def test_routers():
    """Test that routers initialize correctly"""
    
    # Connect to database
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    
    if not mongo_url or not db_name:
        print("❌ MONGO_URL or DB_NAME not set in .env")
        return False
    
    print(f"🔗 Connecting to MongoDB: {db_name}")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Mock email function for testing
    async def mock_email(*args, **kwargs):
        print(f"   📧 Mock email sent: {args[0] if args else kwargs}")
        return True
    
    # Initialize routers
    print("\n📦 Initializing routers...")
    init_auth(db, mock_email)
    init_users(db, mock_email)
    print("   ✅ auth_v2 initialized")
    print("   ✅ users_v2 initialized")
    
    # Check router endpoints
    print("\n🛣️  Auth Router endpoints:")
    for route in auth_router.routes:
        print(f"   {route.methods} {route.path}")
    
    print("\n🛣️  Users Router endpoints:")
    for route in users_router.routes:
        print(f"   {route.methods} {route.path}")
    
    # Test database connection
    print("\n🔍 Testing database connection...")
    try:
        user_count = await db.users.count_documents({})
        print(f"   ✅ Found {user_count} users in database")
    except Exception as e:
        print(f"   ❌ Database error: {e}")
        return False
    
    # Close connection
    client.close()
    
    print("\n✅ All router tests passed!")
    print("\n📋 Next steps:")
    print("   1. Review the router code in /app/backend/routers/auth_v2.py")
    print("   2. Review the router code in /app/backend/routers/users_v2.py")
    print("   3. When ready, integrate into server.py")
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_routers())
    sys.exit(0 if success else 1)
