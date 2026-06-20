"""
Core configuration module for StationCab backend
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'volt-taxi-secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', 24))

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_SECRET_KEY') or os.environ.get('STRIPE_API_KEY')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', "pk_live_51J5B0aIhFRBc7tGxbkNUnMyYfrSEGJpSc1DzoxUASi6guCIYeaYGEeA2Cf9Ce7ZiYa2vSJEsjtnvJ1mKxQc8xhJI006tIB0hKE")

# SMTP Configuration (Zembra/OVH)
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'ssl0.ovh.net')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '465'))
SMTP_CLIENT_EMAIL = os.environ.get('SMTP_CLIENT_EMAIL', 'contact@stationcab.fr')
SMTP_CLIENT_PASSWORD = os.environ.get('SMTP_CLIENT_PASSWORD', '')
SMTP_DRIVER_EMAIL = os.environ.get('SMTP_DRIVER_EMAIL', 'driver@stationcab.fr')
SMTP_DRIVER_PASSWORD = os.environ.get('SMTP_DRIVER_PASSWORD', '')

# Web Push VAPID Keys
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', 'BDCbQxC5k4UrbdizRop8uCR-33wtwazA7uIfpBAWqJUSfJG8tzJwRrcXS_HXXCmZfo2l_Buf_zLLHeHAtF8BU54')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', 'Et9fgI_HxcyPRlFfOt0uXUeMn7z7C2zKPGXl0uBDGGs')
VAPID_CLAIMS = {"sub": "mailto:contact@stationcab.fr"}

# Mapbox
MAPBOX_ACCESS_TOKEN = os.environ.get('MAPBOX_ACCESS_TOKEN', '')

# Cors Origins
CORS_ORIGINS = ["*"]
