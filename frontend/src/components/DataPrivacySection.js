import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import { 
  Shield, 
  Download, 
  Trash2, 
  AlertTriangle, 
  Eye, 
  Lock,
  Loader2,
  FileJson,
  CheckCircle
} from 'lucide-react';

const DataPrivacySection = () => {
  const { api, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Export personal data
  const handleExportData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/my-data');
      
      // Create and download JSON file
      const dataStr = JSON.stringify(response.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stationcab_mes_donnees_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Vos données ont été téléchargées');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Erreur lors de l\'export des données');
    }
    setLoading(false);
  };

  // Request account deletion
  const handleRequestDeletion = async () => {
    try {
      await api.post('/users/request-deletion');
      toast.success('Un email de confirmation vous a été envoyé');
      setShowDeleteConfirm(true);
    } catch (error) {
      console.error('Error requesting deletion:', error);
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  // Confirm account deletion
  const handleConfirmDeletion = async () => {
    if (!deletePassword) {
      toast.error('Veuillez entrer votre mot de passe');
      return;
    }

    setDeleting(true);
    try {
      await api.delete('/users/my-account', {
        params: { password: deletePassword }
      });
      
      toast.success('Votre compte a été supprimé');
      
      // Logout and redirect
      setTimeout(() => {
        logout();
      }, 2000);
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
    setDeleting(false);
  };

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Shield className="w-5 h-5 text-primary" />
          Mes données personnelles (RGPD)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info */}
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
          <p className="text-sm text-gray-300">
            Conformément au RGPD, vous pouvez accéder à vos données, les télécharger 
            ou demander la suppression de votre compte.
          </p>
        </div>

        {/* Rights */}
        <div className="grid gap-4">
          {/* Right to access / portability */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Download className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Télécharger mes données</h4>
                <p className="text-sm text-gray-400">
                  Obtenez une copie de toutes vos données personnelles
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleExportData}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileJson className="w-4 h-4" />
              )}
              Exporter (JSON)
            </Button>
          </div>

          {/* Right to rectification */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Eye className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Modifier mes informations</h4>
                <p className="text-sm text-gray-400">
                  Mettez à jour vos données personnelles
                </p>
              </div>
            </div>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>

          {/* Right to erasure */}
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Supprimer mon compte</h4>
                <p className="text-sm text-gray-400">
                  Effacer définitivement toutes vos données
                </p>
              </div>
            </div>

            {!showDeleteConfirm ? (
              <Button 
                variant="outline" 
                onClick={handleRequestDeletion}
                className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Demander la suppression
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-red-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-red-400">Attention !</p>
                      <p className="text-red-200">
                        Cette action est irréversible. Toutes vos données seront supprimées.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-gray-400">
                    Confirmez avec votre mot de passe :
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Votre mot de passe"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword('');
                    }}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleConfirmDeletion}
                    disabled={deleting || !deletePassword}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Supprimer définitivement
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contact DPO */}
        <p className="text-xs text-gray-500 text-center">
          Pour toute question sur vos données : {' '}
          <a href="mailto:contact@stationcab.fr" className="text-primary hover:underline">
            contact@stationcab.fr
          </a>
        </p>
      </CardContent>
    </Card>
  );
};

export default DataPrivacySection;
