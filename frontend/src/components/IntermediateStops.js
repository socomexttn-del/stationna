import React from 'react';
import AddressAutocomplete from './AddressAutocomplete';
import { Button } from './ui/button';
import { Plus, X, MapPin, ArrowDown } from 'lucide-react';

const IntermediateStops = ({ stops, setStops, maxStops = 3 }) => {
  const addStop = () => {
    if (stops.length < maxStops) {
      setStops([...stops, { lat: null, lng: null, address: '' }]);
    }
  };

  const removeStop = (index) => {
    setStops(stops.filter((_, i) => i !== index));
  };

  const updateStop = (index, location) => {
    const newStops = [...stops];
    newStops[index] = location;
    setStops(newStops);
  };

  return (
    <div className="space-y-3">
      {/* Existing stops */}
      {stops.map((stop, index) => (
        <div key={index} className="relative animate-fade-in">
          <div className="absolute left-3 top-0 bottom-0 flex flex-col items-center justify-center pointer-events-none">
            <ArrowDown className="w-4 h-4 text-amber-500 mb-1" />
            <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-amber-400 shadow-lg shadow-amber-500/30" />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <AddressAutocomplete
                label={`Arrêt ${index + 1}`}
                placeholder="Adresse de l'arrêt..."
                value={stop}
                onChange={(loc) => updateStop(index, loc)}
                inputClassName="pl-10"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeStop(index)}
              className="h-10 w-10 text-red-400 hover:text-red-500 hover:bg-red-500/10 shrink-0 mt-6"
              data-testid={`remove-stop-${index}`}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      ))}

      {/* Add stop button */}
      {stops.length < maxStops && (
        <Button
          type="button"
          variant="outline"
          onClick={addStop}
          className="w-full h-12 border-dashed border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/50"
          data-testid="add-stop-btn"
        >
          <Plus className="w-5 h-5 mr-2" />
          Ajouter un arrêt ({stops.length}/{maxStops})
        </Button>
      )}

      {/* Info message */}
      {stops.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          Les arrêts seront effectués dans l'ordre indiqué
        </p>
      )}
    </div>
  );
};

export default IntermediateStops;
