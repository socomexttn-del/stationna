import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Input } from './ui/input';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

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
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setInputValue(value?.address || '');
  }, [value?.address]);

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
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${MAPBOX_TOKEN}&` +
        `country=fr&` +
        `language=fr&` +
        `types=address,poi&` +
        `limit=5`
      );
      const data = await response.json();
      
      if (data.features) {
        setSuggestions(data.features.map(feature => ({
          id: feature.id,
          address: feature.place_name,
          lat: feature.center[1],
          lng: feature.center[0]
        })));
        setShowSuggestions(true);
      }
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-start gap-3 border-b border-border last:border-0"
            >
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-sm">{suggestion.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
