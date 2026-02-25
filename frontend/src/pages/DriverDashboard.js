import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import ChatComponent from '../components/ChatComponent';
import BookingReceipt from '../components/BookingReceipt';
import { 
  Car, MapPin, Navigation, Star, Clock, DollarSign,
  Menu, User, History, LogOut, Check, X, Play, Phone, Bell, Wifi, WifiOff, MessageCircle, FileText, Receipt, Crosshair, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const DriverDashboard = () => {
  const { user, logout, api, updateUser } = useAuth();
  const { permission, requestPermission, notifyNewRide, notifyRideAssigned, notifyNewMessage } = usePushNotifications();
  
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

  // Get current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: 'Position actuelle'
          };
          setCurrentLocation(location);
          
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
          setLocationError('Impossible d\'obtenir votre position');
          toast.error('Activez la géolocalisation pour recevoir des courses');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationError('Géolocalisation non supportée');
    }
  }, [api]);

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
        // Show notification for new ride
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Nouvelle course!</span>
            <span className="text-sm">{data.pickup?.address} → {data.destination?.address}</span>
            <span className="text-primary font-bold">{data.estimated_fare}€</span>
          </div>,
          { duration: 10000 }
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
        
      case 'ride_taken':
        // Remove ride from available list
        setAvailableRides(prev => prev.filter(r => r.id !== data.ride_id));
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

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      setTimeout(() => {
        oscillator.frequency.value = 1100;
      }, 150);
      setTimeout(() => {
        oscillator.stop();
      }, 300);
    } catch (e) {
      console.log('Audio not supported');
    }
  };

  // Send GPS location to server
  const sendLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          await api.put('/drivers/location', {
            lat: latitude,
            lng: longitude,
            address: 'Position actuelle'
          });
          console.log('Location sent:', latitude, longitude);
        } catch (error) {
          console.error('Error sending location:', error);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [api]);

  // Start/stop location tracking based on active ride
  useEffect(() => {
    let locationInterval;
    
    if (activeRide && (activeRide.status === 'accepted' || activeRide.status === 'in_progress')) {
      // Send location immediately and then every 5 seconds
      sendLocation();
      locationInterval = setInterval(sendLocation, 5000);
    }
    
    return () => {
      if (locationInterval) {
        clearInterval(locationInterval);
      }
    };
  }, [activeRide, sendLocation]);

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
    } catch (error) {
      console.error('Error fetching active ride:', error);
    }
  };

  const fetchAvailableRides = async () => {
    try {
      const response = await api.get('/rides/available');
      setAvailableRides(response.data);
    } catch (error) {
      console.error('Error fetching available rides:', error);
    }
  };

  const toggleAvailability = async (checked) => {
    try {
      const response = await api.put('/users/availability', { 
        is_available: checked,
        location: { lat: 48.8566, lng: 2.3522, address: 'Paris Centre' }
      });
      setIsAvailable(checked);
      updateUser(response.data);
      toast.success(checked ? 'Vous êtes maintenant disponible' : 'Vous êtes hors ligne');
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
    try {
      const response = await api.post(`/rides/${activeRide.id}/complete`);
      setActiveRide(null);
      fetchStats();
      toast.success('Course terminée! Paiement en attente.');
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
    } catch (error) {
      toast.error('Erreur lors de l\'annulation');
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
            <span className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>Volt Driver</span>
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
          <div className="flex items-center gap-2 text-sm text-orange-500 bg-orange-500/10 p-3 rounded-xl">
            <Crosshair className="w-4 h-4" />
            <span>{locationError} - Activez la géolocalisation pour recevoir des courses</span>
          </div>
        )}
        
        {currentLocation && isAvailable && (
          <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 p-3 rounded-xl">
            <Crosshair className="w-4 h-4" />
            <span>Position active - Vous recevrez les courses à proximité</span>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.today_earnings.toFixed(2)}€</p>
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
                    <p className="text-2xl font-bold">{stats.total_earnings.toFixed(2)}€</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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

              <div className="flex gap-3">
                {activeRide.status === 'accepted' && (
                  <>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={cancelRide}
                      data-testid="driver-cancel-btn"
                    >
                      <X className="w-4 h-4 mr-2" /> Annuler
                    </Button>
                    <Button 
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={startRide}
                      data-testid="start-ride-btn"
                    >
                      <Play className="w-4 h-4 mr-2" /> Démarrer
                    </Button>
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
            <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>Courses disponibles</h2>
            
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
                <Card key={ride.id} className="bg-card border-border/50 hover:border-primary/50 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{ride.passenger_name}</p>
                      <p className="text-xl font-bold text-primary">{ride.estimated_fare}€</p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-green-500 mt-0.5" />
                        <p className="text-sm">{ride.pickup.address}</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <Navigation className="w-4 h-4 text-primary mt-0.5" />
                        <p className="text-sm">{ride.destination.address}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-muted-foreground">{ride.distance_km} km</span>
                      <Button 
                        onClick={() => acceptRide(ride.id)}
                        data-testid={`accept-ride-${ride.id}`}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
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
    </div>
  );
};

export default DriverDashboard;
