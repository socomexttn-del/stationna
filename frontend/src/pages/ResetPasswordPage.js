import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Mail, Lock, ArrowLeft, Check } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // If we have a token, we're in reset mode
  const isResetMode = !!token;

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Veuillez entrer votre email');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
      setEmailSent(true);
      toast.success('Email envoyé !');
    } catch (error) {
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/reset-password`, {
        token,
        new_password: newPassword
      });
      setResetSuccess(true);
      toast.success('Mot de passe modifié !');
      setTimeout(() => navigate('/auth'), 2000);
    } catch (error) {
      const message = error.response?.data?.detail || 'Erreur lors de la réinitialisation';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">Mot de passe modifié !</h2>
            <p className="text-muted-foreground">Redirection vers la connexion...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (emailSent && !isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Email envoyé !</h2>
            <p className="text-muted-foreground mb-4">
              Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Vérifiez votre boîte mail (et les spams).
            </p>
            <Button variant="outline" onClick={() => navigate('/auth')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {isResetMode ? 'Nouveau mot de passe' : 'Mot de passe oublié ?'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isResetMode ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Modification...' : 'Modifier le mot de passe'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Entrez votre email pour recevoir un lien de réinitialisation.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Envoi...' : 'Envoyer le lien'}
              </Button>
              
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full"
                onClick={() => navigate('/auth')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à la connexion
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
