"""
Core module initialization
"""
from .deps import (
    get_db,
    init_database,
    get_current_user,
    get_admin_user,
    get_driver_user,
    get_passenger_user,
    hash_password,
    verify_password,
    create_token,
    decode_token,
    calculate_distance,
    calculate_total_distance_with_stops,
    estimate_duration_minutes,
    find_nearest_driver,
    logger
)

__all__ = [
    "get_db",
    "init_database",
    "get_current_user",
    "get_admin_user",
    "get_driver_user",
    "get_passenger_user",
    "hash_password",
    "verify_password",
    "create_token",
    "decode_token",
    "calculate_distance",
    "calculate_total_distance_with_stops",
    "estimate_duration_minutes",
    "find_nearest_driver",
    "logger"
]
