import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Users, ArrowLeft, RefreshCw, Check, X, Loader2, 
  FileText, Clock, CheckCircle2, XCircle, AlertCircle,
  Eye, Building, Phone, Mail, Calendar, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const DOCUMENT_NAMES = {
  permis_conduire: "Permis de Conduire",
  cni: "Pièce d'Identité",
  photo_visage: "Photo du Visage",
  assurance_vehicule: "Assurance Véhicule",
  controle_technique: "Contrôle Technique",
  photo_voiture_avant: "Photo Voiture - Avant",
  photo_voiture_arriere: "Photo Voiture - Arrière",
  photo_voiture_profil: "Photo Voiture - Profil",
  carte_professionnelle: "Carte Professionnelle",
  assurance_transport: "Assurance Transport",
  licence_transport: "Licence de Transport",
  kbis: "Extrait KBIS",
  rib: "RIB",
};

const AdminDriverValidationPage = () => {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDriver, setExpandedDriver] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [updatingDoc, setUpdatingDoc] = useState(null);
  const [validatingDriver, setValidatingDriver] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Accès non autorisé');
      navigate('/');
      return;
    }
    fetchPendingDrivers();
  }, [user, navigate]);

  const fetchPendingDrivers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/drivers/pending-validation');
      setPendingDrivers(response.data.drivers || []);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const updateDocumentStatus = async (driverId, docType, status) => {
    setUpdatingDoc(`${driverId}-${docType}`);
    try {
      await api.put(`/admin/drivers/${driverId}/documents/${docType}/status?status=${status}`);
      
      // Update local state
      setPendingDrivers(prev => prev.map(driver => {
        if (driver.id === driverId) {
          return {
            ...driver,
            documents: {
              ...driver.documents,
              [docType]: {
                ...driver.documents[docType],
                status: status
              }
            }
          };
        }
        return driver;
      }));
      
      toast.success(`Document ${status === 'approved' ? 'approuvé' : 'rejeté'}`);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdatingDoc(null);
    }
  };

  const validateDriverAccount = async (driverId) => {
    setValidatingDriver(driverId);
    try {
      await api.put(`/admin/drivers/${driverId}/validate`);
      toast.success('Compte chauffeur validé et activé !');
      // Remove from pending list
      setPendingDrivers(prev => prev.filter(d => d.id !== driverId));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la validation');
    } finally {
      setValidatingDriver(null);
    }
  };

  const getDocStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getDocStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Approuvé</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Rejeté</Badge>;
      default:
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">En attente</Badge>;
    }
  };

  const canValidateDriver = (driver) => {
    const documents = driver.documents || {};
    const requiredDocs = Object.keys(DOCUMENT_NAMES);
    return requiredDocs.every(docType => 
      documents[docType]?.status === 'approved'
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR');
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
                <FileText className="w-8 h-8 text-primary" />
                Validation des Chauffeurs
              </h1>
              <p className="text-muted-foreground mt-1">
                {pendingDrivers.length} chauffeur(s) en attente de validation
              </p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={fetchPendingDrivers}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Pending Drivers List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : pendingDrivers.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Aucun chauffeur en attente</h3>
              <p className="text-muted-foreground">Tous les chauffeurs ont été validés</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingDrivers.map((driver) => {
              const isExpanded = expandedDriver === driver.id;
              const documents = driver.documents || {};
              const progress = driver.document_progress || {};
              const allApproved = canValidateDriver(driver);
              
              return (
                <Card key={driver.id} className="bg-card border-border/50">
                  <CardHeader 
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedDriver(isExpanded ? null : driver.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                          <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {driver.first_name} {driver.last_name}
                          </CardTitle>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {driver.email}
                            </span>
                            {driver.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {driver.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Progression</p>
                          <p className="font-bold text-lg">
                            {progress.approved || 0}/{progress.total_required || 13}
                          </p>
                        </div>
                        
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${allApproved ? 'bg-green-500' : 'bg-primary'}`}
                            style={{ width: `${progress.completion_percent || 0}%` }}
                          />
                        </div>
                        
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="border-t border-border/50 pt-4">
                      {/* Company Info */}
                      {(driver.company_name || driver.siret) && (
                        <div className="bg-muted/30 rounded-lg p-4 mb-4">
                          <h4 className="font-medium flex items-center gap-2 mb-2">
                            <Building className="w-4 h-4" />
                            Informations Société
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {driver.company_name && (
                              <>
                                <span className="text-muted-foreground">Raison sociale:</span>
                                <span>{driver.company_name}</span>
                              </>
                            )}
                            {driver.siret && (
                              <>
                                <span className="text-muted-foreground">SIRET:</span>
                                <span>{driver.siret}</span>
                              </>
                            )}
                            {driver.address && (
                              <>
                                <span className="text-muted-foreground">Adresse:</span>
                                <span>{driver.address}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Documents Grid */}
                      <h4 className="font-medium mb-3">Documents ({progress.uploaded || 0} téléchargés)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(DOCUMENT_NAMES).map(([docType, docName]) => {
                          const doc = documents[docType];
                          const hasDoc = doc && doc.url;
                          const isUpdating = updatingDoc === `${driver.id}-${docType}`;
                          
                          return (
                            <div 
                              key={docType}
                              className={`p-3 rounded-lg border ${hasDoc ? 'bg-muted/30 border-border/50' : 'bg-red-500/5 border-red-500/20'}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {hasDoc ? getDocStatusIcon(doc.status) : <AlertCircle className="w-4 h-4 text-red-400" />}
                                  <span className="font-medium text-sm">{docName}</span>
                                </div>
                                
                                {hasDoc && getDocStatusBadge(doc.status)}
                              </div>
                              
                              {hasDoc ? (
                                <div className="mt-2 space-y-2">
                                  {doc.expiry_date && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      Expire le: {formatDate(doc.expiry_date)}
                                    </p>
                                  )}
                                  
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setPreviewDoc({ url: doc.url, name: docName })}
                                      className="h-7 text-xs"
                                    >
                                      <Eye className="w-3 h-3 mr-1" />
                                      Voir
                                    </Button>
                                    
                                    {doc.status !== 'approved' && (
                                      <Button
                                        size="sm"
                                        onClick={() => updateDocumentStatus(driver.id, docType, 'approved')}
                                        disabled={isUpdating}
                                        className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                      >
                                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                                        Approuver
                                      </Button>
                                    )}
                                    
                                    {doc.status !== 'rejected' && (
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => updateDocumentStatus(driver.id, docType, 'rejected')}
                                        disabled={isUpdating}
                                        className="h-7 text-xs"
                                      >
                                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
                                        Rejeter
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-red-400 mt-1">Document non téléchargé</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Validate Button */}
                      <div className="mt-6 pt-4 border-t border-border/50 flex justify-end">
                        <Button
                          onClick={() => validateDriverAccount(driver.id)}
                          disabled={!allApproved || validatingDriver === driver.id}
                          className={`${allApproved ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'}`}
                        >
                          {validatingDriver === driver.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                          )}
                          {allApproved ? 'Valider et Activer le Compte' : 'Tous les documents doivent être approuvés'}
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 max-h-[70vh] overflow-auto">
            {previewDoc?.url && (
              previewDoc.url.startsWith('data:image') ? (
                <img src={previewDoc.url} alt={previewDoc.name} className="w-full h-auto" />
              ) : previewDoc.url.startsWith('data:application/pdf') ? (
                <iframe 
                  src={previewDoc.url} 
                  className="w-full h-[60vh]" 
                  title={previewDoc.name}
                />
              ) : (
                <p className="text-muted-foreground">Aperçu non disponible</p>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDriverValidationPage;
