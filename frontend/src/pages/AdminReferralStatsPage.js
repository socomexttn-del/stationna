import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { ArrowLeft, Search, Users, Trophy, Percent, Gift, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const AdminReferralStatsPage = () => {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchStats();
  }, [user, navigate]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/drivers/referral-stats');
      setStats({
        total_drivers: response.data.total_drivers,
        total_referral_points: response.data.total_referral_points,
        drivers_with_reduced_commission: response.data.drivers_with_reduced_commission
      });
      setDrivers(response.data.drivers || []);
    } catch (error) {
      console.error('Error fetching referral stats:', error);
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Code copié !');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredDrivers = drivers.filter(driver => {
    const search = searchTerm.toLowerCase();
    return (
      driver.first_name?.toLowerCase().includes(search) ||
      driver.last_name?.toLowerCase().includes(search) ||
      driver.email?.toLowerCase().includes(search) ||
      driver.driver_code?.toLowerCase().includes(search) ||
      driver.phone?.includes(search)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Statistiques Parrainage</h1>
            <p className="text-sm text-muted-foreground">Codes chauffeurs et points de fidélité</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.total_drivers || 0}</p>
                  <p className="text-sm text-muted-foreground">Chauffeurs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Gift className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.total_referral_points || 0}</p>
                  <p className="text-sm text-muted-foreground">Points totaux</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.drivers_with_reduced_commission || 0}</p>
                  <p className="text-sm text-muted-foreground">Commission 10%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, code ou téléphone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Drivers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chauffeurs ({filteredDrivers.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Chauffeur</TableHead>
                    <TableHead className="text-center">Points</TableHead>
                    <TableHead className="text-center">Clients</TableHead>
                    <TableHead className="text-center">Commission</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">
                            {driver.driver_code || 'N/A'}
                          </span>
                          {driver.driver_code && (
                            <button
                              onClick={() => copyCode(driver.driver_code)}
                              className="p-1 hover:bg-muted rounded"
                            >
                              {copiedCode === driver.driver_code ? (
                                <CheckCircle className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3 text-muted-foreground" />
                              )}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{driver.first_name} {driver.last_name}</p>
                          <p className="text-xs text-muted-foreground">{driver.email}</p>
                          <p className="text-xs text-muted-foreground">{driver.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold">{driver.referral_points || 0}</span>
                          {driver.points_to_reduced_commission > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {driver.points_to_reduced_commission} pour 10%
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-lg font-medium">{driver.referred_clients_count || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          driver.commission_rate <= 0.10 
                            ? 'bg-green-500/20 text-green-500' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {Math.round(driver.commission_rate * 100)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          driver.validation_status === 'active' 
                            ? 'bg-green-500/20 text-green-500' 
                            : driver.validation_status === 'pending_validation'
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : 'bg-red-500/20 text-red-500'
                        }`}>
                          {driver.validation_status === 'active' ? 'Actif' : 
                           driver.validation_status === 'pending_validation' ? 'En attente' : 'Suspendu'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDrivers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucun chauffeur trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="mt-6 bg-muted/50">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" />
              Comment fonctionne le parrainage ?
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Chaque chauffeur a un code unique (ex: SC-0001)</li>
              <li>• Le chauffeur partage son code avec des clients potentiels</li>
              <li>• Quand un nouveau client termine sa première course avec le code, le chauffeur gagne 1 point</li>
              <li>• À 3000 points, la commission passe de 18% à 10%</li>
              <li>• Un client ne peut donner qu'un seul point (première course uniquement)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminReferralStatsPage;
