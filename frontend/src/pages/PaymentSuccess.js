import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Check, ArrowRight } from 'lucide-react';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const { api } = useAuth();
  const [status, setStatus] = useState('loading');
  const [paymentInfo, setPaymentInfo] = useState(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      pollPaymentStatus(sessionId);
    }
  }, [searchParams]);

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      setStatus('pending');
      return;
    }

    try {
      const response = await api.get(`/payments/status/${sessionId}`);
      setPaymentInfo(response.data);
      
      if (response.data.payment_status === 'paid') {
        setStatus('success');
        return;
      } else if (response.data.status === 'expired') {
        setStatus('error');
        return;
      }

      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border/50">
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk' }}>Vérification...</h2>
              <p className="text-muted-foreground">Nous vérifions votre paiement</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk' }}>Paiement réussi!</h2>
              <p className="text-muted-foreground mb-6">
                Merci pour votre paiement de {paymentInfo?.amount_total ? (paymentInfo.amount_total / 100).toFixed(2) : '0'}€
              </p>
              <Link to="/passenger">
                <Button 
                  data-testid="back-to-dashboard"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
                >
                  Retour au tableau de bord
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </>
          )}

          {status === 'pending' && (
            <>
              <div className="w-20 h-20 mx-auto bg-primary/20 rounded-full flex items-center justify-center mb-6">
                <Check className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk' }}>Paiement en cours</h2>
              <p className="text-muted-foreground mb-6">
                Votre paiement est en cours de traitement. Vous recevrez une confirmation par email.
              </p>
              <Link to="/passenger">
                <Button 
                  data-testid="back-to-dashboard-pending"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
                >
                  Retour au tableau de bord
                </Button>
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 mx-auto bg-destructive/20 rounded-full flex items-center justify-center mb-6">
                <span className="text-4xl">❌</span>
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk' }}>Erreur de paiement</h2>
              <p className="text-muted-foreground mb-6">
                Une erreur est survenue lors du paiement. Veuillez réessayer.
              </p>
              <Link to="/passenger">
                <Button 
                  data-testid="back-to-dashboard-error"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
                >
                  Réessayer
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
