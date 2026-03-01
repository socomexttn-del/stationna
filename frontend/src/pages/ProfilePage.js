import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import SavedCardsManager from '../components/SavedCardsManager';
import LanguageSelector from '../components/LanguageSelector';
import { ArrowLeft, User, Star, Car, Phone, Mail, Save, CreditCard, Globe } from 'lucide-react';
import { toast } from 'sonner';

const ProfilePage = () => {
  const { user, api, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [vehicleData, setVehicleData] = useState(user?.vehicle_info || {
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    license_plate: ''
  });

  const handleVehicleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.put('/users/vehicle', vehicleData);
      updateUser(response.data);
      toast.success('Véhicule mis à jour!');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass p-4">
        <div className="flex items-center gap-4">
          <Link to={user?.role === 'driver' ? '/driver' : '/passenger'}>
            <Button variant="ghost" size="icon" data-testid="profile-back-btn" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>Mon profil</h1>
        </div>
      </header>

      {/* Content */}
      <div className="pt-24 pb-8 px-4 space-y-6">
        {/* Profile Card */}
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center">
                <User className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{user?.first_name} {user?.last_name}</h2>
                <p className="text-muted-foreground capitalize">{user?.role === 'driver' ? 'Chauffeur' : 'Passager'}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-4 h-4 fill-primary text-primary" />
                  <span className="font-medium">{user?.rating?.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({user?.total_rides} courses)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Informations de contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Téléphone</p>
                <p className="font-medium">{user?.phone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Info (Drivers only) */}
        {user?.role === 'driver' && (
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Car className="w-5 h-5" /> Mon véhicule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVehicleUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="make">Marque</Label>
                    <Input
                      id="make"
                      data-testid="vehicle-make"
                      value={vehicleData.make}
                      onChange={(e) => setVehicleData({ ...vehicleData, make: e.target.value })}
                      className="h-12 bg-muted border-white/10"
                      placeholder="Toyota"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Modèle</Label>
                    <Input
                      id="model"
                      data-testid="vehicle-model"
                      value={vehicleData.model}
                      onChange={(e) => setVehicleData({ ...vehicleData, model: e.target.value })}
                      className="h-12 bg-muted border-white/10"
                      placeholder="Camry"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year">Année</Label>
                    <Input
                      id="year"
                      type="number"
                      data-testid="vehicle-year"
                      value={vehicleData.year}
                      onChange={(e) => setVehicleData({ ...vehicleData, year: parseInt(e.target.value) })}
                      className="h-12 bg-muted border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">Couleur</Label>
                    <Input
                      id="color"
                      data-testid="vehicle-color"
                      value={vehicleData.color}
                      onChange={(e) => setVehicleData({ ...vehicleData, color: e.target.value })}
                      className="h-12 bg-muted border-white/10"
                      placeholder="Noir"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="license_plate">Plaque d'immatriculation</Label>
                  <Input
                    id="license_plate"
                    data-testid="vehicle-plate"
                    value={vehicleData.license_plate}
                    onChange={(e) => setVehicleData({ ...vehicleData, license_plate: e.target.value })}
                    className="h-12 bg-muted border-white/10"
                    placeholder="AB-123-CD"
                  />
                </div>
                <Button 
                  type="submit" 
                  data-testid="save-vehicle-btn"
                  disabled={loading}
                  className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" /> Enregistrer
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Saved Cards (Passengers only) */}
        {user?.role === 'passenger' && (
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Mes cartes bancaires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SavedCardsManager />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
