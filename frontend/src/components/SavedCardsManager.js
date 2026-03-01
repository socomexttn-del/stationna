import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  CreditCard, Plus, Trash2, Check, Loader2, Star, X 
} from 'lucide-react';
import { toast } from 'sonner';

// Card brand icons
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

// Add Card Form Component
const AddCardForm = ({ onSuccess, onCancel }) => {
  const { api } = useAuth();
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get SetupIntent from backend
      const response = await api.post('/payments/setup-intent');
      const { client_secret } = response.data;

      // Confirm card setup
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        client_secret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
          },
        }
      );

      if (stripeError) {
        setError(stripeError.message);
        toast.error(stripeError.message);
      } else if (setupIntent.status === 'succeeded') {
        toast.success('Carte enregistrée avec succès !');
        onSuccess();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'enregistrement');
      toast.error('Erreur lors de l\'enregistrement de la carte');
    } finally {
      setIsLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#ffffff',
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-muted/50 rounded-xl p-4 border border-white/10">
        <CardElement options={cardElementOptions} />
      </div>
      
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      
      <div className="flex gap-3">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          className="flex-1"
        >
          Annuler
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || isLoading}
          className="flex-1 bg-primary text-primary-foreground"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Enregistrer
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

// Main Component
const SavedCardsManager = ({ onCardSelect, selectionMode = false }) => {
  const { api } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [deletingCard, setDeletingCard] = useState(null);

  // Initialize Stripe
  useEffect(() => {
    const initStripe = async () => {
      try {
        const response = await api.post('/payments/setup-intent');
        const { publishable_key } = response.data;
        setStripePromise(loadStripe(publishable_key));
      } catch (error) {
        console.error('Error initializing Stripe:', error);
      }
    };
    initStripe();
  }, [api]);

  // Fetch saved cards
  const fetchCards = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payments/saved-cards');
      setCards(response.data);
      
      // Auto-select default card
      const defaultCard = response.data.find(c => c.is_default);
      if (defaultCard && selectionMode) {
        setSelectedCard(defaultCard.id);
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const handleDeleteCard = async (cardId) => {
    setDeletingCard(cardId);
    try {
      await api.delete(`/payments/saved-cards/${cardId}`);
      toast.success('Carte supprimée');
      fetchCards();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeletingCard(null);
    }
  };

  const handleSetDefault = async (cardId) => {
    try {
      await api.post(`/payments/set-default-card/${cardId}`);
      toast.success('Carte par défaut mise à jour');
      fetchCards();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleSelectCard = (cardId) => {
    setSelectedCard(cardId);
    if (onCardSelect) {
      onCardSelect(cardId);
    }
  };

  const handleAddSuccess = () => {
    setShowAddForm(false);
    fetchCards();
  };

  if (loading && cards.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Card List */}
      {cards.length > 0 ? (
        <div className="space-y-3">
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => selectionMode && handleSelectCard(card.id)}
              className={`
                bg-card border rounded-xl p-4 transition-all
                ${selectionMode ? 'cursor-pointer hover:border-primary/50' : ''}
                ${selectedCard === card.id ? 'border-primary ring-2 ring-primary/20' : 'border-border/50'}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectionMode && (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedCard === card.id ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`}>
                      {selectedCard === card.id && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  )}
                  <CardBrandIcon brand={card.brand} />
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      •••• {card.last4}
                      {card.is_default && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          Par défaut
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Expire {card.exp_month.toString().padStart(2, '0')}/{card.exp_year}
                    </p>
                  </div>
                </div>
                
                {!selectionMode && (
                  <div className="flex items-center gap-2">
                    {!card.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(card.id)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCard(card.id)}
                      disabled={deletingCard === card.id}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      {deletingCard === card.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border">
          <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Aucune carte enregistrée</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ajoutez une carte pour payer plus rapidement
          </p>
        </div>
      )}

      {/* Add Card Form */}
      {showAddForm && stripePromise ? (
        <Card className="bg-card border-primary/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Ajouter une carte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise}>
              <AddCardForm 
                onSuccess={handleAddSuccess} 
                onCancel={() => setShowAddForm(false)} 
              />
            </Elements>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setShowAddForm(true)}
          variant="outline"
          className="w-full h-12 border-dashed"
          data-testid="add-card-btn"
        >
          <Plus className="w-5 h-5 mr-2" />
          Ajouter une carte
        </Button>
      )}
    </div>
  );
};

export default SavedCardsManager;
