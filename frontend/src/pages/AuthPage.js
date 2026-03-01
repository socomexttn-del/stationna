import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Car, User, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const AuthPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') || 'passenger';
  const { login, register } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState(defaultRole);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        <Card className="w-full max-w-md bg-card border-border/50">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <Car className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                {isLogin ? t('auth.login') : t('auth.register')}
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                {isLogin ? 'Accédez à votre compte Allogo' : 'Créez votre compte Allogo'}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            {!isLogin && (
              <div className="mb-6">
                <Label className="text-sm text-muted-foreground mb-3 block">Je suis un(e)</Label>
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
              </div>

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
      </div>
    </div>
  );
};

export default AuthPage;
