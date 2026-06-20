"""
Celery configuration for StationCab

This module configures Celery for background task processing.
It requires Redis to be running on the server.

To start the worker:
    celery -A services.celery_app worker --loglevel=info

To start the beat scheduler (for periodic tasks):
    celery -A services.celery_app beat --loglevel=info
"""
import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Redis URL (default to localhost)
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# Create Celery app
celery_app = Celery(
    'stationcab',
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['services.tasks']
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Europe/Paris',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
    worker_prefetch_multiplier=1,  # Process one task at a time
    task_acks_late=True,  # Acknowledge task after completion
)

# Periodic tasks (beat schedule)
celery_app.conf.beat_schedule = {
    'process-scheduled-rides-every-minute': {
        'task': 'services.tasks.process_scheduled_rides',
        'schedule': 60.0,  # Every minute
    },
    'cleanup-expired-authorizations-hourly': {
        'task': 'services.tasks.cleanup_expired_authorizations',
        'schedule': 3600.0,  # Every hour
    },
    'check-driver-documents-daily': {
        'task': 'services.tasks.check_expiring_documents',
        'schedule': 86400.0,  # Every 24 hours
    },
}
