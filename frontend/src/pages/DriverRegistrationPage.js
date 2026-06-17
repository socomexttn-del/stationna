import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { 
  Car, ArrowLeft, ArrowRight, Upload, Check, X, User, FileText, 
  CreditCard, Camera, Building, Calendar, Phone, Mail, Lock, Eye, EyeOff,
  AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const DOCUMENT_TYPES = {
  // Personal documents
  permis_conduire: { name: "Permis de Conduire", category: "personal", required: true, hasExpiry: true, icon: CreditCard },
  cni: { name: "Pièce d'Identité (CNI/Passeport)", category: "personal", required: true, hasExpiry: true, icon: CreditCard },
  photo_visage: { name: "Photo du Visage (Selfie)", category: "personal", required: true, hasExpiry: false, icon: Camera, isPhoto: true },
  
  // Vehicle documents
  assurance_vehicule: { name: "Assurance Véhicule", category: "vehicle", required: true, hasExpiry: true, icon: FileText },
  controle_technique: { name: "Contrôle Technique", category: "vehicle", required: true, hasExpiry: true, icon: FileText },
  photo_voiture_avant: { name: "Photo Voiture - Avant", category: "vehicle", required: true, hasExpiry: false, icon: Camera, isPhoto: true },
  photo_voiture_arriere: { name: "Photo Voiture - Arrière", category: "vehicle", required: true, hasExpiry: false, icon: Camera, isPhoto: true },
  photo_voiture_profil: { name: "Photo Voiture - Profil", category: "vehicle", required: true, hasExpiry: false, icon: Camera, isPhoto: true },
  
  // Professional documents
  carte_professionnelle: { name: "Carte Professionnelle VTC/Taxi", category: "professional", required: true, hasExpiry: true, icon: CreditCard },
  assurance_transport: { name: "Assurance Transport à Titre Onéreux", category: "professional", required: true, hasExpiry: true, icon: FileText },
  licence_transport: { name: "Licence de Transport", category: "professional", required: true, hasExpiry: true, icon: FileText },
  kbis: { name: "Extrait KBIS", category: "professional", required: true, hasExpiry: true, icon: Building },
  
  // Financial
  rib: { name: "RIB (Relevé d'Identité Bancaire)", category: "financial", required: true, hasExpiry: false, icon: CreditCard },
};

const STEPS = [
  { id: 'personal', title: 'Informations personnelles', icon: User },
  { id: 'company', title: 'Informations société', icon: Building },
  { id: 'documents_personal', title: 'Documents personnels', icon: FileText },
  { id: 'documents_vehicle', title: 'Documents véhicule', icon: Car },
  { id: 'documents_professional', title: 'Documents professionnels', icon: CreditCard },
  { id: 'review', title: 'Vérification', icon: CheckCircle2 },
];

const DriverRegistrationPage = () => {
  const navigate = useNavigate();
  const { api } = useAuth();
  const fileInputRefs = useRef({});
  
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedCGV, setAcceptedCGV] = useState(false);
  
  // Personal info
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    // Company info
    company_name: '',
    siret: '',
    address: '',
    tva_number: '',
  });
  
  // Documents with expiry dates
  const [documents, setDocuments] = useState({});
  const [expiryDates, setExpiryDates] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileSelect = async (docType, file) => {
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez JPG, PNG, WEBP ou PDF.');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux. Maximum 10 Mo.');
      return;
    }
    
    setUploadingDoc(docType);
    
    try {
      // Convert to base64 for storage (in production, upload to cloud storage)
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocuments(prev => ({
          ...prev,
          [docType]: {
            name: file.name,
            type: file.type,
            data: reader.result,
            uploadedAt: new Date().toISOString()
          }
        }));
        setUploadingDoc(null);
        toast.success(`${DOCUMENT_TYPES[docType].name} téléchargé`);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erreur lors du téléchargement');
      setUploadingDoc(null);
    }
  };

  const handleExpiryChange = (docType, date) => {
    setExpiryDates(prev => ({ ...prev, [docType]: date }));
  };

  const removeDocument = (docType) => {
    setDocuments(prev => {
      const newDocs = { ...prev };
      delete newDocs[docType];
      return newDocs;
    });
    setExpiryDates(prev => {
      const newDates = { ...prev };
      delete newDates[docType];
      return newDates;
    });
  };

  const getDocumentsByCategory = (category) => {
    return Object.entries(DOCUMENT_TYPES).filter(([_, doc]) => doc.category === category);
  };

  const isStepComplete = (stepId) => {
    switch (stepId) {
      case 'personal':
        return formData.email && formData.password && formData.first_name && formData.last_name && formData.phone;
      case 'company':
        return formData.company_name && formData.siret && formData.address;
      case 'documents_personal':
        return getDocumentsByCategory('personal').every(([key, doc]) => 
          !doc.required || (documents[key] && (!doc.hasExpiry || expiryDates[key]))
        );
      case 'documents_vehicle':
        return getDocumentsByCategory('vehicle').every(([key, doc]) => 
          !doc.required || (documents[key] && (!doc.hasExpiry || expiryDates[key]))
        );
      case 'documents_professional':
        const profDocs = getDocumentsByCategory('professional');
        const finDocs = getDocumentsByCategory('financial');
        return [...profDocs, ...finDocs].every(([key, doc]) => 
          !doc.required || (documents[key] && (!doc.hasExpiry || expiryDates[key]))
        );
      default:
        return true;
    }
  };

  const canProceed = () => {
    return isStepComplete(STEPS[currentStep].id);
  };

  const handleSubmit = async () => {
    // Vérification CGV
    if (!acceptedCGV) {
      toast.error('Vous devez accepter les Conditions Générales de Vente pour vous inscrire');
      return;
    }
    
    setLoading(true);
    
    try {
      // Register driver account
      const registerResponse = await api.post('/auth/register', {
        ...formData,
        role: 'driver'
      });
      
      // Get token from registration
      const token = registerResponse.data.token;
      
      // Upload all documents
      for (const [docType, doc] of Object.entries(documents)) {
        await api.put('/drivers/documents', {
          document_type: docType,
          document_url: doc.data,
          expiry_date: expiryDates[docType] || null
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      // Update company info
      await api.put('/users/profile', {
        company_name: formData.company_name,
        siret: formData.siret,
        address: formData.address,
        tva_number: formData.tva_number
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Inscription réussie ! Votre compte est en attente de validation.');
      navigate('/auth?registered=true');
      
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const renderDocumentUpload = (docType, docInfo) => {
    const IconComponent = docInfo.icon;
    const isUploaded = !!documents[docType];
    const isUploading = uploadingDoc === docType;
    
    return (
      <div key={docType} className="bg-muted/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isUploaded ? 'bg-green-500/20' : 'bg-muted'}`}>
              {isUploaded ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <IconComponent className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm">{docInfo.name}</p>
              {docInfo.required && <p className="text-xs text-red-400">Obligatoire</p>}
            </div>
          </div>
          
          {isUploaded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeDocument(docType)}
              className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {isUploaded ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle2 className="w-4 h-4" />
              <span>{documents[docType].name}</span>
            </div>
            
            {docInfo.hasExpiry && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Date de validité</Label>
                <Input
                  type="date"
                  value={expiryDates[docType] || ''}
                  onChange={(e) => handleExpiryChange(docType, e.target.value)}
                  className="h-10 bg-background"
                  min={new Date().toISOString().split('T')[0]}
                  required={docInfo.hasExpiry}
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            <input
              type="file"
              ref={el => fileInputRefs.current[docType] = el}
              onChange={(e) => handleFileSelect(docType, e.target.files[0])}
              accept={docInfo.isPhoto ? "image/*" : "image/*,application/pdf"}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full h-12 border-dashed"
              onClick={() => fileInputRefs.current[docType]?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {docInfo.isPhoto ? 'Prendre ou choisir une photo' : 'Télécharger le document'}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderStepContent = () => {
    const step = STEPS[currentStep];
    
    switch (step.id) {
      case 'personal':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom *</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  className="h-12 bg-muted"
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom *</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  className="h-12 bg-muted"
                  placeholder="Dupont"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="h-12 bg-muted pl-10"
                  placeholder="jean.dupont@email.com"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="h-12 bg-muted pl-10"
                  placeholder="+33 6 12 34 56 78"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="h-12 bg-muted pl-10 pr-12"
                  placeholder="Minimum 8 caractères"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'company':
        return (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-amber-500 font-medium mb-1">
                <AlertCircle className="w-4 h-4" />
                <span>Information importante</span>
              </div>
              <p className="text-muted-foreground text-xs">
                Ces informations apparaîtront sur les factures émises à vos clients.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company_name">Nom de la société / Raison sociale *</Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  required
                  className="h-12 bg-muted pl-10"
                  placeholder="Ma Société VTC SARL"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="siret">Numéro SIRET *</Label>
              <Input
                id="siret"
                name="siret"
                value={formData.siret}
                onChange={handleChange}
                required
                className="h-12 bg-muted"
                placeholder="123 456 789 00012"
                maxLength={17}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Adresse du siège social *</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                className="h-12 bg-muted"
                placeholder="123 Rue de Paris, 75001 Paris"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tva_number">Numéro de TVA intracommunautaire</Label>
              <Input
                id="tva_number"
                name="tva_number"
                value={formData.tva_number}
                onChange={handleChange}
                className="h-12 bg-muted"
                placeholder="FR 12 345678901 (optionnel)"
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide si vous êtes auto-entrepreneur (mention TVA non applicable - article 293B du CGI)
              </p>
            </div>
          </div>
        );
        
      case 'documents_personal':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Téléchargez vos documents personnels. Formats acceptés : JPG, PNG, PDF (max 10 Mo)
            </p>
            {getDocumentsByCategory('personal').map(([key, doc]) => renderDocumentUpload(key, doc))}
          </div>
        );
        
      case 'documents_vehicle':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Téléchargez les documents et photos de votre véhicule.
            </p>
            {getDocumentsByCategory('vehicle').map(([key, doc]) => renderDocumentUpload(key, doc))}
          </div>
        );
        
      case 'documents_professional':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Téléchargez vos documents professionnels et bancaires.
            </p>
            {getDocumentsByCategory('professional').map(([key, doc]) => renderDocumentUpload(key, doc))}
            {getDocumentsByCategory('financial').map(([key, doc]) => renderDocumentUpload(key, doc))}
          </div>
        );
        
      case 'review':
        const totalDocs = Object.keys(DOCUMENT_TYPES).length;
        const uploadedDocs = Object.keys(documents).length;
        const allStepsComplete = STEPS.slice(0, -1).every(s => isStepComplete(s.id));
        
        return (
          <div className="space-y-6">
            <div className="text-center">
              {allStepsComplete ? (
                <>
                  <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-green-500">Dossier complet !</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Tous les documents requis ont été téléchargés.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-bold text-amber-500">Dossier incomplet</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Certains documents sont manquants. Veuillez compléter votre dossier.
                  </p>
                </>
              )}
            </div>
            
            {/* Summary */}
            <div className="space-y-3">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-medium mb-2">Informations personnelles</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Nom:</span>
                  <span>{formData.first_name} {formData.last_name}</span>
                  <span className="text-muted-foreground">Email:</span>
                  <span>{formData.email}</span>
                  <span className="text-muted-foreground">Téléphone:</span>
                  <span>{formData.phone}</span>
                </div>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-medium mb-2">Société</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Raison sociale:</span>
                  <span>{formData.company_name}</span>
                  <span className="text-muted-foreground">SIRET:</span>
                  <span>{formData.siret}</span>
                </div>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-medium mb-2">Documents ({uploadedDocs}/{totalDocs})</h4>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  {Object.entries(DOCUMENT_TYPES).map(([key, doc]) => (
                    <div key={key} className="flex items-center gap-1">
                      {documents[key] ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-red-400" />
                      )}
                      <span className={documents[key] ? 'text-green-500' : 'text-red-400'}>
                        {doc.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm">
              <p className="text-blue-400">
                <strong>Prochaine étape :</strong> Après votre inscription, un administrateur vérifiera vos documents. 
                Vous recevrez un email de confirmation une fois votre compte activé.
              </p>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="p-4 border-b border-border/50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </Link>
          <div className="flex items-center gap-2">
            <Car className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">Devenir Chauffeur</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 pb-32">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const isComplete = index < currentStep || (index === currentStep && isStepComplete(step.id));
              
              return (
                <div key={step.id} className="flex flex-col items-center">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      isComplete ? 'bg-green-500' : isActive ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    {isComplete && index < currentStep ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <StepIcon className={`w-5 h-5 ${isActive || isComplete ? 'text-white' : 'text-muted-foreground'}`} />
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 text-center max-w-[60px] ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Progress bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep + (canProceed() ? 1 : 0)) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {React.createElement(STEPS[currentStep].icon, { className: "w-5 h-5 text-primary" })}
              {STEPS[currentStep].title}
            </CardTitle>
            <CardDescription>
              Étape {currentStep + 1} sur {STEPS.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepContent()}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 p-4">
        <div className="max-w-2xl mx-auto flex gap-4">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex-1 h-12"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Précédent
            </Button>
          )}
          
          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
              className="flex-1 h-12 bg-primary text-primary-foreground"
            >
              Suivant
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <div className="flex-1 space-y-4">
              {/* CGV Checkbox */}
              <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-xl border border-border">
                <Checkbox
                  id="accept-cgv-driver"
                  checked={acceptedCGV}
                  onCheckedChange={setAcceptedCGV}
                  data-testid="accept-cgv-driver-checkbox"
                  className="mt-0.5"
                />
                <label
                  htmlFor="accept-cgv-driver"
                  className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                >
                  J&apos;ai lu et j&apos;accepte les{' '}
                  <Link to="/cgv" target="_blank" className="text-primary hover:underline">
                    Conditions Générales de Vente
                  </Link>{' '}
                  et les{' '}
                  <Link to="/mentions-legales" target="_blank" className="text-primary hover:underline">
                    Mentions Légales
                  </Link>
                  . Je m&apos;engage à respecter les obligations du statut de chauffeur VTC/Taxi partenaire StationCab.
                </label>
              </div>
              
              <Button
                onClick={handleSubmit}
                disabled={loading || !acceptedCGV || !STEPS.slice(0, -1).every(s => isStepComplete(s.id))}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Soumettre mon inscription
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverRegistrationPage;
