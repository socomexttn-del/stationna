import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { ArrowLeft, MapPin, Navigation, Clock, Star, CreditCard, Check, X, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const RideHistory = () => {
  const { user, api } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/rides/history/me');
      setRides(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const response = await api.get('/rides/history/export-pdf', {
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `allogo_historique_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF téléchargé !');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status, paymentStatus) => {
    if (status === 'cancelled') {
      return (
        <span className="flex items-center gap-1 text-sm text-destructive">
          <X className="w-4 h-4" /> Annulée
        </span>
      );
    }
    if (status === 'completed') {
      if (paymentStatus === 'paid') {
        return (
          <span className="flex items-center gap-1 text-sm text-green-500">
            <Check className="w-4 h-4" /> Payée
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1 text-sm text-primary">
          <CreditCard className="w-4 h-4" /> En attente
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass p-4">
        <div className="flex items-center gap-4">
          <Link to={user?.role === 'driver' ? '/driver' : '/passenger'}>
            <Button variant="ghost" size="icon" data-testid="back-btn" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>Historique</h1>
        </div>
      </header>

      {/* Content */}
      <div className="pt-24 pb-8 px-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Aucune course</h3>
            <p className="text-muted-foreground">Votre historique de courses apparaîtra ici</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rides.map((ride) => (
              <Card key={ride.id} className="bg-card border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(ride.created_at)}
                      </p>
                      {user?.role === 'passenger' && ride.driver_name && (
                        <p className="font-medium">{ride.driver_name}</p>
                      )}
                      {user?.role === 'driver' && (
                        <p className="font-medium">{ride.passenger_name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary">
                        {ride.final_fare || ride.estimated_fare}€
                      </p>
                      {getStatusBadge(ride.status, ride.payment_status)}
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">{ride.pickup.address}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Navigation className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">{ride.destination.address}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                    <span>{ride.distance_km} km</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RideHistory;
