import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CreditCard, Lock, Check, Loader2, X } from 'lucide-react';

const CardForm = ({ clientSecret, amount, onSuccess, onCancel, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: '"Space Grotesk", sans-serif',
        '::placeholder': {
          color: '#6b7280',
        },
        iconColor: '#facc15',
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444',
      },
    },
    hidePostalCode: true,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: submitError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      });

      if (submitError) {
        setError(submitError.message);
        onError?.(submitError.message);
      } else if (paymentIntent.status === 'succeeded') {
        onSuccess?.(paymentIntent);
      }
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.');
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Détails de la carte
        </label>
        <div className="p-4 bg-muted/50 rounded-lg border border-white/10 focus-within:border-primary/50 transition-colors">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="w-3 h-3" />
        <span>Paiement sécurisé par Stripe</span>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
          data-testid="payment-cancel-btn"
        >
          <X className="w-4 h-4 mr-2" />
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="payment-submit-btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Traitement...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Payer {amount?.toFixed(2)}€
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

const PaymentForm = ({ 
  clientSecret, 
  publishableKey, 
  amount, 
  rideName,
  onSuccess, 
  onCancel,
  onError 
}) => {
  const [stripePromise] = useState(() => loadStripe(publishableKey));

  return (
    <Card className="w-full max-w-md mx-auto bg-card border-border/50">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center mb-3">
          <CreditCard className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-xl" style={{ fontFamily: 'Space Grotesk' }}>
          Paiement de la course
        </CardTitle>
        {rideName && (
          <p className="text-sm text-muted-foreground mt-1">{rideName}</p>
        )}
        <div className="mt-3 p-3 bg-primary/10 rounded-lg">
          <span className="text-2xl font-bold text-primary">{amount?.toFixed(2)}€</span>
        </div>
      </CardHeader>
      
      <CardContent>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CardForm 
            clientSecret={clientSecret} 
            amount={amount}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onError={onError}
          />
        </Elements>
      </CardContent>
    </Card>
  );
};

export default PaymentForm;
