"""
Promo Codes Router (User-facing)
Handles promo code application for passengers
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
import uuid

from core.deps import get_db, get_current_user
from models.base import PromoCodeApply

router = APIRouter(prefix="/promo", tags=["Promo"])


@router.post("/apply")
async def apply_promo_code(data: PromoCodeApply, current_user: dict = Depends(get_current_user)):
    """Apply a promo code to user's account"""
    db = get_db()
    
    code = data.code.upper().strip()
    
    promo = await db.promo_codes.find_one({"code": code}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="Code promo invalide")
    
    # Check if expired
    valid_until = datetime.fromisoformat(promo["valid_until"].replace("Z", "+00:00"))
    if valid_until < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code promo expiré")
    
    # Check max uses
    if promo["used_count"] >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="Code promo épuisé")
    
    # Check if user already used this promo
    existing = await db.user_promos.find_one({
        "user_id": current_user["id"],
        "promo_id": promo["id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà utilisé ce code promo")
    
    # Add promo to user
    user_promo = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "promo_id": promo["id"],
        "code": code,
        "discount_percent": promo["discount_percent"],
        "used": False,
        "applied_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_promos.insert_one(user_promo)
    
    return {
        "status": "ok",
        "message": f"Code promo appliqué: -{promo['discount_percent']}% sur votre prochaine course",
        "discount_percent": promo["discount_percent"]
    }


@router.get("/my-codes")
async def get_my_promo_codes(current_user: dict = Depends(get_current_user)):
    """Get all promo codes for current user"""
    db = get_db()
    
    promos = await db.user_promos.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("applied_at", -1).to_list(20)
    
    available = [p for p in promos if not p.get("used")]
    used = [p for p in promos if p.get("used")]
    
    return {
        "available": available,
        "used": used,
        "total_available": len(available)
    }
