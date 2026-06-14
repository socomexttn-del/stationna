/**
 * Push Notification Service for StationCab
 * Handles Firebase Cloud Messaging (FCM) for native push notifications
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

class PushNotificationService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.token = null;
    this.initialized = false;
    this.listeners = [];
  }

  /**
   * Initialize push notifications
   * @param {string} authToken - JWT auth token for API calls
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(authToken) {
    if (!this.isNative) {
      console.log('Push notifications only available on native platforms');
      return false;
    }

    if (this.initialized) {
      return true;
    }

    try {
      // Request permission
      const permStatus = await PushNotifications.requestPermissions();
      
      if (permStatus.receive !== 'granted') {
        console.warn('Push notification permission denied');
        return false;
      }

      // Register with FCM
      await PushNotifications.register();

      // Set up listeners
      this._setupListeners(authToken);
      
      this.initialized = true;
      console.log('Push notifications initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  /**
   * Set up push notification event listeners
   * @private
   */
  _setupListeners(authToken) {
    // Registration success
    PushNotifications.addListener('registration', async (token) => {
      console.log('FCM Token received:', token.value);
      this.token = token.value;
      
      // Register token with backend
      await this._registerTokenWithBackend(token.value, authToken);
    });

    // Registration error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('FCM Registration error:', error);
    });

    // Notification received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received (foreground):', notification);
      
      // Notify all listeners
      this.listeners.forEach(callback => {
        try {
          callback({
            type: 'foreground',
            notification: {
              title: notification.title,
              body: notification.body,
              data: notification.data
            }
          });
        } catch (e) {
          console.error('Error in notification listener:', e);
        }
      });
    });

    // Notification action performed (user tapped on notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push notification action:', action);
      
      // Notify all listeners
      this.listeners.forEach(callback => {
        try {
          callback({
            type: 'action',
            notification: {
              title: action.notification.title,
              body: action.notification.body,
              data: action.notification.data
            },
            actionId: action.actionId
          });
        } catch (e) {
          console.error('Error in notification listener:', e);
        }
      });
    });
  }

  /**
   * Register FCM token with backend
   * @private
   */
  async _registerTokenWithBackend(token, authToken) {
    try {
      const response = await axios.post(
        `${API_URL}/api/fcm/register`,
        {
          token: token,
          device_info: {
            platform: Capacitor.getPlatform(),
            isNative: this.isNative
          }
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );
      
      console.log('FCM token registered with backend:', response.data);
      return true;
    } catch (error) {
      console.error('Failed to register FCM token with backend:', error);
      return false;
    }
  }

  /**
   * Unregister FCM token (call on logout)
   * @param {string} authToken - JWT auth token
   */
  async unregister(authToken) {
    if (!this.token || !authToken) return;

    try {
      await axios.delete(
        `${API_URL}/api/fcm/unregister`,
        {
          data: { token: this.token },
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );
      
      this.token = null;
      console.log('FCM token unregistered');
    } catch (error) {
      console.error('Failed to unregister FCM token:', error);
    }
  }

  /**
   * Add notification listener
   * @param {Function} callback - Callback function for notifications
   * @returns {Function} - Unsubscribe function
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Get current FCM token
   * @returns {string|null}
   */
  getToken() {
    return this.token;
  }

  /**
   * Check if running on native platform
   * @returns {boolean}
   */
  isNativePlatform() {
    return this.isNative;
  }

  /**
   * Check if push notifications are available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    if (!this.isNative) return false;
    
    try {
      const permStatus = await PushNotifications.checkPermissions();
      return permStatus.receive === 'granted';
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
const pushNotificationService = new PushNotificationService();

export default pushNotificationService;
