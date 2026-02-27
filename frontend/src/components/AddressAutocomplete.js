import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Input } from './ui/input';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const POPULAR_LOCATIONS = [
  { id: 'gare-nord', text: 'Gare du Nord', address: 'Gare du Nord, 75010 Paris', lat: 48.8809, lng: 2.3553 },
  { id: 'gare-est', text: 'Gare de l\'Est', address: 'Gare de l\'Est, 75010 Paris', lat: 48.8763, lng: 2.3594 },
  { id: 'gare-lyon', text: 'Gare de Lyon', address: 'Gare de Lyon, 75012 Paris', lat: 48.8443, lng: 2.3738 },
  { id: 'gare-saint-lazare', text: 'Gare Saint-Lazare', address: 'Gare Saint-Lazare, 75008 Paris', lat: 48.8765, lng: 2.3252 },
  { id: 'gare-montparnasse', text: 'Gare Montparnasse', address: 'Gare Montparnasse, 75015 Paris', lat: 48.8408, lng: 2.3194 },
  { id: 'cdg', text: 'Aéroport CDG', address: 'Aéroport Paris-Charles de Gaulle, Roissy', lat: 49.0097, lng: 2.5479 },
  { id: 'orly', text: 'Aéroport Orly', address: 'Aéroport de Paris-Orly', lat: 48.7262, lng: 2.3652 },
];

const AddressAutocomplete = ({ value, onChange, placeholder, icon: Icon = MapPin, iconColor = 'text-primary', dataTestId }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value?.address || '');
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setInputValue(value?.address || '');
  }, [value?.address]);

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
    try {
      const queryLower = query.toLowerCase();
      const localMatches = POPULAR_LOCATIONS.filter(loc => 
        loc.text.toLowerCase().includes(queryLower) || 
        loc.address.toLowerCase().includes(queryLower)
      ).map(loc => ({
        id: loc.id,
        address: loc.address,
        shortAddress: loc.text,
        lat: loc.lat,
        lng: loc.lng,
        isLocal: true
      }));

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=fr&language=fr&limit=5&proximity=2.3522,48.8566`
      );
      const data = await response.json();
      
      let mapboxResults = [];
      if (data.features) {
        mapboxResults = data.features.map(feature => ({
          id: feature.id,
          address: feature.place_name,
          shortAddress: feature.text,
          lat: feature.center[1],
          lng: feature.center[0],
          isLocal: false
        }));
      }

      const combined = [...localMatches, ...mapboxResults].slice(0, 7);
      setSuggestions(combined);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Geocoding error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchAddress(newValue);
    }, 300);
  };

  const handleSelectSuggestion = (suggestion) => {
    setInputValue(suggestion.address);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange({
      lat: suggestion.lat,
      lng: suggestion.lng,
      address: suggestion.address
    });
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('La géolocalisation n\'est pas supportée');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&language=fr&limit=1`
          );
          const data = await response.json();
          
          if (data.features && data.features.length > 0) {
            const address = data.features[0].place_name;
            setInputValue(address);
            onChange({ lat: latitude, lng: longitude, address });
          }
        } catch (error) {
          console.error('Reverse geocoding error:', error);
          onChange({ lat: latitude, lng: longitude, address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLoading(false);
        alert('Impossible d\'obtenir votre position');
      }
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Icon className={`absolute left-4 w-5 h-5 ${iconColor} z-10`} />
        <Input
          data-testid={dataTestId}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className="h-14 pl-12 pr-12 bg-muted border-white/10 rounded-xl text-lg"
        />
        {isLoading ? (
          <Loader2 className="absolute right-4 w-5 h-5 text-muted-foreground animate-spin" />
        ) : (
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            className="absolute right-4 p-1 text-muted-foreground hover:text-primary transition-colors"
            title="Utiliser ma position"
          >
            <Navigation className="w-5 h-5" />
          </button>
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-start gap-3 border-b border-border last:border-0"
            >
              <MapPin className={`w-5 h-5 mt-0.5 flex-shrink-0 ${suggestion.isLocal ? 'text-yellow-500' : 'text-primary'}`} />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{suggestion.shortAddress}</span>
                  {suggestion.isLocal && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded-full">
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

export default AddressAutocomplete;
