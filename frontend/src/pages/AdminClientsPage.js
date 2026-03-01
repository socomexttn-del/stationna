import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { 
  Users, Search, ChevronLeft, ChevronRight, Mail, Phone, 
  Calendar, MapPin, Navigation, Car, CreditCard, Star, 
  FileText, X, Download, Loader2, ArrowUpDown, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const AdminClientsPage = () => {
  const { api } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Client detail modal
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Invoice modal
  const [invoiceData, setInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Fetch clients
  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        sort_by: sortBy,
        sort_order: sortOrder
      });
      if (search) params.append('search', search);
      
      const response = await api.get(`/admin/clients?${params}`);
      setClients(response.data.clients);
      setTotalPages(response.data.pages);
      setTotal(response.data.total);
    } catch (error) {
      toast.error('Erreur lors du chargement des clients');
    } finally {
      setLoading(false);
    }
  }, [api, page, search, sortBy, sortOrder]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchClients();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch client details
  const openClientDetails = async (client) => {
    setSelectedClient(client);
    setLoadingDetails(true);
    try {
      const response = await api.get(`/admin/clients/${client.id}`);
      setClientDetails(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des détails');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Generate invoice
  const generateInvoice = async (rideId) => {
    setLoadingInvoice(true);
    try {
      const response = await api.get(`/admin/rides/${rideId}/invoice`);
      setInvoiceData(response.data);
    } catch (error) {
      toast.error('Erreur lors de la génération de la facture');
    } finally {
      setLoadingInvoice(false);
    }
  };

  // Print invoice
  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Facture ${invoiceData.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .logo { font-size: 28px; font-weight: bold; color: #facc15; }
            .invoice-info { text-align: right; }
            .client-info { margin-bottom: 30px; }
            .ride-details { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f5f5f5; }
            .total { font-size: 24px; font-weight: bold; text-align: right; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">ALLOGO</div>
            <div class="invoice-info">
              <h2>FACTURE</h2>
              <p><strong>N°:</strong> ${invoiceData.invoice_number}</p>
              <p><strong>Date:</strong> ${invoiceData.date}</p>
            </div>
          </div>
          
          <div class="client-info">
            <h3>Client</h3>
            <p><strong>${invoiceData.client_name}</strong></p>
            <p>${invoiceData.client_email}</p>
            <p>${invoiceData.client_phone}</p>
          </div>
          
          <div class="ride-details">
            <h3>Détails de la course</h3>
            <p><strong>Départ:</strong> ${invoiceData.pickup_address}</p>
            ${invoiceData.stops ? invoiceData.stops.map((s, i) => `<p><strong>Arrêt ${i+1}:</strong> ${s}</p>`).join('') : ''}
            <p><strong>Arrivée:</strong> ${invoiceData.destination_address}</p>
            <p><strong>Distance:</strong> ${invoiceData.distance_km} km</p>
            <p><strong>Véhicule:</strong> ${invoiceData.vehicle_type === 'van' ? 'Van' : 'Standard'} - ${invoiceData.passenger_count} passager(s)</p>
            ${invoiceData.driver_name ? `<p><strong>Chauffeur:</strong> ${invoiceData.driver_name}</p>` : ''}
          </div>
          
          <table>
            <tr>
              <th>Description</th>
              <th style="text-align:right">Montant</th>
            </tr>
            <tr>
              <td>Course Allogo (${invoiceData.distance_km} km)</td>
              <td style="text-align:right">${invoiceData.fare_details.subtotal.toFixed(2)} €</td>
            </tr>
            <tr>
              <td>TVA (${invoiceData.fare_details.tax_rate}%)</td>
              <td style="text-align:right">${invoiceData.fare_details.tax_amount.toFixed(2)} €</td>
            </tr>
          </table>
          
          <p class="total">Total TTC: ${invoiceData.total_amount.toFixed(2)} €</p>
          
          <div class="footer">
            <p>${invoiceData.company_info.name} - ${invoiceData.company_info.address}</p>
            <p>SIRET: ${invoiceData.company_info.siret} - TVA: ${invoiceData.company_info.tva}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Sort handler
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Status badge
  const StatusBadge = ({ status }) => {
    const colors = {
      completed: 'bg-green-500/20 text-green-500',
      cancelled: 'bg-red-500/20 text-red-500',
      pending: 'bg-yellow-500/20 text-yellow-500',
      accepted: 'bg-blue-500/20 text-blue-500',
      in_progress: 'bg-purple-500/20 text-purple-500',
      paid: 'bg-green-500/20 text-green-500'
    };
    const labels = {
      completed: 'Terminée',
      cancelled: 'Annulée',
      pending: 'En attente',
      accepted: 'Acceptée',
      in_progress: 'En cours',
      paid: 'Payé'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-500/20 text-gray-500'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" style={{ fontFamily: 'Space Grotesk' }}>
              <Users className="w-8 h-8 text-primary" />
              Base de données clients
            </h1>
            <p className="text-muted-foreground mt-1">{total} client{total > 1 ? 's' : ''} enregistré{total > 1 ? 's' : ''}</p>
          </div>
          
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 bg-card border-border/50"
              data-testid="search-clients"
            />
          </div>
        </div>

        {/* Clients Table */}
        <Card className="bg-card border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      <button onClick={() => handleSort('first_name')} className="flex items-center gap-1 hover:text-foreground">
                        Client <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">
                      <button onClick={() => handleSort('total_rides')} className="flex items-center gap-1 hover:text-foreground mx-auto">
                        Courses <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                    <th className="text-center p-4 font-medium text-muted-foreground">
                      <button onClick={() => handleSort('total_spent')} className="flex items-center gap-1 hover:text-foreground mx-auto">
                        Dépensé <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                    <th className="text-center p-4 font-medium text-muted-foreground hidden lg:table-cell">Note</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                      </td>
                    </tr>
                  ) : clients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        Aucun client trouvé
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr key={client.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{client.first_name} {client.last_name}</p>
                            <p className="text-sm text-muted-foreground md:hidden">{client.email}</p>
                          </div>
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <div className="space-y-1">
                            <p className="text-sm flex items-center gap-2">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              {client.email}
                            </p>
                            <p className="text-sm flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              {client.phone || '-'}
                            </p>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-semibold">{client.completed_rides}</span>
                          <span className="text-muted-foreground">/{client.total_rides}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-semibold text-primary">{client.total_spent.toFixed(2)}€</span>
                        </td>
                        <td className="p-4 text-center hidden lg:table-cell">
                          <div className="flex items-center justify-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span>{client.rating}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openClientDetails(client)}
                            data-testid={`view-client-${client.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Voir
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Page {page} sur {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client Details Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-card rounded-2xl border border-border/50 animate-scale-in">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10"
              onClick={() => { setSelectedClient(null); setClientDetails(null); }}
            >
              <X className="w-5 h-5" />
            </Button>
            
            <div className="p-6 overflow-y-auto max-h-[90vh]">
              {loadingDetails ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : clientDetails ? (
                <div className="space-y-6">
                  {/* Client Header */}
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary">
                        {clientDetails.client.first_name[0]}{clientDetails.client.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold">
                        {clientDetails.client.first_name} {clientDetails.client.last_name}
                      </h2>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" /> {clientDetails.client.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" /> {clientDetails.client.phone || '-'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" /> Client depuis {clientDetails.client.created_at?.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-muted/30 border-border/30">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-primary">{clientDetails.rides.length}</p>
                        <p className="text-xs text-muted-foreground">Courses totales</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30 border-border/30">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-green-500">{clientDetails.client.total_spent}€</p>
                        <p className="text-xs text-muted-foreground">Total dépensé</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30 border-border/30">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold">{clientDetails.client.total_distance} km</p>
                        <p className="text-xs text-muted-foreground">Distance parcourue</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30 border-border/30">
                      <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                          <span className="text-2xl font-bold">{clientDetails.client.avg_rating}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Note moyenne</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Ride History */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Car className="w-5 h-5 text-primary" />
                      Historique des courses
                    </h3>
                    
                    {clientDetails.rides.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Aucune course</p>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {clientDetails.rides.map((ride) => (
                          <Card key={ride.id} className="bg-muted/20 border-border/30">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <StatusBadge status={ride.status} />
                                    <StatusBadge status={ride.payment_status} />
                                    <span className="text-xs text-muted-foreground">
                                      {ride.created_at?.slice(0, 16).replace('T', ' ')}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-sm">
                                    <p className="flex items-center gap-2 truncate">
                                      <MapPin className="w-4 h-4 text-green-500 shrink-0" />
                                      <span className="truncate">{ride.pickup?.address}</span>
                                    </p>
                                    {ride.stops?.map((stop, idx) => (
                                      <p key={idx} className="flex items-center gap-2 truncate text-amber-500">
                                        <MapPin className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{stop.address}</span>
                                      </p>
                                    ))}
                                    <p className="flex items-center gap-2 truncate">
                                      <Navigation className="w-4 h-4 text-primary shrink-0" />
                                      <span className="truncate">{ride.destination?.address}</span>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>{ride.distance_km} km</span>
                                    <span>{ride.vehicle_type === 'van' ? 'Van' : 'Standard'}</span>
                                    <span>{ride.passenger_count} passager(s)</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-lg font-bold text-primary">
                                    {(ride.final_fare || ride.estimated_fare)?.toFixed(2)}€
                                  </p>
                                  {ride.status === 'completed' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => generateInvoice(ride.id)}
                                      className="mt-2"
                                      data-testid={`invoice-${ride.id}`}
                                    >
                                      <FileText className="w-4 h-4 mr-1" />
                                      Facture
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {invoiceData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border/50 animate-scale-in">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10"
              onClick={() => setInvoiceData(null)}
            >
              <X className="w-5 h-5" />
            </Button>
            
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-primary" style={{ fontFamily: 'Space Grotesk' }}>ALLOGO</p>
                  <p className="text-sm text-muted-foreground">Facture</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{invoiceData.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">{invoiceData.date}</p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Client Info */}
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-sm text-muted-foreground mb-2">Client</p>
                <p className="font-semibold">{invoiceData.client_name}</p>
                <p className="text-sm">{invoiceData.client_email}</p>
                <p className="text-sm">{invoiceData.client_phone}</p>
              </div>
              
              {/* Ride Details */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                <p className="text-sm text-muted-foreground mb-2">Détails de la course</p>
                <p className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Départ:</span> {invoiceData.pickup_address}
                </p>
                {invoiceData.stops?.map((stop, idx) => (
                  <p key={idx} className="flex items-center gap-2 text-sm text-amber-500">
                    <MapPin className="w-4 h-4" />
                    <span className="font-medium">Arrêt {idx + 1}:</span> {stop}
                  </p>
                ))}
                <p className="flex items-center gap-2 text-sm">
                  <Navigation className="w-4 h-4 text-primary" />
                  <span className="font-medium">Arrivée:</span> {invoiceData.destination_address}
                </p>
                <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                  <span>{invoiceData.distance_km} km</span>
                  <span>{invoiceData.vehicle_type === 'van' ? 'Van' : 'Standard'}</span>
                  <span>{invoiceData.passenger_count} passager(s)</span>
                </div>
                {invoiceData.driver_name && (
                  <p className="text-sm mt-2">
                    <span className="text-muted-foreground">Chauffeur:</span> {invoiceData.driver_name}
                  </p>
                )}
              </div>
              
              {/* Pricing */}
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span>Course Allogo ({invoiceData.distance_km} km)</span>
                  <span>{invoiceData.fare_details.subtotal.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/30 text-muted-foreground">
                  <span>TVA ({invoiceData.fare_details.tax_rate}%)</span>
                  <span>{invoiceData.fare_details.tax_amount.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between py-3 text-xl font-bold">
                  <span>Total TTC</span>
                  <span className="text-primary">{invoiceData.total_amount.toFixed(2)} €</span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setInvoiceData(null)}
                  className="flex-1"
                >
                  Fermer
                </Button>
                <Button
                  onClick={printInvoice}
                  className="flex-1 bg-primary text-primary-foreground"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Imprimer / PDF
                </Button>
              </div>
              
              {/* Company Footer */}
              <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/30">
                <p>{invoiceData.company_info.name} - {invoiceData.company_info.address}</p>
                <p>SIRET: {invoiceData.company_info.siret} - TVA: {invoiceData.company_info.tva}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminClientsPage;
