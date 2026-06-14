import React from 'react';

// StationCab Logo Component
// Uses the official StationCab shield logo with gradient colors

const StationCabLogo = ({ className = "", size = "default", showText = true, darkMode = true }) => {
  // Size presets
  const sizes = {
    small: { icon: 32, text: "text-lg" },
    default: { icon: 40, text: "text-xl" },
    large: { icon: 56, text: "text-2xl" },
    xlarge: { icon: 80, text: "text-3xl" }
  };
  
  const currentSize = sizes[size] || sizes.default;
  
  // Colors based on the official logo
  const primaryColor = darkMode ? "#0d9488" : "#0d9488"; // Teal
  const secondaryColor = darkMode ? "#1e3a5f" : "#1e3a5f"; // Navy blue
  const textColor = darkMode ? "#ffffff" : "#1e3a5f";
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Shield Logo SVG */}
      <svg 
        width={currentSize.icon} 
        height={currentSize.icon} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shield outline */}
        <path 
          d="M50 5 L90 20 L90 50 C90 75 70 90 50 95 C30 90 10 75 10 50 L10 20 Z" 
          stroke="url(#shieldGradient)" 
          strokeWidth="4" 
          fill="none"
        />
        
        {/* Inner shield pattern - left side */}
        <path 
          d="M25 30 L25 55 C25 68 35 78 50 82" 
          stroke={secondaryColor} 
          strokeWidth="4" 
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Inner shield pattern - right side */}
        <path 
          d="M75 30 L75 55 C75 68 65 78 50 82" 
          stroke={primaryColor} 
          strokeWidth="4" 
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Arrow pointing up */}
        <path 
          d="M50 25 L50 65 M35 40 L50 25 L65 40" 
          stroke="url(#arrowGradient)" 
          strokeWidth="5" 
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Horizontal lines */}
        <path 
          d="M30 45 L42 45 M58 45 L70 45" 
          stroke={secondaryColor} 
          strokeWidth="3" 
          strokeLinecap="round"
        />
        
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={secondaryColor} />
            <stop offset="100%" stopColor={primaryColor} />
          </linearGradient>
          <linearGradient id="arrowGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={secondaryColor} />
            <stop offset="100%" stopColor={primaryColor} />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Text */}
      {showText && (
        <div className="flex flex-col">
          <span 
            className={`font-bold ${currentSize.text} tracking-tight`}
            style={{ 
              color: textColor,
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.05em'
            }}
          >
            StationCab
          </span>
          {size === 'large' || size === 'xlarge' ? (
            <span 
              className="text-xs uppercase tracking-widest opacity-70"
              style={{ color: textColor }}
            >
              Plateforme de Mobilité
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default StationCabLogo;
