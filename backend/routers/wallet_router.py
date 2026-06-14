"""
Wallet Router
Handles passenger wallet operations: balance, top-up, payments
"""
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
import stripe
import os

from core.deps import get_db, get_current_user, get_passenger_user, logger
from models.base import WalletTopUpRequest, WalletPayRequest

router = APIRouter(prefix="/wallet", tags=["Wallet"])

# Stripe configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
stripe.api_key = STRIPE_API_KEY

# Wallet bonus tiers
WALLET_BONUS_TIERS = [
    {"min_amount": 100, "bonus": 15, "label": "+15€ offerts (100€+)"},
    {"min_amount": 50, "bonus": 5, "label": "+5€ offerts (50€+)"},
    {"min_amount": 20, "bonus": 2, "label": "+2€ offerts (20€+)"},
]


def calculate_wallet_bonus(amount: int) -> dict:
    """Calculate bonus based on top-up amount"""
    for tier in WALLET_BONUS_TIERS:
        if amount >= tier["min_amount"]:
            return {
                "bonus": tier["bonus"],
                "label": tier["label"],
                "total": amount + tier["bonus"]
            }
    return {"bonus": 0, "label": None, "total": amount}


@router.get("/balance")
async def get_wallet_balance(current_user: dict = Depends(get_current_user)):
    """Get wallet balance for current user"""
    db = get_db()
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "wallet_balance": 1})
    return {
        "balance": user.get("wallet_balance", 0),
        "currency": "EUR"
    }


@router.get("/transactions")
async def get_wallet_transactions(
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get wallet transaction history"""
    db = get_db()
    transactions = await db.transactions.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.transactions.count_documents({"user_id": current_user["id"]})
    
    return {
        "transactions": transactions,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/bonus-tiers")
async def get_bonus_tiers():
    """Get available bonus tiers for wallet top-up"""
    return {"tiers": WALLET_BONUS_TIERS}


@router.post("/top-up")
async def create_topup(data: WalletTopUpRequest, current_user: dict = Depends(get_current_user)):
    """Create a Stripe checkout session for wallet top-up"""
    db = get_db()
    
    if data.amount < 5:
        raise HTTPException(status_code=400, detail="Minimum top-up amount is 5€")
    if data.amount > 500:
        raise HTTPException(status_code=400, detail="Maximum top-up amount is 500€")
    
    bonus_info = calculate_wallet_bonus(data.amount)
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'unit_amount': data.amount * 100,
                    'product_data': {
                        'name': f'Rechargement Portefeuille StationCab',
                        'description': f'Rechargement de {data.amount}€' + (f' + {bonus_info["bonus"]}€ offerts' if bonus_info["bonus"] > 0 else ''),
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{data.origin_url}/wallet?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{data.origin_url}/wallet?cancelled=true",
            metadata={
                'type': 'wallet_topup',
                'user_id': current_user["id"],
                'amount': str(data.amount),
                'bonus': str(bonus_info["bonus"]),
                'total_credit': str(bonus_info["total"])
            }
        )
        
        return {
            "session_id": session.id,
            "checkout_url": session.url,
            "amount": data.amount,
            "bonus": bonus_info["bonus"],
            "total_credit": bonus_info["total"],
            "bonus_label": bonus_info["label"]
        }
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Payment service error")


@router.post("/confirm-topup")
async def confirm_topup(session_id: str, current_user: dict = Depends(get_current_user)):
    """Confirm wallet top-up after successful payment"""
    db = get_db()
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status != 'paid':
            raise HTTPException(status_code=400, detail="Payment not completed")
        
        if session.metadata.get('type') != 'wallet_topup':
            raise HTTPException(status_code=400, detail="Invalid session type")
        
        if session.metadata.get('user_id') != current_user["id"]:
            raise HTTPException(status_code=403, detail="Session does not belong to you")
        
        # Check if already processed
        existing = await db.transactions.find_one({"stripe_session_id": session_id})
        if existing:
            return {"status": "already_processed", "balance": existing.get("balance_after", 0)}
        
        amount = int(session.metadata.get('amount', 0))
        bonus = int(session.metadata.get('bonus', 0))
        total_credit = amount + bonus
        
        # Update wallet balance
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
        current_balance = user.get("wallet_balance", 0)
        new_balance = current_balance + total_credit
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"wallet_balance": new_balance}}
        )
        
        # Create transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "type": "topup",
            "amount": amount,
            "bonus": bonus,
            "total_credit": total_credit,
            "balance_before": current_balance,
            "balance_after": new_balance,
            "stripe_session_id": session_id,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.transactions.insert_one(transaction)
        
        return {
            "status": "success",
            "amount": amount,
            "bonus": bonus,
            "total_credited": total_credit,
            "new_balance": new_balance
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Payment verification failed")


@router.post("/pay")
async def pay_with_wallet(data: WalletPayRequest, current_user: dict = Depends(get_current_user)):
    """Pay for a ride using wallet balance"""
    db = get_db()
    
    ride = await db.rides.find_one({"id": data.ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["passenger_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    if ride["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Ride already paid")
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    current_balance = user.get("wallet_balance", 0)
    
    if current_balance < data.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. You have {current_balance}€, need {data.amount}€")
    
    new_balance = current_balance - data.amount
    
    # Update wallet balance
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"wallet_balance": new_balance}}
    )
    
    # Update ride payment status
    await db.rides.update_one(
        {"id": data.ride_id},
        {"$set": {
            "payment_status": "paid",
            "payment_method": "wallet",
            "paid_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create transaction record
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "payment",
        "amount": -data.amount,
        "ride_id": data.ride_id,
        "balance_before": current_balance,
        "balance_after": new_balance,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "status": "success",
        "amount_paid": data.amount,
        "new_balance": new_balance
    }
