import React, { useState } from 'react';
import AddressAutocomplete from './AddressAutocomplete';
import { Button } from './ui/button';
import { Plus, X, MapPin, GripVertical } from 'lucide-react';

const IntermediateStops = ({ stops, setStops, maxStops = 3 }) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const addStop = () => {
    if (stops.length < maxStops) {
      const newStop = { 
        id: Date.now(),
        order: stops.length,
        lat: null, 
        lng: null, 
        address: '' 
      };
      setStops([...stops, newStop]);
    }
  };

  const removeStop = (index) => {
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops.map((s, i) => ({ ...s, order: i })));
  };

  const updateStop = (index, location) => {
    const newStops = [...stops];
    newStops[index] = { 
      ...location, 
      id: stops[index].id || Date.now(),
      order: index 
    };
    setStops(newStops);
  };

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Add some styling to the dragged element
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== draggedIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    // Reorder the stops
    const newStops = [...stops];
    const [draggedStop] = newStops.splice(draggedIndex, 1);
    newStops.splice(dropIndex, 0, draggedStop);
    
    // Update order property
    const reorderedStops = newStops.map((s, i) => ({ ...s, order: i }));
    setStops(reorderedStops);
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Touch handlers for mobile
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchedIndex, setTouchedIndex] = useState(null);

  const handleTouchStart = (e, index) => {
    setTouchStartY(e.touches[0].clientY);
    setTouchedIndex(index);
  };

  const handleTouchMove = (e) => {
    if (touchedIndex === null) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY;
    
    // Determine if we should swap with neighbor
    if (Math.abs(diff) > 50) {
      const direction = diff > 0 ? 1 : -1;
      const newIndex = touchedIndex + direction;
      
      if (newIndex >= 0 && newIndex < stops.length) {
        // Swap stops
        const newStops = [...stops];
        [newStops[touchedIndex], newStops[newIndex]] = [newStops[newIndex], newStops[touchedIndex]];
        const reorderedStops = newStops.map((s, i) => ({ ...s, order: i }));
        setStops(reorderedStops);
        
        // Update touched index and reset start position
        setTouchedIndex(newIndex);
        setTouchStartY(currentY);
      }
    }
  };

  const handleTouchEnd = () => {
    setTouchStartY(null);
    setTouchedIndex(null);
  };

  return (
    <div className="space-y-3">
      {/* Existing stops with drag-and-drop */}
      {stops.map((stop, index) => (
        <div 
          key={stop.id || index} 
          className={`relative animate-fade-in transition-all duration-200 ${
            dragOverIndex === index ? 'transform translate-y-1 border-t-2 border-primary pt-2' : ''
          } ${draggedIndex === index ? 'opacity-50' : ''}`}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onTouchStart={(e) => handleTouchStart(e, index)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center gap-2">
            {/* Drag handle */}
            <div 
              className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-white touch-none"
              title="Glisser pour réordonner"
            >
              <GripVertical className="w-5 h-5" />
            </div>
            
            {/* Stop number badge */}
            <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {index + 1}
            </div>
            
            {/* Address input */}
            <div className="flex-1">
              <AddressAutocomplete
                label=""
                placeholder={`Arrêt ${index + 1}...`}
                value={stop}
                onChange={(loc) => updateStop(index, loc)}
                inputClassName="h-11"
              />
            </div>
            
            {/* Remove button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeStop(index)}
              className="h-10 w-10 text-red-400 hover:text-red-500 hover:bg-red-500/10 shrink-0"
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
          <GripVertical className="w-3 h-3" />
          Glissez pour réordonner les arrêts
        </p>
      )}
    </div>
  );
};

export default IntermediateStops;
