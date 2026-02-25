import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Input } from './ui/input';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Popular locations - Gares et Aéroports
const POPULAR_LOCATIONS = [
  // Gares parisiennes
  { id: 'gare-nord', text: 'Gare du Nord', address: 'Gare du Nord, 75010 Paris', lat: 48.8809, lng: 2.3553, type: 'poi' },
  { id: 'gare-est', text: 'Gare de l\'Est', address: 'Gare de l\'Est, 75010 Paris', lat: 48.8763, lng: 2.3594, type: 'poi' },
  { id: 'gare-lyon', text: 'Gare de Lyon', address: 'Gare de Lyon, 75012 Paris', lat: 48.8443, lng: 2.3738, type: 'poi' },
  { id: 'gare-saint-lazare', text: 'Gare Saint-Lazare', address: 'Gare Saint-Lazare, 75008 Paris', lat: 48.8765, lng: 2.3252, type: 'poi' },
  { id: 'gare-austerlitz', text: 'Gare d\'Austerlitz', address: 'Gare d\'Austerlitz, 75013 Paris', lat: 48.8424, lng: 2.3656, type: 'poi' },
  { id: 'gare-montparnasse', text: 'Gare Montparnasse', address: 'Gare Montparnasse, 75015 Paris', lat: 48.8408, lng: 2.3194, type: 'poi' },
  // Aéroports
  { id: 'cdg', text: 'Aéroport CDG', address: 'Aéroport Paris-Charles de Gaulle, 95700 Roissy-en-France', lat: 49.0097, lng: 2.5479, type: 'poi' },
  { id: 'orly', text: 'Aéroport Orly', address: 'Aéroport de Paris-Orly, 94390 Orly', lat: 48.7262, lng: 2.3652, type: 'poi' },
  { id: 'beauvais', text: 'Aéroport Beauvais', address: 'Aéroport de Beauvais-Tillé, 60000 Beauvais', lat: 49.4544, lng: 2.1128, type: 'poi' },
];

const AddressAutocomplete = ({ 
  value, 
  onChange, 
  placeholder, 
  icon: Icon = MapPin,
  iconColor = 'text-primary',
  dataTestId
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value?.address || '');
  const [userLocation, setUserLocation] = useState(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setInputValue(value?.address || '');
  }, [value?.address]);

  // Get user location for proximity bias
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          // Default to Paris if geolocation fails
          setUserLocation({ lat: 48.8566, lng: 2.3522 });
        }
      );
    } else {
      setUserLocation({ lat: 48.8566, lng: 2.3522 });
    }
  }, []);

  // Close suggestions when clicking outside
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
      // First, search in popular locations
      const queryLower = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const localMatches = POPULAR_LOCATIONS.filter(loc => {
        const textLower = loc.text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const addressLower = loc.address.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return textLower.includes(queryLower) || addressLower.includes(queryLower) || queryLower.includes(textLower.split(' ')[0]);
      }).map(loc => ({
        id: loc.id,
        address: loc.address,
        shortAddress: loc.text,
        city: 'Paris',
        postcode: '',
        lat: loc.lat,
        lng: loc.lng,
        type: loc.type,
        isLocal: true
      }));

      // Build proximity parameter for better local results
      const proximityParam = userLocation 
        ? `&proximity=${userLocation.lng},${userLocation.lat}` 
        : '&proximity=2.3522,48.8566'; // Default to Paris

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${MAPBOX_TOKEN}&` +
        `country=fr&` +
        `language=fr&` +
        `types=address,poi,place,locality,neighborhood&` +
        `autocomplete=true&` +
        `fuzzyMatch=true&` +
        `limit=7` +
        proximityParam
      );
      const data = await response.json();
      
      let mapboxResults = [];
      if (data.features) {
        mapboxResults = data.features.map(feature => {
          // Extract context for better display
          const context = feature.context || [];
          const city = context.find(c => c.id.startsWith('place'))?.text || '';
          const postcode = context.find(c => c.id.startsWith('postcode'))?.text || '';
          
          return {
            id: feature.id,
            address: feature.place_name,
            shortAddress: feature.text,
            city,
            postcode,
            lat: feature.center[1],
            lng: feature.center[0],
            type: feature.place_type?.[0] || 'address',
            isLocal: false
          };
        });
      }

      // Combine local matches first, then Mapbox results (avoiding duplicates)
      const seenAddresses = new Set(localMatches.map(m => m.shortAddress.toLowerCase()));
      const filteredMapbox = mapboxResults.filter(r => !seenAddresses.has(r.shortAddress.toLowerCase()));
      
      const combined = [...localMatches, ...filteredMapbox].slice(0, 7);
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
    
    // Debounce API calls
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
        
        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?` +
            `access_token=${MAPBOX_TOKEN}&language=fr&limit=1`
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
              <MapPin className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                suggestion.isLocal ? 'text-yellow-500' :
                suggestion.type === 'poi' ? 'text-yellow-500' : 
                suggestion.type === 'place' ? 'text-blue-500' : 'text-primary'
              }`} />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{suggestion.shortAddress}</span>
                  {suggestion.isLocal && (
                    <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      Populaire
                    </span>
                  )}
                </div>
                {(suggestion.city || suggestion.address) && (
                  <span className="text-xs text-muted-foreground truncate">
                    {suggestion.isLocal ? suggestion.address : 
                      (suggestion.postcode ? `${suggestion.postcode} ` : '') + suggestion.city}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
