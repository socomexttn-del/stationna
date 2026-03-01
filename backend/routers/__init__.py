"""
Routers module - All API routers
"""
from .auth_router import router as auth_router
from .users_router import router as users_router
from .drivers_router import router as drivers_router
from .rides_router import router as rides_router
from .wallet_router import router as wallet_router
from .admin_router import router as admin_router
from .payments_router import router as payments_router
from .chat_router import router as chat_router
from .favorites_router import router as favorites_router
from .scheduled_router import router as scheduled_router
from .ratings_router import router as ratings_router
from .promo_router import router as promo_router

__all__ = [
    "auth_router",
    "users_router", 
    "drivers_router",
    "rides_router",
    "wallet_router",
    "admin_router",
    "payments_router",
    "chat_router",
    "favorites_router",
    "scheduled_router",
    "ratings_router",
    "promo_router"
]
