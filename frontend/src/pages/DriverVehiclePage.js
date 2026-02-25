import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Car, FileText, Upload, Check, X, Clock, ArrowLeft,
  CreditCard, Shield, Calendar, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const DOCUMENT_TYPES = [
  { id: 'carte_grise', name: 'Carte Grise', icon: FileText, required: true },
  { id: 'assurance', name: 'Assurance', icon: Shield, required: true },
  { id: 'controle_technique', name: 'Contrôle Technique', icon: Check, required: true },
  { id: 'permis_conduire', name: 'Permis de Conduire', icon: CreditCard, required: true },
  { id: 'carte_vtc', name: 'Carte VTC', icon: Car, required: true },
];

const DriverVehiclePage = () => {
  const { user, api, updateUser } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    license_plate: '',
    vehicle_type: 'standard'
  });
  const [documents, setDocuments] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);

  useEffect(() => {
    if (user?.role !== 'driver') {
      navigate('/');
      return;
    }
    fetchDriverData();
  }, [user, navigate]);

  const fetchDriverData = async () => {
    try {
      const response = await api.get('/drivers/documents');
      if (response.data.vehicle_info) {
        setVehicleInfo(response.data.vehicle_info);
      }
      setDocuments(response.data.documents || {});
    } catch (error) {
      console.error('Error fetching driver data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.put('/users/vehicle', vehicleInfo);
      updateUser(response.data);
      toast.success('Informations du véhicule mises à jour');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentUpload = async (docType, file) => {
    if (!file) return;
    
    setUploadingDoc(docType);
    
    // In a real app, you would upload to a cloud storage (S3, etc.)
    // For now, we'll simulate with a data URL
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await api.put('/drivers/documents', {
          document_type: docType,
          document_url: reader.result,
          expiry_date: null
        });
        toast.success('Document téléchargé avec succès');
        fetchDriverData();
      } catch (error) {
        toast.error('Erreur lors du téléchargement');
      } finally {
        setUploadingDoc(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const getDocumentStatus = (doc) => {
    if (!doc) return { text: 'Non fourni', color: 'text-orange-500', bg: 'bg-orange-500/20' };
    switch (doc.status) {
      case 'approved':
        return { text: 'Approuvé', color: 'text-green-500', bg: 'bg-green-500/20', icon: Check };
      case 'rejected':
        return { text: 'Rejeté', color: 'text-red-500', bg: 'bg-red-500/20', icon: X };
      case 'pending':
      default:
        return { text: 'En attente', color: 'text-yellow-500', bg: 'bg-yellow-500/20', icon: Clock };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-white/10 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/driver')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
              Mon Véhicule
            </h1>
            <p className="text-sm text-muted-foreground">Gérez vos informations et documents</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        {/* Vehicle Info Card */}
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
              Informations du véhicule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVehicleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Marque *</label>
                  <Input
                    value={vehicleInfo.make}
                    onChange={(e) => setVehicleInfo({...vehicleInfo, make: e.target.value})}
                    placeholder="Ex: Peugeot"
                    required
                    className="bg-muted/30 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Modèle *</label>
                  <Input
                    value={vehicleInfo.model}
                    onChange={(e) => setVehicleInfo({...vehicleInfo, model: e.target.value})}
                    placeholder="Ex: 508"
                    required
                    className="bg-muted/30 border-white/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Année *</label>
                  <Input
                    type="number"
                    value={vehicleInfo.year}
                    onChange={(e) => setVehicleInfo({...vehicleInfo, year: parseInt(e.target.value)})}
                    min="2000"
                    max={new Date().getFullYear() + 1}
                    required
                    className="bg-muted/30 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Couleur *</label>
                  <Input
                    value={vehicleInfo.color}
                    onChange={(e) => setVehicleInfo({...vehicleInfo, color: e.target.value})}
                    placeholder="Ex: Noir"
                    required
                    className="bg-muted/30 border-white/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Plaque d'immatriculation *</label>
                <Input
                  value={vehicleInfo.license_plate}
                  onChange={(e) => setVehicleInfo({...vehicleInfo, license_plate: e.target.value.toUpperCase()})}
                  placeholder="Ex: AB-123-CD"
                  required
                  className="bg-muted/30 border-white/10 uppercase"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Type de véhicule *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVehicleInfo({...vehicleInfo, vehicle_type: 'standard'})}
                    className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      vehicleInfo.vehicle_type === 'standard'
                        ? 'border-primary bg-primary/10'
                        : 'border-white/10 bg-muted/30 hover:border-white/20'
                    }`}
                  >
                    <Car className="w-6 h-6" />
                    <span className="font-medium">Standard</span>
                    <span className="text-xs text-muted-foreground">1-4 passagers</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVehicleInfo({...vehicleInfo, vehicle_type: 'van'})}
                    className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      vehicleInfo.vehicle_type === 'van'
                        ? 'border-primary bg-primary/10'
                        : 'border-white/10 bg-muted/30 hover:border-white/20'
                    }`}
                  >
                    <Car className="w-6 h-6" />
                    <span className="font-medium">Van</span>
                    <span className="text-xs text-muted-foreground">1-7 passagers</span>
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={saving}
                className="w-full h-12 bg-primary text-primary-foreground rounded-xl"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Documents Card */}
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Documents obligatoires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span>Tous les documents doivent être validés par un administrateur</span>
            </div>

            {DOCUMENT_TYPES.map((docType) => {
              const doc = documents[docType.id];
              const status = getDocumentStatus(doc);
              const StatusIcon = status.icon;

              return (
                <div 
                  key={docType.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <docType.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{docType.name}</p>
                      <div className={`flex items-center gap-1 text-xs ${status.color}`}>
                        {StatusIcon && <StatusIcon className="w-3 h-3" />}
                        <span>{status.text}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {doc?.url && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(doc.url, '_blank')}
                        className="text-xs"
                      >
                        Voir
                      </Button>
                    )}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => handleDocumentUpload(docType.id, e.target.files?.[0])}
                        disabled={uploadingDoc === docType.id}
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        asChild
                        disabled={uploadingDoc === docType.id}
                      >
                        <span className="flex items-center gap-1">
                          {uploadingDoc === docType.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              <span>...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3 h-3" />
                              <span>{doc ? 'Modifier' : 'Ajouter'}</span>
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Summary */}
        {vehicleInfo.license_plate && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                  <Car className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{vehicleInfo.make} {vehicleInfo.model}</p>
                  <p className="text-sm text-muted-foreground">
                    {vehicleInfo.color} • {vehicleInfo.year} • {vehicleInfo.license_plate}
                  </p>
                </div>
                <div className="ml-auto">
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    vehicleInfo.vehicle_type === 'van' 
                      ? 'bg-blue-500/20 text-blue-500' 
                      : 'bg-green-500/20 text-green-500'
                  }`}>
                    {vehicleInfo.vehicle_type === 'van' ? 'Van' : 'Standard'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default DriverVehiclePage;
