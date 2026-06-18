import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  ArrowLeft, RefreshCw, DollarSign, Car, Truck, AlertTriangle,
  CheckCircle, XCircle, Calendar, Download, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const AdminCancellationsPage = () => {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Accès non autorisé');
      navigate('/');
      return;
    }
    fetchCancellations();
  }, [user, navigate, page]);

  const fetchCancellations = async () => {
    setLoading(true);
    try {
      let url = `/admin/cancellation-fees?page=${page}&limit=20`;
      if (dateFrom) url += `&date_from=${dateFrom}`;
      if (dateTo) url += `&date_to=${dateTo}`;
      
      const response = await api.get(url);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching cancellations:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setPage(1);
    fetchCancellations();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVehicleIcon = (type) => {
    switch(type) {
      case 'van': return <Truck className="w-4 h-4" />;
      case 'taxi': return <Car className="w-4 h-4 text-yellow-500" />;
      default: return <Car className="w-4 h-4" />;
    }
  };

  const getVehicleLabel = (type) => {
    switch(type) {
      case 'van': return 'Van';
      case 'taxi': return 'Taxi';
      case 'standard': return 'VTC';
      default: return type;
    }
  };

  const exportCSV = () => {
    if (!data?.cancellations?.length) return;
    
    const headers = ['Date', 'Numéro', 'Client', 'Véhicule', 'Frais', 'Prélevé', 'Départ', 'Destination'];
    const rows = data.cancellations.map(c => [
      formatDate(c.cancelled_at),
      c.reservation_number || c.id.slice(0, 8),
      c.passenger_name,
      getVehicleLabel(c.vehicle_type),
      `${c.cancellation_fee}€`,
      c.cancellation_fee_charged ? 'Oui' : 'Non',
      c.pickup?.address || '',
      c.destination?.address || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `frais_annulation_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success('Export CSV téléchargé');
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
              Frais d'annulation
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchCancellations} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={!data?.cancellations?.length}>
              <Download className="w-4 h-4 mr-2" /> CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Summary Cards */}
        {data?.totals && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">{data.totals.total_charged?.toFixed(2)}€</p>
                    <p className="text-xs text-muted-foreground">Total encaissé</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">{data.totals.total_not_charged?.toFixed(2)}€</p>
                    <p className="text-xs text-muted-foreground">Non prélevé</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data.totals.total_fees?.toFixed(2)}€</p>
                    <p className="text-xs text-muted-foreground">Total frais</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data.totals.count}</p>
                    <p className="text-xs text-muted-foreground">Annulations</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* By Vehicle Type */}
        {data?.by_vehicle_type && Object.keys(data.by_vehicle_type).length > 0 && (
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Par type de véhicule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {['standard', 'van', 'taxi'].map(type => {
                  const stats = data.by_vehicle_type[type];
                  if (!stats) return null;
                  return (
                    <div key={type} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      {getVehicleIcon(type)}
                      <div>
                        <p className="font-medium">{getVehicleLabel(type)}</p>
                        <p className="text-sm text-muted-foreground">
                          {stats.count} annul. • {stats.total_fees?.toFixed(2)}€
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[150px]">
                <label className="text-sm text-muted-foreground mb-1 block">Date début</label>
                <Input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-sm text-muted-foreground mb-1 block">Date fin</label>
                <Input 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-background"
                />
              </div>
              <Button onClick={handleFilter} className="h-10">
                <Calendar className="w-4 h-4 mr-2" /> Filtrer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Historique des annulations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground font-medium">Date</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Réservation</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Client</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Véhicule</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">Frais</th>
                    <th className="text-center p-3 text-muted-foreground font-medium">Statut</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Trajet</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.cancellations?.map((cancellation) => (
                    <tr key={cancellation.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="p-3 whitespace-nowrap">
                        {formatDate(cancellation.cancelled_at)}
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          {cancellation.reservation_number || cancellation.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{cancellation.passenger_name}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {getVehicleIcon(cancellation.vehicle_type)}
                          <span>{getVehicleLabel(cancellation.vehicle_type)}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold text-primary">
                        {cancellation.cancellation_fee}€
                      </td>
                      <td className="p-3 text-center">
                        {cancellation.cancellation_fee_charged ? (
                          <span className="inline-flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded text-xs">
                            <CheckCircle className="w-3 h-3" /> Prélevé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 rounded text-xs">
                            <XCircle className="w-3 h-3" /> Échec
                          </span>
                        )}
                      </td>
                      <td className="p-3 max-w-[200px]">
                        <p className="text-xs truncate" title={cancellation.pickup?.address}>
                          {cancellation.pickup?.address?.slice(0, 30)}...
                        </p>
                        <p className="text-xs text-muted-foreground truncate" title={cancellation.destination?.address}>
                          → {cancellation.destination?.address?.slice(0, 30)}...
                        </p>
                      </td>
                    </tr>
                  ))}
                  {(!data?.cancellations || data.cancellations.length === 0) && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        Aucune annulation avec frais trouvée
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data?.pagination && data.pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Page {data.pagination.page} sur {data.pagination.pages} ({data.pagination.total} résultats)
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
                    onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                    disabled={page >= data.pagination.pages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminCancellationsPage;
