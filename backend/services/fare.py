"""
Fare calculation services
"""
import math
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from config import FARE_CONFIG, WALLET_BONUS_TIERS

def calculate_distance(pickup: Dict, destination: Dict) -> float:
    """Calculate distance between two points using Haversine formula"""
    R = 6371  # Earth's radius in km
    lat1, lon1 = math.radians(pickup['lat']), math.radians(pickup['lng'])
    lat2, lon2 = math.radians(destination['lat']), math.radians(destination['lng'])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def calculate_total_distance_with_stops(
    pickup: Dict, 
    destination: Dict, 
    stops: Optional[List[Dict]] = None
) -> Tuple[float, List[float]]:
    """Calculate total distance including intermediate stops"""
    if not stops:
        total_distance = calculate_distance(pickup, destination)
        return total_distance, []
    
    segments = []
    current_point = pickup
    
    for stop in stops:
        segment_distance = calculate_distance(current_point, stop)
        segments.append(segment_distance)
        current_point = stop
    
    final_segment = calculate_distance(current_point, destination)
    segments.append(final_segment)
    
    total_distance = sum(segments)
    return total_distance, segments

def estimate_duration_minutes(distance_km: float) -> int:
    """Estimate ride duration based on distance"""
    avg_speed_kmh = 25
    return max(5, int((distance_km / avg_speed_kmh) * 60))

def calculate_fare(
    distance_km: float,
    duration_minutes: int = 0,
    is_scheduled: bool = False,
    is_immediate: bool = True,
    vehicle_type: str = "standard",
    passenger_count: int = 1,
    stops_count: int = 0
) -> dict:
    """Calculate fare based on various parameters"""
    config = FARE_CONFIG
    
    # Base fare
    fare = config["base_fare"]
    
    # Distance fare
    if distance_km > config["base_distance_km"]:
        extra_distance = distance_km - config["base_distance_km"]
        fare += extra_distance * config["price_per_km"]
    
    # Duration fare
    if duration_minutes > 0:
        fare += duration_minutes * config["price_per_minute"]
    
    # Night supplement
    current_hour = datetime.now().hour
    is_night = current_hour >= config["night_start_hour"] or current_hour < config["night_end_hour"]
    night_supplement = 0
    if is_night:
        night_supplement = fare * (config["night_multiplier"] - 1)
        fare *= config["night_multiplier"]
    
    # Vehicle type supplement
    van_supplement = 0
    if vehicle_type == "van":
        van_supplement = fare * (config["van_multiplier"] - 1)
        fare *= config["van_multiplier"]
    
    # Passenger supplement
    passenger_supplement = 0
    if passenger_count > config["passenger_threshold"]:
        extra_passengers = passenger_count - config["passenger_threshold"]
        passenger_supplement = extra_passengers * config["extra_passenger_supplement"]
        fare += passenger_supplement
    
    # Stops supplement
    stops_supplement = stops_count * config["stop_supplement"]
    fare += stops_supplement
    
    # Scheduled ride supplement
    scheduled_supplement = 0
    if is_scheduled:
        scheduled_supplement = config["scheduled_supplement"]
        fare += scheduled_supplement
    
    # Apply minimum fare
    fare = max(fare, config["min_fare"])
    
    return {
        "estimated_fare": round(fare, 2),
        "base_fare": config["base_fare"],
        "distance_fare": round(max(0, (distance_km - config["base_distance_km"]) * config["price_per_km"]), 2),
        "duration_fare": round(duration_minutes * config["price_per_minute"], 2),
        "night_supplement": round(night_supplement, 2),
        "van_supplement": round(van_supplement, 2),
        "passenger_supplement": round(passenger_supplement, 2),
        "stops_supplement": round(stops_supplement, 2),
        "scheduled_supplement": round(scheduled_supplement, 2),
        "currency": "EUR",
        "is_night_rate": is_night
    }

def calculate_wallet_bonus(amount: float) -> dict:
    """Calculate bonus based on top-up amount"""
    for tier in WALLET_BONUS_TIERS:
        if amount >= tier["min_amount"]:
            return {"bonus": tier["bonus"], "label": tier["label"], "total": amount + tier["bonus"]}
    return {"bonus": 0, "label": None, "total": amount}
