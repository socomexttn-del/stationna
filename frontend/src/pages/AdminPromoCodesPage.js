import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  ArrowLeft, Plus, Trash2, Tag, Users, Calendar, Percent,
  Search, Loader2, Copy, CheckCircle, XCircle, BarChart3, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const AdminPromoCodesPage = () => {
  const { api } = useAuth();
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [promoStats, setPromoStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [newCode, setNewCode] = useState('');
  const [discount, setDiscount] = useState(10);
  const [maxUses, setMaxUses] = useState(100);
  const [validUntil, setValidUntil] = useState('');

  useEffect(() => {
    fetchPromoCodes();
    // Set default valid until date (30 days from now)
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    setValidUntil(defaultDate.toISOString().split('T')[0]);
  }, []);

  const fetchPromoCodes = async () => {
    try {
      const response = await api.get('/admin/promo-codes');
      setPromoCodes(response.data.promo_codes);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const createPromoCode = async (e) => {
    e.preventDefault();
    if (!newCode.trim()) {
      toast.error('Veuillez entrer un code');
      return;
    }
    
    setCreating(true);
    try {
      await api.post('/admin/promo-codes', {
        code: newCode.toUpperCase(),
        discount_percent: discount,
        max_uses: maxUses,
        valid_until: new Date(validUntil).toISOString()
      });
      toast.success('Code promo créé !');
      setShowCreateForm(false);
      setNewCode('');
      setDiscount(10);
      setMaxUses(100);
      fetchPromoCodes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const deletePromoCode = async (promoId) => {
    if (!window.confirm('Supprimer ce code promo ?')) return;
    
    try {
      await api.delete(`/admin/promo-codes/${promoId}`);
      toast.success('Code promo supprimé');
      fetchPromoCodes();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const viewPromoStats = async (promo) => {
    setSelectedPromo(promo);
    try {
      const response = await api.get(`/admin/promo-codes/${promo.id}/stats`);
      setPromoStats(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des stats');
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copié !');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const filteredCodes = promoCodes.filter(p => 
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats summary
  const totalCodes = promoCodes.length;
  const activeCodes = promoCodes.filter(p => !p.is_expired && p.used_count < p.max_uses).length;
  const totalUsages = promoCodes.reduce((sum, p) => sum + (p.used_count || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>
              Codes Promo
            </h1>
          </div>
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="gap-2 bg-primary text-primary-foreground"
            data-testid="create-promo-btn"
          >
            <Plus className="w-4 h-4" /> Nouveau
          </Button>
        </div>
      </header>

      <main className="pt-20 pb-8 px-4 max-w-4xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-primary/20 to-transparent border-primary/30">
            <CardContent className="p-4 text-center">
              <Tag className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{totalCodes}</p>
              <p className="text-xs text-muted-foreground">Total codes</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/20 to-transparent border-green-500/30">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{activeCodes}</p>
              <p className="text-xs text-muted-foreground">Actifs</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/20 to-transparent border-blue-500/30">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{totalUsages}</p>
              <p className="text-xs text-muted-foreground">Utilisations</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-primary" />
                  Nouveau Code Promo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createPromoCode} className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Code</label>
                    <Input
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      placeholder="Ex: SUMMER2025"
                      className="uppercase"
                      maxLength={20}
                      data-testid="promo-code-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Réduction (%)</label>
                      <Input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                        min="1"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Utilisations max</label>
                      <Input
                        type="number"
                        value={maxUses}
                        onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Valide jusqu'au</label>
                    <Input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Annuler
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1"
                      disabled={creating}
                      data-testid="submit-promo-btn"
                    >
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats Modal */}
        {selectedPromo && promoStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
              <CardHeader className="border-b border-border/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Stats: {selectedPromo.code}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedPromo(null); setPromoStats(null); }}>
                    <XCircle className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">{promoStats.promo.discount_percent}%</p>
                    <p className="text-xs text-muted-foreground">Réduction</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold">{promoStats.promo.used_count}/{promoStats.promo.max_uses}</p>
                    <p className="text-xs text-muted-foreground">Utilisations</p>
                  </div>
                </div>
                
                <h4 className="font-medium mb-2">Utilisateurs ({promoStats.usages.length})</h4>
                {promoStats.usages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune utilisation</p>
                ) : (
                  <div className="space-y-2">
                    {promoStats.usages.map((usage, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{usage.user_name || 'Utilisateur'}</p>
                          <p className="text-xs text-muted-foreground">{usage.user_email}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          usage.used ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {usage.used ? 'Utilisé' : 'En attente'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Promo Codes List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredCodes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun code promo</p>
              <Button 
                className="mt-4"
                onClick={() => setShowCreateForm(true)}
              >
                Créer un code
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCodes.map((promo) => (
              <Card 
                key={promo.id} 
                className={`${promo.is_expired ? 'opacity-60' : ''} ${
                  promo.used_count >= promo.max_uses ? 'border-red-500/30' : 'border-white/10'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => copyCode(promo.code)}
                        className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                      >
                        <Tag className="w-4 h-4 text-primary" />
                        <span className="font-mono font-bold">{promo.code}</span>
                        <Copy className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-green-500">-{promo.discount_percent}%</span>
                          {promo.is_referral && (
                            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">Parrainage</span>
                          )}
                          {promo.is_expired && (
                            <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">Expiré</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {promo.used_count}/{promo.max_uses}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(promo.valid_until)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Usage bar */}
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${promo.usage_percent >= 90 ? 'bg-red-500' : promo.usage_percent >= 50 ? 'bg-orange-500' : 'bg-green-500'}`}
                          style={{ width: `${promo.usage_percent}%` }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => viewPromoStats(promo)}
                        data-testid={`view-stats-${promo.code}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePromoCode(promo.id)}
                        className="text-red-500 hover:text-red-400"
                        data-testid={`delete-${promo.code}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPromoCodesPage;
