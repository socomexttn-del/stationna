import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { X, ArrowLeft } from 'lucide-react';

const PaymentCancel = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border/50">
        <CardContent className="p-8 text-center">
          <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center mb-6">
            <X className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk' }}>Paiement annulé</h2>
          <p className="text-muted-foreground mb-6">
            Vous avez annulé le paiement. Vous pouvez réessayer à tout moment.
          </p>
          <Link to="/passenger">
            <Button 
              data-testid="back-to-dashboard-cancel"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au tableau de bord
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCancel;
