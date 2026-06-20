import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Check, 
  Euro,
  Car,
  Calendar,
  User,
  FileText
} from 'lucide-react';

const AdminDriverPaymentsPage = () => {
  const { api } = useAuth();
  const [weekOffset, setWeekOffset] = useState(-1); // Default to last week (ready to pay)
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paidDrivers, setPaidDrivers] = useState(new Set());
  const [paymentHistory, setPaymentHistory] = useState([]);

  useEffect(() => {
    fetchWeeklySummary();
    fetchPaymentHistory();
  }, [weekOffset]);

  const fetchWeeklySummary = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/drivers/weekly-summary?week_offset=${weekOffset}`);
      setSummary(response.data);
      
      // Check which drivers are already paid for this week
      const historyResponse = await api.get('/admin/drivers/payment-history');
      const paid = new Set();
      historyResponse.data.payments.forEach(p => {
        if (p.week_start === response.data.week_start) {
          paid.add(p.driver_id);
        }
      });
      setPaidDrivers(paid);
    } catch (error) {
      console.error('Error fetching summary:', error);
      toast.error('Erreur lors du chargement');
    }
    setLoading(false);
  };

  const fetchPaymentHistory = async () => {
    try {
      const response = await api.get('/admin/drivers/payment-history');
      setPaymentHistory(response.data.payments || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    }
  };

  const downloadInvoice = async (driverId, driverName) => {
    try {
      const response = await api.get(
        `/admin/drivers/${driverId}/weekly-invoice?week_start=${summary.week_start}`,
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `releve_${driverName.replace(' ', '_')}_${summary.week_start}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Relevé téléchargé');
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors du téléchargement');
    }
  };

  const markAsPaid = async (driverId, driverName) => {
    if (!window.confirm(`Marquer ${driverName} comme payé pour la semaine du ${summary.week_start} ?`)) {
      return;
    }
    
    try {
      await api.post(`/admin/drivers/${driverId}/mark-paid?week_start=${summary.week_start}`);
      toast.success(`${driverName} marqué comme payé`);
      setPaidDrivers(prev => new Set([...prev, driverId]));
      fetchPaymentHistory();
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Erreur lors du marquage');
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getWeekLabel = () => {
    if (weekOffset === 0) return 'Semaine en cours';
    if (weekOffset === -1) return 'Semaine dernière';
    return `Il y a ${Math.abs(weekOffset)} semaines`;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Paiements Chauffeurs</h1>
            <p className="text-gray-400 text-sm">Relevés hebdomadaires et virements</p>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <Card className="mb-6 bg-card/50 border-border">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              onClick={() => setWeekOffset(w => w - 1)}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Semaine précédente
            </Button>
            
            <div className="text-center">
              <p className="text-sm text-gray-400">{getWeekLabel()}</p>
              {summary && (
                <p className="text-lg font-bold text-white">
                  {formatDate(summary.week_start)} - {formatDate(summary.week_end)}
                </p>
              )}
            </div>
            
            <Button 
              variant="outline" 
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={weekOffset >= 0}
              className="gap-2"
            >
              Semaine suivante <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-card/50 border-border">
            <CardContent className="py-4 text-center">
              <Car className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold text-white">{summary.totals.total_rides}</p>
              <p className="text-xs text-gray-400">Courses</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="py-4 text-center">
              <Euro className="w-6 h-6 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold text-white">{summary.totals.total_fare.toFixed(2)}€</p>
              <p className="text-xs text-gray-400">CA Total</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="py-4 text-center">
              <FileText className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold text-white">{summary.totals.total_commission.toFixed(2)}€</p>
              <p className="text-xs text-gray-400">Commission (18%)</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="py-4 text-center">
              <User className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-white">{summary.totals.total_earnings.toFixed(2)}€</p>
              <p className="text-xs text-gray-400">À verser</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Drivers List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-400 mt-4">Chargement...</p>
        </div>
      ) : summary?.drivers?.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Relevés par chauffeur ({summary.drivers.length})
          </h2>
          
          {summary.drivers.map((driver) => (
            <Card 
              key={driver.driver_id} 
              className={`bg-card/50 border-border ${paidDrivers.has(driver.driver_id) ? 'border-green-500/50' : ''}`}
            >
              <CardContent className="py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{driver.driver_name}</h3>
                      {paidDrivers.has(driver.driver_id) && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs rounded-full">
                          ✓ Payé
                        </span>
                      )}
                    </div>
                    {driver.company_name && (
                      <p className="text-sm text-gray-400">{driver.company_name}</p>
                    )}
                    <p className="text-xs text-gray-500">{driver.email}</p>
                    {driver.iban && (
                      <p className="text-xs text-gray-500 font-mono mt-1">IBAN: {driver.iban}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{driver.total_rides}</p>
                      <p className="text-xs text-gray-400">courses</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-500">{driver.total_earnings.toFixed(2)}€</p>
                      <p className="text-xs text-gray-400">à verser</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadInvoice(driver.driver_id, driver.driver_name)}
                      className="gap-1"
                    >
                      <Download className="w-4 h-4" /> PDF
                    </Button>
                    {!paidDrivers.has(driver.driver_id) && (
                      <Button 
                        size="sm"
                        onClick={() => markAsPaid(driver.driver_id, driver.driver_name)}
                        className="gap-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4" /> Marquer payé
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Expandable rides list */}
                <details className="mt-4">
                  <summary className="text-sm text-gray-400 cursor-pointer hover:text-white">
                    Voir les {driver.total_rides} courses
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="text-gray-500">
                        <tr>
                          <th className="text-left py-1">Date</th>
                          <th className="text-left py-1">Trajet</th>
                          <th className="text-right py-1">Prix</th>
                          <th className="text-right py-1">Net</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        {driver.rides.map((ride) => (
                          <tr key={ride.id} className="border-t border-border/50">
                            <td className="py-1">{ride.completed_at?.slice(0, 10)}</td>
                            <td className="py-1 truncate max-w-[200px]">
                              {ride.pickup} → {ride.destination}
                            </td>
                            <td className="py-1 text-right">{ride.fare.toFixed(2)}€</td>
                            <td className="py-1 text-right text-green-500">{ride.earnings.toFixed(2)}€</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card/50 border-border">
          <CardContent className="py-12 text-center">
            <Car className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400">Aucune course cette semaine</p>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {paymentHistory.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-4">Historique des paiements</h2>
          <Card className="bg-card/50 border-border">
            <CardContent className="py-4">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 text-xs">
                    <tr>
                      <th className="text-left py-2">Chauffeur</th>
                      <th className="text-left py-2">Semaine</th>
                      <th className="text-right py-2">Montant</th>
                      <th className="text-right py-2">Payé le</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    {paymentHistory.slice(0, 20).map((payment) => (
                      <tr key={payment.id} className="border-t border-border/50">
                        <td className="py-2">{payment.driver_name}</td>
                        <td className="py-2">{formatDate(payment.week_start)}</td>
                        <td className="py-2 text-right text-green-500">{payment.amount.toFixed(2)}€</td>
                        <td className="py-2 text-right text-gray-500">{formatDate(payment.paid_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info Box */}
      <Card className="mt-6 bg-yellow-500/10 border-yellow-500/30">
        <CardContent className="py-4">
          <p className="text-yellow-200 text-sm">
            <strong>Rappel :</strong> Les virements aux chauffeurs sont effectués chaque <strong>lundi</strong>. 
            Téléchargez les relevés PDF et effectuez les virements manuellement via votre banque.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDriverPaymentsPage;
