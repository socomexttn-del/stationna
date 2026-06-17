import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CreditCard, Check, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Card input styling
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#6b7280'
      },
      backgroundColor: 'transparent'
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444'
    }
  },
  hidePostalCode: true
};

// Inner form component that uses Stripe hooks
const CardForm = ({ onSuccess, onCancel, clientSecret }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { api } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Confirm the SetupIntent
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        }
      });

      if (stripeError) {
        setError(stripeError.message);
        setLoading(false);
        return;
      }

      // Save the payment method to the backend
      await api.post('/payments/save-payment-method', {
        payment_method_id: setupIntent.payment_method
      });

      toast.success('Carte enregistrée avec succès !');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'enregistrement de la carte');
    }
    
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>
      
      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 bg-primary"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <CreditCard className="w-4 h-4 mr-2" />
          )}
          Enregistrer la carte
        </Button>
      </div>
    </form>
  );
};

// Main component
const SavedCardManager = ({ onCardSaved, showTitle = true }) => {
  const { api } = useAuth();
  const [savedCard, setSavedCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [removingCard, setRemovingCard] = useState(false);

  // Fetch saved card on mount
  useEffect(() => {
    fetchSavedCard();
  }, []);

  const fetchSavedCard = async () => {
    try {
      const response = await api.get('/payments/saved-card');
      if (response.data.has_card) {
        setSavedCard(response.data.card);
      } else {
        setSavedCard(null);
      }
    } catch (err) {
      console.error('Error fetching saved card:', err);
    }
    setLoading(false);
  };

  const initializeStripe = async () => {
    try {
      // Get setup intent from backend
      const response = await api.post('/payments/create-setup-intent');
      const { client_secret, publishable_key } = response.data;
      
      setClientSecret(client_secret);
      setStripePromise(loadStripe(publishable_key));
      setShowAddCard(true);
    } catch (err) {
      toast.error('Erreur lors de l\'initialisation du paiement');
    }
  };

  const handleRemoveCard = async () => {
    if (!confirm('Voulez-vous vraiment supprimer cette carte ?')) return;
    
    setRemovingCard(true);
    try {
      await api.delete('/payments/remove-card');
      setSavedCard(null);
      toast.success('Carte supprimée');
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
    setRemovingCard(false);
  };

  const handleCardSaved = () => {
    setShowAddCard(false);
    fetchSavedCard();
    if (onCardSaved) onCardSaved();
  };

  const getCardBrandIcon = (brand) => {
    const brandColors = {
      visa: 'text-blue-500',
      mastercard: 'text-orange-500',
      amex: 'text-blue-600'
    };
    return brandColors[brand?.toLowerCase()] || 'text-gray-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="bg-card border-border">
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Moyen de paiement
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={showTitle ? '' : 'pt-4'}>
        {savedCard && !showAddCard ? (
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${getCardBrandIcon(savedCard.brand)}`}>
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-white capitalize">
                  {savedCard.brand} •••• {savedCard.last4}
                </p>
                <p className="text-sm text-muted-foreground">
                  Expire {savedCard.exp_month}/{savedCard.exp_year}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-green-500 text-sm">
                <Check className="w-4 h-4" />
                <span>Par défaut</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveCard}
                disabled={removingCard}
                className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
              >
                {removingCard ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        ) : showAddCard && stripePromise && clientSecret ? (
          <Elements stripe={stripePromise}>
            <CardForm
              clientSecret={clientSecret}
              onSuccess={handleCardSaved}
              onCancel={() => setShowAddCard(false)}
            />
          </Elements>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">
              Aucune carte enregistrée
            </p>
            <Button onClick={initializeStripe} className="bg-primary">
              <CreditCard className="w-4 h-4 mr-2" />
              Ajouter une carte bancaire
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SavedCardManager;
