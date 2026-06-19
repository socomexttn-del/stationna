import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import webPushService from '../services/webPushService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import ChatComponent from '../components/ChatComponent';
import BookingReceipt from '../components/BookingReceipt';
import StationCabLogo from '../components/StationCabLogo';
import { 
  Car, MapPin, Navigation, Star, Clock, DollarSign,
  Menu, User, History, LogOut, Check, X, Play, Phone, Bell, Wifi, WifiOff, MessageCircle, FileText, Receipt, Crosshair, Loader2, Eye, EyeOff, RefreshCw, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const DriverDashboard = () => {
  const { t } = useTranslation();
  const { user, logout, api, updateUser } = useAuth();
  const { permission, requestPermission, notifyNewRide, notifyRideAssigned, notifyNewMessage, initializeNative, addPushListener, isNative } = usePushNotifications();
  
  const [isAvailable, setIsAvailable] = useState(user?.is_available || false);
  const [availableRides, setAvailableRides] = useState([]);
  const [dismissedRides, setDismissedRides] = useState([]); // Rides the driver refused/ignored
  const [activeRide, setActiveRide] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [stats, setStats] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [hideEarnings, setHideEarnings] = useState(() => {
    return localStorage.getItem('allogo_hide_earnings') === 'true';
  });
  
  // MODE CHAUFFEUR - Keep app alive in background
  const [driverModeActive, setDriverModeActive] = useState(false);
  const wakeLockRef = useRef(null);
  const silentAudioRef = useRef(null);
  const keepAliveIntervalRef = useRef(null);
  
  // Taxi meter price modal
  const [showMeterModal, setShowMeterModal] = useState(false);
  const [meterPrice, setMeterPrice] = useState('');

  // Audio context kept alive for notifications
  const audioContextRef = useRef(null);
  const audioElementRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [webPushEnabled, setWebPushEnabled] = useState(false);

  // ============ MODE CHAUFFEUR FUNCTIONS ============
  
  // Request Wake Lock to prevent screen from sleeping
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('✅ Wake Lock activé - écran restera allumé');
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('⚠️ Wake Lock relâché');
        });
        return true;
      }
    } catch (err) {
      console.log('Wake Lock non disponible:', err);
    }
    return false;
  };

  // Release Wake Lock
  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('Wake Lock désactivé');
    }
  };

  // Start silent audio to keep browser active in background
  const startSilentAudio = () => {
    try {
      // Create audio context for silent tone
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create a very quiet oscillator (inaudible but keeps browser active)
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.value = 1; // Very low frequency
      gainNode.gain.value = 0.001; // Almost silent
      
      oscillator.start();
      silentAudioRef.current = { audioCtx, oscillator, gainNode };
      
      console.log('✅ Audio silencieux démarré - app reste active en arrière-plan');
      return true;
    } catch (e) {
      console.log('Erreur audio silencieux:', e);
      return false;
    }
  };

  // Stop silent audio
  const stopSilentAudio = () => {
    if (silentAudioRef.current) {
      try {
        silentAudioRef.current.oscillator.stop();
        silentAudioRef.current.audioCtx.close();
      } catch (e) {}
      silentAudioRef.current = null;
      console.log('Audio silencieux arrêté');
    }
  };

  // Activate Driver Mode
  const activateDriverMode = async () => {
    console.log('🚗 Activation Mode Chauffeur...');
    
    try {
      // 1. Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      
      // 2. Activate Wake Lock (keep screen on)
      await requestWakeLock();
      
      // 3. Start silent audio (keep app alive in background)
      startSilentAudio();
      
      // 4. Initialize audio context for alarms
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          setSoundEnabled(true);
          console.log('Audio context initialized');
        } catch (e) {
          console.log('Audio context error:', e);
        }
      }
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      // 5. Start keep-alive ping every 30 seconds
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
      keepAliveIntervalRef.current = setInterval(() => {
        console.log('💓 Keep-alive ping');
        // Re-request wake lock if it was released
        if (!wakeLockRef.current && driverModeActive) {
          requestWakeLock();
        }
      }, 30000);
      
      setDriverModeActive(true);
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-bold">🚗 Mode Chauffeur activé!</span>
          <span className="text-sm">• Écran reste allumé</span>
          <span className="text-sm">• App active en arrière-plan</span>
          <span className="text-sm">• Alarme sonore pour nouvelles courses</span>
        </div>,
        { duration: 5000 }
      );
    } catch (error) {
      console.error('Erreur activation Mode Chauffeur:', error);
      toast.error('Erreur lors de l\'activation du Mode Chauffeur');
    }
  };

  // Deactivate Driver Mode
  const deactivateDriverMode = () => {
    console.log('🚗 Désactivation Mode Chauffeur...');
    
    releaseWakeLock();
    stopSilentAudio();
    
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    
    setDriverModeActive(false);
    toast.info('Mode Chauffeur désactivé');
  };

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && driverModeActive) {
        console.log('📱 Page redevenue visible - réactivation Wake Lock');
        await requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [driverModeActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
      stopSilentAudio();
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
    };
  }, []);

  // Initialize Web Push notifications for background notifications
  const initWebPush = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const success = await webPushService.initialize(token);
      setWebPushEnabled(success);
      
      if (success) {
        console.log('✅ Web Push notifications enabled - will work in background!');
        
        // Listen for service worker messages
        webPushService.addMessageListener((message) => {
          console.log('📩 Service Worker message:', message);
          if (message.type === 'NOTIFICATION_CLICK') {
            // Refresh rides when notification is clicked
            fetchAvailableRides();
          }
          if (message.type === 'SYNC_RIDES' || message.type === 'CHECK_NEW_RIDES') {
            fetchAvailableRides();
          }
        });
      }
    } catch (e) {
      console.log('Web Push init error:', e);
    }
  }, []);

  // Initialize audio system on first user interaction
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        setSoundEnabled(true);
        console.log('Audio context initialized for driver');
        
        // Also initialize Web Push when user enables sound
        initWebPush();
      } catch (e) {
        console.log('Audio context error:', e);
      }
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [initWebPush]);

  // Create persistent audio element for notifications
  useEffect(() => {
    // Create an audio element that can play notification sounds
    const audio = new Audio();
    audio.volume = 1.0;
    audioElementRef.current = audio;
    
    // Add interaction listeners to enable audio
    const handleInteraction = () => {
      initAudio();
      // Try to play a silent sound to unlock audio
      if (audioElementRef.current) {
        audioElementRef.current.play().then(() => {
          audioElementRef.current.pause();
        }).catch(() => {});
      }
    };
    
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [initAudio]);

  // Get current location on mount with permission check
  useEffect(() => {
    const checkPermissionAndGetLocation = async () => {
      // Check permission status first if API is available
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          
          if (permissionStatus.state === 'denied') {
            setLocationError('Géolocalisation refusée - Activez-la dans les paramètres pour recevoir des courses');
            toast.error('Activez la géolocalisation dans les paramètres de votre navigateur', { duration: 6000 });
            return;
          }
          
          // Listen for permission changes
          permissionStatus.onchange = () => {
            if (permissionStatus.state === 'granted') {
              getLocation();
            }
          };
        } catch (e) {
          // Permission API not fully supported
        }
      }
      
      getLocation();
    };

    const getLocation = () => {
      if (!navigator.geolocation) {
        setLocationError('Géolocalisation non supportée');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: 'Position actuelle'
          };
          setCurrentLocation(location);
          setLocationError(null);
          
          // Update driver location in database
          try {
            await api.put('/drivers/location', location);
            console.log('Driver location updated');
          } catch (error) {
            console.error('Error updating location:', error);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          if (error.code === error.PERMISSION_DENIED) {
            setLocationError('Géolocalisation refusée - Activez-la dans les paramètres');
            toast.error('Activez la géolocalisation pour recevoir des courses', { duration: 5000 });
          } else if (error.code === error.TIMEOUT) {
            setLocationError('Délai de géolocalisation dépassé');
          } else {
            setLocationError('Impossible d\'obtenir votre position');
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    };

    checkPermissionAndGetLocation();
  }, [api]);

  // Initialize native push notifications
  useEffect(() => {
    const initPushNotifications = async () => {
      const authToken = localStorage.getItem('volt_token');
      if (authToken && isNative && initializeNative) {
        console.log('Initializing native push notifications for driver...');
        const success = await initializeNative(authToken);
        if (success) {
          console.log('Native push notifications initialized successfully');
        }
      }
    };
    
    initPushNotifications();
  }, [isNative, initializeNative]);

  // Listen for native push notifications
  useEffect(() => {
    if (!isNative || !addPushListener) return;
    
    const unsubscribe = addPushListener((event) => {
      console.log('Native push notification received:', event);
      // The push notification will trigger a UI refresh via the notification polling system
      // The native notification is handled by the OS when app is in background
    });
    
    return unsubscribe;
  }, [isNative, addPushListener]);

  // Continuous location tracking when available
  useEffect(() => {
    if (!isAvailable || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Position actuelle'
        };
        setCurrentLocation(location);
        
        // Update location in database
        try {
          await api.put('/drivers/location', location);
        } catch (error) {
          console.error('Error updating location:', error);
        }
      },
      (error) => console.error('Watch position error:', error),
      { enableHighAccuracy: true, maximumAge: 30000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isAvailable, api]);

  // Notification handler
  const handleNotification = useCallback((data) => {
    console.log('Notification received:', data);
    
    switch (data.type) {
      case 'new_ride':
        // Show notification for new ride with accept button
        toast(
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-green-500">🚗 Nouvelle course!</span>
            <span className="text-sm">{data.pickup?.address}</span>
            <span className="text-xs text-muted-foreground">→ {data.destination?.address}</span>
            <div className="flex justify-between items-center mt-1">
              <span className="text-primary font-bold">{data.estimated_fare}€</span>
              <button 
                onClick={() => {
                  acceptRide(data.id);
                  toast.dismiss();
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg text-sm"
              >
                Accepter
              </button>
            </div>
          </div>,
          { duration: 30000 }
        );
        // Add to available rides
        setAvailableRides(prev => {
          const exists = prev.some(r => r.id === data.id);
          if (!exists) {
            return [{
              id: data.id,
              passenger_name: data.passenger_name,
              pickup: data.pickup,
              destination: data.destination,
              distance_km: data.distance_km,
              estimated_fare: data.estimated_fare
            }, ...prev];
          }
          return prev;
        });
        // Push notification
        notifyNewRide(data.passenger_name, data.pickup?.address);
        // Play notification sound - max 3 times
        playNotificationSound(3);
        break;
      
      case 'ride_assigned':
        // New ride automatically assigned to this driver
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Course attribuée!</span>
            <span className="text-sm">{data.pickup?.address}</span>
            <span className="text-primary font-bold">{data.estimated_fare}€</span>
          </div>,
          { duration: 10000 }
        );
        // Push notification
        notifyRideAssigned(data.passenger_name, data.pickup?.address);
        // Refresh active ride
        fetchActiveRide();
        // Play notification sound - max 3 times
        playNotificationSound(3);
        break;
      
      case 'ride_available':
        // New ride available - driver must accept
        toast(
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-green-500">🚗 Nouvelle course disponible!</span>
            <span className="text-sm">{data.pickup?.address}</span>
            <span className="text-xs text-muted-foreground">→ {data.destination?.address}</span>
            <div className="flex justify-between items-center mt-1">
              <span className="text-primary font-bold">{data.driver_earnings || data.estimated_fare}€</span>
              <button 
                onClick={() => {
                  acceptRide(data.ride_id);
                  toast.dismiss();
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg text-sm"
              >
                Accepter
              </button>
            </div>
          </div>,
          { duration: 30000 }
        );
        // Push notification
        notifyNewRide(data.passenger_name, data.pickup?.address, data.driver_earnings);
        // Refresh available rides
        fetchAvailableRides();
        // Play notification sound multiple times to get attention
        playNotificationSound();
        setTimeout(() => playNotificationSound(), 500);
        setTimeout(() => playNotificationSound(), 1000);
        break;
        
      case 'ride_taken':
        // Remove ride from available list
        setAvailableRides(prev => prev.filter(r => r.id !== data.ride_id));
        break;
      
      case 'scheduled_ride_available':
        // Scheduled ride notification with accept button
        toast(
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-amber-500">📅 Course réservée à l'avance!</span>
            <span className="text-sm font-medium">Prise en charge: {data.scheduled_time}</span>
            <span className="text-sm">{data.pickup}</span>
            <span className="text-xs text-muted-foreground">→ {data.destination}</span>
            <div className="flex justify-between items-center mt-1">
              <span className="text-amber-500 font-bold">{data.estimated_fare}€</span>
              <button 
                onClick={() => {
                  acceptRide(data.ride_id);
                  toast.dismiss();
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg text-sm"
              >
                Accepter
              </button>
            </div>
          </div>,
          { duration: 60000 }
        );
        // Refresh available rides
        fetchAvailableRides();
        // Play notification sound
        playNotificationSound();
        setTimeout(() => playNotificationSound(), 500);
        break;
      
      case 'new_message':
        // New chat message notification
        if (!chatOpen) {
          setUnreadMessages(prev => prev + 1);
          toast.info(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{data.sender_name}</span>
              <span className="text-sm">{data.message}</span>
            </div>,
            { duration: 4000 }
          );
          // Push notification
          notifyNewMessage(data.sender_name, data.message);
          playNotificationSound();
        }
        break;
        
      default:
        break;
    }
  }, [chatOpen]);

  // Connect to notification polling
  const { isConnected } = useNotifications(api, 'driver', handleNotification);

  // Alarm interval ref for continuous ringing
  const alarmIntervalRef = useRef(null);
  const [alarmActive, setAlarmActive] = useState(false);

  // Stop the alarm
  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    setAlarmActive(false);
    if (navigator.vibrate) {
      navigator.vibrate(0); // Stop vibration
    }
    console.log('🔕 Alarme arrêtée');
  }, []);

  // Play notification sound - VERY aggressive for new rides
  const playNotificationSound = useCallback((repeat = 1, continuous = false) => {
    console.log('🔊 Playing notification sound, repeat:', repeat, 'continuous:', continuous);
    
    // Play single beep
    const playBeep = () => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        
        const playTone = (startTime, freq, duration) => {
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          oscillator.frequency.value = freq;
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.7, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
          
          oscillator.start(startTime);
          oscillator.stop(startTime + duration);
        };
        
        const now = audioCtx.currentTime;
        // LOUD taxi horn pattern
        playTone(now, 1400, 0.15);
        playTone(now + 0.18, 900, 0.15);
        playTone(now + 0.36, 1400, 0.15);
        playTone(now + 0.54, 900, 0.15);
        playTone(now + 0.72, 1600, 0.3);
        
        return true;
      } catch (e) {
        console.log('Audio error:', e);
        return false;
      }
    };

    // Vibrate
    const vibrate = () => {
      if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 800]);
      }
    };
    
    // If continuous mode - start alarm that repeats until stopped
    if (continuous) {
      stopAlarm(); // Stop any existing alarm first
      setAlarmActive(true);
      
      // Play immediately
      playBeep();
      vibrate();
      
      // Then repeat every 2 seconds
      alarmIntervalRef.current = setInterval(() => {
        playBeep();
        vibrate();
        console.log('🔔 Alarme continue...');
      }, 2000);
      
      // Auto-stop after 60 seconds to prevent infinite loop
      setTimeout(() => {
        if (alarmIntervalRef.current) {
          stopAlarm();
          toast.info('Alarme arrêtée automatiquement après 60 secondes');
        }
      }, 60000);
      
      return;
    }
    
    // Normal mode - play X times
    for (let i = 0; i < Math.min(repeat, 5); i++) {
      setTimeout(() => {
        playBeep();
        vibrate();
      }, i * 1200);
    }
  }, [stopAlarm]);

  // Send GPS location to server
  const sendLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError('Géolocalisation non supportée');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        setLocationError(null);
        
        try {
          // Reverse geocode for address
          const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
          let address = 'Position actuelle';
          try {
            const geoRes = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&language=fr&limit=1`
            );
            const geoData = await geoRes.json();
            if (geoData.features?.[0]) {
              address = geoData.features[0].place_name;
            }
          } catch (e) {}
          
          await api.put('/drivers/location', {
            lat: latitude,
            lng: longitude,
            address: address
          });
        } catch (error) {
          console.error('Error sending location:', error);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationError('Activez la géolocalisation');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, [api]);

  // Play sound when going online/offline
  const playOnlineSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Rising happy sound for online
      oscillator.frequency.value = 523; // C5
      oscillator.type = 'sine';
      gainNode.gain.value = 0.4;
      oscillator.start();
      setTimeout(() => { oscillator.frequency.value = 659; }, 100); // E5
      setTimeout(() => { oscillator.frequency.value = 784; }, 200); // G5
      setTimeout(() => { oscillator.stop(); audioContext.close(); }, 350);
    } catch (e) {}
  }, []);

  const playOfflineSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Falling sound for offline
      oscillator.frequency.value = 440; // A4
      oscillator.type = 'sine';
      gainNode.gain.value = 0.4;
      oscillator.start();
      setTimeout(() => { oscillator.frequency.value = 349; }, 150); // F4
      setTimeout(() => { oscillator.frequency.value = 294; }, 300); // D4
      setTimeout(() => { oscillator.stop(); audioContext.close(); }, 450);
    } catch (e) {}
  }, []);

  // Start/stop location tracking based on availability
  useEffect(() => {
    let locationInterval;
    
    if (isAvailable) {
      // Send location immediately when going online
      sendLocation();
      // Then every 30 seconds while online
      locationInterval = setInterval(sendLocation, 30000);
    }
    
    // Also track more frequently during active ride
    if (activeRide && (activeRide.status === 'accepted' || activeRide.status === 'in_progress')) {
      if (locationInterval) clearInterval(locationInterval);
      sendLocation();
      locationInterval = setInterval(sendLocation, 5000);
    }
    
    return () => {
      if (locationInterval) clearInterval(locationInterval);
    };
  }, [isAvailable, activeRide, sendLocation]);

  useEffect(() => {
    fetchStats();
    fetchActiveRide();
    if (isAvailable) {
      fetchAvailableRides();
    }
    const interval = setInterval(() => {
      fetchActiveRide();
      // Always fetch available rides to show notifications
      if (!activeRide) fetchAvailableRides();
    }, 5000);
    return () => clearInterval(interval);
  }, [isAvailable]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/stats/driver');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Track previous active ride to detect cancellations
  const prevActiveRideRef = useRef(null);
  
  const fetchActiveRide = async () => {
    try {
      const response = await api.get('/rides/active');
      const newRide = response.data;
      
      // Detect if passenger cancelled the ride (had active ride, now gone)
      if (prevActiveRideRef.current && !newRide) {
        // Check if it was cancelled (not completed by us)
        const prevStatus = prevActiveRideRef.current.status;
        if (prevStatus === 'accepted' || prevStatus === 'arrived' || prevStatus === 'in_progress') {
          // The ride disappeared - likely cancelled by passenger
          toast.error(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">⚠️ Course annulée par le client</span>
              <span className="text-sm">La course a été annulée. Vous êtes de nouveau disponible.</span>
            </div>,
            { duration: 8000 }
          );
          // Play a notification sound
          playNotificationSound(2);
          // Set driver back to available
          setIsAvailable(true);
        }
      }
      
      prevActiveRideRef.current = newRide;
      setActiveRide(newRide);
      
      // If there's an active ride, ensure driver is marked as unavailable
      if (newRide && (newRide.status === 'accepted' || newRide.status === 'arrived' || newRide.status === 'in_progress')) {
        setIsAvailable(false);
      }
    } catch (error) {
      console.error('Error fetching active ride:', error);
    }
  };

  // Track previous rides count to detect new ones
  const [prevRidesCount, setPrevRidesCount] = useState(0);
  const notifiedRidesRef = useRef(new Set()); // Track rides we've already notified about

  const fetchAvailableRides = async () => {
    try {
      const response = await api.get('/rides/available');
      const allRides = response.data || [];
      
      // Filter out dismissed rides
      const newRides = allRides.filter(r => !dismissedRides.includes(r.id));
      
      // Get current ride IDs
      const currentRideIds = new Set(newRides.map(r => r.id));
      
      // Clean up old notified rides that are no longer available
      // This ensures we can re-notify if a ride comes back or for new test rides
      const oldNotified = [...notifiedRidesRef.current];
      oldNotified.forEach(id => {
        if (!currentRideIds.has(id)) {
          notifiedRidesRef.current.delete(id);
        }
      });
      
      // Check for truly NEW rides (not yet notified)
      const brandNewRides = newRides.filter(r => !notifiedRidesRef.current.has(r.id));
      
      console.log('📊 Courses:', { 
        total: allRides.length, 
        filtered: newRides.length, 
        new: brandNewRides.length,
        notified: notifiedRidesRef.current.size 
      });
      
      // Play alarm for new rides (always play if there are new rides!)
      if (brandNewRides.length > 0) {
        // Mark these rides as notified
        brandNewRides.forEach(r => notifiedRidesRef.current.add(r.id));
        
        // START CONTINUOUS ALARM for new ride(s)!
        console.log('🔔 ALARME! Nouvelle(s) course(s):', brandNewRides.length);
        playNotificationSound(1, true); // true = continuous alarm
        
        // Show toast for the first new ride
        const firstNew = brandNewRides[0];
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">🚗 NOUVELLE COURSE!</span>
            <span className="text-sm">{firstNew?.pickup?.address}</span>
            <span className="text-primary font-bold text-xl">{firstNew?.driver_earnings || (firstNew?.estimated_fare * 0.82).toFixed(2)}€</span>
          </div>,
          { duration: 60000 }
        );
        
        // Also trigger browser notification if permission granted
        if (Notification.permission === 'granted') {
          new Notification('StationCab - Nouvelle course!', {
            body: `${firstNew?.pickup?.address} → ${firstNew?.destination?.address}\nGains: ${firstNew?.driver_earnings || (firstNew?.estimated_fare * 0.82).toFixed(2)}€`,
            icon: '/logo192.png',
            tag: 'new-ride',
            requireInteraction: true
          });
        }
      }
      
      setPrevRidesCount(newRides.length);
      setAvailableRides(newRides);
    } catch (error) {
      console.error('Error fetching available rides:', error);
    }
  };

  const toggleAvailability = async (checked) => {
    try {
      // Use current location if available
      const location = currentLocation || { lat: 48.8566, lng: 2.3522, address: 'Paris Centre' };
      
      const response = await api.put('/users/availability', { 
        is_available: checked,
        location: location
      });
      setIsAvailable(checked);
      updateUser(response.data);
      
      // Play appropriate sound
      if (checked) {
        playOnlineSound();
        toast.success('Vous êtes maintenant en ligne');
      } else {
        playOfflineSound();
        toast.success('Vous êtes hors ligne');
      }
    } catch (error) {
      toast.error('Erreur lors du changement de statut');
    }
  };

  const acceptRide = async (rideId) => {
    stopAlarm(); // Stop alarm when accepting
    // Remove from notified set so future rides can trigger alarm
    notifiedRidesRef.current.delete(rideId);
    try {
      const response = await api.post(`/rides/${rideId}/accept`);
      setActiveRide(response.data);
      setAvailableRides([]);
      // Clear all notified rides since we accepted one
      notifiedRidesRef.current.clear();
      toast.success('Course acceptée!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'acceptation');
      fetchAvailableRides();
    }
  };

  const dismissRide = async (rideId) => {
    stopAlarm(); // Stop alarm when dismissing
    // Remove from notified set
    notifiedRidesRef.current.delete(rideId);
    // Add to dismissed list so it won't show again locally
    setDismissedRides(prev => [...prev, rideId]);
    // Remove from available rides
    setAvailableRides(prev => prev.filter(r => r.id !== rideId));
    
    // Call API to register refusal and trigger reassignment after 5 seconds
    try {
      await api.post(`/rides/${rideId}/refuse`);
      toast.info('Course refusée - Elle sera proposée à un autre chauffeur');
    } catch (error) {
      // Still dismissed locally, just log the error
      console.error('Error refusing ride:', error);
      toast.info('Course ignorée');
    }
  };

  const startRide = async () => {
    if (!activeRide) return;
    try {
      const response = await api.post(`/rides/${activeRide.id}/start`);
      setActiveRide(response.data);
      toast.success('Course démarrée!');
    } catch (error) {
      toast.error('Erreur lors du démarrage');
    }
  };

  const completeRide = async () => {
    if (!activeRide) return;
    
    // For taxi rides, show meter price modal
    if (activeRide.vehicle_type === 'taxi') {
      setMeterPrice(activeRide.estimated_fare?.toString() || '');
      setShowMeterModal(true);
      return;
    }
    
    // For VTC rides, complete directly
    try {
      const response = await api.post(`/rides/${activeRide.id}/complete`);
      setActiveRide(null);
      fetchStats();
      toast.success('Course terminée! Paiement en attente.');
    } catch (error) {
      toast.error('Erreur lors de la finalisation');
    }
  };

  const submitMeterPrice = async () => {
    if (!activeRide) return;
    
    const price = parseFloat(meterPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Veuillez entrer un prix valide');
      return;
    }
    
    try {
      const response = await api.post(`/rides/${activeRide.id}/complete`, {
        meter_price: price
      });
      setShowMeterModal(false);
      setMeterPrice('');
      setActiveRide(null);
      fetchStats();
      toast.success(`Course terminée! Prix compteur: ${price.toFixed(2)}€`);
    } catch (error) {
      toast.error('Erreur lors de la finalisation');
    }
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/cancel`);
      setActiveRide(null);
      toast.success('Course annulée');
      fetchAvailableRides();
    } catch (error) {
      toast.error('Erreur lors de l\'annulation');
    }
  };

  const rejectRide = async () => {
    if (!activeRide) return;
    try {
      const response = await api.post(`/rides/${activeRide.id}/reject`);
      setActiveRide(null);
      toast.success(response.data.message || 'Course refusée et transférée');
      fetchAvailableRides();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du refus');
    }
  };

  const ratePassenger = async (rating) => {
    if (!activeRide) return;
    try {
      await api.post('/ratings', { ride_id: activeRide.id, rating });
      toast.success('Merci pour votre évaluation!');
      setActiveRide(null);
    } catch (error) {
      console.error('Rating error:', error);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'text-yellow-500';
      case 'accepted': return 'text-blue-500';
      case 'in_progress': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StationCabLogo size="small" darkMode={true} showText={false} />
            <span className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk' }}>Chauffeur</span>
            {/* WebSocket connection indicator */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${isConnected ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? 'Live' : 'Hors ligne'}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {isAvailable ? 'En ligne' : 'Hors ligne'}
              </span>
              <Switch 
                checked={isAvailable} 
                onCheckedChange={toggleAvailability}
                data-testid="availability-switch"
                disabled={!!activeRide}
              />
            </div>
            
            {/* Refresh button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={async () => {
                try {
                  // Show loading indicator
                  const toastId = toast.loading('Actualisation...');
                  
                  // Refresh available rides
                  const ridesResponse = await api.get('/rides/available');
                  setAvailableRides(ridesResponse.data || []);
                  
                  // Refresh active ride
                  const activeResponse = await api.get('/rides/active');
                  if (activeResponse.data) {
                    setActiveRide(activeResponse.data);
                  } else {
                    setActiveRide(null);
                  }
                  
                  // Refresh earnings
                  try {
                    const earningsResponse = await api.get('/drivers/earnings');
                    setTodayEarnings(earningsResponse.data?.today || 0);
                    setTotalEarnings(earningsResponse.data?.total || 0);
                    setTodayRides(earningsResponse.data?.rides_today || 0);
                  } catch (e) {}
                  
                  toast.dismiss(toastId);
                  toast.success('Page actualisée');
                } catch (error) {
                  console.error('Refresh error:', error);
                  toast.error('Erreur lors du rafraîchissement');
                }
              }}
              className="rounded-full"
              data-testid="driver-refresh-btn"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
            
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="driver-menu-btn" className="rounded-full">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent className="bg-card border-border">
                <SheetHeader>
                  <SheetTitle className="text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{user?.first_name} {user?.last_name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Star className="w-3 h-3 fill-primary text-primary" />
                          {user?.rating?.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-8 space-y-2">
                  <Link to="/profile" onClick={() => setMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start h-12" data-testid="driver-nav-profile">
                      <User className="w-5 h-5 mr-3" /> Mon profil
                    </Button>
                  </Link>
                  <Link to="/driver/vehicle" onClick={() => setMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start h-12" data-testid="driver-nav-vehicle">
                      <Car className="w-5 h-5 mr-3" /> Mon véhicule
                    </Button>
                  </Link>
                  <Link to="/history" onClick={() => setMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start h-12" data-testid="driver-nav-history">
                      <History className="w-5 h-5 mr-3" /> Historique
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-12 text-destructive hover:text-destructive"
                    onClick={logout}
                    data-testid="driver-nav-logout"
                  >
                    <LogOut className="w-5 h-5 mr-3" /> Déconnexion
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-24 pb-8 px-4 space-y-6">
        {/* Location Status */}
        {!currentLocation && !locationError && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Détection de votre position...</span>
          </div>
        )}
        
        {locationError && (
          <div className="flex flex-col gap-3 text-sm bg-orange-500/10 p-4 rounded-xl border border-orange-500/30">
            <div className="flex items-center gap-2 text-orange-500">
              <Crosshair className="w-5 h-5" />
              <span className="font-medium">Géolocalisation requise</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Pour recevoir des courses, vous devez activer la géolocalisation.
            </p>
            <Button 
              onClick={() => {
                setLocationError(null);
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const loc = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        address: "Position actuelle"
                      };
                      setCurrentLocation(loc);
                      toast.success('Position détectée!');
                    },
                    (error) => {
                      console.error('Geolocation error:', error);
                      if (error.code === 1) {
                        setLocationError('Permission refusée');
                        toast.error(
                          <div>
                            <p className="font-bold">Permission refusée</p>
                            <p className="text-xs">Allez dans les paramètres de votre navigateur pour autoriser la géolocalisation</p>
                          </div>,
                          { duration: 8000 }
                        );
                      } else {
                        setLocationError('Position indisponible');
                      }
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
                  );
                }
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              data-testid="enable-location-btn"
            >
              <Crosshair className="w-4 h-4 mr-2" />
              Activer ma position
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Si le bouton ne fonctionne pas, vérifiez les paramètres de votre navigateur
            </p>
          </div>
        )}
        
        {currentLocation && isAvailable && (
          <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 p-3 rounded-xl">
            <Crosshair className="w-4 h-4" />
            <span>Position active - Vous recevrez les courses à proximité</span>
          </div>
        )}

        {/* MODE CHAUFFEUR - Keep app alive */}
        {isAvailable && (
          <div className={`rounded-xl p-4 ${driverModeActive ? 'bg-green-500/20 border-2 border-green-500' : 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50'}`}>
            {!driverModeActive ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-yellow-500 font-bold">
                  <Car className="w-5 h-5" />
                  <span className="text-lg">Mode Chauffeur</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Activez le Mode Chauffeur pour recevoir les courses même en arrière-plan :
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                  <li>✓ Écran reste allumé</li>
                  <li>✓ App active en arrière-plan</li>
                  <li>✓ Alarme sonore forte</li>
                  <li>✓ Vibrations</li>
                </ul>
                <Button 
                  size="lg" 
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold h-14 text-lg"
                  onClick={activateDriverMode}
                  data-testid="activate-driver-mode-btn"
                >
                  <Car className="w-6 h-6 mr-2" />
                  🚗 ACTIVER MODE CHAUFFEUR
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-500 font-bold">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-lg">Mode Chauffeur Actif</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => playNotificationSound(1)}
                    className="text-xs"
                  >
                    🔊 Tester
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    <span>Écran allumé</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    <span>Son actif</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    <span>Arrière-plan</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    <span>Vibrations</span>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10"
                  onClick={deactivateDriverMode}
                >
                  Désactiver le Mode Chauffeur
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ALARM ACTIVE - Big stop button */}
        {alarmActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-pulse">
            <div className="text-center p-8">
              <div className="text-6xl mb-4">🔔</div>
              <h2 className="text-3xl font-bold text-white mb-4">NOUVELLE COURSE!</h2>
              <p className="text-lg text-white/80 mb-6">Regardez les détails ci-dessus</p>
              <Button 
                size="lg"
                onClick={stopAlarm}
                className="bg-red-600 hover:bg-red-700 text-white text-xl px-8 py-6 h-auto"
              >
                🔕 ARRÊTER L'ALARME
              </Button>
            </div>
          </div>
        )}

        {/* Available Rides - PRIORITY: Show when online OR when there are rides */}
        {!activeRide && (isAvailable || availableRides.length > 0) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>Courses disponibles</h2>
              {availableRides.length > 0 && (
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                  {availableRides.length} course{availableRides.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            {!isAvailable && availableRides.length > 0 && (
              <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-3 text-amber-500 text-sm">
                ⚠️ Vous êtes hors ligne. Passez en ligne pour accepter ces courses.
              </div>
            )}
            
            {availableRides.length === 0 ? (
              <Card className="bg-card border-border/50">
                <CardContent className="p-6 text-center">
                  <Car className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Aucune course disponible</p>
                  <p className="text-xs text-muted-foreground mt-1">Restez en ligne pour recevoir des demandes</p>
                </CardContent>
              </Card>
            ) : (
              availableRides.map((ride) => (
                <Card key={ride.id} className={`bg-card ${ride.is_scheduled ? 'border-amber-500/50 hover:border-amber-500' : 'border-green-500/50 hover:border-green-500'} transition-colors shadow-[0_0_15px_${ride.is_scheduled ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}]`}>
                  <CardContent className="p-4 space-y-3">
                    {/* BUTTONS AT TOP - Always visible */}
                    <div className="flex gap-2 w-full">
                      <Button 
                        variant="outline"
                        onClick={() => dismissRide(ride.id)}
                        data-testid={`dismiss-ride-${ride.id}`}
                        className="flex-1 h-12 border-red-500/50 text-red-500 hover:bg-red-500/10 font-bold text-base"
                      >
                        <X className="w-5 h-5 mr-2" /> Refuser
                      </Button>
                      <Button 
                        onClick={() => acceptRide(ride.id)}
                        data-testid={`accept-ride-${ride.id}`}
                        className={`flex-1 h-12 ${ride.is_scheduled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold text-base`}
                      >
                        <Check className="w-5 h-5 mr-2" /> Accepter
                      </Button>
                    </div>
                    
                    {/* Scheduled ride badge */}
                    {ride.is_scheduled && ride.scheduled_time && (
                      <div className="flex items-center gap-2 bg-amber-500/20 text-amber-500 px-3 py-1.5 rounded-full w-fit text-sm font-medium">
                        <Clock className="w-4 h-4" />
                        <span>Réservée - {new Date(ride.scheduled_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                    
                    {/* Price and passenger info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 ${ride.is_scheduled ? 'bg-amber-500/20' : 'bg-green-500/20'} rounded-full flex items-center justify-center`}>
                          <User className={`w-4 h-4 ${ride.is_scheduled ? 'text-amber-500' : 'text-green-500'}`} />
                        </div>
                        <p className="font-semibold">{ride.passenger_name}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${ride.is_scheduled ? 'text-amber-500' : 'text-green-500'}`}>{ride.driver_earnings || (ride.estimated_fare * 0.82).toFixed(2)}€</p>
                        <p className="text-xs text-muted-foreground">Vos gains</p>
                      </div>
                    </div>
                    
                    {/* Addresses */}
                    <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <MapPin className={`w-4 h-4 ${ride.is_scheduled ? 'text-amber-500' : 'text-green-500'} mt-0.5 flex-shrink-0`} />
                        <p className="text-sm">{ride.pickup.address}</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <Navigation className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{ride.destination.address}</p>
                      </div>
                    </div>
                    
                    {/* Ride details */}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{ride.distance_km} km</span>
                      <span>•</span>
                      <span>{ride.vehicle_type === 'van' ? 'Van' : ride.vehicle_type === 'taxi' ? 'Taxi' : 'Standard'}</span>
                      <span>•</span>
                      <span>{ride.passenger_count || 1} passager{(ride.passenger_count || 1) > 1 ? 's' : ''}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Active Ride */}
        {activeRide && (
          <Card className="bg-card border-primary/50 shadow-[0_0_20px_rgba(250,204,21,0.1)]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg" style={{ fontFamily: 'Space Grotesk' }}>Course active</CardTitle>
                <span className={`text-sm font-medium ${getStatusColor(activeRide.status)}`}>
                  {activeRide.status === 'accepted' ? 'En route vers client' : 
                   activeRide.status === 'arrived' ? 'Arrivé - En attente' : 'En course'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* === BOUTONS D'ACTION EN PREMIER (visible sans scroll) === */}
              <div className="flex flex-col gap-3">
                {/* Status: accepted - show arrived button */}
                {activeRide.status === 'accepted' && (
                  <>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg font-bold"
                      onClick={async () => {
                        try {
                          await api.post(`/rides/${activeRide.id}/arrived`);
                          toast.success('Client notifié de votre arrivée!');
                          playNotificationSound(1);
                          fetchActiveRide();
                        } catch (error) {
                          toast.error('Erreur lors de la notification');
                        }
                      }}
                      data-testid="driver-arrived-btn"
                    >
                      <MapPin className="w-5 h-5 mr-2" /> Je suis arrivé
                    </Button>
                  </>
                )}
                
                {/* Status: arrived - client à bord, démarrer la course */}
                {activeRide.status === 'arrived' && (
                  <>
                    <div className="text-center py-2 bg-blue-500/20 rounded-lg text-blue-400 text-sm font-medium">
                      ✓ En attente du client
                    </div>
                    <Button 
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-14 text-lg font-bold"
                      onClick={startRide}
                      data-testid="start-ride-btn"
                    >
                      <Play className="w-5 h-5 mr-2" /> Démarrer la course
                    </Button>
                  </>
                )}
                
                {/* Status: in_progress - terminer la course */}
                {activeRide.status === 'in_progress' && (
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-14 text-lg font-bold"
                    onClick={completeRide}
                    data-testid="complete-ride-btn"
                  >
                    <Check className="w-5 h-5 mr-2" /> Terminer la course
                  </Button>
                )}
              </div>

              {/* Navigation Buttons - Waze & Google Maps (toujours visible en haut) */}
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 bg-[#33ccff]/10 border-[#33ccff]/30 hover:bg-[#33ccff]/20"
                  onClick={() => {
                    const dest = activeRide.status === 'accepted' ? activeRide.pickup : activeRide.destination;
                    const url = `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`;
                    window.open(url, '_blank');
                  }}
                  data-testid="open-waze-btn"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="#33ccff">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.54 3.04 8.37 7.2 9.57.14-.78.3-1.98-.06-2.83-.33-.77-2.09-4.89-2.09-4.89s-.53-1.06.37-1.06c.9 0 1.47 1.43 1.47 1.43s.78 1.34 1.83.89c1.05-.45.74-1.78.74-1.78s-.15-1.12.74-1.12c.89 0 1.04 1.12 1.04 1.12s.3 2.68 2.09 2.68c1.79 0 2.68-1.34 2.68-1.34s.89-1.49 1.64-.74c.74.74.15 1.64.15 1.64s-1.49 2.24-.15 3.58c1.34 1.34 3.13.45 3.13.45s1.79-1.04 1.79-2.83c0-1.79-1.04-3.28-1.04-3.28S22 13.54 22 12c0-5.52-4.48-10-10-10z"/>
                  </svg>
                  Waze
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 bg-[#4285f4]/10 border-[#4285f4]/30 hover:bg-[#4285f4]/20"
                  onClick={() => {
                    const dest = activeRide.status === 'accepted' ? activeRide.pickup : activeRide.destination;
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`;
                    window.open(url, '_blank');
                  }}
                  data-testid="open-gmaps-btn"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="#4285f4">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  Google Maps
                </Button>
              </div>

              {/* Prix et distance - résumé rapide */}
              <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{activeRide.distance_km} km</span>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">{activeRide.estimated_fare}€</p>
                  <p className="text-xs text-green-500">
                    Vos gains: {activeRide.driver_earnings || (activeRide.estimated_fare * 0.82).toFixed(2)}€
                  </p>
                </div>
              </div>

              {/* === INFOS DÉTAILLÉES (scrollables) === */}
              
              {/* Passager + contact */}
              <div className="flex items-center justify-between py-2 border-t border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{activeRide.passenger_name}</p>
                    <p className="text-sm text-muted-foreground">Passager</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full relative" 
                    data-testid="driver-chat-btn"
                    onClick={() => { setChatOpen(true); setUnreadMessages(0); }}
                  >
                    <MessageCircle className="w-5 h-5" />
                    {unreadMessages > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                        {unreadMessages}
                      </span>
                    )}
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-full" data-testid="call-passenger-btn">
                    <Phone className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Adresses */}
              <div className="space-y-2 py-2">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Départ</p>
                    <p className="text-sm truncate">{activeRide.pickup.address}</p>
                  </div>
                </div>
                
                {/* Intermediate Stops */}
                {activeRide.stops && activeRide.stops.length > 0 && (
                  <div className="pl-4 border-l-2 border-amber-500/30 ml-2 space-y-2">
                    {activeRide.stops.map((stop, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-500 mt-0.5 flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-amber-500">Arrêt {index + 1}</p>
                          <p className="text-sm text-amber-400 truncate">{stop.address}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  <Navigation className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Destination</p>
                    <p className="text-sm truncate">{activeRide.destination.address}</p>
                  </div>
                </div>
              </div>

              {/* Boutons secondaires */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowReceipt(true)}
                  data-testid="view-receipt-btn"
                >
                  <Receipt className="w-4 h-4 mr-2" /> Bon de réservation
                </Button>
                
                {/* Bouton Annuler (secondaire, en bas) */}
                {(activeRide.status === 'accepted' || activeRide.status === 'arrived') && (
                  <Button 
                    variant="outline" 
                    className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                    onClick={rejectRide}
                    data-testid="driver-reject-btn"
                  >
                    <X className="w-4 h-4 mr-1" /> Annuler
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Booking Receipt Modal */}
        <BookingReceipt
          ride={activeRide}
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
        />

        {/* Stats Cards - At the bottom */}
        {stats && (
          <div className="space-y-3">
            {/* Toggle earnings visibility */}
            <div className="flex justify-end">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  const newValue = !hideEarnings;
                  setHideEarnings(newValue);
                  localStorage.setItem('allogo_hide_earnings', newValue.toString());
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
                data-testid="toggle-earnings-btn"
              >
                {hideEarnings ? (
                  <><Eye className="w-4 h-4 mr-1" /> Afficher les gains</>
                ) : (
                  <><EyeOff className="w-4 h-4 mr-1" /> Masquer les gains</>
                )}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-card border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        {hideEarnings ? '••••' : stats.today_earnings.toFixed(2) + '€'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Aujourd'hui</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Car className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{stats.today_rides}</p>
                      <p className="text-[10px] text-muted-foreground">Courses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        {hideEarnings ? '••••' : stats.total_earnings.toFixed(2) + '€'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                      <Star className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{stats.rating.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground">Note</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Offline Message */}
        {!isAvailable && !activeRide && (
          <Card className="bg-card border-border/50">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                <Car className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Vous êtes hors ligne</h3>
              <p className="text-muted-foreground mb-4">Activez votre disponibilité pour recevoir des demandes de course</p>
              <Button 
                onClick={() => toggleAvailability(true)}
                data-testid="go-online-btn"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Passer en ligne
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chat Component */}
      <ChatComponent
        api={api}
        rideId={activeRide?.id}
        currentUserRole="driver"
        isOpen={chatOpen}
        onOpenChange={(open) => { setChatOpen(open); if (open) setUnreadMessages(0); }}
      />

      {/* Taxi Meter Price Modal */}
      {showMeterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <Card className="w-full max-w-sm mx-4 bg-card border-yellow-500/30">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center mb-3">
                <DollarSign className="w-8 h-8 text-yellow-500" />
              </div>
              <CardTitle className="text-xl">Prix du Compteur</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Entrez le montant affiché sur le compteur du taxi
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={meterPrice}
                  onChange={(e) => setMeterPrice(e.target.value)}
                  placeholder="Ex: 24.50"
                  className="h-14 text-2xl text-center font-bold pr-8"
                  data-testid="meter-price-input"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">€</span>
              </div>
              
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                <p className="font-medium text-yellow-500 mb-1">⚠️ Important</p>
                <p>Ce montant sera débité au client. Assurez-vous qu'il correspond exactement au compteur.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => { setShowMeterModal(false); setMeterPrice(''); }}
                >
                  Annuler
                </Button>
                <Button 
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                  onClick={submitMeterPrice}
                  data-testid="submit-meter-btn"
                >
                  Valider {meterPrice && `${parseFloat(meterPrice).toFixed(2)}€`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
