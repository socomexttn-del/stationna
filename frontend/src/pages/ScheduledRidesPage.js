import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar } from '../components/ui/calendar';
import { 
  ArrowLeft, Clock, MapPin, Navigation, Calendar as CalendarIcon, 
  Star, Home, Briefcase, Heart, Plus, Trash2, Car, Edit2, X,
  AlertCircle, CheckCircle, Timer, Route, Users, Truck, Bell, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import AddressAutocomplete from '../components/AddressAutocomplete';

const ScheduledRidesPage = () => {
  const { api } = useAuth();
  const [scheduledRides, setScheduledRides] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showFavoriteForm, setShowFavoriteForm] = useState(false);
  const [editingRide, setEditingRide] = useState(null);
  
  // Schedule form state
  const [pickup, setPickup] = useState({ lat: 0, lng: 0, address: '' });
  const [destination, setDestination] = useState({ lat: 0, lng: 0, address: '' });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [vehicleType, setVehicleType] = useState('standard');
  const [passengerCount, setPassengerCount] = useState(1);
  
  // Favorite form state
  const [favoriteName, setFavoriteName] = useState('');
  const [favoriteLocation, setFavoriteLocation] = useState({ lat: 0, lng: 0, address: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ridesRes, favoritesRes] = await Promise.all([
        api.get('/rides/scheduled'),
        api.get('/favorites')
      ]);
      setScheduledRides(ridesRes.data);
      setFavorites(favoritesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const scheduleRide = async () => {
    if (!pickup.address || !destination.address) {
      toast.error('Veuillez remplir les adresses');
      return;
    }
    
    // Combine date and time
    const scheduledDateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(':');
    scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    if (scheduledDateTime <= new Date()) {
      toast.error('La date doit être dans le futur');
      return;
    }
    
    try {
      await api.post('/rides/schedule', {
        pickup,
        destination,
        scheduled_time: scheduledDateTime.toISOString(),
        vehicle_type: vehicleType,
        passenger_count: passengerCount
      });
      toast.success('Course planifiée avec succès!');
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la planification');
    }
  };

  const updateScheduledRide = async () => {
    if (!editingRide) return;
    
    const scheduledDateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(':');
    scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    if (scheduledDateTime <= new Date()) {
      toast.error('La date doit être dans le futur');
      return;
    }
    
    try {
      await api.put(`/rides/${editingRide.id}/reschedule`, {
        scheduled_time: scheduledDateTime.toISOString(),
        pickup: pickup.address ? pickup : undefined,
        destination: destination.address ? destination : undefined,
        vehicle_type: vehicleType,
        passenger_count: passengerCount
      });
      toast.success('Course modifiée!');
      setEditingRide(null);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification');
    }
  };

  const resetForm = () => {
    setShowScheduleForm(false);
    setEditingRide(null);
    setPickup({ lat: 0, lng: 0, address: '' });
    setDestination({ lat: 0, lng: 0, address: '' });
    setSelectedDate(new Date());
    setSelectedTime('09:00');
    setVehicleType('standard');
    setPassengerCount(1);
  };

  const startEditing = (ride) => {
    setEditingRide(ride);
    setPickup(ride.pickup);
    setDestination(ride.destination);
    const rideDate = new Date(ride.scheduled_time);
    setSelectedDate(rideDate);
    setSelectedTime(rideDate.toTimeString().slice(0, 5));
    setVehicleType(ride.vehicle_type || 'standard');
    setPassengerCount(ride.passenger_count || 1);
    setShowScheduleForm(true);
  };

  const activateRide = async (rideId) => {
    try {
      await api.post(`/rides/${rideId}/activate`);
      toast.success('Course activée! Recherche d\'un chauffeur...');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de l\'activation');
    }
  };

  const cancelScheduledRide = async (rideId) => {
    if (!window.confirm('Voulez-vous vraiment annuler cette course ?')) return;
    
    try {
      await api.post(`/rides/${rideId}/cancel`);
      toast.success('Course annulée');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de l\'annulation');
    }
  };

  const addFavorite = async () => {
    if (!favoriteName || !favoriteLocation.address) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    
    try {
      await api.post('/favorites', {
        name: favoriteName,
        location: favoriteLocation
      });
      toast.success('Lieu favori ajouté!');
      setShowFavoriteForm(false);
      setFavoriteName('');
      setFavoriteLocation({ lat: 0, lng: 0, address: '' });
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
    }
  };

  const deleteFavorite = async (favoriteId) => {
    try {
      await api.delete(`/favorites/${favoriteId}`);
      toast.success('Lieu supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  // Format date and time nicely
  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const options = { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      hour: '2-digit', 
      minute: '2-digit'
    };
    return date.toLocaleDateString('fr-FR', options);
  };

  // Get time until ride
  const getTimeUntil = (isoString) => {
    if (!isoString) return null;
    const now = new Date();
    const rideDate = new Date(isoString);
    const diff = rideDate - now;
    
    if (diff < 0) return { type: 'past', text: 'Passée' };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (days > 1) {
      return { type: 'future', text: `Dans ${days} jours`, urgent: false };
    } else if (days === 1) {
      return { type: 'soon', text: `Demain`, urgent: false };
    } else if (hours >= 2) {
      return { type: 'soon', text: `Dans ${hours}h`, urgent: false };
    } else if (hours >= 1) {
      return { type: 'imminent', text: `Dans ${hours}h`, urgent: true };
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return { type: 'imminent', text: `Dans ${minutes} min`, urgent: true };
    }
  };

  // Ride card component
  const RideCard = ({ ride }) => {
    const timeUntil = getTimeUntil(ride.scheduled_time);
    const isUrgent = timeUntil?.urgent;
    const isPast = timeUntil?.type === 'past';
    
    return (
      <Card className={`bg-card border-border/50 overflow-hidden transition-all hover:border-primary/30 ${
        isUrgent ? 'ring-2 ring-orange-500/50' : ''
      } ${isPast ? 'opacity-60' : ''}`}>
        {/* Time Badge */}
        <div className={`px-4 py-2 flex items-center justify-between ${
          isUrgent ? 'bg-orange-500/20' : 'bg-primary/10'
        }`}>
          <div className="flex items-center gap-2">
            <CalendarIcon className={`w-4 h-4 ${isUrgent ? 'text-orange-500' : 'text-primary'}`} />
            <span className="font-semibold">{formatDateTime(ride.scheduled_time)}</span>
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${
            isUrgent ? 'bg-orange-500/30 text-orange-500' : 
            timeUntil?.type === 'soon' ? 'bg-yellow-500/30 text-yellow-500' :
            'bg-primary/30 text-primary'
          }`}>
            {timeUntil?.text}
          </span>
        </div>
        
        <CardContent className="p-4 space-y-4">
          {/* Addresses */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Départ</p>
                <p className="font-medium truncate">{ride.pickup?.address}</p>
              </div>
            </div>
            
            {/* Stops if any */}
            {ride.stops?.map((stop, idx) => (
              <div key={idx} className="flex items-start gap-3 pl-4">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-3 h-3 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-500">Arrêt {idx + 1}</p>
                  <p className="text-sm truncate">{stop.address}</p>
                </div>
              </div>
            ))}
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Navigation className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Destination</p>
                <p className="font-medium truncate">{ride.destination?.address}</p>
              </div>
            </div>
          </div>
          
          {/* Ride Details */}
          <div className="flex flex-wrap gap-3 py-2 border-t border-b border-border/30">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Route className="w-4 h-4" />
              <span>{ride.distance_km} km</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {ride.vehicle_type === 'van' ? (
                <Truck className="w-4 h-4" />
              ) : (
                <Car className="w-4 h-4" />
              )}
              <span>{ride.vehicle_type === 'van' ? 'Van' : 'Standard'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{ride.passenger_count || 1} passager{(ride.passenger_count || 1) > 1 ? 's' : ''}</span>
            </div>
          </div>
          
          {/* Price and Actions */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Tarif estimé</p>
              <p className="text-2xl font-bold text-primary">{ride.estimated_fare}€</p>
            </div>
            
            <div className="flex gap-2">
              {!isPast && (
                <>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => startEditing(ride)}
                    className="h-10 w-10"
                    title="Modifier"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => cancelScheduledRide(ride.id)}
                    className="h-10 w-10 text-red-500 hover:text-red-600"
                    title="Annuler"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {isUrgent && (
                    <Button 
                      onClick={() => activateRide(ride.id)}
                      className="bg-primary text-primary-foreground"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Activer
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Reminder Info */}
          {!isPast && !isUrgent && timeUntil?.type === 'soon' && (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg text-sm text-yellow-500">
              <Bell className="w-4 h-4" />
              <span>Vous recevrez un rappel 1h avant le départ</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Favorite icon mapping
  const favoriteIcons = {
    home: Home,
    work: Briefcase,
    default: Heart
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
              Courses Planifiées
            </h1>
            <p className="text-sm text-muted-foreground">
              {scheduledRides.length} course{scheduledRides.length > 1 ? 's' : ''} à venir
            </p>
          </div>
        </div>

        {/* Stats Summary */}
        {scheduledRides.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{scheduledRides.length}</p>
                <p className="text-xs text-muted-foreground">Planifiées</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-500/10 border-orange-500/30">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-orange-500">
                  {scheduledRides.filter(r => getTimeUntil(r.scheduled_time)?.urgent).length}
                </p>
                <p className="text-xs text-muted-foreground">Imminentes</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-border/30">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">
                  {scheduledRides.reduce((sum, r) => sum + (r.estimated_fare || 0), 0).toFixed(0)}€
                </p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="scheduled" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50">
            <TabsTrigger value="scheduled" data-testid="scheduled-tab">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Planifiées
            </TabsTrigger>
            <TabsTrigger value="favorites" data-testid="favorites-tab">
              <Star className="w-4 h-4 mr-2" />
              Lieux favoris
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="scheduled" className="space-y-4 mt-4">
            {/* Add/Edit Schedule Form */}
            {(showScheduleForm || editingRide) ? (
              <Card className="bg-card border-primary/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {editingRide ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                      {editingRide ? 'Modifier la course' : 'Nouvelle course planifiée'}
                    </span>
                    <Button variant="ghost" size="icon" onClick={resetForm}>
                      <X className="w-5 h-5" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AddressAutocomplete
                    value={pickup}
                    onChange={setPickup}
                    placeholder="Adresse de départ"
                    icon={MapPin}
                    iconColor="text-green-500"
                    dataTestId="schedule-pickup"
                  />
                  <AddressAutocomplete
                    value={destination}
                    onChange={setDestination}
                    placeholder="Destination"
                    icon={Navigation}
                    iconColor="text-primary"
                    dataTestId="schedule-destination"
                  />
                  
                  {/* Vehicle Type */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Type de véhicule</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setVehicleType('standard')}
                        className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                          vehicleType === 'standard' 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border/50 hover:border-primary/50'
                        }`}
                      >
                        <Car className="w-5 h-5 mx-auto mb-1 text-primary" />
                        <p className="text-sm font-medium">Standard</p>
                        <p className="text-xs text-muted-foreground">4 places</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVehicleType('van')}
                        className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                          vehicleType === 'van' 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border/50 hover:border-primary/50'
                        }`}
                      >
                        <Truck className="w-5 h-5 mx-auto mb-1 text-primary" />
                        <p className="text-sm font-medium">Van</p>
                        <p className="text-xs text-muted-foreground">7 places</p>
                      </button>
                    </div>
                  </div>
                  
                  {/* Passengers */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Nombre de passagers</label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))}
                        disabled={passengerCount <= 1}
                      >
                        -
                      </Button>
                      <span className="text-xl font-bold w-8 text-center">{passengerCount}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setPassengerCount(Math.min(vehicleType === 'van' ? 7 : 4, passengerCount + 1))}
                        disabled={passengerCount >= (vehicleType === 'van' ? 7 : 4)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  
                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Heure</label>
                      <Input
                        type="time"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="h-12 bg-muted border-white/10"
                        data-testid="schedule-time"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Date</label>
                      <Input
                        type="date"
                        value={selectedDate.toISOString().split('T')[0]}
                        onChange={(e) => setSelectedDate(new Date(e.target.value))}
                        min={new Date().toISOString().split('T')[0]}
                        className="h-12 bg-muted border-white/10"
                        data-testid="schedule-date"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={resetForm}
                    >
                      Annuler
                    </Button>
                    <Button 
                      className="flex-1 bg-primary text-primary-foreground"
                      onClick={editingRide ? updateScheduledRide : scheduleRide}
                      data-testid="confirm-schedule-btn"
                    >
                      {editingRide ? 'Modifier' : 'Planifier'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button 
                onClick={() => setShowScheduleForm(true)}
                className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
                data-testid="new-schedule-btn"
              >
                <Plus className="w-5 h-5 mr-2" />
                Planifier une nouvelle course
              </Button>
            )}

            {/* Rides List */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : scheduledRides.length === 0 && !showScheduleForm ? (
              <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border">
                <CalendarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Aucune course planifiée</p>
                <p className="text-muted-foreground text-sm mb-4">
                  Planifiez vos courses à l'avance pour gagner du temps
                </p>
                <Button 
                  onClick={() => setShowScheduleForm(true)}
                  className="bg-primary text-primary-foreground"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Planifier maintenant
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduledRides.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="favorites" className="space-y-4 mt-4">
            {/* Add Favorite Form */}
            {showFavoriteForm ? (
              <Card className="bg-card border-primary/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Nouveau lieu favori
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => setShowFavoriteForm(false)}>
                      <X className="w-5 h-5" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Nom du lieu</label>
                    <Input
                      placeholder="Ex: Maison, Bureau, Gym..."
                      value={favoriteName}
                      onChange={(e) => setFavoriteName(e.target.value)}
                      className="h-12 bg-muted border-white/10"
                      data-testid="favorite-name"
                    />
                  </div>
                  
                  <AddressAutocomplete
                    value={favoriteLocation}
                    onChange={setFavoriteLocation}
                    placeholder="Adresse"
                    icon={MapPin}
                    iconColor="text-primary"
                    dataTestId="favorite-address"
                  />
                  
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowFavoriteForm(false)}
                    >
                      Annuler
                    </Button>
                    <Button 
                      className="flex-1 bg-primary text-primary-foreground"
                      onClick={addFavorite}
                      data-testid="save-favorite-btn"
                    >
                      Enregistrer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button 
                onClick={() => setShowFavoriteForm(true)}
                variant="outline"
                className="w-full h-12 border-dashed"
                data-testid="add-favorite-btn"
              >
                <Plus className="w-5 h-5 mr-2" />
                Ajouter un lieu favori
              </Button>
            )}

            {/* Favorites List */}
            {favorites.length === 0 && !showFavoriteForm ? (
              <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border">
                <Star className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Aucun lieu favori</p>
                <p className="text-muted-foreground text-sm">
                  Enregistrez vos lieux fréquents pour réserver plus vite
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {favorites.map((favorite) => {
                  const Icon = favoriteIcons[favorite.type] || favoriteIcons.default;
                  return (
                    <Card key={favorite.id} className="bg-card border-border/50">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{favorite.name}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {favorite.location?.address}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteFavorite(favorite.id)}
                          className="text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ScheduledRidesPage;
