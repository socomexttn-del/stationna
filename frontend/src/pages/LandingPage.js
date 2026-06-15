import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import LanguageSelector from '../components/LanguageSelector';
import StationCabLogo from '../components/StationCabLogo';
import { 
  Car, Shield, CreditCard, Star, MapPin, Clock, ArrowRight, CheckCircle, 
  Users, Zap, Phone, ChevronRight, Navigation, Building, Plane, Train,
  Quote, Calculator, Euro, Wallet, Headphones, FileCheck, Crosshair, Loader2, Truck, X
} from 'lucide-react';
import axios from 'axios';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const API_URL = process.env.REACT_APP_BACKEND_URL;

// Popular locations for quick search
const POPULAR_LOCATIONS = [
  { id: 'gare-nord', text: 'Gare du Nord', address: 'Gare du Nord, 75010 Paris', lat: 48.8809, lng: 2.3553 },
  { id: 'gare-est', text: 'Gare de lEst', address: 'Gare de lEst, 75010 Paris', lat: 48.8763, lng: 2.3594 },
  { id: 'gare-lyon', text: 'Gare de Lyon', address: 'Gare de Lyon, 75012 Paris', lat: 48.8443, lng: 2.3738 },
  { id: 'cdg', text: 'Aéroport CDG', address: 'Aéroport Paris-Charles de Gaulle, Roissy', lat: 49.0097, lng: 2.5479 },
  { id: 'orly', text: 'Aéroport Orly', address: 'Aéroport de Paris-Orly', lat: 48.7262, lng: 2.3652 },
  { id: 'la-defense', text: 'La Défense', address: 'La Défense, 92400 Courbevoie', lat: 48.8918, lng: 2.2362 },
];

// Address Autocomplete Component for Landing Page
const LandingAddressInput = ({ value, onChange, placeholder, icon: Icon, iconColor, isLocating, onLocate }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (value && value.address) {
      setInputValue(value.address);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    
    // Filter local matches
    const queryLower = query.toLowerCase();
    const localMatches = POPULAR_LOCATIONS.filter(loc => 
      loc.text.toLowerCase().includes(queryLower) || loc.address.toLowerCase().includes(queryLower)
    ).map(loc => ({
      id: loc.id,
      address: loc.address,
      shortAddress: loc.text,
      lat: loc.lat,
      lng: loc.lng,
      isLocal: true
    }));

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=fr&language=fr&limit=5&types=poi,address,place,locality&proximity=2.3522,48.8566`
      );
      const data = await response.json();
      
      const mapboxResults = data.features?.map(feature => ({
        id: feature.id,
        address: feature.place_name,
        shortAddress: feature.text,
        lat: feature.center[1],
        lng: feature.center[0],
        isLocal: false
      })) || [];

      setSuggestions([...localMatches, ...mapboxResults].slice(0, 6));
      setShowSuggestions(true);
    } catch (error) {
      console.error('Geocoding error:', error);
      setSuggestions(localMatches);
      setShowSuggestions(true);
    }
    setIsLoading(false);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(newValue), 300);
  };

  const handleSelectSuggestion = (suggestion) => {
    setInputValue(suggestion.address);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange({ lat: suggestion.lat, lng: suggestion.lng, address: suggestion.address });
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Icon className={`absolute left-3 w-5 h-5 z-10 ${iconColor}`} />
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className="pl-10 pr-10 h-12 bg-background/50 border-border/50"
          data-testid="landing-address-input"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 w-5 h-5 text-muted-foreground animate-spin" />
        ) : onLocate ? (
          <button
            type="button"
            onClick={onLocate}
            disabled={isLocating}
            className="absolute right-3 p-1 text-muted-foreground hover:text-primary transition-colors"
            title="Me localiser"
          >
            {isLocating ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <Crosshair className="w-5 h-5" />
            )}
          </button>
        ) : null}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-start gap-3 border-b border-border last:border-0"
            >
              <MapPin className={`w-4 h-4 mt-0.5 flex-shrink-0 ${suggestion.isLocal ? 'text-yellow-500' : 'text-primary'}`} />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{suggestion.shortAddress}</span>
                  {suggestion.isLocal && (
                    <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded-full">
                      Populaire
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate">{suggestion.address}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const LandingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState({ lat: null, lng: null, address: '' });
  const [destination, setDestination] = useState({ lat: null, lng: null, address: '' });
  const [isLocating, setIsLocating] = useState(false);
  const [estimates, setEstimates] = useState(null);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
  const [showEstimates, setShowEstimates] = useState(false);
  
  // Auto-geolocate on mount
  useEffect(() => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&language=fr&limit=1`
            );
            const data = await response.json();
            const address = data.features?.[0]?.place_name || 'Position actuelle';
            setPickup({ lat: latitude, lng: longitude, address });
          } catch (error) {
            setPickup({ lat: latitude, lng: longitude, address: 'Position actuelle' });
          }
          setIsLocating(false);
        },
        (error) => {
          console.log('Geolocation not available or denied');
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    }
  }, []);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&language=fr&limit=1`
          );
          const data = await response.json();
          const address = data.features?.[0]?.place_name || 'Position actuelle';
          setPickup({ lat: latitude, lng: longitude, address });
        } catch (error) {
          setPickup({ lat: latitude, lng: longitude, address: 'Position actuelle' });
        }
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };
  
  const handleEstimate = async () => {
    if (!pickup.lat || !destination.lat) {
      // Just redirect to auth if addresses not complete
      navigate('/auth?role=passenger');
      return;
    }
    
    setIsLoadingEstimate(true);
    setShowEstimates(false);
    
    try {
      // Fetch estimates for all 3 vehicle types
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
      // Still redirect to booking on error
      navigate('/auth?role=passenger');
    }
    setIsLoadingEstimate(false);
  };

  const handleBookNow = (vehicleType) => {
    navigate(`/auth?role=passenger&vehicle=${vehicleType}`);
  };
  
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0a1628 0%, #071018 100%)' }}>
      {/* Header avec SEO optimisé */}
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

      {/* Hero Section avec calculateur de prix */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background effects */}
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
                
                {/* SEO optimized title */}
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
                  Prix connu à l'avance. Paiement sécurisé.
                </p>
                
                {/* Trust badges */}
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
                      {/* Geolocation status */}
                      {isLocating && (
                        <div className="flex items-center gap-2 text-sm bg-primary/10 border border-primary/30 p-2 rounded-lg">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span className="text-primary">Localisation en cours...</span>
                        </div>
                      )}
                      
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Départ</label>
                        <LandingAddressInput
                          value={pickup}
                          onChange={setPickup}
                          placeholder="Adresse de départ"
                          icon={MapPin}
                          iconColor="text-green-500"
                          isLocating={isLocating}
                          onLocate={handleLocate}
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Destination</label>
                        <LandingAddressInput
                          value={destination}
                          onChange={setDestination}
                          placeholder="Adresse d'arrivée"
                          icon={Navigation}
                          iconColor="text-primary"
                          isLocating={false}
                          onLocate={null}
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
                          <>
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            Calcul en cours...
                          </>
                        ) : (
                          <>
                            Voir le prix estimé
                            <ArrowRight className="ml-2 w-5 h-5" />
                          </>
                        )}
                      </Button>
                      
                      <p className="text-xs text-gray-500 text-center">
                        Gratuit et sans engagement
                      </p>
                    </div>
                  ) : (
                    /* Price Estimates Display */
                    <div className="space-y-4">
                      {/* Route info */}
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
                              <h3 className="font-bold text-white">VTC Premium</h3>
                              <p className="text-xs text-gray-400">1-4 places • Berline confort</p>
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
                              <p className="text-xs text-gray-400">1-7 places • Espace bagages</p>
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
                              <p className="text-xs text-gray-400">1-4 places • Tarif réglementé</p>
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

      {/* Services - VTC et Taxi */}
      <section className="py-20 relative" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(31, 63, 107, 0.1) 50%, transparent 100%)' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: 'rgba(0, 166, 147, 0.1)', color: '#00a693' }}>
              Nos services
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white" style={{ fontFamily: 'Space Grotesk' }}>
              VTC professionnels & Taxis officiels
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              {
                title: 'VTC Premium',
                description: 'Chauffeurs professionnels avec véhicules récents et confortables',
                icon: Car,
                price: 'À partir de 15€',
                features: ['Berline confortable', 'Chauffeur professionnel', 'Prix fixe garanti']
              },
              {
                title: 'Taxi Officiel',
                description: 'Taxis conventionnés avec tarifs réglementés pour les aéroports',
                icon: CreditCard,
                price: 'Forfait aéroport',
                features: ['Tarif réglementé', 'CDG & Orly', 'Compteur officiel']
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
                location: 'Paris',
                rating: 5,
                text: 'Réservation rapide et chauffeur très ponctuel. Le prix annoncé était le prix final, aucune surprise !'
              },
              {
                name: 'Thomas D.',
                location: 'Lyon',
                rating: 5,
                text: 'Excellent service pour mes trajets aéroport. Chauffeur professionnel et véhicule impeccable.'
              },
              {
                name: 'Sophie M.',
                location: 'Marseille',
                rating: 5,
                text: 'Je recommande vivement ! Application simple à utiliser et chauffeurs toujours courtois.'
              }
            ].map((review, index) => (
              <div 
                key={index}
                className="p-6 rounded-2xl feature-card"
              >
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-current" style={{ color: '#00a693' }} />
                  ))}
                </div>
                
                <Quote className="w-8 h-8 mb-3 opacity-30" style={{ color: '#00a693' }} />
                
                <p className="text-gray-300 mb-4 italic">"{review.text}"</p>
                
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: '#1f3f6b' }}>
                    {review.name[0]}
                  </div>
                  <div>
                    <div className="text-white font-medium">{review.name}</div>
                    <div className="text-sm text-gray-500">{review.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section Devenir Chauffeur */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1f3f6b 0%, #0d2137 100%)' }} />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0, 166, 147, 0.3) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: 'rgba(0, 166, 147, 0.2)', color: '#00a693' }}>
                  Chauffeurs partenaires
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-white" style={{ fontFamily: 'Space Grotesk' }}>
                  Pourquoi rejoindre <span style={{ color: '#00a693' }}>StationCab</span> ?
                </h2>
                <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                  Développez votre activité avec notre plateforme. Inscrivez-vous gratuitement et commencez à recevoir des courses.
                </p>
                
                <ul className="space-y-4 mb-8">
                  {[
                    { icon: Wallet, text: 'Commissions réduites' },
                    { icon: Zap, text: 'Paiement rapide' },
                    { icon: Clock, text: 'Courses disponibles 24h/24' },
                    { icon: Headphones, text: 'Assistance dédiée' },
                    { icon: FileCheck, text: 'Inscription en quelques minutes' }
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-200">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 166, 147, 0.2)' }}>
                        <item.icon className="w-4 h-4" style={{ color: '#00a693' }} />
                      </div>
                      {item.text}
                    </li>
                  ))}
                </ul>
                
                <Link to="/devenir-chauffeur">
                  <Button 
                    data-testid="cta-driver-btn"
                    className="h-14 px-8 rounded-full font-bold text-lg shadow-[0_0_30px_rgba(0,166,147,0.3)]"
                    style={{ backgroundColor: '#00a693', color: '#ffffff' }}
                  >
                    S'inscrire gratuitement
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
                        <div className="text-2xl font-bold text-white">4.9★</div>
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
              <a href="#" className="hover:text-white transition-colors">Mentions légales</a>
              <a href="#" className="hover:text-white transition-colors">CGU</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-gray-500 text-sm">
              © 2024 StationCab. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
