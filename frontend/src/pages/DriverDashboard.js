import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import ChatComponent from '../components/ChatComponent';
import BookingReceipt from '../components/BookingReceipt';
import { 
  Car, MapPin, Navigation, Star, Clock, DollarSign,
  Menu, User, History, LogOut, Check, X, Play, Phone, Bell, Wifi, WifiOff, MessageCircle, FileText, Receipt, Crosshair, Loader2, Eye, EyeOff, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const DriverDashboard = () => {
  const { t } = useTranslation();
  const { user, logout, api, updateUser } = useAuth();
  const { permission, requestPermission, notifyNewRide, notifyRideAssigned, notifyNewMessage, initializeNative, addPushListener, isNative } = usePushNotifications();
  
  const [isAvailable, setIsAvailable] = useState(user?.is_available || false);
  const [availableRides, setAvailableRides] = useState([]);
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
  
  // Taxi meter price modal
  const [showMeterModal, setShowMeterModal] = useState(false);
  const [meterPrice, setMeterPrice] = useState('');

  // Audio context kept alive for notifications
  const audioContextRef = useRef(null);
  const audioElementRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Initialize audio system on first user interaction
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        setSoundEnabled(true);
        console.log('Audio context initialized for driver');
      } catch (e) {
        console.log('Audio context error:', e);
      }
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

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
        // Play notification sound
        playNotificationSound();
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
        // Play notification sound
        playNotificationSound();
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

  // Play notification sound - VERY aggressive for new rides
  const playNotificationSound = useCallback((repeat = 1) => {
    console.log('Playing notification sound, repeat:', repeat);
    
    const playWebAudio = () => {
      try {
        const ctx = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // MAXIMUM LOUDNESS urgent sound
        osc.frequency.value = 880;
        osc.type = 'square';
        gain.gain.value = 1.0; // MAX
        osc.start();
        
        // Urgent rising pattern
        setTimeout(() => { osc.frequency.value = 1047; }, 80);
        setTimeout(() => { osc.frequency.value = 1319; }, 160);
        setTimeout(() => { osc.frequency.value = 1568; }, 240);
        setTimeout(() => { osc.frequency.value = 1047; }, 320);
        setTimeout(() => { osc.frequency.value = 1319; }, 400);
        setTimeout(() => { osc.frequency.value = 1568; }, 480);
        setTimeout(() => { osc.stop(); }, 560);
      } catch (e) {
        console.log('Web Audio error:', e);
      }
    };

    // Play multiple times
    for (let i = 0; i < repeat; i++) {
      setTimeout(playWebAudio, i * 700);
    }
    
    // Strong vibration pattern
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);
    }
    
    // Browser notification with sound
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚗 NOUVELLE COURSE!', {
        body: 'Une nouvelle course est disponible!',
        icon: '/favicon.ico',
        requireInteraction: true,
        silent: false,
        tag: 'new-ride-' + Date.now()
      });
    }
  }, []);

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
      if (isAvailable && !activeRide) fetchAvailableRides();
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

  const fetchActiveRide = async () => {
    try {
      const response = await api.get('/rides/active');
      setActiveRide(response.data);
      
      // If there's an active ride, ensure driver is marked as unavailable
      if (response.data && (response.data.status === 'accepted' || response.data.status === 'in_progress')) {
        setIsAvailable(false);
      }
    } catch (error) {
      console.error('Error fetching active ride:', error);
    }
  };

  // Track previous rides count to detect new ones
  const [prevRidesCount, setPrevRidesCount] = useState(0);

  const fetchAvailableRides = async () => {
    try {
      const response = await api.get('/rides/available');
      const newRides = response.data || [];
      
      // Check if there are new rides
      if (newRides.length > prevRidesCount && prevRidesCount > 0) {
        // New ride detected - play sound!
        playNotificationSound(3);
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">🚗 Nouvelle course!</span>
            <span className="text-sm">{newRides[0]?.pickup?.address}</span>
            <span className="text-primary font-bold">{newRides[0]?.estimated_fare}€</span>
          </div>,
          { duration: 10000 }
        );
      } else if (newRides.length > 0 && prevRidesCount === 0) {
        // First ride when coming online
        playNotificationSound(2);
        toast.success(`${newRides.length} course(s) disponible(s)!`, { duration: 5000 });
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
    try {
      const response = await api.post(`/rides/${rideId}/accept`);
      setActiveRide(response.data);
      setAvailableRides([]);
      toast.success('Course acceptée!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'acceptation');
      fetchAvailableRides();
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
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>Allogo Driver</span>
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

        {/* Important warning for drivers */}
        {isAvailable && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-xs">
            <div className="flex items-center gap-2 text-yellow-500 font-medium mb-1">
              <Bell className="w-4 h-4" />
              <span>Important - Notifications</span>
            </div>
            <p className="text-muted-foreground">
              Pour recevoir les alertes de course, gardez cette page ouverte et votre écran allumé. 
              Les navigateurs ne peuvent pas sonner quand le téléphone est en veille.
            </p>
            {!soundEnabled && (
              <Button 
                size="sm" 
                className="w-full mt-2 bg-yellow-500 hover:bg-yellow-600 text-black"
                onClick={() => {
                  initAudio();
                  playNotificationSound(1);
                  toast.success('Son activé!');
                }}
              >
                <Bell className="w-3 h-3 mr-2" />
                Activer le son
              </Button>
            )}
          </div>
        )}

        {/* Stats Cards */}
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
            
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {hideEarnings ? '••••' : stats.today_earnings.toFixed(2) + '€'}
                      </p>
                      <p className="text-xs text-muted-foreground">Aujourd'hui</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Car className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.today_rides}</p>
                      <p className="text-xs text-muted-foreground">Courses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {hideEarnings ? '••••' : stats.total_earnings.toFixed(2) + '€'}
                      </p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <Star className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.rating.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Note</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Active Ride */}
        {activeRide && (
          <Card className="bg-card border-primary/50 shadow-[0_0_20px_rgba(250,204,21,0.1)]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg" style={{ fontFamily: 'Space Grotesk' }}>Course active</CardTitle>
                <span className={`text-sm font-medium ${getStatusColor(activeRide.status)}`}>
                  {activeRide.status === 'accepted' ? 'En route vers client' : 'En course'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
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
                  {/* Chat Button */}
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

              <div className="space-y-2 py-2">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Départ</p>
                    <p className="text-sm">{activeRide.pickup.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Navigation className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Destination</p>
                    <p className="text-sm">{activeRide.destination.address}</p>
                  </div>
                </div>
              </div>

              {/* Navigation Buttons - Waze & Google Maps */}
              <div className="flex gap-3 py-2">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 bg-[#33ccff]/10 border-[#33ccff]/30 hover:bg-[#33ccff]/20"
                  onClick={() => {
                    const destination = activeRide.status === 'accepted' ? activeRide.pickup : activeRide.destination;
                    const url = `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
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
                    const destination = activeRide.status === 'accepted' ? activeRide.pickup : activeRide.destination;
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;
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

              <div className="flex items-center justify-between py-2 border-t border-border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{activeRide.distance_km} km</span>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">{activeRide.estimated_fare}€</p>
                  <p className="text-xs text-green-500">
                    Vos gains: {activeRide.driver_earnings || (activeRide.estimated_fare * 0.82).toFixed(2)}€
                  </p>
                </div>
              </div>

              {/* Booking Receipt Button */}
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowReceipt(true)}
                data-testid="view-receipt-btn"
              >
                <Receipt className="w-4 h-4 mr-2" /> Voir le bon de réservation
              </Button>

              <div className="flex flex-col gap-3">
                {activeRide.status === 'accepted' && (
                  <>
                    {/* Arrived button - only show if not already arrived */}
                    {!activeRide.driver_arrived && (
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12"
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
                    )}
                    {activeRide.driver_arrived && (
                      <div className="text-center py-2 bg-blue-500/20 rounded-lg text-blue-400 text-sm">
                        ✓ Client notifié de votre arrivée
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
                        onClick={rejectRide}
                        data-testid="driver-reject-btn"
                      >
                        <X className="w-4 h-4 mr-2" /> Refuser
                      </Button>
                      <Button 
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={startRide}
                        data-testid="start-ride-btn"
                      >
                        <Play className="w-4 h-4 mr-2" /> Démarrer
                      </Button>
                    </div>
                  </>
                )}
                {activeRide.status === 'in_progress' && (
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={completeRide}
                    data-testid="complete-ride-btn"
                  >
                    <Check className="w-4 h-4 mr-2" /> Terminer la course
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

        {/* Available Rides */}
        {!activeRide && isAvailable && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>Courses disponibles</h2>
              {availableRides.length > 0 && (
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                  {availableRides.length} course{availableRides.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            {availableRides.length === 0 ? (
              <Card className="bg-card border-border/50">
                <CardContent className="p-8 text-center">
                  <Car className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucune course disponible pour le moment</p>
                  <p className="text-sm text-muted-foreground mt-1">Restez en ligne pour recevoir des demandes</p>
                </CardContent>
              </Card>
            ) : (
              availableRides.map((ride) => (
                <Card key={ride.id} className={`bg-card ${ride.is_scheduled ? 'border-amber-500/50 hover:border-amber-500' : 'border-green-500/50 hover:border-green-500'} transition-colors shadow-[0_0_15px_${ride.is_scheduled ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}]`}>
                  <CardContent className="p-4 space-y-3">
                    {/* Scheduled ride badge */}
                    {ride.is_scheduled && ride.scheduled_time && (
                      <div className="flex items-center gap-2 bg-amber-500/20 text-amber-500 px-3 py-1.5 rounded-full w-fit text-sm font-medium">
                        <Clock className="w-4 h-4" />
                        <span>Course réservée à l'avance - {new Date(ride.scheduled_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                    
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
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{ride.distance_km} km</span>
                        <span>•</span>
                        <span>{ride.vehicle_type === 'van' ? 'Van' : ride.vehicle_type === 'taxi' ? 'Taxi' : 'Standard'}</span>
                        <span>•</span>
                        <span>{ride.passenger_count || 1} passager{(ride.passenger_count || 1) > 1 ? 's' : ''}</span>
                      </div>
                      <Button 
                        onClick={() => acceptRide(ride.id)}
                        data-testid={`accept-ride-${ride.id}`}
                        className={`${ride.is_scheduled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold`}
                      >
                        <Check className="w-4 h-4 mr-2" /> Accepter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
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
