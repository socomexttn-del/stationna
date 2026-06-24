import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Input } from './ui/input';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const POPULAR_LOCATIONS = [
  { id: 'gare-nord', text: 'Gare du Nord', address: 'Gare du Nord, 75010 Paris', lat: 48.8809, lng: 2.3553 },
  { id: 'gare-est', text: 'Gare de lEst', address: 'Gare de lEst, 75010 Paris', lat: 48.8763, lng: 2.3594 },
  { id: 'gare-lyon', text: 'Gare de Lyon', address: 'Gare de Lyon, 75012 Paris', lat: 48.8443, lng: 2.3738 },
  { id: 'gare-austerlitz', text: 'Gare dAusterlitz', address: 'Gare dAusterlitz, 75013 Paris', lat: 48.8425, lng: 2.3659 },
  { id: 'gare-montparnasse', text: 'Gare Montparnasse', address: 'Gare Montparnasse, 75015 Paris', lat: 48.8408, lng: 2.3188 },
  { id: 'gare-saint-lazare', text: 'Gare Saint-Lazare', address: 'Gare Saint-Lazare, 75008 Paris', lat: 48.8760, lng: 2.3250 },
  { id: 'cdg', text: 'Aeroport CDG', address: 'Aeroport Paris-Charles de Gaulle, Roissy', lat: 49.0097, lng: 2.5479 },
  { id: 'orly', text: 'Aeroport Orly', address: 'Aeroport de Paris-Orly', lat: 48.7262, lng: 2.3652 },
  { id: 'beauvais', text: 'Aeroport Beauvais', address: 'Aeroport de Beauvais-Tille', lat: 49.4544, lng: 2.1128 },
  { id: 'aeroville', text: 'Aeroville', address: 'Centre Commercial Aeroville, Tremblay-en-France', lat: 49.0048, lng: 2.5656 },
  { id: 'porte-maillot', text: 'Porte Maillot', address: 'Porte Maillot, 75017 Paris', lat: 48.8779, lng: 2.2826 },
  { id: 'la-defense', text: 'La Defense', address: 'La Defense, 92400 Courbevoie', lat: 48.8918, lng: 2.2362 },
  { id: 'disneyland', text: 'Disneyland Paris', address: 'Disneyland Paris, Marne-la-Vallee', lat: 48.8673, lng: 2.7838 },
];

function AddressAutocomplete(props) {
  const { value, onChange, placeholder, icon: Icon, iconColor, dataTestId } = props;
  const IconComponent = Icon || MapPin;
  const colorClass = iconColor || 'text-primary';
  
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(function() {
    if (value && value.address) {
      setInputValue(value.address);
    }
  }, [value]);

  useEffect(function() {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return function() {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  function searchAddress(query) {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    
    var queryLower = query.toLowerCase();
    var localMatches = POPULAR_LOCATIONS.filter(function(loc) {
      return loc.text.toLowerCase().includes(queryLower) || loc.address.toLowerCase().includes(queryLower);
    }).map(function(loc) {
      return {
        id: loc.id,
        address: loc.address,
        shortAddress: loc.text,
        lat: loc.lat,
        lng: loc.lng,
        isLocal: true
      };
    });

    // Search with broader parameters - include POIs, addresses, places
    fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(query) + '.json?access_token=' + MAPBOX_TOKEN + '&country=fr&language=fr&limit=7&types=poi,address,place,locality,neighborhood&proximity=2.3522,48.8566')
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        var mapboxResults = [];
        if (data.features) {
          mapboxResults = data.features.map(function(feature) {
            return {
              id: feature.id,
              address: feature.place_name,
              shortAddress: feature.text,
              lat: feature.center[1],
              lng: feature.center[0],
              isLocal: false
            };
          });
        }
        var combined = localMatches.concat(mapboxResults).slice(0, 8);
        setSuggestions(combined);
        setShowSuggestions(true);
        setIsLoading(false);
      })
      .catch(function(error) {
        console.error('Geocoding error:', error);
        setSuggestions(localMatches);
        setShowSuggestions(true);
        setIsLoading(false);
      });
  }

  function handleInputChange(e) {
    var newValue = e.target.value;
    setInputValue(newValue);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(function() {
      searchAddress(newValue);
    }, 300);
  }

  // Scroll input into view on mobile when focused
  function handleFocus() {
    if (suggestions.length > 0) setShowSuggestions(true);
    // On mobile, scroll the input to the top of the visible area
    setTimeout(function() {
      if (containerRef.current && window.innerWidth < 768) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[0]);
    }
  }

  function handleSelectSuggestion(suggestion) {
    setInputValue(suggestion.address);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange({
      lat: suggestion.lat,
      lng: suggestion.lng,
      address: suggestion.address
    });
  }

  function handleGetCurrentLocation() {
    if (!navigator.geolocation) {
      alert('La geolocalisation nest pas supportee');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      function(position) {
        var latitude = position.coords.latitude;
        var longitude = position.coords.longitude;
        
        fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/' + longitude + ',' + latitude + '.json?access_token=' + MAPBOX_TOKEN + '&language=fr&limit=1')
          .then(function(response) {
            return response.json();
          })
          .then(function(data) {
            if (data.features && data.features.length > 0) {
              var address = data.features[0].place_name;
              setInputValue(address);
              onChange({ lat: latitude, lng: longitude, address: address });
            }
            setIsLoading(false);
          })
          .catch(function(error) {
            console.error('Reverse geocoding error:', error);
            onChange({ lat: latitude, lng: longitude, address: latitude.toFixed(4) + ', ' + longitude.toFixed(4) });
            setIsLoading(false);
          });
      },
      function(error) {
        console.error('Geolocation error:', error);
        setIsLoading(false);
        alert('Impossible dobtenir votre position');
      }
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <IconComponent className={'absolute left-4 w-5 h-5 z-10 ' + colorClass} />
        <Input
          data-testid={dataTestId}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          className="h-14 pl-12 pr-36 sm:pr-40 bg-muted border-white/10 rounded-xl text-lg"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 w-5 h-5 text-muted-foreground animate-spin" />
        ) : (
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            className="absolute right-2 flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-all duration-200 border border-primary/30"
            title="Utiliser ma position actuelle"
            data-testid="geolocation-button"
          >
            <Navigation className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">Ma position</span>
          </button>
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-60 sm:max-h-80 overflow-y-auto">
          {suggestions.map(function(suggestion) {
            return (
              <button
                key={suggestion.id}
                onClick={function() { handleSelectSuggestion(suggestion); }}
                className="w-full px-3 py-2 sm:px-4 sm:py-3 text-left hover:bg-muted active:bg-muted/80 transition-colors flex items-start gap-2 sm:gap-3 border-b border-border last:border-0"
              >
                <MapPin className={'w-4 h-4 sm:w-5 sm:h-5 mt-0.5 flex-shrink-0 ' + (suggestion.isLocal ? 'text-yellow-500' : 'text-primary')} />
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{suggestion.shortAddress}</span>
                    {suggestion.isLocal && (
                      <span className="text-[10px] sm:text-xs bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded-full">
                        Populaire
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] sm:text-xs text-muted-foreground truncate">{suggestion.address}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AddressAutocomplete;
