import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import StationCabLogo from '../components/StationCabLogo';
import { Car, User, ArrowLeft, Eye, EyeOff, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

const AuthPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') || 'passenger';
  const isRegistered = searchParams.get('registered') === 'true';
  const { login, register } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState(defaultRole);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptedCGV, setAcceptedCGV] = useState(false);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(isRegistered);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: ''
  });

  useEffect(() => {
    if (isRegistered) {
      setShowRegistrationSuccess(true);
    }
  }, [isRegistered]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Vérification CGV pour inscription
    if (!isLogin && !acceptedCGV) {
      toast.error('Vous devez accepter les Conditions Générales de Vente pour vous inscrire');
      return;
    }
    
    setLoading(true);
    
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast.success(t('common.success'));
      } else {
        await register({ ...formData, role });
        toast.success(t('common.success'));
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>{t('common.back')}</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        {/* Registration Success Message for Drivers */}
        {showRegistrationSuccess ? (
          <Card className="w-full max-w-md bg-card border-border/50">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-green-500" style={{ fontFamily: 'Space Grotesk' }}>
                  Inscription réussie !
                </h2>
                <p className="text-lg text-foreground">
                  Votre compte chauffeur a bien été créé.
                </p>
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-amber-500">
                  <Clock className="w-5 h-5" />
                  <span className="font-semibold">En attente de validation</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Nos équipes vont vérifier vos documents et informations. 
                  Vous recevrez une notification dès que votre compte sera activé.
                </p>
                <p className="text-sm text-muted-foreground">
                  Délai habituel : <span className="font-medium text-foreground">24 à 48h ouvrées</span>
                </p>
              </div>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowRegistrationSuccess(false)}
              >
                Retour à la connexion
              </Button>
            </CardContent>
          </Card>
        ) : (
        <Card className="w-full max-w-md bg-card border-border/50">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex justify-center">
              <StationCabLogo size="large" showText={false} darkMode={true} />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                {isLogin ? t('auth.login') : t('auth.register')}
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                {isLogin ? t('auth.loginSubtitle', 'Accédez à votre compte StationCab') : t('auth.registerSubtitle', 'Créez votre compte StationCab')}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            {!isLogin && (
              <div className="mb-6">
                <Label className="text-sm text-muted-foreground mb-3 block">{t('auth.iAm', 'Je suis un(e)')}</Label>
                <Tabs value={role} onValueChange={setRole}>
                  <TabsList className="grid grid-cols-2 w-full bg-muted">
                    <TabsTrigger 
                      value="passenger" 
                      data-testid="role-passenger-tab"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <User className="w-4 h-4 mr-2" />
                      {t('auth.passenger')}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="driver" 
                      data-testid="role-driver-tab"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <Car className="w-4 h-4 mr-2" />
                      {t('auth.driver')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">{t('auth.firstName')}</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      data-testid="input-firstname"
                      value={formData.first_name}
                      onChange={handleChange}
                      required={!isLogin}
                      className="h-12 bg-muted border-white/10 focus:border-primary/50"
                      placeholder="Jean"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">{t('auth.lastName')}</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      data-testid="input-lastname"
                      value={formData.last_name}
                      onChange={handleChange}
                      required={!isLogin}
                      className="h-12 bg-muted border-white/10 focus:border-primary/50"
                      placeholder="Dupont"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  data-testid="input-email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="h-12 bg-muted border-white/10 focus:border-primary/50"
                  placeholder="jean.dupont@email.com"
                />
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('auth.phone')}</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    data-testid="input-phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required={!isLogin}
                    className="h-12 bg-muted border-white/10 focus:border-primary/50"
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    data-testid="input-password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="h-12 bg-muted border-white/10 focus:border-primary/50 pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {isLogin && (
                  <div className="text-right mt-1">
                    <a 
                      href="/forgot-password" 
                      className="text-sm text-primary hover:underline"
                    >
                      Mot de passe oublié ?
                    </a>
                  </div>
                )}
              </div>

              {/* Case à cocher CGV pour inscription */}
              {!isLogin && (
                <div className="flex items-start space-x-3 pt-2">
                  <Checkbox
                    id="accept-cgv"
                    checked={acceptedCGV}
                    onCheckedChange={setAcceptedCGV}
                    data-testid="accept-cgv-checkbox"
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="accept-cgv"
                    className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                  >
                    J&apos;accepte les{' '}
                    <Link to="/cgv" target="_blank" className="text-primary hover:underline">
                      CGV
                    </Link>,{' '}
                    la{' '}
                    <Link to="/politique-confidentialite" target="_blank" className="text-primary hover:underline">
                      Politique de confidentialité
                    </Link>{' '}
                    et le traitement de mes données personnelles conformément au RGPD.
                  </label>
                </div>
              )}

              <Button
                type="submit"
                data-testid="auth-submit-btn"
                disabled={loading}
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold mt-6"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  isLogin ? t('auth.login') : t('auth.register')
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                data-testid="toggle-auth-mode"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
              </button>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
