import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import LanguageSelector from '../components/LanguageSelector';
import StationCabLogo from '../components/StationCabLogo';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { 
  Car, Shield, CreditCard, Star, MapPin, Clock, ArrowRight, CheckCircle, 
  Users, Zap, Phone, ChevronRight, Navigation, Building, Plane, Train,
  Quote, Calculator, Euro, Wallet, Headphones, FileCheck, Loader2, Truck, X
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LandingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState({ lat: null, lng: null, address: '' });
  const [destination, setDestination] = useState({ lat: null, lng: null, address: '' });
  const [estimates, setEstimates] = useState(null);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
  const [showEstimates, setShowEstimates] = useState(false);
  
  const handleEstimate = async () => {
    if (!pickup.lat || !destination.lat) {
      navigate('/auth?role=passenger');
      return;
    }
    
    setIsLoadingEstimate(true);
    setShowEstimates(false);
    
    try {
      const [vtcRes, vanRes, taxiRes] = await Promise.all([
        axios.post(`${API_URL}/api/rides/estimate`, {
          pickup, destination, vehicle_type: 'standard', passenger_count: 1
        }),
        axios.post(`${API_URL}/api/rides/estimate`, {
          pickup, destination, vehicle_type: 'van', passenger_count: 1
        }),
        axios.post(`${API_URL}/api/rides/estimate`, {
          pickup, destination, vehicle_type: 'taxi', passenger_count: 1
        })
      ]);
      
      setEstimates({
        vtc: vtcRes.data,
        van: vanRes.data,
        taxi: taxiRes.data,
        distance: vtcRes.data.distance_km,
        duration: vtcRes.data.duration_minutes
      });
      setShowEstimates(true);
    } catch (error) {
      console.error('Estimate error:', error);
      navigate('/auth?role=passenger');
    }
    setIsLoadingEstimate(false);
  };

  const handleBookNow = (vehicleType) => {
    navigate(`/auth?role=passenger&vehicle=${vehicleType}`);
  };
  
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0a1628 0%, #071018 100%)' }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <StationCabLogo size="default" darkMode={true} />
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <Link to="/auth">
              <Button 
                data-testid="header-login-btn"
                className="rounded-full font-semibold px-6 h-10 btn-glow transition-all"
                style={{ backgroundColor: '#00a693', color: '#ffffff' }}
              >
                {t('auth.login')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ 
            background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 166, 147, 0.12) 0%, transparent 50%)'
          }} />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left side - Text */}
              <div className="text-center lg:text-left">
                <div className="flex justify-center lg:justify-start mb-6">
                  <StationCabLogo size="large" showText={false} darkMode={true} />
                </div>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6" style={{ fontFamily: 'Space Grotesk' }}>
                  <span className="text-white">Réservez un </span>
                  <span style={{ color: '#00a693' }}>VTC</span>
                  <span className="text-white"> ou </span>
                  <span style={{ color: '#00a693' }}>Taxi</span>
                  <br />
                  <span className="text-white">en France 24h/24</span>
                </h1>
                
                <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                  Chauffeurs VTC professionnels vérifiés et Taxis officiels. 
                  Prix connu à l&apos;avance. Paiement sécurisé.
                </p>
                
                <div className="flex flex-wrap gap-4 justify-center lg:justify-start mb-8">
                  {[
                    { icon: Shield, text: 'Chauffeurs vérifiés' },
                    { icon: Euro, text: 'Prix fixe garanti' },
                    { icon: Clock, text: 'Disponible 24h/24' }
                  ].map((badge, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ backgroundColor: 'rgba(0, 166, 147, 0.1)' }}>
                      <badge.icon className="w-4 h-4" style={{ color: '#00a693' }} />
                      <span className="text-sm text-gray-300">{badge.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Right side - Price Calculator */}
              <div className="w-full max-w-md mx-auto lg:mx-0">
                <div className="p-6 rounded-2xl border" style={{ 
                  background: 'linear-gradient(135deg, rgba(31, 63, 107, 0.4) 0%, rgba(10, 22, 40, 0.8) 100%)',
                  borderColor: 'rgba(0, 166, 147, 0.3)'
                }}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-5 h-5" style={{ color: '#00a693' }} />
                      <h2 className="text-xl font-bold text-white">Estimez votre course</h2>
                    </div>
                    {showEstimates && (
                      <button 
                        onClick={() => { setShowEstimates(false); setEstimates(null); }}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    )}
                  </div>
                  
                  {!showEstimates ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Départ</label>
                        <AddressAutocomplete
                          value={pickup}
                          onChange={setPickup}
                          placeholder="Adresse de départ"
                          icon={MapPin}
                          iconColor="text-green-500"
                          dataTestId="landing-pickup"
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Destination</label>
                        <AddressAutocomplete
                          value={destination}
                          onChange={setDestination}
                          placeholder="Adresse d&apos;arrivée"
                          icon={Navigation}
                          iconColor="text-primary"
                          dataTestId="landing-destination"
                        />
                      </div>
                      
                      <Button 
                        onClick={handleEstimate}
                        disabled={isLoadingEstimate}
                        className="w-full h-14 rounded-xl font-bold text-lg shadow-[0_0_30px_rgba(0,166,147,0.3)] transition-all hover:shadow-[0_0_40px_rgba(0,166,147,0.5)]"
                        style={{ backgroundColor: '#00a693', color: '#ffffff' }}
                        data-testid="estimate-price-btn"
                      >
                        {isLoadingEstimate ? (
                          <span className="flex items-center">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            Calcul en cours...
                          </span>
                        ) : (
                          <span className="flex items-center">
                            Voir le prix estimé
                            <ArrowRight className="ml-2 w-5 h-5" />
                          </span>
                        )}
                      </Button>
                      
                      <p className="text-xs text-gray-500 text-center">
                        Gratuit et sans engagement
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'rgba(0, 166, 147, 0.1)' }}>
                        <div className="flex items-center gap-2">
                          <Navigation className="w-4 h-4" style={{ color: '#00a693' }} />
                          <span className="text-sm text-gray-300">{estimates.distance} km</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" style={{ color: '#00a693' }} />
                          <span className="text-sm text-gray-300">~{estimates.duration} min</span>
                        </div>
                      </div>
                      
                      {/* VTC Option */}
                      <div 
                        className="p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02]"
                        style={{ borderColor: 'rgba(0, 166, 147, 0.5)', backgroundColor: 'rgba(0, 166, 147, 0.05)' }}
                        onClick={() => handleBookNow('standard')}
                        data-testid="vtc-option"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 166, 147, 0.2)' }}>
                              <Car className="w-5 h-5" style={{ color: '#00a693' }} />
                            </div>
                            <div>
                              <h3 className="font-bold text-white">VTC</h3>
                              <p className="text-xs text-gray-400">1-4 places - Véhicule confort</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold" style={{ color: '#00a693' }}>{estimates.vtc.estimated_fare}€</p>
                            <p className="text-xs text-gray-500">Prix fixe</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Van Option */}
                      <div 
                        className="p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02]"
                        style={{ borderColor: 'rgba(59, 130, 246, 0.5)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                        onClick={() => handleBookNow('van')}
                        data-testid="van-option"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/20">
                              <Truck className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                              <h3 className="font-bold text-white">Van</h3>
                              <p className="text-xs text-gray-400">1-7 places - Espace bagages</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-blue-400">{estimates.van.estimated_fare}€</p>
                            <p className="text-xs text-gray-500">Prix fixe</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Taxi Option */}
                      <div 
                        className="p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02]"
                        style={{ borderColor: 'rgba(234, 179, 8, 0.5)', backgroundColor: 'rgba(234, 179, 8, 0.05)' }}
                        onClick={() => handleBookNow('taxi')}
                        data-testid="taxi-option"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-500/20">
                              <Car className="w-5 h-5 text-yellow-500" />
                            </div>
                            <div>
                              <h3 className="font-bold text-white">Taxi Officiel</h3>
                              <p className="text-xs text-gray-400">1-4 places - Tarif réglementé</p>
                              {estimates.taxi.fare_details?.is_airport_flat_rate && (
                                <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">
                                  Forfait Aéroport
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-yellow-500">{estimates.taxi.estimated_fare}€</p>
                            <p className="text-xs text-gray-500">
                              {estimates.taxi.fare_details?.is_airport_flat_rate ? 'Prix fixe' : 'Estimation'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-500 text-center">
                        Cliquez sur une option pour réserver
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pourquoi nous choisir */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white" style={{ fontFamily: 'Space Grotesk' }}>
              Pourquoi choisir <span style={{ color: '#00a693' }}>StationCab</span> ?
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              La confiance de milliers de clients en France
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
            {[
              { icon: Shield, title: 'Chauffeurs vérifiés', desc: 'Documents contrôlés' },
              { icon: Euro, title: 'Prix connus', desc: 'Pas de surprise' },
              { icon: CreditCard, title: 'Paiement sécurisé', desc: 'CB ou espèces' },
              { icon: Clock, title: 'Disponible 24h/24', desc: '7 jours sur 7' },
              { icon: Zap, title: 'Réservation instantanée', desc: 'En 30 secondes' }
            ].map((item, index) => (
              <div 
                key={index}
                className="text-center p-4 rounded-xl feature-card"
              >
                <div className="icon-container w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <item.icon className="w-6 h-6" style={{ color: '#00a693' }} />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 relative" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(31, 63, 107, 0.1) 50%, transparent 100%)' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: 'rgba(0, 166, 147, 0.1)', color: '#00a693' }}>
              Nos services
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white" style={{ fontFamily: 'Space Grotesk' }}>
              VTC professionnels et Taxis officiels
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              {
                title: 'VTC',
                description: 'Chauffeurs professionnels avec véhicules récents et confortables',
                icon: Car,
                price: 'À partir de 15€',
                features: ['Véhicule confortable', 'Chauffeur professionnel', 'Prix fixe garanti']
              },
              {
                title: 'Taxi Officiel',
                description: 'Taxis conventionnés avec tarifs réglementés pour les aéroports',
                icon: CreditCard,
                price: 'Forfait aéroport',
                features: ['Tarif réglementé', 'CDG et Orly', 'Compteur officiel']
              }
            ].map((service, index) => (
              <div 
                key={index}
                className="p-6 rounded-2xl transition-all duration-300 card-hover feature-card"
              >
                <div className="icon-container w-14 h-14 rounded-xl flex items-center justify-center mb-4">
                  <service.icon className="w-7 h-7" style={{ color: '#00a693' }} />
                </div>
                
                <h3 className="text-xl font-bold mb-2 text-white">{service.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{service.description}</p>
                
                <div className="text-2xl font-bold mb-4" style={{ color: '#00a693' }}>{service.price}</div>
                
                <ul className="space-y-2 mb-6">
                  {service.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4" style={{ color: '#00a693' }} />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Link to="/auth?role=passenger">
                  <Button 
                    variant="outline"
                    className="w-full rounded-full"
                    style={{ borderColor: 'rgba(0, 166, 147, 0.5)', color: '#ffffff' }}
                  >
                    Réserver
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Zones desservies */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white" style={{ fontFamily: 'Space Grotesk' }}>
              Zones desservies
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Disponible dans les principales villes de France
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
            {[
              { name: 'Paris', icon: Building },
              { name: 'Lille', icon: Building },
              { name: 'Lyon', icon: Building },
              { name: 'Marseille', icon: Building },
              { name: 'Aéroports', icon: Plane },
              { name: 'Gares', icon: Train }
            ].map((zone, index) => (
              <div 
                key={index}
                className="text-center p-4 rounded-xl feature-card cursor-pointer hover:scale-105 transition-transform"
              >
                <zone.icon className="w-8 h-8 mx-auto mb-2" style={{ color: '#00a693' }} />
                <span className="text-white font-medium">{zone.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Avis clients */}
      <section className="py-20 relative" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(31, 63, 107, 0.15) 50%, transparent 100%)' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white" style={{ fontFamily: 'Space Grotesk' }}>
              Ce que disent nos clients
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: 'Marie L.',
                rating: 5,
                text: 'Service impeccable ! Chauffeur ponctuel et très professionnel. Je recommande vivement.',
                trip: 'Paris - CDG'
              },
              {
                name: 'Thomas B.',
                rating: 5,
                text: 'Prix fixe garanti, pas de mauvaise surprise. Le chauffeur était au rendez-vous.',
                trip: 'Gare du Nord - Orly'
              },
              {
                name: 'Sophie M.',
                rating: 5,
                text: 'Application simple et efficace. Réservation en quelques clics. Très satisfaite !',
                trip: 'Paris - Disneyland'
              }
            ].map((review, index) => (
              <div 
                key={index}
                className="p-6 rounded-2xl feature-card"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  ))}
                </div>
                <Quote className="w-8 h-8 mb-4 opacity-30" style={{ color: '#00a693' }} />
                <p className="text-gray-300 mb-4 italic">&quot;{review.text}&quot;</p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{review.name}</span>
                  <span className="text-xs text-gray-500">{review.trip}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Devenir chauffeur */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: 'rgba(0, 166, 147, 0.1)', color: '#00a693' }}>
                  Rejoignez-nous
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-white" style={{ fontFamily: 'Space Grotesk' }}>
                  Devenez chauffeur <span style={{ color: '#00a693' }}>StationCab</span>
                </h2>
                <p className="text-gray-400 mb-8 leading-relaxed">
                  Rejoignez notre réseau de chauffeurs professionnels. Gérez votre emploi du temps, 
                  acceptez les courses qui vous conviennent et augmentez vos revenus.
                </p>
                
                <ul className="space-y-4 mb-8">
                  {[
                    { icon: Wallet, text: 'Commission avantageuse' },
                    { icon: Clock, text: 'Liberté de vos horaires' },
                    { icon: Headphones, text: 'Support disponible 24/7' },
                    { icon: FileCheck, text: 'Inscription simple et rapide' }
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-300">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 166, 147, 0.1)' }}>
                        <item.icon className="w-5 h-5" style={{ color: '#00a693' }} />
                      </div>
                      {item.text}
                    </li>
                  ))}
                </ul>
                
                <Link to="/devenir-chauffeur">
                  <Button 
                    className="h-14 px-8 rounded-full font-bold text-lg"
                    style={{ backgroundColor: '#00a693', color: '#ffffff' }}
                  >
                    Devenir chauffeur partenaire
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>
              
              <div className="relative hidden md:block">
                <div className="absolute inset-0 blur-3xl opacity-20" style={{ backgroundColor: '#00a693' }} />
                <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-3xl p-8 border border-gray-700/50">
                  <div className="text-center">
                    <div className="text-5xl font-bold mb-2" style={{ color: '#00a693' }}>150+</div>
                    <div className="text-gray-400 mb-6">Chauffeurs actifs</div>
                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(0, 166, 147, 0.1)' }}>
                        <div className="text-2xl font-bold text-white">4.9</div>
                        <div className="text-sm text-gray-400">Note moyenne</div>
                      </div>
                      <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(31, 63, 107, 0.3)' }}>
                        <div className="text-2xl font-bold text-white">24/7</div>
                        <div className="text-sm text-gray-400">Support</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-white" style={{ fontFamily: 'Space Grotesk' }}>
              Prêt à réserver votre course ?
            </h2>
            <p className="text-lg text-gray-400 mb-8">
              Rejoignez des milliers de clients satisfaits
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth?role=passenger">
                <Button 
                  className="h-14 px-10 rounded-full font-bold text-lg shadow-[0_0_40px_rgba(0,166,147,0.4)] transition-all hover:shadow-[0_0_60px_rgba(0,166,147,0.6)] hover:scale-105"
                  style={{ backgroundColor: '#00a693', color: '#ffffff' }}
                >
                  Réserver maintenant
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/devenir-chauffeur">
                <Button 
                  variant="outline"
                  className="h-14 px-10 rounded-full font-bold text-lg transition-all hover:scale-105"
                  style={{ borderColor: 'rgba(0, 166, 147, 0.5)', color: '#ffffff' }}
                >
                  Devenir chauffeur
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t" style={{ borderColor: 'rgba(31, 63, 107, 0.3)' }}>
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <StationCabLogo size="small" darkMode={true} />
            <div className="flex items-center gap-8 text-sm text-gray-500">
              <Link to="/mentions-legales" className="hover:text-white transition-colors">Mentions légales</Link>
              <Link to="/cgv" className="hover:text-white transition-colors">CGV</Link>
              <a href="mailto:contact@stationcab.fr" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} StationCab - A&amp;S Prestige SASU. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
