import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import MapComponent from '../components/MapComponent';
import AddressAutocomplete from '../components/AddressAutocomplete';
import ChatComponent from '../components/ChatComponent';
import RatingModal from '../components/RatingModal';
import PaymentMethodSelector from '../components/PaymentMethodSelector';
import { 
  Car, MapPin, Navigation, Star, Clock, CreditCard, 
  Menu, User, History, LogOut, Phone, X, Route, MessageCircle,
  Calendar, Gift, Users, Truck, Bookmark, Plus, Trash2, Zap, Bell, Crosshair, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const PassengerDashboard = () => {
  const { user, logout, api } = useAuth();
  const navigate = useNavigate();
  const { permission, requestPermission, notifyDriverAccepted, notifyDriverArrived, notifyRideCompleted, notifyNewMessage } = usePushNotifications();
  
  const [step, setStep] = useState('idle'); // idle, booking, searching, ride_active
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activeRide, setActiveRide] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [driverPath, setDriverPath] = useState([]);
  const [frequentTrips, setFrequentTrips] = useState([]);
  const [showSaveTrip, setShowSaveTrip] = useState(false);
  const [tripName, setTripName] = useState('');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [completedRideForRating, setCompletedRideForRating] = useState(null);
  const [isLocating, setIsLocating] = useState(true);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  
  const [pickup, setPickup] = useState({ lat: 48.8566, lng: 2.3522, address: '' });
  const [destination, setDestination] = useState({ lat: 48.8738, lng: 2.2950, address: '' });
  const [passengers, setPassengers] = useState(1);
  const [vehicleType, setVehicleType] = useState('standard');

  // Sound functions for passenger notifications
  const playAcceptedSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Happy ascending sound
      oscillator.frequency.value = 523;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.4;
      oscillator.start();
      setTimeout(() => { oscillator.frequency.value = 659; }, 150);
      setTimeout(() => { oscillator.frequency.value = 784; }, 300);
      setTimeout(() => { oscillator.stop(); audioContext.close(); }, 450);
    } catch (e) {}
    
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }, []);

  const playArrivedSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // More urgent sound - driver is waiting
      oscillator.frequency.value = 880;
      oscillator.type = 'square';
      gainNode.gain.value = 0.5;
      oscillator.start();
      setTimeout(() => { oscillator.frequency.value = 1100; }, 100);
      setTimeout(() => { oscillator.frequency.value = 880; }, 200);
      setTimeout(() => { oscillator.frequency.value = 1100; }, 300);
      setTimeout(() => { oscillator.frequency.value = 1320; }, 400);
      setTimeout(() => { oscillator.stop(); audioContext.close(); }, 500);
    } catch (e) {}
    
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
  }, []);

  // Get user's current location on mount with permission check
  useEffect(() => {
    const checkPermissionAndGetLocation = async () => {
      // Check permission status first if API is available
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          
          if (permissionStatus.state === 'denied') {
            setIsLocating(false);
            toast.error(
              'Géolocalisation refusée. Pour une meilleure expérience, activez-la dans les paramètres de votre navigateur.',
              { duration: 6000 }
            );
            return;
          }
          
          // Listen for permission changes
          permissionStatus.onchange = () => {
            if (permissionStatus.state === 'granted') {
              getLocation();
            }
          };
        } catch (e) {
          // Permission API not fully supported, continue with geolocation
        }
      }
      
      getLocation();
    };

    const getLocation = () => {
      if (!navigator.geolocation) {
        setIsLocating(false);
        toast.error('Votre navigateur ne supporte pas la géolocalisation');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode to get address
          try {
            const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&language=fr`
            );
            const data = await response.json();
            const address = data.features?.[0]?.place_name || 'Position actuelle';
            
            setPickup({
              lat: latitude,
              lng: longitude,
              address: address
            });
            toast.success('Position détectée automatiquement', { duration: 2000 });
          } catch (error) {
            setPickup({
              lat: latitude,
              lng: longitude,
              address: 'Position actuelle'
            });
          }
          setIsLocating(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsLocating(false);
          if (error.code === error.PERMISSION_DENIED) {
            toast.error(
              'Géolocalisation désactivée. Activez-la dans les paramètres de votre navigateur pour une meilleure expérience.',
              { duration: 5000 }
            );
          } else if (error.code === error.TIMEOUT) {
            toast.info('Délai de géolocalisation dépassé. Entrez votre adresse manuellement.', { duration: 3000 });
          } else {
            toast.info('Entrez votre adresse de départ', { duration: 3000 });
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    };

    checkPermissionAndGetLocation();
  }, []);

  // Submit rating and reset page after
  const submitRating = async (ratingData) => {
    await api.post('/ratings', ratingData);
    // Reset page state for new booking
    resetBookingState();
  };

  // Reset page to initial booking state
  const resetBookingState = useCallback(() => {
    setActiveRide(null);
    setStep('idle');
    setEstimate(null);
    setDriverLocation(null);
    setDriverPath([]);
    setDestination({ lat: 48.8738, lng: 2.2950, address: '' });
    setShowRatingModal(false);
    setCompletedRideForRating(null);
    setChatOpen(false);
    setUnreadMessages(0);
    toast.success('Prêt pour une nouvelle course!', { duration: 2000 });
  }, []);

  // Fetch available drivers for map display
  const fetchAvailableDrivers = useCallback(async () => {
    // Don't fetch if we have an active ride (driver assigned)
    if (activeRide) return;
    
    try {
      const response = await api.get('/drivers/available');
      setAvailableDrivers(response.data || []);
    } catch (error) {
      console.error('Error fetching available drivers:', error);
    }
  }, [api, activeRide]);

  // Poll available drivers every 10 seconds
  useEffect(() => {
    fetchAvailableDrivers();
    const interval = setInterval(fetchAvailableDrivers, 10000);
    return () => clearInterval(interval);
  }, [fetchAvailableDrivers]);

  // Fetch frequent trips
  const fetchFrequentTrips = useCallback(async () => {
    try {
      const response = await api.get('/frequent-trips');
      setFrequentTrips(response.data);
    } catch (error) {
      console.error('Error fetching frequent trips:', error);
    }
  }, [api]);

  useEffect(() => {
    fetchFrequentTrips();
  }, [fetchFrequentTrips]);

  // Load a frequent trip
  const loadFrequentTrip = async (trip) => {
    setPickup(trip.pickup);
    setDestination(trip.destination);
    setVehicleType(trip.vehicle_type);
    setPassengers(trip.passenger_count);
    
    // Increment use count
    try {
      await api.post(`/frequent-trips/${trip.id}/use`);
      fetchFrequentTrips();
    } catch (error) {
      console.error('Error updating trip use count:', error);
    }
    
    toast.success(`Trajet "${trip.name}" chargé !`);
  };

  // Save current trip as frequent
  const saveFrequentTrip = async () => {
    if (!tripName.trim()) {
      toast.error('Veuillez entrer un nom pour ce trajet');
      return;
    }
    if (!pickup.address || !destination.address) {
      toast.error('Veuillez remplir les adresses');
      return;
    }
    
    try {
      await api.post('/frequent-trips', {
        name: tripName,
        pickup,
        destination,
        vehicle_type: vehicleType,
        passenger_count: passengers
      });
      toast.success('Trajet enregistré !');
      setShowSaveTrip(false);
      setTripName('');
      fetchFrequentTrips();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  // Delete a frequent trip
  const deleteFrequentTrip = async (tripId, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/frequent-trips/${tripId}`);
      toast.success('Trajet supprimé');
      fetchFrequentTrips();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  // Handle route calculation callback
  const handleRouteCalculated = useCallback((info) => {
    setRouteInfo(info);
  }, []);

  // Fetch driver location for active ride
  const fetchDriverLocation = useCallback(async () => {
    if (!activeRide?.id || !activeRide?.driver_id) return;
    
    try {
      // Fetch both location and path
      const [locationRes, pathRes] = await Promise.all([
        api.get(`/rides/${activeRide.id}/driver-location`),
        api.get(`/rides/${activeRide.id}/driver-path`)
      ]);
      
      if (locationRes.data.location) {
        setDriverLocation(locationRes.data.location);
      }
      
      if (pathRes.data.path && pathRes.data.path.length > 0) {
        setDriverPath(pathRes.data.path);
      }
    } catch (error) {
      console.error('Error fetching driver location:', error);
    }
  }, [activeRide?.id, activeRide?.driver_id, api]);

  // Notification handler for real-time updates
  const handleNotification = useCallback((data) => {
    console.log('Passenger notification:', data);
    
    switch (data.type) {
      case 'ride_accepted':
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Chauffeur trouvé!</span>
            <span className="text-sm">{data.driver_name} arrive dans {data.eta_minutes || '~5'} min</span>
          </div>,
          { duration: 5000 }
        );
        // Push notification
        notifyDriverAccepted(data.driver_name, data.eta_minutes || 5);
        // Play sound for ride accepted
        playAcceptedSound();
        setStep('ride_active');
        fetchActiveRide();
        break;
      
      case 'driver_arrived':
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Votre chauffeur est arrivé!</span>
            <span className="text-sm">{data.driver_name} vous attend</span>
          </div>,
          { duration: 8000 }
        );
        // Push notification
        notifyDriverArrived(data.driver_name);
        // Play urgent sound for driver arrived
        playArrivedSound();
        fetchActiveRide();
        break;
        
      case 'ride_started':
        toast.success('La course a démarré!', { duration: 3000 });
        fetchActiveRide();
        break;
        
      case 'ride_completed':
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Course terminée!</span>
            <span className="text-sm">Montant: {data.final_fare}€</span>
          </div>,
          { duration: 5000 }
        );
        // Push notification
        notifyRideCompleted(data.final_fare);
        // Show rating modal after a short delay
        setTimeout(() => {
          setCompletedRideForRating({
            id: data.ride_id,
            driver_name: data.driver_name,
            final_fare: data.final_fare
          });
          setShowRatingModal(true);
        }, 1500);
        fetchActiveRide();
        setDriverLocation(null);
        break;
      
      case 'driver_location':
        // Real-time driver location update
        if (data.location) {
          setDriverLocation(data.location);
        }
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
        }
        break;
        
      default:
        break;
    }
  }, [notifyDriverAccepted, notifyDriverArrived, notifyRideCompleted, notifyNewMessage, chatOpen, playAcceptedSound, playArrivedSound, resetBookingState]);

  // Connect to notification polling
  useNotifications(api, 'passenger', handleNotification);

  // Poll driver location when ride is active
  useEffect(() => {
    let locationInterval;
    
    if (activeRide && activeRide.driver_id && 
        (activeRide.status === 'accepted' || activeRide.status === 'in_progress')) {
      fetchDriverLocation();
      locationInterval = setInterval(fetchDriverLocation, 5000);
    } else {
      setDriverLocation(null);
      setDriverPath([]);
    }
    
    return () => {
      if (locationInterval) clearInterval(locationInterval);
    };
  }, [activeRide, fetchDriverLocation]);

  useEffect(() => {
    fetchActiveRide();
    const interval = setInterval(fetchActiveRide, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveRide = async () => {
    try {
      const response = await api.get('/rides/active');
      if (response.data) {
        setActiveRide(response.data);
        setStep('ride_active');
      } else {
        setActiveRide(null);
        if (step === 'ride_active') setStep('idle');
      }
    } catch (error) {
      console.error('Error fetching active ride:', error);
    }
  };

  const getEstimate = async () => {
    if (!pickup.address || !destination.address) {
      toast.error('Veuillez remplir les adresses');
      return;
    }
    
    // Validate passengers for vehicle type
    if (vehicleType === 'standard' && passengers > 4) {
      toast.error('Maximum 4 passagers pour un véhicule standard. Choisissez un Van.');
      return;
    }
    if (vehicleType === 'van' && passengers > 7) {
      toast.error('Maximum 7 passagers pour un Van.');
      return;
    }
    
    try {
      const response = await api.post('/rides/estimate', { 
        pickup, 
        destination,
        vehicle_type: vehicleType,
        passenger_count: passengers
      });
      setEstimate(response.data);
      setStep('booking');
    } catch (error) {
      toast.error('Erreur lors de l\'estimation');
    }
  };

  const createRide = async () => {
    try {
      const response = await api.post('/rides', { 
        pickup, 
        destination,
        vehicle_type: vehicleType,
        passenger_count: passengers
      });
      setActiveRide(response.data);
      setStep('searching');
      toast.success('Recherche d\'un chauffeur...');
      
      // Start polling for driver acceptance
      const checkInterval = setInterval(async () => {
        const check = await api.get(`/rides/${response.data.id}`);
        if (check.data.status === 'accepted') {
          clearInterval(checkInterval);
          setActiveRide(check.data);
          setStep('ride_active');
          toast.success('Chauffeur trouvé!');
        }
      }, 3000);
      
      // Clear after 2 minutes if no driver found
      setTimeout(() => clearInterval(checkInterval), 120000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la réservation');
    }
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/cancel`);
      setActiveRide(null);
      setStep('idle');
      setEstimate(null);
      toast.success('Course annulée');
    } catch (error) {
      toast.error('Erreur lors de l\'annulation');
    }
  };

  const handlePayment = async () => {
    if (!activeRide) return;
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
    toast.success('Paiement effectué avec succès !');
    setShowPaymentModal(false);
    // Refresh ride data
    fetchActiveRide();
  };

  const handlePaymentCancel = () => {
    setShowPaymentModal(false);
  };

  const handlePaymentError = (errorMsg) => {
    toast.error(errorMsg || 'Erreur de paiement');
  };

  const rateDriver = async (rating) => {
    if (!activeRide) return;
    try {
      await api.post('/ratings', { ride_id: activeRide.id, rating });
      toast.success('Merci pour votre évaluation!');
      setActiveRide(null);
      setStep('idle');
    } catch (error) {
      toast.error('Erreur lors de l\'évaluation');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'text-yellow-500';
      case 'accepted': return 'text-blue-500';
      case 'in_progress': return 'text-green-500';
      case 'completed': return 'text-primary';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'pending': return 'Recherche d\'un chauffeur...';
      case 'accepted': return 'Chauffeur en route';
      case 'in_progress': return 'Course en cours';
      case 'completed': return 'Course terminée';
      default: return status;
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
            <span className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>Allogo</span>
          </div>
          
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="menu-btn" className="rounded-full">
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
                {permission !== 'granted' && (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start h-12 border-primary/50 text-primary"
                    onClick={requestPermission}
                    data-testid="enable-notifications"
                  >
                    <Bell className="w-5 h-5 mr-3" /> Activer les notifications
                  </Button>
                )}
                <Link to="/profile" onClick={() => setMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start h-12" data-testid="nav-profile">
                    <User className="w-5 h-5 mr-3" /> Mon profil
                  </Button>
                </Link>
                <Link to="/scheduled" onClick={() => setMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start h-12" data-testid="nav-scheduled">
                    <Calendar className="w-5 h-5 mr-3" /> Courses planifiées
                  </Button>
                </Link>
                <Link to="/history" onClick={() => setMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start h-12" data-testid="nav-history">
                    <History className="w-5 h-5 mr-3" /> Historique
                  </Button>
                </Link>
                <Link to="/payments" onClick={() => setMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start h-12" data-testid="nav-payments">
                    <Gift className="w-5 h-5 mr-3" /> Paiements & Promos
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start h-12 text-destructive hover:text-destructive"
                  onClick={logout}
                  data-testid="nav-logout"
                >
                  <LogOut className="w-5 h-5 mr-3" /> Déconnexion
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Map Area */}
      <div className="h-screen pt-20">
        <MapComponent 
          pickupLocation={activeRide ? activeRide.pickup : (pickup.address ? pickup : null)}
          destinationLocation={activeRide ? activeRide.destination : (destination.address ? destination : null)}
          driverLocation={driverLocation}
          driverPath={driverPath}
          availableDrivers={!activeRide ? availableDrivers : []}
          onRouteCalculated={handleRouteCalculated}
          className="absolute inset-0"
        />
        
        {/* Driver Location Badge - Show when tracking driver */}
        {driverLocation && activeRide && (
          <div className="absolute top-24 left-4 z-30">
            <div className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse">
                <Car className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {activeRide.status === 'accepted' ? 'Chauffeur en route' : 'Course en cours'}
                </p>
                <p className="font-semibold text-blue-400">
                  {activeRide.driver_eta_minutes && activeRide.status === 'accepted' 
                    ? `Arrivée dans ~${activeRide.driver_eta_minutes} min`
                    : 'Position en temps réel'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Auto-assigned driver badge - Show immediately after booking */}
        {activeRide && activeRide.status === 'accepted' && !driverLocation && (
          <div className="absolute top-24 left-4 right-4 z-30">
            <div className="glass rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                  <Car className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chauffeur attribué</p>
                  <p className="font-semibold text-green-400">{activeRide.driver_name}</p>
                </div>
              </div>
              {activeRide.driver_eta_minutes && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Arrivée estimée</p>
                  <p className="font-semibold text-primary">{activeRide.driver_eta_minutes} min</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Route Info Badge */}
        {routeInfo && pickup.address && destination.address && step === 'idle' && !activeRide && (
          <div className="absolute top-24 left-4 right-4 z-30">
            <div className="glass rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <Route className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Itinéraire</p>
                  <p className="font-semibold">{routeInfo.distance} km</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Temps estimé</p>
                <p className="font-semibold text-primary">{routeInfo.duration} min</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className="fixed bottom-0 left-0 right-0 mobile-drawer glass p-6 z-40">
        {step === 'idle' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>Où allez-vous?</h2>
            
            <div className="space-y-3">
              {/* Location indicator */}
              {isLocating && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Détection de votre position...</span>
                </div>
              )}
              
              <div className="relative">
                <AddressAutocomplete
                  value={pickup}
                  onChange={setPickup}
                  placeholder="Point de départ"
                  icon={MapPin}
                  iconColor="text-green-500"
                  dataTestId="input-pickup"
                />
                {/* Relocate button */}
                <button
                  onClick={() => {
                    if (navigator.geolocation) {
                      setIsLocating(true);
                      navigator.geolocation.getCurrentPosition(
                        async (position) => {
                          const { latitude, longitude } = position.coords;
                          try {
                            const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
                            const response = await fetch(
                              `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&language=fr`
                            );
                            const data = await response.json();
                            const address = data.features?.[0]?.place_name || 'Position actuelle';
                            setPickup({ lat: latitude, lng: longitude, address });
                            toast.success('Position mise à jour');
                          } catch (error) {
                            setPickup({ lat: latitude, lng: longitude, address: 'Position actuelle' });
                          }
                          setIsLocating(false);
                        },
                        () => {
                          toast.error('Impossible d\'obtenir votre position');
                          setIsLocating(false);
                        },
                        { enableHighAccuracy: true }
                      );
                    }
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-muted hover:bg-primary/20 rounded-full flex items-center justify-center transition-colors"
                  title="Me localiser"
                  data-testid="relocate-btn"
                >
                  <Crosshair className="w-4 h-4 text-primary" />
                </button>
              </div>
              
              <AddressAutocomplete
                value={destination}
                onChange={setDestination}
                placeholder="Destination"
                icon={Navigation}
                iconColor="text-primary"
                dataTestId="input-destination"
              />
            </div>

            {/* Vehicle Type & Passengers Selection */}
            <div className="grid grid-cols-2 gap-3">
              {/* Vehicle Type */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Car className="w-4 h-4" /> Type de véhicule
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setVehicleType('standard');
                      if (passengers > 4) setPassengers(4);
                    }}
                    data-testid="vehicle-standard"
                    className={`flex-1 py-3 px-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                      vehicleType === 'standard' 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-white/10 bg-muted/50 hover:border-white/20'
                    }`}
                  >
                    <Car className="w-5 h-5" />
                    <span className="text-xs font-medium">Standard</span>
                    <span className="text-[10px] text-muted-foreground">1-4 places</span>
                  </button>
                  <button
                    onClick={() => setVehicleType('van')}
                    data-testid="vehicle-van"
                    className={`flex-1 py-3 px-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                      vehicleType === 'van' 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-white/10 bg-muted/50 hover:border-white/20'
                    }`}
                  >
                    <Truck className="w-5 h-5" />
                    <span className="text-xs font-medium">Van</span>
                    <span className="text-[10px] text-muted-foreground">1-7 places</span>
                  </button>
                </div>
              </div>

              {/* Passengers Count */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" /> Passagers
                </label>
                <div className="flex items-center justify-center gap-3 h-[76px] bg-muted/50 rounded-xl border border-white/10">
                  <button
                    onClick={() => setPassengers(Math.max(1, passengers - 1))}
                    data-testid="passengers-minus"
                    disabled={passengers <= 1}
                    className="w-10 h-10 rounded-full bg-background border border-white/10 flex items-center justify-center text-xl font-bold disabled:opacity-30 hover:border-primary transition-colors"
                  >
                    -
                  </button>
                  <span className="text-2xl font-bold w-8 text-center" data-testid="passengers-count">{passengers}</span>
                  <button
                    onClick={() => setPassengers(Math.min(vehicleType === 'van' ? 7 : 4, passengers + 1))}
                    data-testid="passengers-plus"
                    disabled={passengers >= (vehicleType === 'van' ? 7 : 4)}
                    className="w-10 h-10 rounded-full bg-background border border-white/10 flex items-center justify-center text-xl font-bold disabled:opacity-30 hover:border-primary transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Info about extra passenger fee */}
            {passengers > 4 && (
              <div className="text-xs text-yellow-500 bg-yellow-500/10 rounded-lg px-3 py-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Supplément de 4€ par passager au-delà de 4</span>
              </div>
            )}

            {/* Frequent Trips Section */}
            {frequentTrips.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" /> Trajets fréquents
                  </p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
                  {frequentTrips.slice(0, 4).map((trip) => (
                    <div
                      key={trip.id}
                      onClick={() => loadFrequentTrip(trip)}
                      className="flex-shrink-0 bg-muted/50 hover:bg-muted border border-white/10 hover:border-primary/50 rounded-xl px-3 py-2 text-left transition-all group relative cursor-pointer"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => deleteFrequentTrip(trip.id, e)}
                        onKeyDown={(e) => e.key === 'Enter' && deleteFrequentTrip(trip.id, e)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <X className="w-3 h-3 text-white" />
                      </div>
                      <p className="text-sm font-medium truncate max-w-[140px]">{trip.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {trip.vehicle_type === 'van' ? <Truck className="w-3 h-3" /> : <Car className="w-3 h-3" />}
                        <span>{trip.passenger_count}p</span>
                        {trip.use_count > 0 && <span className="text-primary">• {trip.use_count}×</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save Trip / Estimate Buttons */}
            <div className="flex gap-2">
              {pickup.address && destination.address && (
                <Button 
                  variant="outline"
                  onClick={() => setShowSaveTrip(!showSaveTrip)}
                  data-testid="save-trip-btn"
                  className="h-14 px-4 rounded-full"
                >
                  <Bookmark className="w-5 h-5" />
                </Button>
              )}
              <Button 
                onClick={getEstimate}
                data-testid="estimate-btn"
                className="flex-1 h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold text-lg"
              >
                Estimer le prix
              </Button>
            </div>

            {/* Save Trip Form */}
            {showSaveTrip && (
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 animate-fade-in border border-white/10">
                <p className="text-sm font-medium">Enregistrer ce trajet</p>
                <input
                  type="text"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="Ex: Maison → Travail"
                  className="w-full px-4 py-3 bg-background border border-white/10 rounded-xl text-sm focus:border-primary outline-none"
                  data-testid="trip-name-input"
                />
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => { setShowSaveTrip(false); setTripName(''); }}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button 
                    onClick={saveFrequentTrip}
                    data-testid="confirm-save-trip"
                    className="flex-1 bg-primary text-primary-foreground"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Enregistrer
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'booking' && estimate && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>Estimation</h2>
              <Button variant="ghost" size="icon" onClick={() => { setStep('idle'); setEstimate(null); }}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <Card className="bg-muted/50 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      {vehicleType === 'van' ? <Truck className="w-5 h-5 text-primary" /> : <Car className="w-5 h-5 text-primary" />}
                    </div>
                    <div>
                      <p className="font-semibold">Allogo {vehicleType === 'van' ? 'Van' : 'Chauffeur'}</p>
                      <p className="text-sm text-muted-foreground">
                        {routeInfo?.distance || estimate.distance_km} km • {estimate.duration_minutes || routeInfo?.duration} min • {passengers} passager{passengers > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-primary">{estimate.estimated_fare}€</p>
                </div>
                
                {/* Fare breakdown */}
                {estimate.fare_details && (
                  <div className="space-y-2 pt-3 border-t border-white/10 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Prise en charge</span>
                      <span>{estimate.fare_details.prise_en_charge}€</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Distance ({estimate.distance_km} km)</span>
                      <span>{estimate.fare_details.distance_cost}€</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Temps ({estimate.duration_minutes} min)</span>
                      <span>{estimate.fare_details.time_cost}€</span>
                    </div>
                    {estimate.fare_details.supplement_details?.map((sup, idx) => (
                      <div key={idx} className="flex justify-between text-yellow-500">
                        <span>{sup.name}</span>
                        <span>+{sup.amount}€</span>
                      </div>
                    ))}
                    {estimate.fare_details.minimum_applied && (
                      <div className="flex justify-between text-yellow-500 text-xs">
                        <span>Tarif minimum appliqué</span>
                        <span>8,00€</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Button 
              onClick={createRide}
              data-testid="book-ride-btn"
              className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold text-lg pulse-glow"
            >
              Réserver maintenant (+4€ immédiat)
            </Button>
          </div>
        )}

        {step === 'searching' && (
          <div className="space-y-4 animate-fade-in text-center py-4">
            <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>Recherche en cours...</h2>
            <p className="text-muted-foreground">Nous cherchons un chauffeur près de vous</p>
            <Button 
              variant="outline"
              onClick={cancelRide}
              data-testid="cancel-search-btn"
              className="mt-4"
            >
              Annuler
            </Button>
          </div>
        )}

        {step === 'ride_active' && activeRide && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${getStatusColor(activeRide.status)}`}>
                  {getStatusText(activeRide.status)}
                </p>
                <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>
                  {activeRide.status === 'completed' ? 'Course terminée!' : 'Votre course'}
                </h2>
              </div>
              {activeRide.status !== 'completed' && (
                <Button variant="outline" size="sm" onClick={cancelRide} data-testid="cancel-ride-btn">
                  <X className="w-4 h-4 mr-1" /> Annuler
                </Button>
              )}
            </div>

            {activeRide.driver_name && (
              <Card className="bg-muted/50 border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{activeRide.driver_name}</p>
                        <p className="text-sm text-muted-foreground">Votre chauffeur</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Chat Button */}
                      {(activeRide.status === 'accepted' || activeRide.status === 'in_progress') && (
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="rounded-full relative" 
                          data-testid="chat-btn"
                          onClick={() => { setChatOpen(true); setUnreadMessages(0); }}
                        >
                          <MessageCircle className="w-5 h-5" />
                          {unreadMessages > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                              {unreadMessages}
                            </span>
                          )}
                        </Button>
                      )}
                      <Button variant="outline" size="icon" className="rounded-full" data-testid="call-driver-btn">
                        <Phone className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{activeRide.distance_km} km</span>
              </div>
              <p className="text-xl font-bold text-primary">
                {activeRide.final_fare || activeRide.estimated_fare}€
              </p>
            </div>

            {activeRide.status === 'completed' && activeRide.payment_status !== 'paid' && (
              <Button 
                onClick={handlePayment}
                disabled={loadingPayment}
                data-testid="pay-btn"
                className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold text-lg"
              >
                {loadingPayment ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Chargement...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" /> Payer {activeRide.final_fare || activeRide.estimated_fare}€
                  </>
                )}
              </Button>
            )}

            {activeRide.status === 'completed' && activeRide.payment_status === 'paid' && (
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    setCompletedRideForRating(activeRide);
                    setShowRatingModal(true);
                  }}
                  data-testid="open-rating-btn"
                  className="w-full h-14 bg-primary/10 text-primary hover:bg-primary/20 rounded-full font-bold"
                >
                  <Star className="w-5 h-5 mr-2" /> Évaluer votre chauffeur
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rating Modal */}
      <RatingModal
        ride={completedRideForRating}
        isOpen={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          setCompletedRideForRating(null);
          // Reset for new booking after closing rating modal
          resetBookingState();
        }}
        onSubmit={submitRating}
      />

      {/* Chat Component */}
      <ChatComponent
        api={api}
        rideId={activeRide?.id}
        currentUserRole="passenger"
        isOpen={chatOpen}
        onOpenChange={(open) => { setChatOpen(open); if (open) setUnreadMessages(0); }}
      />

      {/* Payment Modal */}
      {showPaymentModal && activeRide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md animate-scale-in">
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-2 -right-2 z-10 bg-card rounded-full"
              onClick={handlePaymentCancel}
            >
              <X className="w-5 h-5" />
            </Button>
            <PaymentMethodSelector
              api={api}
              rideId={activeRide.id}
              amount={activeRide.final_fare || activeRide.estimated_fare}
              rideName={`${activeRide.pickup?.address} → ${activeRide.destination?.address}`}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
              onError={handlePaymentError}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PassengerDashboard;
