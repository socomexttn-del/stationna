import React, { useRef } from 'react';
import { 
  MapPin, Navigation, Car, User, Phone, CreditCard, 
  Calendar, Hash, Building, FileText, X, Printer, Download
} from 'lucide-react';
import { Button } from './ui/button';

const BookingReceipt = ({ ride, onClose, isOpen }) => {
  const receiptRef = useRef(null);

  if (!isOpen || !ride) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePrint = () => {
    const printContent = receiptRef.current;
    const printWindow = window.open('', '', 'width=600,height=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>Bon de Réservation - ${ride.reservation_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #FFD700; padding-bottom: 15px; margin-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; color: #FFD700; }
            .reservation-number { font-size: 18px; color: #666; margin-top: 5px; }
            .section { margin-bottom: 20px; }
            .section-title { font-weight: bold; font-size: 14px; color: #666; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .label { color: #666; }
            .value { font-weight: 500; text-align: right; max-width: 60%; }
            .total-section { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 20px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .total-main { font-size: 20px; font-weight: bold; color: #FFD700; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">ALLOGO</div>
            <div class="reservation-number">Bon de réservation N° ${ride.reservation_number}</div>
          </div>
          
          <div class="section">
            <div class="section-title">INFORMATIONS CHAUFFEUR</div>
            <div class="row"><span class="label">Nom</span><span class="value">${ride.driver_name || '-'}</span></div>
            <div class="row"><span class="label">Société</span><span class="value">${ride.driver_company || 'Indépendant'}</span></div>
            <div class="row"><span class="label">Téléphone</span><span class="value">${ride.driver_phone || '-'}</span></div>
            <div class="row"><span class="label">N° Identification</span><span class="value">${ride.driver_identification || '-'}</span></div>
            <div class="row"><span class="label">Immatriculation</span><span class="value">${ride.driver_license_plate || '-'}</span></div>
          </div>
          
          <div class="section">
            <div class="section-title">DÉTAILS DE LA COURSE</div>
            <div class="row"><span class="label">Date</span><span class="value">${formatDate(ride.created_at)}</span></div>
            <div class="row"><span class="label">Prise en charge</span><span class="value">${ride.pickup?.address || '-'}</span></div>
            ${ride.stops && ride.stops.length > 0 ? ride.stops.map((stop, i) => `
              <div class="row" style="color: #f59e0b;">
                <span class="label">↳ Arrêt ${i + 1}</span>
                <span class="value">${stop.address}</span>
              </div>
            `).join('') : ''}
            <div class="row"><span class="label">Destination</span><span class="value">${ride.destination?.address || '-'}</span></div>
            <div class="row"><span class="label">Distance</span><span class="value">${ride.distance_km} km</span></div>
            <div class="row"><span class="label">Passagers</span><span class="value">${ride.passenger_count}</span></div>
            <div class="row"><span class="label">Type véhicule</span><span class="value">${ride.vehicle_type === 'van' ? 'Van' : 'Standard'}</span></div>
          </div>
          
          <div class="section">
            <div class="section-title">CLIENT</div>
            <div class="row"><span class="label">Nom</span><span class="value">${ride.passenger_name}</span></div>
            <div class="row"><span class="label">Téléphone</span><span class="value">${ride.passenger_phone || '-'}</span></div>
          </div>
          
          <div class="total-section">
            <div class="total-row"><span>Prix de la course</span><span>${ride.estimated_fare}€</span></div>
            <div class="total-row"><span>Commission (18%)</span><span>-${ride.commission_amount || (ride.estimated_fare * 0.18).toFixed(2)}€</span></div>
            <div class="total-row total-main"><span>Vos gains</span><span>${ride.driver_earnings || (ride.estimated_fare * 0.82).toFixed(2)}€</span></div>
          </div>
          
          <div class="footer">
            <p>StationCab - Service de transport</p>
            <p>Document généré le ${new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card border border-white/10 rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-white/10 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-primary" style={{ fontFamily: 'Space Grotesk' }}>
              BON DE RÉSERVATION
            </h3>
            <p className="text-sm text-muted-foreground">N° {ride.reservation_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div ref={receiptRef} className="p-4 space-y-4">
          {/* Driver Info Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Informations Chauffeur
            </h4>
            <div className="bg-muted/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Nom</span>
                </div>
                <span className="font-medium">{ride.driver_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Société</span>
                </div>
                <span className="font-medium">{ride.driver_company || 'Indépendant'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Téléphone</span>
                </div>
                <span className="font-medium">{ride.driver_phone || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">N° Identification</span>
                </div>
                <span className="font-medium font-mono">{ride.driver_identification}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Car className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Immatriculation</span>
                </div>
                <span className="font-medium font-mono">{ride.driver_license_plate}</span>
              </div>
            </div>
          </div>

          {/* Ride Details Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Détails de la Course
            </h4>
            <div className="bg-muted/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Date</span>
                </div>
                <span className="font-medium">{formatDate(ride.created_at)}</span>
              </div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-green-500" />
                  <span className="text-muted-foreground">Départ</span>
                </div>
                <span className="font-medium text-right max-w-[60%] text-sm">{ride.pickup?.address}</span>
              </div>
              
              {/* Intermediate Stops */}
              {ride.stops && ride.stops.length > 0 && (
                <div className="pl-2 border-l-2 border-amber-500/30 ml-2 space-y-2">
                  {ride.stops.map((stop, index) => (
                    <div key={index} className="flex items-start justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-4 h-4 rounded-full bg-amber-500/30 flex items-center justify-center text-[10px] font-bold text-amber-500">
                          {index + 1}
                        </div>
                        <span className="text-amber-500">Arrêt {index + 1}</span>
                      </div>
                      <span className="font-medium text-right max-w-[55%] text-sm text-amber-400">{stop.address}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Navigation className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Arrivée</span>
                </div>
                <span className="font-medium text-right max-w-[60%] text-sm">{ride.destination?.address}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Distance</span>
                <span className="font-medium">{ride.distance_km} km</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Passagers</span>
                <span className="font-medium">{ride.passenger_count}</span>
              </div>
            </div>
          </div>

          {/* Client Info Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Client
            </h4>
            <div className="bg-muted/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nom</span>
                <span className="font-medium">{ride.passenger_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Téléphone</span>
                <span className="font-medium">{ride.passenger_phone || '-'}</span>
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tarification
            </h4>
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Prix de la course</span>
                <span className="font-semibold">{ride.estimated_fare}€</span>
              </div>
              <div className="flex items-center justify-between text-red-400">
                <span>Commission (18%)</span>
                <span>-{ride.commission_amount || (ride.estimated_fare * 0.18).toFixed(2)}€</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                <span className="font-semibold">Vos gains</span>
                <span className="text-2xl font-bold text-primary">
                  {ride.driver_earnings || (ride.estimated_fare * 0.82).toFixed(2)}€
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-white/10 p-4">
          <Button 
            onClick={onClose}
            className="w-full h-12 bg-primary text-primary-foreground rounded-xl"
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookingReceipt;
