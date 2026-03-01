import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { 
  Car, FileText, Upload, Check, X, Clock, ArrowLeft,
  CreditCard, Shield, Calendar, AlertCircle, Trash2, Eye,
  User, Home, Briefcase, Building, FileCheck, Wallet, Loader2, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

// Document categories with icons
const DOCUMENT_CATEGORIES = {
  vehicle: { name: 'Documents Véhicule', icon: Car, color: 'text-blue-500' },
  personal: { name: 'Documents Personnels', icon: User, color: 'text-green-500' },
  professional: { name: 'Documents Professionnels', icon: Briefcase, color: 'text-purple-500' },
  financial: { name: 'Documents Financiers', icon: Wallet, color: 'text-amber-500' },
};

// Document type icons
const DOC_ICONS = {
  carte_grise: FileText,
  assurance: Shield,
  controle_technique: CheckCircle2,
  permis_conduire: CreditCard,
  carte_vtc: Car,
  cni: User,
  justificatif_domicile: Home,
  rc_pro: Shield,
  kbis: Building,
  attestation_vigilance: FileCheck,
  rib: Wallet,
};

const DriverVehiclePage = () => {
  const { user, api, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
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
  const [documentTypes, setDocumentTypes] = useState({});
  const [documentStatus, setDocumentStatus] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [activeTab, setActiveTab] = useState('vehicle');
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    if (user?.role !== 'driver') {
      navigate('/');
      return;
    }
    fetchDriverData();
  }, [user, navigate]);

  const fetchDriverData = async () => {
    try {
      const [docsResponse, statusResponse] = await Promise.all([
        api.get('/drivers/documents'),
        api.get('/drivers/documents/status')
      ]);
      
      if (docsResponse.data.vehicle_info) {
        setVehicleInfo(docsResponse.data.vehicle_info);
      }
      setDocuments(docsResponse.data.documents || {});
      setDocumentTypes(docsResponse.data.document_types || {});
      setDocumentStatus(statusResponse.data);
    } catch (error) {
      console.error('Error fetching driver data:', error);
      toast.error('Erreur lors du chargement des données');
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
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Le fichier ne doit pas dépasser 5 Mo');
      return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format accepté: JPG, PNG, WebP ou PDF');
      return;
    }
    
    setUploadingDoc(docType);
    
    try {
      // Convert to base64 for storage (in production, use cloud storage)
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result;
        
        try {
          await api.put('/drivers/documents', {
            document_type: docType,
            document_url: dataUrl,
            expiry_date: null
          });
          
          toast.success('Document téléversé avec succès');
          fetchDriverData(); // Refresh
        } catch (error) {
          toast.error('Erreur lors du téléversement');
        } finally {
          setUploadingDoc(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Erreur lors du téléversement');
      setUploadingDoc(null);
    }
  };

  const handleDeleteDocument = async (docType) => {
    if (!window.confirm('Supprimer ce document ?')) return;
    
    try {
      await api.delete(`/drivers/documents/${docType}`);
      toast.success('Document supprimé');
      fetchDriverData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const styles = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-500', label: 'En attente' },
      approved: { bg: 'bg-green-500/20', text: 'text-green-500', label: 'Validé' },
      rejected: { bg: 'bg-red-500/20', text: 'text-red-500', label: 'Refusé' }
    };
    const style = styles[status] || styles.pending;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  // Document card component
  const DocumentCard = ({ docType, docInfo, uploadedDoc }) => {
    const Icon = DOC_ICONS[docType] || FileText;
    const isUploaded = uploadedDoc?.url;
    const isUploading = uploadingDoc === docType;
    
    return (
      <Card className={`bg-card border-border/50 transition-all hover:border-primary/30 ${
        isUploaded ? 'border-l-4 border-l-green-500' : docInfo.required ? 'border-l-4 border-l-red-500' : ''
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isUploaded ? 'bg-green-500/20' : 'bg-muted/50'
            }`}>
              <Icon className={`w-6 h-6 ${isUploaded ? 'text-green-500' : 'text-muted-foreground'}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium truncate">{docInfo.name}</h4>
                {docInfo.required && (
                  <span className="text-xs text-red-500 bg-red-500/10 px-2 py-0.5 rounded">Requis</span>
                )}
              </div>
              
              {isUploaded ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={uploadedDoc.status} />
                    <span className="text-xs text-muted-foreground">
                      Ajouté le {uploadedDoc.uploaded_at?.slice(0, 10)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewDoc({ type: docType, ...uploadedDoc })}
                      className="h-8"
                    >
                      <Eye className="w-4 h-4 mr-1" /> Voir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDocument(docType)}
                      className="h-8 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Non téléversé</p>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => handleDocumentUpload(docType, e.target.files[0])}
                      disabled={isUploading}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={isUploading}
                      asChild
                    >
                      <span>
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Envoi...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-1" /> Téléverser
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Group documents by category
  const getDocumentsByCategory = () => {
    const grouped = {};
    Object.entries(documentTypes).forEach(([docType, docInfo]) => {
      const category = docInfo.category || 'other';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push({ docType, docInfo, uploadedDoc: documents[docType] });
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const documentsByCategory = getDocumentsByCategory();

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/driver">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
              Véhicule & Documents
            </h1>
            <p className="text-muted-foreground text-sm">
              Gérez vos informations et documents professionnels
            </p>
          </div>
        </div>

        {/* Progress Card */}
        {documentStatus && (
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-primary" />
                  <span className="font-medium">Progression des documents</span>
                </div>
                <span className="text-2xl font-bold text-primary">
                  {documentStatus.completion_percentage}%
                </span>
              </div>
              <Progress value={documentStatus.completion_percentage} className="h-2 mb-3" />
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-muted-foreground">
                  <span className="text-foreground font-medium">{documentStatus.total_uploaded}</span>/{documentStatus.total_required} téléversés
                </span>
                <span className="text-green-500">
                  <Check className="w-4 h-4 inline mr-1" />
                  {documentStatus.total_approved} validés
                </span>
                {documentStatus.pending_documents?.length > 0 && (
                  <span className="text-yellow-500">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {documentStatus.pending_documents.length} en attente
                  </span>
                )}
                {documentStatus.rejected_documents?.length > 0 && (
                  <span className="text-red-500">
                    <X className="w-4 h-4 inline mr-1" />
                    {documentStatus.rejected_documents.length} refusés
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border/50 pb-2 overflow-x-auto">
          <Button
            variant={activeTab === 'vehicle' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('vehicle')}
            className="shrink-0"
          >
            <Car className="w-4 h-4 mr-2" /> Véhicule
          </Button>
          {Object.entries(DOCUMENT_CATEGORIES).map(([key, cat]) => (
            <Button
              key={key}
              variant={activeTab === key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(key)}
              className="shrink-0"
            >
              <cat.icon className={`w-4 h-4 mr-2 ${cat.color}`} /> {cat.name}
            </Button>
          ))}
        </div>

        {/* Vehicle Info Tab */}
        {activeTab === 'vehicle' && (
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                Informations du véhicule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVehicleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Marque</Label>
                    <Input
                      value={vehicleInfo.make}
                      onChange={(e) => setVehicleInfo({ ...vehicleInfo, make: e.target.value })}
                      placeholder="Ex: Mercedes"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Modèle</Label>
                    <Input
                      value={vehicleInfo.model}
                      onChange={(e) => setVehicleInfo({ ...vehicleInfo, model: e.target.value })}
                      placeholder="Ex: Classe E"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Année</Label>
                    <Input
                      type="number"
                      value={vehicleInfo.year}
                      onChange={(e) => setVehicleInfo({ ...vehicleInfo, year: parseInt(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Couleur</Label>
                    <Input
                      value={vehicleInfo.color}
                      onChange={(e) => setVehicleInfo({ ...vehicleInfo, color: e.target.value })}
                      placeholder="Ex: Noir"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Immatriculation</Label>
                    <Input
                      value={vehicleInfo.license_plate}
                      onChange={(e) => setVehicleInfo({ ...vehicleInfo, license_plate: e.target.value.toUpperCase() })}
                      placeholder="Ex: AB-123-CD"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Type de véhicule</Label>
                  <div className="flex gap-4 mt-2">
                    <label className={`flex-1 cursor-pointer p-4 rounded-xl border-2 transition-all ${
                      vehicleInfo.vehicle_type === 'standard' 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border/50 hover:border-primary/50'
                    }`}>
                      <input
                        type="radio"
                        name="vehicle_type"
                        value="standard"
                        checked={vehicleInfo.vehicle_type === 'standard'}
                        onChange={(e) => setVehicleInfo({ ...vehicleInfo, vehicle_type: e.target.value })}
                        className="hidden"
                      />
                      <Car className="w-6 h-6 mb-2 text-primary" />
                      <p className="font-medium">Standard</p>
                      <p className="text-sm text-muted-foreground">4 places</p>
                    </label>
                    <label className={`flex-1 cursor-pointer p-4 rounded-xl border-2 transition-all ${
                      vehicleInfo.vehicle_type === 'van' 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border/50 hover:border-primary/50'
                    }`}>
                      <input
                        type="radio"
                        name="vehicle_type"
                        value="van"
                        checked={vehicleInfo.vehicle_type === 'van'}
                        onChange={(e) => setVehicleInfo({ ...vehicleInfo, vehicle_type: e.target.value })}
                        className="hidden"
                      />
                      <Car className="w-6 h-6 mb-2 text-primary" />
                      <p className="font-medium">Van</p>
                      <p className="text-sm text-muted-foreground">7 places</p>
                    </label>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="w-full h-12 bg-primary text-primary-foreground"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Enregistrer'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Document Category Tabs */}
        {activeTab !== 'vehicle' && documentsByCategory[activeTab] && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              {DOCUMENT_CATEGORIES[activeTab] && (
                <>
                  {React.createElement(DOCUMENT_CATEGORIES[activeTab].icon, {
                    className: `w-5 h-5 ${DOCUMENT_CATEGORIES[activeTab].color}`
                  })}
                  <h2 className="text-lg font-semibold">{DOCUMENT_CATEGORIES[activeTab].name}</h2>
                </>
              )}
            </div>
            
            <div className="grid gap-4">
              {documentsByCategory[activeTab].map(({ docType, docInfo, uploadedDoc }) => (
                <DocumentCard
                  key={docType}
                  docType={docType}
                  docInfo={docInfo}
                  uploadedDoc={uploadedDoc}
                />
              ))}
            </div>
          </div>
        )}

        {/* Document Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-3xl max-h-[90vh] bg-card rounded-2xl overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70"
                onClick={() => setPreviewDoc(null)}
              >
                <X className="w-5 h-5" />
              </Button>
              
              <div className="p-4 border-b border-border/50">
                <h3 className="font-semibold">
                  {documentTypes[previewDoc.type]?.name || previewDoc.type}
                </h3>
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <StatusBadge status={previewDoc.status} />
                  <span>Ajouté le {previewDoc.uploaded_at?.slice(0, 10)}</span>
                </div>
              </div>
              
              <div className="p-4 overflow-auto max-h-[70vh]">
                {previewDoc.url?.startsWith('data:image') ? (
                  <img 
                    src={previewDoc.url} 
                    alt={previewDoc.type} 
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : previewDoc.url?.startsWith('data:application/pdf') ? (
                  <iframe
                    src={previewDoc.url}
                    className="w-full h-[60vh] rounded-lg"
                    title={previewDoc.type}
                  />
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Aperçu non disponible
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverVehiclePage;
