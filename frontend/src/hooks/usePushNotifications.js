import { useState, useEffect, useCallback } from 'react';

export const usePushNotifications = () => {
  const [permission, setPermission] = useState('default');
  const [swRegistration, setSwRegistration] = useState(null);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
          setSwRegistration(registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Check current permission status
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
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
  }, []);

  // Show a local notification
  const showNotification = useCallback((title, body, data = {}) => {
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
        tag: 'volt-taxi-notification',
        renotify: true
      });
    }
  }, [permission, swRegistration]);

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
      `Montant: ${fare}€ - Merci d'avoir voyagé avec Volt`,
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
    isSupported: 'Notification' in window
  };
};

export default usePushNotifications;
