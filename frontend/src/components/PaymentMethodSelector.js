import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  CreditCard, Plus, Check, Loader2, ChevronRight, Wallet
} from 'lucide-react';
import { toast } from 'sonner';

// Card brand display
const CardBrandIcon = ({ brand }) => {
  const brandColors = {
    visa: '#1A1F71',
    mastercard: '#EB001B',
    amex: '#006FCF',
    discover: '#FF6000',
    default: '#6B7280'
  };
  
  return (
    <div 
      className="w-10 h-7 rounded flex items-center justify-center text-white text-xs font-bold uppercase"
      style={{ backgroundColor: brandColors[brand?.toLowerCase()] || brandColors.default }}
    >
      {brand?.slice(0, 4) || 'Card'}
    </div>
  );
};

// New Card Form
const NewCardForm = ({ clientSecret, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: { card: elements.getElement(CardElement) } }
      );

      if (error) {
        onError(error.message);
      } else if (paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent);
      }
    } catch (err) {
      onError(err.message || 'Erreur de paiement');
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
      <div className="bg-muted/50 rounded-xl p-4 border border-white/10">
        <CardElement options={cardElementOptions} />
      </div>
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing}
        className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold text-lg"
        data-testid="confirm-payment-btn"
      >
        {isProcessing ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Traitement...</>
        ) : (
          <><CreditCard className="w-5 h-5 mr-2" />Payer</>
        )}
      </Button>
    </form>
  );
};

// Main Component
const PaymentMethodSelector = ({ 
  api, rideId, amount, rideName, onSuccess, onCancel, onError 
}) => {
  const [savedCards, setSavedCards] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState(null); // 'wallet', card_id, or null for new
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [cardsRes, walletRes, intentRes] = await Promise.all([
          api.get('/payments/saved-cards'),
          api.get('/wallet/balance'),
          api.post('/payments/create-payment-intent', { ride_id: rideId })
        ]);
        
        setSavedCards(cardsRes.data || []);
        setWalletBalance(walletRes.data.balance || 0);
        setClientSecret(intentRes.data.client_secret);
        setStripePromise(loadStripe(intentRes.data.publishable_key));
        
        // Auto-select best payment method
        if (walletRes.data.balance >= amount) {
          setSelectedMethod('wallet');
        } else {
          const defaultCard = cardsRes.data?.find(c => c.is_default);
          if (defaultCard) setSelectedMethod(defaultCard.id);
          else if (cardsRes.data?.length > 0) setSelectedMethod(cardsRes.data[0].id);
          else setShowNewCardForm(true);
        }
      } catch (error) {
        console.error('Error initializing payment:', error);
        onError?.(error.response?.data?.detail || 'Erreur d\'initialisation');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [api, rideId, amount, onError]);

  // Pay with wallet
  const handlePayWithWallet = async () => {
    setIsProcessing(true);
    try {
      const response = await api.post('/wallet/pay', { ride_id: rideId });
      toast.success(response.data.message);
      onSuccess?.({ id: 'wallet_payment', new_balance: response.data.new_balance });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur de paiement');
      onError?.(error.response?.data?.detail);
    } finally {
      setIsProcessing(false);
    }
  };

  // Pay with saved card
  const handlePayWithSavedCard = async () => {
    if (!selectedMethod || selectedMethod === 'wallet') return;
    setIsProcessing(true);
    try {
      const response = await api.post('/payments/pay-with-saved-card', {
        ride_id: rideId,
        payment_method_id: selectedMethod
      });
      if (response.data.status === 'succeeded') {
        toast.success('Paiement effectué !');
        onSuccess?.({ id: 'saved_card_payment' });
      } else {
        toast.error(response.data.message || 'Paiement en attente');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur de paiement');
      onError?.(error.response?.data?.detail);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewCardSuccess = (paymentIntent) => {
    toast.success('Paiement effectué !');
    onSuccess?.(paymentIntent);
  };

  const handlePay = () => {
    if (selectedMethod === 'wallet') handlePayWithWallet();
    else if (selectedMethod) handlePayWithSavedCard();
  };

  const canUseWallet = walletBalance >= amount;

  if (isLoading) {
    return (
      <Card className="bg-card border-border/50">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          Paiement
        </CardTitle>
        <p className="text-sm text-muted-foreground">{rideName}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Amount Display */}
        <div className="text-center py-4 bg-muted/30 rounded-xl">
          <p className="text-sm text-muted-foreground">Montant à payer</p>
          <p className="text-3xl font-bold text-primary">{amount}€</p>
        </div>

        {!showNewCardForm && (
          <div className="space-y-3">
            {/* Wallet Option */}
            <button
              onClick={() => setSelectedMethod('wallet')}
              disabled={!canUseWallet}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                selectedMethod === 'wallet' 
                  ? 'border-primary bg-primary/10' 
                  : canUseWallet 
                    ? 'border-border/50 bg-muted/30 hover:border-primary/50'
                    : 'border-border/30 bg-muted/10 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedMethod === 'wallet' ? 'border-primary bg-primary' : 'border-muted-foreground'
                }`}>
                  {selectedMethod === 'wallet' && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <div className="w-10 h-7 rounded bg-primary/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Portefeuille Allogo</p>
                  <p className="text-xs text-muted-foreground">
                    Solde: {walletBalance.toFixed(2)}€
                    {!canUseWallet && <span className="text-red-400 ml-1">(insuffisant)</span>}
                  </p>
                </div>
              </div>
              {canUseWallet && (
                <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full">
                  Recommandé
                </span>
              )}
            </button>

            {/* Saved Cards */}
            {savedCards.length > 0 && (
              <p className="text-sm font-medium text-muted-foreground pt-2">Cartes enregistrées</p>
            )}
            {savedCards.map((card) => (
              <button
                key={card.id}
                onClick={() => setSelectedMethod(card.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                  selectedMethod === card.id 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border/50 bg-muted/30 hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === card.id ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {selectedMethod === card.id && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <CardBrandIcon brand={card.brand} />
                  <div className="text-left">
                    <p className="font-medium">•••• {card.last4}</p>
                    <p className="text-xs text-muted-foreground">
                      Expire {card.exp_month.toString().padStart(2, '0')}/{card.exp_year}
                    </p>
                  </div>
                </div>
                {card.is_default && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                    Par défaut
                  </span>
                )}
              </button>
            ))}

            {/* Pay Button */}
            {selectedMethod && (
              <Button 
                onClick={handlePay}
                disabled={isProcessing}
                className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold text-lg"
                data-testid="pay-btn"
              >
                {isProcessing ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Traitement...</>
                ) : (
                  <><Check className="w-5 h-5 mr-2" />Payer {amount}€</>
                )}
              </Button>
            )}

            {/* New card option */}
            <button
              onClick={() => setShowNewCardForm(true)}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-dashed border-border/50 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-7 rounded bg-muted flex items-center justify-center">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Utiliser une nouvelle carte</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* New Card Form */}
        {showNewCardForm && stripePromise && clientSecret && (
          <div className="space-y-3">
            {(savedCards.length > 0 || canUseWallet) && (
              <button
                onClick={() => setShowNewCardForm(false)}
                className="text-sm text-primary hover:underline"
              >
                ← Retour aux méthodes de paiement
              </button>
            )}
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <NewCardForm 
                clientSecret={clientSecret}
                onSuccess={handleNewCardSuccess}
                onError={onError}
              />
            </Elements>
          </div>
        )}

        {/* Cancel Button */}
        <Button variant="ghost" onClick={onCancel} className="w-full">
          Annuler
        </Button>
      </CardContent>
    </Card>
  );
};

export default PaymentMethodSelector;
