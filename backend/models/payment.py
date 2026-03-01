"""
Payment-related Pydantic models
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PaymentCreateRequest(BaseModel):
    ride_id: str
    amount: float

class SetupIntentResponse(BaseModel):
    client_secret: str
    publishable_key: str
    customer_id: str

class SavedCard(BaseModel):
    id: str
    brand: str
    last4: str
    exp_month: int
    exp_year: int
    is_default: bool = False

class PayWithSavedCardRequest(BaseModel):
    ride_id: str
    payment_method_id: str

class WalletTopUpRequest(BaseModel):
    amount: float

class WalletPaymentRequest(BaseModel):
    ride_id: str

class PaymentHistoryResponse(BaseModel):
    id: str
    ride_id: str
    amount: float
    status: str
    method: str
    created_at: datetime
    ride_info: Optional[dict] = None

class PromoCodeCreate(BaseModel):
    code: str
    discount_percent: float
    max_uses: int = 100
    valid_until: str

class PromoCodeApply(BaseModel):
    code: str

class InvoiceData(BaseModel):
    invoice_number: str
    date: str
    company: dict
    client: dict
    ride: dict
    amount: dict
    notes: Optional[str] = None
