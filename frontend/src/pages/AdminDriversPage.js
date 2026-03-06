import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { 
  Users, Car, ArrowLeft, RefreshCw, Star, MapPin, 
  Phone, Mail, Check, Loader2, Truck, Key, X
} from 'lucide-react';
import { toast } from 'sonner';

const AdminDriversPage = () => {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [resetPasswordModal, setResetPasswordModal] = useState(null); // driver object or null
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Accès non autorisé');
      navigate('/');
      return;
    }
    fetchDrivers();
  }, [user, navigate]);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/drivers');
      setDrivers(response.data.drivers || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des chauffeurs');
    } finally {
      setLoading(false);
    }
  };

  const updateVehicleTypes = async (driverId, vehicleTypes) => {
    setUpdating(driverId);
    try {
      await api.put('/admin/drivers/vehicle-types', {
        driver_id: driverId,
        vehicle_types: vehicleTypes
      });
      
      // Update local state
      setDrivers(prev => prev.map(d => 
        d.id === driverId ? { ...d, driver_vehicle_types: vehicleTypes } : d
      ));
      
      toast.success('Configuration mise à jour');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdating(null);
    }
  };

  const toggleVehicleType = (driver, type) => {
    const currentTypes = driver.driver_vehicle_types || ['vtc'];
    let newTypes;
    
    if (currentTypes.includes(type)) {
      // Remove type (but ensure at least one type remains)
      newTypes = currentTypes.filter(t => t !== type);
      if (newTypes.length === 0) {
        toast.error('Le chauffeur doit avoir au moins un type de véhicule');
        return;
      }
    } else {
      // Add type
      newTypes = [...currentTypes, type];
    }
    
    updateVehicleTypes(driver.id, newTypes);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordModal || !newPassword) return;
    
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    setResettingPassword(true);
    try {
      await api.post('/admin/reset-user-password', {
        user_id: resetPasswordModal.id,
        new_password: newPassword
      });
      toast.success(`Mot de passe réinitialisé pour ${resetPasswordModal.email}`);
      setResetPasswordModal(null);
      setNewPassword('');
    } catch (error) {
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin')}
              className="rounded-full hover:bg-primary/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" style={{ fontFamily: 'Space Grotesk' }}>
                <Users className="w-8 h-8 text-primary" />
                Gestion des Chauffeurs
              </h1>
              <p className="text-muted-foreground mt-1">Configurez les types de véhicules pour chaque chauffeur</p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={fetchDrivers}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Legend */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-3">
              <strong>Configuration des types de courses :</strong>
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-primary"></div>
                <span className="text-sm">VTC - Courses VTC standard</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <span className="text-sm">Van - Courses Van (7 places)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span className="text-sm">Taxi - Courses Taxi (peut aussi faire VTC)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Drivers List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : drivers.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Aucun chauffeur enregistré</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {drivers.map(driver => {
              const vehicleTypes = driver.driver_vehicle_types || ['vtc'];
              const hasVtc = vehicleTypes.includes('vtc');
              const hasVan = vehicleTypes.includes('van');
              const hasTaxi = vehicleTypes.includes('taxi');
              const isUpdating = updating === driver.id;
              
              return (
                <Card key={driver.id} className="bg-card hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Driver Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                          <Car className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">
                            {driver.first_name} {driver.last_name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {driver.email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {driver.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500" />
                              {driver.rating?.toFixed(1) || '5.0'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${driver.is_available ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                              {driver.is_available ? 'En ligne' : 'Hors ligne'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {driver.total_rides || 0} courses
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setResetPasswordModal(driver)}
                              className="text-xs h-6 px-2"
                            >
                              <Key className="w-3 h-3 mr-1" />
                              Réinitialiser MDP
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Vehicle Type Toggles */}
                      <div className="flex items-center gap-6 bg-muted/30 rounded-lg p-4">
                        {isUpdating && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        )}
                        
                        {/* VTC Toggle */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Car className="w-5 h-5 text-primary" />
                            <span className="font-medium">VTC</span>
                          </div>
                          <Switch
                            checked={hasVtc}
                            onCheckedChange={() => toggleVehicleType(driver, 'vtc')}
                            disabled={isUpdating}
                            className="data-[state=checked]:bg-primary"
                          />
                        </div>
                        
                        {/* Van Toggle */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Truck className="w-5 h-5 text-blue-500" />
                            <span className="font-medium text-blue-500">Van</span>
                          </div>
                          <Switch
                            checked={hasVan}
                            onCheckedChange={() => toggleVehicleType(driver, 'van')}
                            disabled={isUpdating}
                            className="data-[state=checked]:bg-blue-500"
                          />
                        </div>
                        
                        {/* Taxi Toggle */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Car className="w-5 h-5 text-yellow-500" />
                            <span className="font-medium text-yellow-500">Taxi</span>
                          </div>
                          <Switch
                            checked={hasTaxi}
                            onCheckedChange={() => toggleVehicleType(driver, 'taxi')}
                            disabled={isUpdating}
                            className="data-[state=checked]:bg-yellow-500"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                Réinitialiser le mot de passe
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setResetPasswordModal(null);
                  setNewPassword('');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Réinitialiser le mot de passe pour :
              </p>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="font-semibold">{resetPasswordModal.first_name} {resetPasswordModal.last_name}</p>
                <p className="text-sm text-muted-foreground">{resetPasswordModal.email}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nouveau mot de passe</label>
                <Input
                  type="text"
                  placeholder="Nouveau mot de passe (min. 6 caractères)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setResetPasswordModal(null);
                    setNewPassword('');
                  }}
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleResetPassword}
                  disabled={resettingPassword || newPassword.length < 6}
                >
                  {resettingPassword ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Confirmer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminDriversPage;
