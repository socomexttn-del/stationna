/**
 * Web Push Notification Service for StationCab
 * Enables push notifications even when phone is in sleep mode
 */

const API_URL = process.env.REACT_APP_BACKEND_URL;

class WebPushService {
  constructor() {
    this.swRegistration = null;
    this.subscription = null;
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Initialize web push notifications
   * @param {string} authToken - JWT auth token
   * @returns {Promise<boolean>}
   */
  async initialize(authToken) {
    if (!this.isSupported) {
      console.warn('[WebPush] Not supported in this browser');
      return false;
    }

    try {
      // Register service worker
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('[WebPush] Service Worker registered');

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('[WebPush] Service Worker ready');

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[WebPush] Notification permission denied');
        return false;
      }
      console.log('[WebPush] Notification permission granted');

      // Subscribe to push notifications
      const subscribed = await this.subscribe(authToken);
      return subscribed;

    } catch (error) {
      console.error('[WebPush] Initialization error:', error);
      return false;
    }
  }

  /**
   * Subscribe to push notifications
   * @param {string} authToken
   * @returns {Promise<boolean>}
   */
  async subscribe(authToken) {
    try {
      // Get VAPID public key from server
      const vapidResponse = await fetch(`${API_URL}/api/push/vapid-key`);
      if (!vapidResponse.ok) {
        console.error('[WebPush] Failed to get VAPID key');
        return false;
      }
      
      const { publicKey } = await vapidResponse.json();
      
      // Convert VAPID key to Uint8Array
      const applicationServerKey = this.urlBase64ToUint8Array(publicKey);
      
      // Subscribe to push
      this.subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
      
      console.log('[WebPush] Push subscription created:', this.subscription);

      // Send subscription to backend
      const response = await fetch(`${API_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          subscription: this.subscription.toJSON()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription on server');
      }

      console.log('[WebPush] Subscription saved on server');
      return true;

    } catch (error) {
      console.error('[WebPush] Subscribe error:', error);
      return false;
    }
  }

  /**
   * Unsubscribe from push notifications
   * @param {string} authToken
   */
  async unsubscribe(authToken) {
    if (!this.subscription) return;

    try {
      // Unsubscribe from push manager
      await this.subscription.unsubscribe();
      
      // Remove from server
      await fetch(`${API_URL}/api/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        })
      });

      this.subscription = null;
      console.log('[WebPush] Unsubscribed');

    } catch (error) {
      console.error('[WebPush] Unsubscribe error:', error);
    }
  }

  /**
   * Check if push notifications are active
   * @returns {Promise<boolean>}
   */
  async isSubscribed() {
    if (!this.swRegistration) return false;
    
    const subscription = await this.swRegistration.pushManager.getSubscription();
    return subscription !== null;
  }

  /**
   * Show a local notification (for testing)
   * @param {string} title
   * @param {string} body
   * @param {object} data
   */
  async showLocalNotification(title, body, data = {}) {
    if (!this.swRegistration) return;

    this.swRegistration.active.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      data
    });
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   * @private
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Add listener for service worker messages
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  addMessageListener(callback) {
    const handler = (event) => {
      if (event.data) {
        callback(event.data);
      }
    };
    
    navigator.serviceWorker.addEventListener('message', handler);
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handler);
    };
  }
}

// Singleton
const webPushService = new WebPushService();
export default webPushService;
