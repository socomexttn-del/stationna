import React from 'react';

// StationCab Logo Component
// Uses the official StationCab logo image

const StationCabLogo = ({ className = "", size = "default", showText = true, darkMode = true }) => {
  // Size presets
  const sizes = {
    small: { icon: 36, text: "text-lg" },
    default: { icon: 44, text: "text-xl" },
    large: { icon: 64, text: "text-2xl" },
    xlarge: { icon: 100, text: "text-3xl" }
  };
  
  const currentSize = sizes[size] || sizes.default;
  const textColor = darkMode ? "#ffffff" : "#1e3a5f";
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Logo Image */}
      <img 
        src="/logo-stationcab.png" 
        alt="StationCab Logo"
        style={{ 
          height: currentSize.icon,
          width: 'auto',
          objectFit: 'contain'
        }}
      />
      
      {/* Text - only if showText is true and not using large sizes (logo already has text) */}
      {showText && size !== 'large' && size !== 'xlarge' && (
        <span 
          className={`font-bold ${currentSize.text} tracking-tight`}
          style={{ 
            color: textColor,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          StationCab
        </span>
      )}
    </div>
  );
};

export default StationCabLogo;
