"""
Firebase Cloud Messaging Service for Push Notifications
"""
import os
import json
import logging
from typing import Optional, List, Dict, Any
import firebase_admin
from firebase_admin import credentials, messaging
from pathlib import Path

logger = logging.getLogger(__name__)

# Firebase configuration from environment
FIREBASE_CREDENTIALS = os.environ.get('FIREBASE_CREDENTIALS', '')
FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID', 'allogo-43fd4')

# Global Firebase app instance
_firebase_app: Optional[firebase_admin.App] = None


def initialize_firebase() -> bool:
    """Initialize Firebase Admin SDK"""
    global _firebase_app
    
    if _firebase_app is not None:
        return True
    
    try:
        # Check if credentials are provided via environment variable (JSON string)
        if FIREBASE_CREDENTIALS:
            cred_dict = json.loads(FIREBASE_CREDENTIALS)
            cred = credentials.Certificate(cred_dict)
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized from environment variable")
            return True
        
        # Check for credentials file
        cred_file = Path(__file__).parent.parent / 'firebase-credentials.json'
        if cred_file.exists():
            cred = credentials.Certificate(str(cred_file))
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info(f"Firebase initialized from file: {cred_file}")
            return True
        
        logger.warning("Firebase credentials not found - push notifications disabled")
        return False
        
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        return False


def is_firebase_initialized() -> bool:
    """Check if Firebase is properly initialized"""
    return _firebase_app is not None


async def send_push_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    sound: str = "default",
    priority: str = "high"
) -> bool:
    """
    Send a push notification to a single device
    
    Args:
        token: FCM device token
        title: Notification title
        body: Notification body text
        data: Optional data payload (all values must be strings)
        sound: Notification sound
        priority: Message priority (high/normal)
    
    Returns:
        True if sent successfully, False otherwise
    """
    if not is_firebase_initialized():
        if not initialize_firebase():
            logger.warning("Firebase not initialized - skipping push notification")
            return False
    
    try:
        # Convert all data values to strings (FCM requirement)
        str_data = {}
        if data:
            for key, value in data.items():
                str_data[key] = str(value) if value is not None else ""
        
        # Create the message with Android and APNs configurations for high priority
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=str_data,
            token=token,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    sound=sound,
                    priority='high',
                    channel_id='allogo_rides',  # High importance channel
                    default_vibrate_timings=True,
                    default_sound=True,
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound=sound,
                        content_available=True,
                        mutable_content=True,
                    )
                ),
                headers={
                    'apns-priority': '10',  # High priority
                    'apns-push-type': 'alert'
                }
            )
        )
        
        response = messaging.send(message)
        logger.info(f"Push notification sent successfully: {response}")
        return True
        
    except messaging.UnregisteredError:
        logger.warning(f"FCM token is no longer valid: {token[:20]}...")
        return False
    except messaging.SenderIdMismatchError:
        logger.error("FCM Sender ID mismatch - check Firebase project configuration")
        return False
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")
        return False


async def send_push_to_multiple(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    sound: str = "default"
) -> Dict[str, Any]:
    """
    Send push notification to multiple devices
    
    Args:
        tokens: List of FCM device tokens
        title: Notification title
        body: Notification body text
        data: Optional data payload
        sound: Notification sound
    
    Returns:
        Dictionary with success_count, failure_count, and failed_tokens
    """
    if not is_firebase_initialized():
        if not initialize_firebase():
            return {"success_count": 0, "failure_count": len(tokens), "failed_tokens": tokens}
    
    if not tokens:
        return {"success_count": 0, "failure_count": 0, "failed_tokens": []}
    
    try:
        # Convert all data values to strings
        str_data = {}
        if data:
            for key, value in data.items():
                str_data[key] = str(value) if value is not None else ""
        
        # Create multicast message
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=str_data,
            tokens=tokens,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    sound=sound,
                    priority='high',
                    channel_id='allogo_rides',
                    default_vibrate_timings=True,
                    default_sound=True,
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound=sound,
                        content_available=True,
                    )
                ),
                headers={
                    'apns-priority': '10',
                }
            )
        )
        
        response = messaging.send_each_for_multicast(message)
        
        # Collect failed tokens
        failed_tokens = []
        for idx, result in enumerate(response.responses):
            if not result.success:
                failed_tokens.append(tokens[idx])
                logger.warning(f"Failed to send to token {tokens[idx][:20]}...: {result.exception}")
        
        logger.info(f"Multicast sent: {response.success_count} success, {response.failure_count} failures")
        
        return {
            "success_count": response.success_count,
            "failure_count": response.failure_count,
            "failed_tokens": failed_tokens
        }
        
    except Exception as e:
        logger.error(f"Failed to send multicast notification: {e}")
        return {"success_count": 0, "failure_count": len(tokens), "failed_tokens": tokens}


# Initialize Firebase when module is imported
initialize_firebase()
