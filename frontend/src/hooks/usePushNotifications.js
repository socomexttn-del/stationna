import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import pushNotificationService from '../services/pushNotifications';

export const usePushNotifications = () => {
  const [permission, setPermission] = useState('default');
  const [swRegistration, setSwRegistration] = useState(null);
  const [isNative, setIsNative] = useState(false);
  const authTokenRef = useRef(null);

  // Check if running on native platform
  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Register service worker for web
  useEffect(() => {
    if (!isNative && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
          setSwRegistration(registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, [isNative]);

  // Check current permission status
  useEffect(() => {
    if (!isNative && 'Notification' in window) {
      setPermission(Notification.permission);
    } else if (isNative) {
      pushNotificationService.isAvailable().then(available => {
        setPermission(available ? 'granted' : 'default');
      });
    }
  }, [isNative]);

  // Initialize native push notifications
  const initializeNative = useCallback(async (authToken) => {
    if (!isNative) return false;
    
    authTokenRef.current = authToken;
    const success = await pushNotificationService.initialize(authToken);
    if (success) {
      setPermission('granted');
    }
    return success;
  }, [isNative]);

  // Request notification permission
  const requestPermission = useCallback(async (authToken = null) => {
    // For native platform, initialize Firebase push notifications
    if (isNative) {
      const token = authToken || authTokenRef.current;
      if (token) {
        return await initializeNative(token);
      }
      console.warn('Auth token required for native push notifications');
      return false;
    }

    // For web platform
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isNative, initializeNative]);

  // Unregister on logout
  const unregister = useCallback(async (authToken) => {
    if (isNative) {
      await pushNotificationService.unregister(authToken);
    }
  }, [isNative]);

  // Show a local notification (web only, native handled by system)
  const showNotification = useCallback((title, body, data = {}) => {
    if (isNative) {
      // On native, notifications are handled by the system
      // We can still show local notifications if needed
      console.log('Native notification:', title, body);
      return;
    }

    if (permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    // Use service worker if available
    if (swRegistration) {
      swRegistration.active?.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        body,
        data
      });
    } else if ('Notification' in window) {
      // Fallback to basic notification
      new Notification(title, {
        body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: [200, 100, 200],
        tag: 'allogo-notification',
        renotify: true
      });
    }
  }, [permission, swRegistration, isNative]);

  // Add listener for native push notifications
  const addPushListener = useCallback((callback) => {
    if (isNative) {
      return pushNotificationService.addListener(callback);
    }
    return () => {}; // No-op for web
  }, [isNative]);

  // Notification templates for taxi app
  const notifyDriverAccepted = useCallback((driverName, eta) => {
    showNotification(
      'Chauffeur trouvé !',
      `${driverName} arrive dans ${eta} minutes`,
      { type: 'driver_accepted' }
    );
  }, [showNotification]);

  const notifyDriverArrived = useCallback((driverName) => {
    showNotification(
      'Votre chauffeur est arrivé',
      `${driverName} vous attend`,
      { type: 'driver_arrived' }
    );
  }, [showNotification]);

  const notifyRideCompleted = useCallback((fare) => {
    showNotification(
      'Course terminée',
      `Montant: ${fare}€ - Merci d'avoir voyagé avec Allogo`,
      { type: 'ride_completed' }
    );
  }, [showNotification]);

  const notifyNewRide = useCallback((passengerName, pickup) => {
    showNotification(
      'Nouvelle course disponible',
      `${passengerName} - ${pickup}`,
      { type: 'new_ride' }
    );
  }, [showNotification]);

  const notifyRideAssigned = useCallback((passengerName, pickup) => {
    showNotification(
      'Course attribuée',
      `${passengerName} - ${pickup}`,
      { type: 'ride_assigned' }
    );
  }, [showNotification]);

  const notifyNewMessage = useCallback((senderName, message) => {
    showNotification(
      `Message de ${senderName}`,
      message,
      { type: 'new_message' }
    );
  }, [showNotification]);

  return {
    permission,
    requestPermission,
    showNotification,
    notifyDriverAccepted,
    notifyDriverArrived,
    notifyRideCompleted,
    notifyNewRide,
    notifyRideAssigned,
    notifyNewMessage,
    addPushListener,
    unregister,
    initializeNative,
    isSupported: isNative || 'Notification' in window,
    isNative
  };
};

export default usePushNotifications;
