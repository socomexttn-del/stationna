import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar } from '../components/ui/calendar';
import { 
  ArrowLeft, Clock, MapPin, Navigation, Calendar as CalendarIcon, 
  Star, Home, Briefcase, Heart, Plus, Trash2, Car
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
  
  // Schedule form state
  const [pickup, setPickup] = useState({ lat: 0, lng: 0, address: '' });
  const [destination, setDestination] = useState({ lat: 0, lng: 0, address: '' });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('09:00');
  
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
        scheduled_time: scheduledDateTime.toISOString()
      });
      toast.success('Course planifiée!');
      setShowScheduleForm(false);
      setPickup({ lat: 0, lng: 0, address: '' });
      setDestination({ lat: 0, lng: 0, address: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
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
      toast.success('Adresse favorite ajoutée!');
      setShowFavoriteForm(false);
      setFavoriteName('');
      setFavoriteLocation({ lat: 0, lng: 0, address: '' });
      fetchData();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const deleteFavorite = async (favoriteId) => {
    try {
      await api.delete(`/favorites/${favoriteId}`);
      toast.success('Adresse supprimée');
      fetchData();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFavoriteIcon = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('maison') || lowerName.includes('home')) return Home;
    if (lowerName.includes('travail') || lowerName.includes('bureau') || lowerName.includes('work')) return Briefcase;
    return Heart;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass p-4">
        <div className="flex items-center gap-4">
          <Link to="/passenger">
            <Button variant="ghost" size="icon" data-testid="back-btn" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>Mes courses</h1>
        </div>
      </header>

      {/* Content */}
      <div className="pt-24 pb-8 px-4">
        <Tabs defaultValue="scheduled" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="scheduled" data-testid="tab-scheduled">
              <CalendarIcon className="w-4 h-4 mr-2" /> Planifiées
            </TabsTrigger>
            <TabsTrigger value="favorites" data-testid="tab-favorites">
              <Star className="w-4 h-4 mr-2" /> Favoris
            </TabsTrigger>
          </TabsList>

          {/* Scheduled Rides Tab */}
          <TabsContent value="scheduled" className="space-y-4">
            <Button 
              onClick={() => setShowScheduleForm(!showScheduleForm)}
              data-testid="new-schedule-btn"
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
            >
              <Plus className="w-5 h-5 mr-2" /> Planifier une course
            </Button>

            {showScheduleForm && (
              <Card className="bg-card border-primary/50">
                <CardHeader>
                  <CardTitle className="text-lg">Nouvelle course planifiée</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AddressAutocomplete
                    value={pickup}
                    onChange={setPickup}
                    placeholder="Point de départ"
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
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-sm text-muted-foreground mb-2 block">Heure</label>
                      <Input
                        type="time"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="h-12 bg-muted border-white/10"
                        data-testid="schedule-time"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Date</label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date()}
                      className="rounded-xl border border-border"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowScheduleForm(false)}
                    >
                      Annuler
                    </Button>
                    <Button 
                      className="flex-1 bg-primary text-primary-foreground"
                      onClick={scheduleRide}
                      data-testid="confirm-schedule-btn"
                    >
                      Planifier
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : scheduledRides.length === 0 ? (
              <div className="text-center py-12">
                <CalendarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucune course planifiée</p>
              </div>
            ) : (
              scheduledRides.map((ride) => (
                <Card key={ride.id} className="bg-card border-border/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary">
                        <Clock className="w-4 h-4" />
                        <span className="font-semibold">{formatDateTime(ride.scheduled_time)}</span>
                      </div>
                      <span className="text-xl font-bold">{ride.estimated_fare}€</span>
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
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => cancelScheduledRide(ride.id)}
                        className="flex-1"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Annuler
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => activateRide(ride.id)}
                        className="flex-1 bg-primary text-primary-foreground"
                        data-testid={`activate-ride-${ride.id}`}
                      >
                        <Car className="w-4 h-4 mr-1" /> Lancer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Favorites Tab */}
          <TabsContent value="favorites" className="space-y-4">
            <Button 
              onClick={() => setShowFavoriteForm(!showFavoriteForm)}
              data-testid="new-favorite-btn"
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
            >
              <Plus className="w-5 h-5 mr-2" /> Ajouter une adresse
            </Button>

            {showFavoriteForm && (
              <Card className="bg-card border-primary/50">
                <CardHeader>
                  <CardTitle className="text-lg">Nouvelle adresse favorite</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Nom</label>
                    <Input
                      value={favoriteName}
                      onChange={(e) => setFavoriteName(e.target.value)}
                      placeholder="Ex: Maison, Travail, Gym..."
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
                      data-testid="confirm-favorite-btn"
                    >
                      Ajouter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : favorites.length === 0 ? (
              <div className="text-center py-12">
                <Star className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucune adresse favorite</p>
                <p className="text-sm text-muted-foreground mt-1">Ajoutez vos lieux fréquents</p>
              </div>
            ) : (
              favorites.map((fav) => {
                const Icon = getFavoriteIcon(fav.name);
                return (
                  <Card key={fav.id} className="bg-card border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{fav.name}</p>
                            <p className="text-sm text-muted-foreground">{fav.location.address}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deleteFavorite(fav.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ScheduledRidesPage;
