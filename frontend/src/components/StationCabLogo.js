import React from 'react';

// StationCab Logo Component
// Uses the official StationCab logo image

const StationCabLogo = ({ className = "", size = "default", showText = false, darkMode = true }) => {
  // Size presets for the logo image
  const sizes = {
    small: 36,
    default: 48,
    large: 72,
    xlarge: 100,
    hero: 160
  };
  
  const currentSize = sizes[size] || sizes.default;
  
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src="/logo-stationcab.png" 
        alt="StationCab - Plateforme de Mobilité"
        style={{ 
          height: currentSize,
          width: 'auto',
          objectFit: 'contain'
        }}
      />
    </div>
  );
};

export default StationCabLogo;
