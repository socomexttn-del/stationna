import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Wallet, ArrowLeft, Plus, Minus, CreditCard, Clock, 
  CheckCircle, XCircle, Loader2, ArrowUpRight, ArrowDownLeft,
  TrendingUp, History, ChevronRight, ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';

// Top-up amount buttons
const TOPUP_AMOUNTS = [10, 20, 50, 100];

// Payment form component
const TopUpForm = ({ clientSecret, amount, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: { card: elements.getElement(CardElement) } }
      );
      
      if (stripeError) {
        setError(stripeError.message);
      } else if (paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent);
      }
    } catch (err) {
      setError(err.message || 'Erreur de paiement');
    } finally {
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#ffffff',
        '::placeholder': { color: '#6b7280' },
        iconColor: '#facc15',
      },
      invalid: { color: '#ef4444', iconColor: '#ef4444' },
    },
    hidePostalCode: true,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center py-4 bg-primary/10 rounded-xl">
        <p className="text-sm text-muted-foreground">Montant à créditer</p>
        <p className="text-3xl font-bold text-primary">+{amount}€</p>
      </div>
      
      <div className="bg-muted/50 rounded-xl p-4 border border-white/10">
        <CardElement options={cardElementOptions} />
      </div>
      
      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
      
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Annuler
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || isProcessing}
          className="flex-1 bg-primary text-primary-foreground"
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement...</>
          ) : (
            <><CreditCard className="w-4 h-4 mr-2" /> Payer {amount}€</>
          )}
        </Button>
      </div>
    </form>
  );
};

const WalletPage = () => {
  const { api } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Top-up state
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(20);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentData, setPaymentData] = useState(null);
  const [stripePromise, setStripePromise] = useState(null);
  const [processingTopUp, setProcessingTopUp] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, [page]);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      const [balanceRes, transactionsRes] = await Promise.all([
        api.get('/wallet/balance'),
        api.get(`/wallet/transactions?page=${page}&limit=10`)
      ]);
      setBalance(balanceRes.data.balance);
      setTransactions(transactionsRes.data.transactions);
      setTotalPages(transactionsRes.data.pages);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const initiateTopUp = async () => {
    const amount = customAmount ? parseFloat(customAmount) : topUpAmount;
    if (amount < 5 || amount > 500) {
      toast.error('Montant entre 5€ et 500€');
      return;
    }
    
    setProcessingTopUp(true);
    try {
      const response = await api.post('/wallet/top-up', { amount });
      setPaymentData({
        clientSecret: response.data.client_secret,
        amount: response.data.amount,
        paymentIntentId: response.data.payment_intent_id
      });
      setStripePromise(loadStripe(response.data.publishable_key));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setProcessingTopUp(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntent) => {
    try {
      const response = await api.post(`/wallet/confirm-topup?payment_intent_id=${paymentIntent.id}`);
      toast.success(response.data.message);
      setBalance(response.data.new_balance);
      setPaymentData(null);
      setShowTopUp(false);
      setCustomAmount('');
      fetchWalletData();
    } catch (error) {
      toast.error('Erreur lors de la confirmation');
    }
  };

  const handleCancel = () => {
    setPaymentData(null);
    setShowTopUp(false);
    setCustomAmount('');
  };

  // Transaction icon and color
  const getTransactionStyle = (type, amount) => {
    if (type === 'topup' || amount > 0) {
      return { icon: ArrowDownLeft, color: 'text-green-500', bg: 'bg-green-500/20' };
    }
    return { icon: ArrowUpRight, color: 'text-red-500', bg: 'bg-red-500/20' };
  };

  // Status badge
  const StatusBadge = ({ status }) => {
    const styles = {
      completed: { bg: 'bg-green-500/20', text: 'text-green-500', icon: CheckCircle },
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-500', icon: Clock },
      failed: { bg: 'bg-red-500/20', text: 'text-red-500', icon: XCircle }
    };
    const style = styles[status] || styles.pending;
    const Icon = style.icon;
    
    return (
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${style.bg} ${style.text}`}>
        <Icon className="w-3 h-3" />
        {status === 'completed' ? 'Terminé' : status === 'pending' ? 'En cours' : 'Échoué'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
              Mon Portefeuille
            </h1>
            <p className="text-sm text-muted-foreground">Gérez votre solde Allogo</p>
          </div>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/30 overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Solde disponible</p>
                  <p className="text-4xl font-bold text-primary">
                    {loading ? '...' : `${balance.toFixed(2)}€`}
                  </p>
                </div>
              </div>
              
              {!showTopUp && (
                <Button 
                  onClick={() => setShowTopUp(true)}
                  className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="topup-btn"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Recharger mon portefeuille
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top-Up Form */}
        {showTopUp && !paymentData && (
          <Card className="bg-card border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Recharger
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick amounts */}
              <div>
                <p className="text-sm text-muted-foreground mb-3">Montant rapide</p>
                <div className="grid grid-cols-4 gap-2">
                  {TOPUP_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => { setTopUpAmount(amount); setCustomAmount(''); }}
                      className={`p-3 rounded-xl border-2 font-semibold transition-all ${
                        topUpAmount === amount && !customAmount
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 hover:border-primary/50'
                      }`}
                    >
                      {amount}€
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Custom amount */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Ou montant personnalisé</p>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Montant (5€ - 500€)"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    min="5"
                    max="500"
                    className="h-12 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleCancel} className="flex-1">
                  Annuler
                </Button>
                <Button 
                  onClick={initiateTopUp}
                  disabled={processingTopUp}
                  className="flex-1 bg-primary text-primary-foreground"
                  data-testid="confirm-topup-btn"
                >
                  {processingTopUp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Continuer - {customAmount || topUpAmount}€</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Form */}
        {paymentData && stripePromise && (
          <Card className="bg-card border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Paiement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Elements stripe={stripePromise} options={{ clientSecret: paymentData.clientSecret }}>
                <TopUpForm
                  clientSecret={paymentData.clientSecret}
                  amount={paymentData.amount}
                  onSuccess={handlePaymentSuccess}
                  onCancel={handleCancel}
                />
              </Elements>
            </CardContent>
          </Card>
        )}

        {/* Transaction History */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-muted-foreground" />
              Historique
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune transaction</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const style = getTransactionStyle(tx.type, tx.amount);
                    const Icon = style.icon;
                    return (
                      <div 
                        key={tx.id}
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl"
                      >
                        <div className={`w-10 h-10 rounded-full ${style.bg} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${style.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{tx.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <StatusBadge status={tx.status} />
                          </div>
                        </div>
                        <p className={`font-bold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}€
                        </p>
                      </div>
                    );
                  })}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/30">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} / {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WalletPage;
