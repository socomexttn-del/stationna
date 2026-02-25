import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Users, Car, DollarSign, TrendingUp, MapPin, Clock, Star,
  ArrowLeft, RefreshCw, Calendar, Route, FileText, Check, X, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const { user, api, logout } = useAuth();
  const navigate = useNavigate();
  
  const [overview, setOverview] = useState(null);
  const [driverStats, setDriverStats] = useState([]);
  const [rideStats, setRideStats] = useState([]);
  const [recentRides, setRecentRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverDocuments, setDriverDocuments] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Accès non autorisé');
      navigate('/');
      return;
    }
    fetchAllStats();
  }, [user, navigate]);

  const fetchAllStats = async () => {
    setLoading(true);
    try {
      const [overviewRes, driversRes, ridesRes, recentRes] = await Promise.all([
        api.get('/admin/stats/overview'),
        api.get('/admin/stats/drivers'),
        api.get('/admin/stats/rides?days=7'),
        api.get('/admin/recent-rides?limit=10')
      ]);
      
      setOverview(overviewRes.data);
      setDriverStats(driversRes.data.drivers);
      setRideStats(ridesRes.data.daily_stats);
      setRecentRides(recentRes.data.rides);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'in_progress': return 'text-blue-500';
      case 'accepted': return 'text-yellow-500';
      case 'pending': return 'text-orange-500';
      case 'cancelled': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Terminée';
      case 'in_progress': return 'En cours';
      case 'accepted': return 'Acceptée';
      case 'pending': return 'En attente';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-white/10 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="md:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                Admin Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">Volt Taxi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchAllStats}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Actualiser
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={logout}
              className="text-destructive"
            >
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Overview Cards */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{overview.users.total_passengers}</p>
                    <p className="text-xs text-muted-foreground">Passagers</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Car className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{overview.users.total_drivers}</p>
                    <p className="text-xs text-muted-foreground">Chauffeurs</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{overview.revenue.total}€</p>
                    <p className="text-xs text-muted-foreground">Revenus totaux</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{overview.rides.completed}</p>
                    <p className="text-xs text-muted-foreground">Courses terminées</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Today's Stats */}
        {overview && (
          <Card className="border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Aujourd'hui
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-primary">{overview.rides.today}</p>
                  <p className="text-sm text-muted-foreground">Courses</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-500">{overview.revenue.today}€</p>
                  <p className="text-sm text-muted-foreground">Revenus</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-500">{overview.revenue.week}€</p>
                  <p className="text-sm text-muted-foreground">Cette semaine</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Driver Stats */}
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
              Statistiques Chauffeurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b border-white/10">
                    <th className="pb-3 font-medium">Chauffeur</th>
                    <th className="pb-3 font-medium text-center">Courses</th>
                    <th className="pb-3 font-medium text-center">Aujourd'hui</th>
                    <th className="pb-3 font-medium text-center">Note</th>
                    <th className="pb-3 font-medium text-right">Revenus</th>
                    <th className="pb-3 font-medium text-center">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {driverStats.map((driver) => (
                    <tr key={driver.id} className="border-b border-white/5 hover:bg-muted/30">
                      <td className="py-3">
                        <div>
                          <p className="font-medium">{driver.name}</p>
                          <p className="text-xs text-muted-foreground">{driver.email}</p>
                        </div>
                      </td>
                      <td className="py-3 text-center">{driver.stats.total_rides}</td>
                      <td className="py-3 text-center">
                        <span className="text-primary font-medium">{driver.stats.rides_today}</span>
                        <span className="text-muted-foreground text-xs ml-1">({driver.stats.revenue_today}€)</span>
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span>{driver.stats.avg_rating}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-semibold text-green-500">
                        {driver.stats.total_revenue}€
                      </td>
                      <td className="py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          driver.is_available 
                            ? 'bg-green-500/20 text-green-500' 
                            : 'bg-red-500/20 text-red-500'
                        }`}>
                          {driver.is_available ? 'En ligne' : 'Hors ligne'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Rides */}
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="w-5 h-5 text-primary" />
              Courses Récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRides.map((ride) => (
                <div 
                  key={ride.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{ride.passenger_name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {ride.pickup?.address} → {ride.destination?.address}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${getStatusColor(ride.status)}`}>
                      {getStatusText(ride.status)}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(ride.created_at)}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold">{ride.final_fare || ride.estimated_fare}€</p>
                    <p className="text-xs text-muted-foreground">{ride.distance_km} km</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Chart */}
        {rideStats.length > 0 && (
          <Card className="border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Évolution (7 derniers jours)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 h-40">
                {rideStats.map((day, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                      style={{ 
                        height: `${Math.max(10, (day.revenue / Math.max(...rideStats.map(d => d.revenue || 1))) * 100)}%` 
                      }}
                    />
                    <p className="text-xs text-muted-foreground">{day.date.slice(5)}</p>
                    <p className="text-xs font-medium">{day.revenue}€</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
