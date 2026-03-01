"""
Payments Router
Handles Stripe payments, saved cards, payment intents
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
import stripe
import os

from core.deps import get_db, get_current_user, logger
from models.base import (
    PaymentCreateRequest,
    PaymentIntentRequest,
    PaymentIntentResponse,
    SetupIntentResponse,
    SavedCard
)

router = APIRouter(prefix="/payments", tags=["Payments"])

# Stripe configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
stripe.api_key = STRIPE_API_KEY


@router.post("/create-setup-intent", response_model=SetupIntentResponse)
async def create_setup_intent(current_user: dict = Depends(get_current_user)):
    """Create a Stripe SetupIntent to save a card"""
    db = get_db()
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    customer_id = user.get("stripe_customer_id")
    
    if not customer_id:
        customer = stripe.Customer.create(
            email=user["email"],
            name=f"{user['first_name']} {user['last_name']}",
            metadata={"user_id": user["id"]}
        )
        customer_id = customer.id
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"stripe_customer_id": customer_id}}
        )
    
    setup_intent = stripe.SetupIntent.create(
        customer=customer_id,
        payment_method_types=["card"]
    )
    
    return SetupIntentResponse(
        client_secret=setup_intent.client_secret,
        setup_intent_id=setup_intent.id
    )


@router.get("/saved-cards", response_model=List[SavedCard])
async def get_saved_cards(current_user: dict = Depends(get_current_user)):
    """Get all saved cards for the current user"""
    db = get_db()
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    customer_id = user.get("stripe_customer_id")
    
    if not customer_id:
        return []
    
    payment_methods = stripe.PaymentMethod.list(
        customer=customer_id,
        type="card"
    )
    
    default_pm = user.get("default_payment_method")
    
    cards = []
    for pm in payment_methods.data:
        cards.append(SavedCard(
            id=pm.id,
            brand=pm.card.brand,
            last4=pm.card.last4,
            exp_month=pm.card.exp_month,
            exp_year=pm.card.exp_year,
            is_default=(pm.id == default_pm)
        ))
    
    return cards


@router.post("/saved-cards/{card_id}/set-default")
async def set_default_card(card_id: str, current_user: dict = Depends(get_current_user)):
    """Set a saved card as default"""
    db = get_db()
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"default_payment_method": card_id}}
    )
    
    return {"status": "ok", "default_card": card_id}


@router.delete("/saved-cards/{card_id}")
async def delete_saved_card(card_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a saved card"""
    try:
        stripe.PaymentMethod.detach(card_id)
        return {"status": "ok", "deleted": card_id}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create-payment-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(
    data: PaymentIntentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe PaymentIntent"""
    db = get_db()
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    customer_id = user.get("stripe_customer_id")
    
    intent_data = {
        "amount": data.amount,
        "currency": data.currency,
        "automatic_payment_methods": {"enabled": True}
    }
    
    if customer_id:
        intent_data["customer"] = customer_id
    
    if data.payment_method_id:
        intent_data["payment_method"] = data.payment_method_id
    
    if data.ride_id:
        intent_data["metadata"] = {"ride_id": data.ride_id}
    
    payment_intent = stripe.PaymentIntent.create(**intent_data)
    
    return PaymentIntentResponse(
        client_secret=payment_intent.client_secret,
        payment_intent_id=payment_intent.id,
        amount=data.amount,
        currency=data.currency
    )


@router.post("/confirm-payment/{ride_id}")
async def confirm_ride_payment(
    ride_id: str,
    payment_intent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Confirm payment for a ride"""
    db = get_db()
    
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["passenger_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    try:
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if payment_intent.status == "succeeded":
            await db.rides.update_one(
                {"id": ride_id},
                {"$set": {
                    "payment_status": "paid",
                    "payment_method": "card",
                    "payment_intent_id": payment_intent_id,
                    "paid_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            return {"status": "success", "payment_status": "paid"}
        else:
            return {"status": "pending", "payment_status": payment_intent.status}
            
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/history")
async def get_payment_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get payment history for rides"""
    db = get_db()
    
    rides = await db.rides.find(
        {
            "passenger_id": current_user["id"],
            "payment_status": "paid"
        },
        {"_id": 0}
    ).sort("paid_at", -1).limit(limit).to_list(limit)
    
    payments = []
    for ride in rides:
        payments.append({
            "id": ride["id"],
            "ride_id": ride["id"],
            "amount": ride.get("final_fare") or ride["estimated_fare"],
            "currency": "EUR",
            "status": ride["payment_status"],
            "created_at": ride.get("paid_at", ride["created_at"]),
            "ride_pickup": ride["pickup"]["address"],
            "ride_destination": ride["destination"]["address"]
        })
    
    return {"payments": payments}
