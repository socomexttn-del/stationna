"""
Fare calculation services for VTC and Taxi
"""
import math
from datetime import datetime, timezone
from typing import Dict, Optional

# Airport coordinates for flat rate detection
AIRPORTS = {
    "cdg": {
        "name": "Charles de Gaulle",
        "lat": 49.0097,
        "lng": 2.5479,
        "radius_km": 5
    },
    "orly": {
        "name": "Orly",
        "lat": 48.7262,
        "lng": 2.3652,
        "radius_km": 3
    }
}

# Seine river latitude - dividing line between Rive Droite/Gauche
SEINE_LATITUDE = 48.86

# Airport flat rates (forfaits) 2025
AIRPORT_FLAT_RATES = {
    "cdg": {
        "rive_droite": 56.00,
        "rive_gauche": 65.00
    },
    "orly": {
        "rive_droite": 45.00,
        "rive_gauche": 36.00
    }
}


def calculate_distance_simple(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Simple distance calculation in km using Haversine formula"""
    R = 6371
    lat1_rad, lng1_rad = math.radians(lat1), math.radians(lng1)
    lat2_rad, lng2_rad = math.radians(lat2), math.radians(lng2)
    
    dlat = lat2_rad - lat1_rad
    dlng = lng2_rad - lng1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


def get_paris_taxi_tariff(scheduled_time: datetime = None) -> dict:
    """
    Determine which Paris taxi tariff applies (A, B, or C) based on time/day
    Tarifs officiels taxis parisiens 2025 (Arrêté 2025-00248)
    """
    check_time = scheduled_time if scheduled_time else datetime.now(timezone.utc)
    
    hour = check_time.hour
    day_of_week = check_time.weekday()
    
    # French public holidays 2025
    holidays_2025 = [
        (1, 1), (4, 21), (5, 1), (5, 8), (5, 29), (6, 9),
        (7, 14), (8, 15), (11, 1), (11, 11), (12, 25)
    ]
    is_holiday = (check_time.month, check_time.day) in holidays_2025
    
    is_sunday = day_of_week == 6
    is_night = hour >= 17 or hour < 10
    
    if is_sunday or is_holiday:
        return {
            "tariff": "B",
            "label": "Tarif B (Dim/Férié)",
            "price_per_km": 1.64,
            "price_per_hour": 51.79,
            "prise_en_charge": 3.00
        }
    elif is_night:
        return {
            "tariff": "B", 
            "label": "Tarif B (Nuit)",
            "price_per_km": 1.64,
            "price_per_hour": 51.79,
            "prise_en_charge": 3.00
        }
    else:
        return {
            "tariff": "A",
            "label": "Tarif A (Jour)",
            "price_per_km": 1.25,
            "price_per_hour": 38.85,
            "prise_en_charge": 3.00
        }


def detect_airport_trip(pickup_lat: float, pickup_lng: float, dest_lat: float, dest_lng: float) -> dict:
    """
    Detect if the trip is to/from an airport and determine the applicable flat rate.
    """
    result = {
        "is_airport_trip": False,
        "airport": None,
        "direction": None,
        "rive": None,
        "flat_rate": None
    }
    
    for airport_code, airport_info in AIRPORTS.items():
        airport_lat = airport_info["lat"]
        airport_lng = airport_info["lng"]
        radius = airport_info["radius_km"]
        
        pickup_to_airport = calculate_distance_simple(pickup_lat, pickup_lng, airport_lat, airport_lng)
        dest_to_airport = calculate_distance_simple(dest_lat, dest_lng, airport_lat, airport_lng)
        
        if pickup_to_airport <= radius:
            result["is_airport_trip"] = True
            result["airport"] = airport_code
            result["airport_name"] = airport_info["name"]
            result["direction"] = "from_airport"
            result["rive"] = "rive_droite" if dest_lat > SEINE_LATITUDE else "rive_gauche"
            result["flat_rate"] = AIRPORT_FLAT_RATES[airport_code][result["rive"]]
            return result
            
        elif dest_to_airport <= radius:
            result["is_airport_trip"] = True
            result["airport"] = airport_code
            result["airport_name"] = airport_info["name"]
            result["direction"] = "to_airport"
            result["rive"] = "rive_droite" if pickup_lat > SEINE_LATITUDE else "rive_gauche"
            result["flat_rate"] = AIRPORT_FLAT_RATES[airport_code][result["rive"]]
            return result
    
    return result


def calculate_taxi_fare(distance_km: float, duration_minutes: int = 0, is_scheduled: bool = False, 
                        passenger_count: int = 1, stops_count: int = 0, scheduled_time: datetime = None,
                        is_suburban: bool = False, pickup_coords: dict = None, dest_coords: dict = None) -> dict:
    """
    Calculate fare for official Paris taxi with regulated pricing
    """
    SUPPLEMENT_IMMEDIAT = 4.00
    SUPPLEMENT_AVANCE = 7.00
    
    airport_trip = {"is_airport_trip": False}
    if pickup_coords and dest_coords:
        airport_trip = detect_airport_trip(
            pickup_coords.get("lat", 0), pickup_coords.get("lng", 0),
            dest_coords.get("lat", 0), dest_coords.get("lng", 0)
        )
    
    if airport_trip["is_airport_trip"]:
        flat_rate = airport_trip["flat_rate"]
        booking_supplement = SUPPLEMENT_AVANCE if is_scheduled else SUPPLEMENT_IMMEDIAT
        booking_label = "Réservation à l'avance" if is_scheduled else "Réservation immédiate"
        total = flat_rate + booking_supplement
        
        rive_label = "Rive Droite" if airport_trip["rive"] == "rive_droite" else "Rive Gauche"
        direction_label = f"Aéroport {airport_trip['airport_name']} → Paris {rive_label}" if airport_trip["direction"] == "from_airport" else f"Paris {rive_label} → Aéroport {airport_trip['airport_name']}"
        
        return {
            "vehicle_type": "taxi",
            "is_airport_flat_rate": True,
            "airport": airport_trip["airport"].upper(),
            "airport_name": airport_trip["airport_name"],
            "direction": airport_trip["direction"],
            "direction_label": direction_label,
            "rive": airport_trip["rive"],
            "rive_label": rive_label,
            "flat_rate": flat_rate,
            "booking_supplement": booking_supplement,
            "booking_supplement_label": booking_label,
            "supplement_details": [
                {"name": f"Forfait {airport_trip['airport_name']} ↔ Paris {rive_label}", "amount": flat_rate},
                {"name": booking_label, "amount": booking_supplement}
            ],
            "total": round(total, 2),
            "regulated": True,
            "regulation_text": "Forfait aéroport réglementé - Préfecture de Police de Paris 2025"
        }
    
    # Standard taxi fare
    if is_suburban:
        tariff_info = {
            "tariff": "C",
            "label": "Tarif C (Banlieue)",
            "price_per_km": 1.74,
            "price_per_hour": 42.52,
            "prise_en_charge": 3.00
        }
    else:
        tariff_info = get_paris_taxi_tariff(scheduled_time)
    
    TARIF_MINIMUM = 8.00
    SUPPLEMENT_PASSAGER = 5.50
    SUPPLEMENT_ARRET = 3.00
    
    prise_en_charge = tariff_info["prise_en_charge"]
    distance_cost = distance_km * tariff_info["price_per_km"]
    time_cost = (duration_minutes / 60) * tariff_info["price_per_hour"]
    
    supplements = 0
    supplement_details = []
    
    if is_scheduled:
        supplements += SUPPLEMENT_AVANCE
        supplement_details.append({"name": "Réservation à l'avance", "amount": SUPPLEMENT_AVANCE})
    else:
        supplements += SUPPLEMENT_IMMEDIAT
        supplement_details.append({"name": "Réservation immédiate", "amount": SUPPLEMENT_IMMEDIAT})
    
    extra_passengers = max(0, passenger_count - 4)
    if extra_passengers > 0:
        passenger_supplement = SUPPLEMENT_PASSAGER * extra_passengers
        supplements += passenger_supplement
        supplement_details.append({"name": f"Passager(s) supplémentaire(s) ({extra_passengers})", "amount": round(passenger_supplement, 2)})
    
    if stops_count > 0:
        stops_supplement = SUPPLEMENT_ARRET * stops_count
        supplements += stops_supplement
        supplement_details.append({"name": f"Arrêt(s) intermédiaire(s) ({stops_count})", "amount": round(stops_supplement, 2)})
    
    subtotal = prise_en_charge + distance_cost + time_cost + supplements
    total = max(TARIF_MINIMUM, subtotal)
    
    return {
        "vehicle_type": "taxi",
        "tariff": tariff_info["tariff"],
        "tariff_label": tariff_info["label"],
        "price_per_km": tariff_info["price_per_km"],
        "price_per_hour": tariff_info["price_per_hour"],
        "prise_en_charge": prise_en_charge,
        "distance_cost": round(distance_cost, 2),
        "time_cost": round(time_cost, 2),
        "supplements": round(supplements, 2),
        "supplement_details": supplement_details,
        "subtotal": round(subtotal, 2),
        "minimum_applied": subtotal < TARIF_MINIMUM,
        "total": round(total, 2),
        "regulated": True,
        "regulation_text": "Tarification réglementée - Préfecture de Police de Paris 2025"
    }


def calculate_vtc_fare(distance_km: float, duration_minutes: int = 0, is_scheduled: bool = False, 
                       vehicle_type: str = "standard", passenger_count: int = 1, stops_count: int = 0) -> dict:
    """
    Calculate fare for VTC (standard or van)
    """
    PRISE_EN_CHARGE = 4.48
    PRIX_KM = 1.30
    TARIF_MINUTE = 0.70
    TARIF_MINIMUM = 8.00
    SUPPLEMENT_IMMEDIAT = 4.00
    SUPPLEMENT_AVANCE = 7.00
    SUPPLEMENT_PASSAGER = 5.50
    SUPPLEMENT_VAN = 10.00
    SUPPLEMENT_ARRET = 3.00
    
    base = PRISE_EN_CHARGE
    distance_cost = distance_km * PRIX_KM
    time_cost = duration_minutes * TARIF_MINUTE
    
    supplements = 0
    supplement_details = []
    
    if vehicle_type == "van":
        supplements += SUPPLEMENT_VAN
        supplement_details.append({"name": "Van (7 places)", "amount": SUPPLEMENT_VAN})
    
    if is_scheduled:
        supplements += SUPPLEMENT_AVANCE
        supplement_details.append({"name": "Réservation à l'avance", "amount": SUPPLEMENT_AVANCE})
    else:
        supplements += SUPPLEMENT_IMMEDIAT
        supplement_details.append({"name": "Réservation immédiate", "amount": SUPPLEMENT_IMMEDIAT})
    
    extra_passengers = max(0, passenger_count - 4)
    if extra_passengers > 0:
        passenger_supplement = SUPPLEMENT_PASSAGER * extra_passengers
        supplements += passenger_supplement
        supplement_details.append({"name": f"Passager(s) supplémentaire(s) ({extra_passengers})", "amount": round(passenger_supplement, 2)})
    
    if stops_count > 0:
        stops_supplement = SUPPLEMENT_ARRET * stops_count
        supplements += stops_supplement
        supplement_details.append({"name": f"Arrêt(s) intermédiaire(s) ({stops_count})", "amount": round(stops_supplement, 2)})
    
    subtotal = base + distance_cost + time_cost + supplements
    total = max(TARIF_MINIMUM, subtotal)
    
    return {
        "vehicle_type": vehicle_type,
        "prise_en_charge": PRISE_EN_CHARGE,
        "price_per_km": PRIX_KM,
        "distance_cost": round(distance_cost, 2),
        "time_cost": round(time_cost, 2),
        "supplements": round(supplements, 2),
        "supplement_details": supplement_details,
        "subtotal": round(subtotal, 2),
        "minimum_applied": subtotal < TARIF_MINIMUM,
        "total": round(total, 2),
        "regulated": False
    }


def calculate_fare(distance_km: float, duration_minutes: int = 0, is_scheduled: bool = False, 
                   is_immediate: bool = True, vehicle_type: str = "standard", passenger_count: int = 1, 
                   stops_count: int = 0, scheduled_time: datetime = None, 
                   pickup_coords: dict = None, dest_coords: dict = None) -> dict:
    """
    Calculate fare based on vehicle type
    """
    if vehicle_type == "taxi":
        return calculate_taxi_fare(
            distance_km=distance_km,
            duration_minutes=duration_minutes,
            is_scheduled=is_scheduled,
            passenger_count=passenger_count,
            stops_count=stops_count,
            scheduled_time=scheduled_time,
            pickup_coords=pickup_coords,
            dest_coords=dest_coords
        )
    else:
        return calculate_vtc_fare(
            distance_km=distance_km,
            duration_minutes=duration_minutes,
            is_scheduled=is_scheduled,
            vehicle_type=vehicle_type,
            passenger_count=passenger_count,
            stops_count=stops_count
        )
