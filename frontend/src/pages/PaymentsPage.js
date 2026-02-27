import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  ArrowLeft, CreditCard, Gift, Copy, Check, 
  MapPin, Navigation, Clock, DollarSign, Share2
} from 'lucide-react';
import { toast } from 'sonner';

const PaymentsPage = () => {
  const { api, user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [myCodes, setMyCodes] = useState([]);
  const [referralCode, setReferralCode] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, summaryRes, codesRes, referralRes] = await Promise.all([
        api.get('/payments/history'),
        api.get('/payments/summary'),
        api.get('/promo/my-codes'),
        api.get('/promo/referral')
      ]);
      setPayments(paymentsRes.data.payments);
      setSummary(summaryRes.data);
      setMyCodes(codesRes.data.promos);
      setReferralCode(referralRes.data.referral_code);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyPromoCode = async () => {
    if (!promoInput.trim()) {
      toast.error('Veuillez entrer un code');
      return;
    }
    
    setApplying(true);
    try {
      const response = await api.post('/promo/apply', { code: promoInput.trim() });
      toast.success(response.data.message);
      setPromoInput('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Code invalide');
    } finally {
      setApplying(false);
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success('Code copié!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferralCode = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Allogo - Code parrainage',
        text: `Utilise mon code ${referralCode} pour obtenir 10% de réduction sur ta première course Allogo!`,
      });
    } else {
      copyReferralCode();
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <span className="text-xs px-2 py-1 bg-green-500/20 text-green-500 rounded-full">Payé</span>;
      case 'initiated':
        return <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded-full">En cours</span>;
      default:
        return <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass p-4">
        <div className="flex items-center gap-4">
          <Link to="/passenger">
            <Button variant="ghost" size="icon" data-testid="back-btn" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>Paiements & Promos</h1>
        </div>
      </header>

      {/* Content */}
      <div className="pt-24 pb-8 px-4">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.total_spent}€</p>
                    <p className="text-xs text-muted-foreground">Total dépensé</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.total_rides_paid}</p>
                    <p className="text-xs text-muted-foreground">Courses payées</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="payments" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="payments" data-testid="tab-payments">
              <CreditCard className="w-4 h-4 mr-2" /> Paiements
            </TabsTrigger>
            <TabsTrigger value="promo" data-testid="tab-promo">
              <Gift className="w-4 h-4 mr-2" /> Promos
            </TabsTrigger>
          </TabsList>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun paiement</p>
              </div>
            ) : (
              payments.map((payment) => (
                <Card key={payment.id} className="bg-card border-border/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">{formatDate(payment.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(payment.status)}
                        <span className="text-lg font-bold">{payment.amount}€</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1 pt-2 border-t border-border">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground truncate">{payment.ride_pickup}</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <Navigation className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground truncate">{payment.ride_destination}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Promo Tab */}
          <TabsContent value="promo" className="space-y-6">
            {/* Apply Promo Code */}
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gift className="w-5 h-5 text-primary" /> Appliquer un code promo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="Entrez votre code"
                    className="h-12 bg-muted border-white/10 flex-1"
                    data-testid="promo-input"
                  />
                  <Button 
                    onClick={applyPromoCode}
                    disabled={applying}
                    className="h-12 bg-primary text-primary-foreground px-6"
                    data-testid="apply-promo-btn"
                  >
                    {applying ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Appliquer'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* My Active Codes */}
            {myCodes.length > 0 && (
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Mes codes actifs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {myCodes.map((code) => (
                    <div 
                      key={code.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                          <Gift className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-semibold">{code.code}</p>
                          <p className="text-sm text-muted-foreground">-{code.discount_percent}%</p>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">
                        Prochaine course
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Referral Code */}
            <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-primary" /> Parrainez vos amis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Partagez votre code et offrez 10% de réduction à vos amis sur leur première course!
                </p>
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-12 bg-background rounded-xl px-4 flex items-center justify-between">
                    <span className="font-mono font-bold text-lg">{referralCode}</span>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={copyReferralCode}
                      data-testid="copy-referral-btn"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  <Button 
                    onClick={shareReferralCode}
                    className="h-12 bg-primary text-primary-foreground"
                    data-testid="share-referral-btn"
                  >
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PaymentsPage;
