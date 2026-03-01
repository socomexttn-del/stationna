"""
Routers module
"""
from .auth_router import router as auth_router
from .users_router import router as users_router
from .drivers_router import router as drivers_router
from .rides_router import router as rides_router
from .wallet_router import router as wallet_router
from .admin_router import router as admin_router

__all__ = [
    "auth_router",
    "users_router", 
    "drivers_router",
    "rides_router",
    "wallet_router",
    "admin_router"
]
