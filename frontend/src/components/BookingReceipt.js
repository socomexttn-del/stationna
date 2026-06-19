import React, { useRef } from 'react';
import { 
  MapPin, Navigation, Car, User, Phone, 
  Calendar, Hash, Building, X, Printer, Truck
} from 'lucide-react';
import { Button } from './ui/button';

// Company info - A&S PRESTIGE
const COMPANY_INFO = {
  name: "A&S PRESTIGE",
  address: "22 B RUE DU DOCTEUR INFROY",
  postalCode: "77290",
  city: "MITRY-MORY",
  phone: "+33 602062244",
  siret: "123 456 789 00012" // TODO: Replace with real SIRET
};

const BookingReceipt = ({ ride, onClose, isOpen }) => {
  const receiptRef = useRef(null);

  if (!isOpen || !ride) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatScheduledTime = (dateStr) => {
    if (!dateStr) return 'Immédiate';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVehicleType = (type) => {
    switch(type) {
      case 'van': return 'Van (7 places)';
      case 'taxi': return 'Taxi';
      default: return 'VTC Standard';
    }
  };

  // Calculate TVA (10% for transport)
  const tvaRate = 10;
  const totalTTC = ride.estimated_fare || 0;
  const totalHT = (totalTTC / (1 + tvaRate / 100)).toFixed(2);
  const tvaAmount = (totalTTC - totalHT).toFixed(2);

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=600,height=900');
    printWindow.document.write(`
      <html>
        <head>
          <title>Bon de Commande - ${ride.reservation_number || ride.id?.slice(0, 8)}</title>
          <style>
            @page { margin: 10mm; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              padding: 15px; 
              color: #1a1a1a; 
              font-size: 12px;
              line-height: 1.4;
            }
            .header { 
              background: #1a1a1a; 
              color: #FFD700; 
              padding: 12px 15px; 
              margin: -15px -15px 15px -15px;
              font-size: 16px;
              font-weight: bold;
            }
            .company-section {
              border-bottom: 1px dotted #ccc;
              padding-bottom: 12px;
              margin-bottom: 12px;
            }
            .company-name { font-weight: bold; font-size: 14px; }
            .company-address { color: #666; font-size: 11px; line-height: 1.6; }
            .section { 
              margin-bottom: 15px;
              border-bottom: 1px dotted #ccc;
              padding-bottom: 12px;
            }
            .section:last-child { border-bottom: none; }
            .section-title { 
              font-weight: bold; 
              font-size: 11px; 
              color: #1a1a1a; 
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 6px;
              align-items: flex-start;
            }
            .label { 
              color: #1a1a1a; 
              font-weight: 600;
              min-width: 140px;
            }
            .value { 
              text-align: right; 
              max-width: 55%;
              color: #333;
            }
            .info-box {
              background: #f5f5f5;
              padding: 10px;
              border-radius: 4px;
              margin-bottom: 12px;
            }
            .legal-text {
              font-size: 10px;
              color: #666;
              font-style: italic;
            }
            .price-highlight {
              font-size: 14px;
              font-weight: bold;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: 10px;
              color: #999;
              border-top: 1px solid #eee;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">Bon de commande</div>
          
          <div class="company-section">
            <div class="company-address">
              ${COMPANY_INFO.address}<br/>
              ${COMPANY_INFO.postalCode}<br/>
              ${COMPANY_INFO.city}<br/>
              ${COMPANY_INFO.phone}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">INFORMATION</div>
            <div class="row">
              <span class="label">Montant Brut maximal (EUR, ${tvaRate}% TVA incl. si applicable)</span>
              <span class="value price-highlight">${totalTTC}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">SERVICE DE TAXI</div>
            <div class="row">
              <span class="label">JUSTIFICATION DE LA RESERVATION PREALABLE</span>
              <span class="value">(Article L3120-2 du Code des transports)</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Exploitant de Taxi</div>
            <div class="company-address">
              ${COMPANY_INFO.name}<br/>
              ${COMPANY_INFO.address}<br/>
              ${COMPANY_INFO.postalCode}<br/>
              ${COMPANY_INFO.city}<br/>
              ${COMPANY_INFO.phone}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Voyage</div>
            <div class="row">
              <span class="label">Conducteur</span>
              <span class="value">${ride.driver_name || '-'}</span>
            </div>
            <div class="row">
              <span class="label">Passager</span>
              <span class="value">${ride.passenger_name || '-'}</span>
            </div>
            <div class="row">
              <span class="label">Commande</span>
              <span class="value">${formatDate(ride.created_at)}</span>
            </div>
            <div class="row">
              <span class="label">Prise en charge</span>
              <span class="value">${formatScheduledTime(ride.scheduled_time)}</span>
            </div>
            <div class="row">
              <span class="label">Lieu prise en charge</span>
              <span class="value">${ride.pickup?.address || '-'}</span>
            </div>
            ${ride.stops && ride.stops.length > 0 ? ride.stops.map((stop, i) => `
              <div class="row" style="color: #b45309;">
                <span class="label">Via (Arrêt ${i + 1})</span>
                <span class="value">${stop.address}</span>
              </div>
            `).join('') : ''}
            <div class="row">
              <span class="label">Destination</span>
              <span class="value">${ride.destination?.address || '-'}</span>
            </div>
            <div class="row">
              <span class="label">Tarifs</span>
              <span class="value">Montant brut maximal ou taximètre si moins élevé</span>
            </div>
            <div class="row">
              <span class="label">Via</span>
              <span class="value">StationCab</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Chauffeur</div>
            <div class="row">
              <span class="label">Nom</span>
              <span class="value">${ride.driver_name || '-'}</span>
            </div>
            <div class="row">
              <span class="label">Société</span>
              <span class="value">${ride.driver_company || COMPANY_INFO.name}</span>
            </div>
            <div class="row">
              <span class="label">Téléphone</span>
              <span class="value">${ride.driver_phone || '-'}</span>
            </div>
            <div class="row">
              <span class="label">Immatriculation</span>
              <span class="value">${ride.driver_license_plate || '-'}</span>
            </div>
            <div class="row">
              <span class="label">Type véhicule</span>
              <span class="value">${getVehicleType(ride.vehicle_type)}</span>
            </div>
          </div>
          
          <div class="footer">
            <p>StationCab - stationcab.fr</p>
            <p>Document généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
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
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-white/10 p-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-bold text-primary" style={{ fontFamily: 'Space Grotesk' }}>
            Bon de commande
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrint} className="border-white/20 hover:bg-white/10">
              <Printer className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/10">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div ref={receiptRef} className="p-4 space-y-4 bg-white text-black">
          {/* Company Address Header */}
          <div className="border-b border-dashed border-gray-300 pb-3">
            <p className="text-sm">{COMPANY_INFO.address}</p>
            <p className="text-sm">{COMPANY_INFO.postalCode}</p>
            <p className="text-sm">{COMPANY_INFO.city}</p>
            <p className="text-sm">{COMPANY_INFO.phone}</p>
          </div>

          {/* INFORMATION Section */}
          <div className="space-y-2 border-b border-dashed border-gray-300 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider">INFORMATION</h4>
            <div className="flex justify-between items-start">
              <span className="text-sm font-semibold max-w-[60%]">
                Montant Brut maximal (EUR, {tvaRate}% TVA incl. si applicable)
              </span>
              <span className="font-bold text-lg">{totalTTC}</span>
            </div>
          </div>

          {/* SERVICE DE TAXI Section */}
          <div className="space-y-2 border-b border-dashed border-gray-300 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider">SERVICE DE TAXI</h4>
            <div className="flex justify-between items-start">
              <span className="text-sm font-semibold">JUSTIFICATION DE LA RESERVATION PREALABLE</span>
              <span className="text-sm text-right text-gray-600">(Article L3120-2 du Code des transports)</span>
            </div>
          </div>

          {/* Exploitant de Taxi Section */}
          <div className="space-y-2 border-b border-dashed border-gray-300 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider">Exploitant de Taxi</h4>
            <div className="text-sm space-y-0.5">
              <p className="font-medium">{COMPANY_INFO.name}</p>
              <p className="border-b border-dashed border-gray-200 pb-1">{COMPANY_INFO.address}</p>
              <p className="border-b border-dashed border-gray-200 py-1">{COMPANY_INFO.postalCode}</p>
              <p className="border-b border-dashed border-gray-200 py-1">{COMPANY_INFO.city}</p>
              <p className="pt-1">{COMPANY_INFO.phone}</p>
            </div>
          </div>

          {/* Voyage Section */}
          <div className="space-y-2 border-b border-dashed border-gray-300 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider">Voyage</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold">Conducteur</span>
                <span>{ride.driver_name || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold">Passager</span>
                <span>{ride.passenger_name || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold">Commande</span>
                <span>{formatDate(ride.created_at)}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold">Prise en charge</span>
                <span>{formatScheduledTime(ride.scheduled_time)}</span>
              </div>
              <div className="flex justify-between items-start border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold min-w-[120px]">Lieu prise en charge</span>
                <span className="text-right max-w-[55%]">{ride.pickup?.address || '-'}</span>
              </div>
              
              {/* Intermediate Stops */}
              {ride.stops && ride.stops.length > 0 && ride.stops.map((stop, index) => (
                <div key={index} className="flex justify-between items-start border-b border-dashed border-amber-200 pb-1 text-amber-700">
                  <span className="font-semibold">Via (Arrêt {index + 1})</span>
                  <span className="text-right max-w-[55%]">{stop.address}</span>
                </div>
              ))}
              
              <div className="flex justify-between items-start border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold min-w-[100px]">Destination</span>
                <span className="text-right max-w-[55%]">{ride.destination?.address || '-'}</span>
              </div>
              <div className="flex justify-between items-start border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold min-w-[80px]">Tarifs</span>
                <span className="text-right max-w-[60%]">Montant brut maximal ou taximètre si moins élevé</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold">Via</span>
                <span>StationCab</span>
              </div>
            </div>
          </div>

          {/* Chauffeur Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider">Chauffeur</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold">Nom</span>
                <span>{ride.driver_name || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold">Société</span>
                <span>{ride.driver_company || COMPANY_INFO.name}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold">Téléphone</span>
                <span>{ride.driver_phone || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold">N° Identification</span>
                <span className="font-mono">{ride.driver_identification || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                <span className="font-semibold">Immatriculation</span>
                <span className="font-mono">{ride.driver_license_plate || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Type véhicule</span>
                <span>{getVehicleType(ride.vehicle_type)}</span>
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
