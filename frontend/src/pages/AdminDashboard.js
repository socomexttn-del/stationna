import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Users, Car, DollarSign, TrendingUp, MapPin, Clock, Star,
  ArrowLeft, RefreshCw, Calendar, Route, FileText, Check, X, Eye,
  Power, UserX, UserCheck, Database, Mail, AlertTriangle, Bell, Loader2, Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { user, api, logout } = useAuth();
  const navigate = useNavigate();
  
  const [overview, setOverview] = useState(null);
  const [driverStats, setDriverStats] = useState([]);
  const [rideStats, setRideStats] = useState([]);
  const [recentRides, setRecentRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverDocuments, setDriverDocuments] = useState(null);
  const [expiringDocs, setExpiringDocs] = useState(null);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [showExpiringDocs, setShowExpiringDocs] = useState(false);

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

  const viewDriverDocuments = async (driver) => {
    try {
      const response = await api.get(`/admin/drivers/${driver.id}/documents`);
      setDriverDocuments(response.data);
      setSelectedDriver(driver);
    } catch (error) {
      toast.error('Erreur lors du chargement des documents');
    }
  };

  const updateDocStatus = async (docType, status) => {
    try {
      await api.put(`/admin/drivers/${selectedDriver.id}/documents/${docType}/status?status=${status}`);
      toast.success(`Document ${status === 'approved' ? 'approuvé' : 'rejeté'}`);
      viewDriverDocuments(selectedDriver);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const toggleDriverStatus = async (driver) => {
    const newStatus = !driver.is_active;
    try {
      await api.put(`/admin/drivers/${driver.id}/status`, { is_active: newStatus });
      toast.success(`Chauffeur ${newStatus ? 'activé' : 'désactivé'}`);
      fetchAllStats(); // Refresh data
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const fetchExpiringDocuments = async () => {
    try {
      const response = await api.get('/admin/documents/expiring?days=30');
      setExpiringDocs(response.data);
      setShowExpiringDocs(true);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  const sendExpiryNotifications = async () => {
    setSendingEmails(true);
    try {
      const response = await api.post('/admin/notifications/send-expiry-alerts', {});
      toast.success(`${response.data.emails_sent} email(s) envoyé(s)`);
      if (response.data.errors?.length > 0) {
        toast.warning(`${response.data.errors.length} erreur(s)`);
      }
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail?.includes('non configuré')) {
        toast.error('Service email non configuré. Ajoutez RESEND_API_KEY dans .env');
      } else {
        toast.error('Erreur lors de l\'envoi');
      }
    } finally {
      setSendingEmails(false);
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
              <p className="text-sm text-muted-foreground">Allogo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/clients">
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
                data-testid="admin-clients-link"
              >
                <Database className="w-4 h-4" /> Clients
              </Button>
            </Link>
            <Link to="/admin/drivers">
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
                data-testid="admin-drivers-link"
              >
                <Car className="w-4 h-4" /> Chauffeurs
              </Button>
            </Link>
            <Link to="/admin/promo-codes">
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
                data-testid="admin-promo-link"
              >
                <Tag className="w-4 h-4" /> Promos
              </Button>
            </Link>
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

        {/* Document Expiry Alerts */}
        <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Documents à renouveler
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={fetchExpiringDocuments}
                  className="gap-2"
                  data-testid="view-expiring-docs-btn"
                >
                  <Eye className="w-4 h-4" /> Voir
                </Button>
                <Button 
                  size="sm"
                  onClick={sendExpiryNotifications}
                  disabled={sendingEmails}
                  className="gap-2 bg-orange-500 hover:bg-orange-600"
                  data-testid="send-notifications-btn"
                >
                  {sendingEmails ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Envoyer alertes
                </Button>
              </div>
            </div>
          </CardHeader>
          {showExpiringDocs && expiringDocs && (
            <CardContent>
              <div className="space-y-2">
                <div className="flex gap-4 text-sm mb-4">
                  <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full">
                    {expiringDocs.expired_count} expirés
                  </span>
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full">
                    {expiringDocs.expiring_count} à renouveler
                  </span>
                </div>
                {expiringDocs.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun document à renouveler</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {expiringDocs.documents.slice(0, 10).map((doc, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          doc.is_expired ? 'bg-red-500/10' : 'bg-orange-500/10'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-sm">{doc.driver_name}</p>
                          <p className="text-xs text-muted-foreground">{doc.doc_name}</p>
                        </div>
                        <span className={`text-xs font-medium ${
                          doc.is_expired ? 'text-red-400' : 'text-orange-400'
                        }`}>
                          {doc.is_expired 
                            ? `Expiré (${Math.abs(doc.days_until_expiry)}j)` 
                            : `${doc.days_until_expiry}j restants`
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>

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
                    <th className="pb-3 font-medium">Véhicule</th>
                    <th className="pb-3 font-medium text-center">Courses</th>
                    <th className="pb-3 font-medium text-center">Note</th>
                    <th className="pb-3 font-medium text-right">Revenus</th>
                    <th className="pb-3 font-medium text-center">Statut</th>
                    <th className="pb-3 font-medium text-center">Compte</th>
                    <th className="pb-3 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {driverStats.map((driver) => (
                    <tr key={driver.id} className={`border-b border-white/5 hover:bg-muted/30 ${!driver.is_active ? 'opacity-50' : ''}`}>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {!driver.is_active && (
                            <UserX className="w-4 h-4 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium">{driver.name}</p>
                            <p className="text-xs text-muted-foreground">{driver.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        {driver.vehicle ? (
                          <div>
                            <p className="text-sm font-medium">{driver.vehicle.make} {driver.vehicle.model}</p>
                            <p className="text-xs text-muted-foreground">{driver.vehicle.license_plate}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-orange-500">Non configuré</span>
                        )}
                      </td>
                      <td className="py-3 text-center">{driver.stats.total_rides}</td>
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
                      <td className="py-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleDriverStatus(driver)}
                          className={`text-xs ${driver.is_active ? 'text-red-500 hover:text-red-400 hover:bg-red-500/10' : 'text-green-500 hover:text-green-400 hover:bg-green-500/10'}`}
                          data-testid={`toggle-driver-${driver.id}`}
                        >
                          {driver.is_active ? (
                            <>
                              <UserX className="w-3 h-3 mr-1" />
                              Désactiver
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3 mr-1" />
                              Activer
                            </>
                          )}
                        </Button>
                      </td>
                      <td className="py-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewDriverDocuments(driver)}
                          className="text-xs"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Docs
                        </Button>
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

      {/* Documents Modal */}
      {selectedDriver && driverDocuments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { setSelectedDriver(null); setDriverDocuments(null); }}
          />
          <div className="relative bg-card border border-white/10 rounded-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <button 
              onClick={() => { setSelectedDriver(null); setDriverDocuments(null); }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Space Grotesk' }}>
              {driverDocuments.name}
            </h3>
            
            {/* Vehicle Info */}
            {driverDocuments.vehicle_info && (
              <div className="mb-4 p-3 bg-muted/30 rounded-xl">
                <p className="text-sm font-medium">
                  {driverDocuments.vehicle_info.make} {driverDocuments.vehicle_info.model} ({driverDocuments.vehicle_info.year})
                </p>
                <p className="text-xs text-muted-foreground">
                  {driverDocuments.vehicle_info.color} • {driverDocuments.vehicle_info.license_plate}
                </p>
              </div>
            )}

            <h4 className="text-sm font-medium text-muted-foreground mb-3">Documents</h4>
            <div className="space-y-3">
              {['carte_grise', 'assurance', 'controle_technique', 'permis_conduire', 'carte_vtc'].map((docType) => {
                const doc = driverDocuments.documents?.[docType];
                const labels = {
                  carte_grise: 'Carte Grise',
                  assurance: 'Assurance',
                  controle_technique: 'Contrôle Technique',
                  permis_conduire: 'Permis de Conduire',
                  carte_vtc: 'Carte VTC'
                };
                
                return (
                  <div 
                    key={docType}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{labels[docType]}</p>
                        <p className={`text-xs ${
                          !doc ? 'text-orange-500' :
                          doc.status === 'approved' ? 'text-green-500' :
                          doc.status === 'rejected' ? 'text-red-500' :
                          'text-yellow-500'
                        }`}>
                          {!doc ? 'Non fourni' :
                           doc.status === 'approved' ? 'Approuvé' :
                           doc.status === 'rejected' ? 'Rejeté' :
                           'En attente'}
                        </p>
                      </div>
                    </div>
                    
                    {doc && (
                      <div className="flex items-center gap-2">
                        {doc.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(doc.url, '_blank')}
                            className="text-xs"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateDocStatus(docType, 'approved')}
                          className="text-xs text-green-500 hover:text-green-400"
                          disabled={doc.status === 'approved'}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateDocStatus(docType, 'rejected')}
                          className="text-xs text-red-500 hover:text-red-400"
                          disabled={doc.status === 'rejected'}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
