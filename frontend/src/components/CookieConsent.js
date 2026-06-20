import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, Cookie, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem('stationcab_cookie_consent');
    if (!consent) {
      // Show banner after a short delay
      setTimeout(() => setVisible(true), 1000);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem('stationcab_cookie_consent', JSON.stringify({
      essential: true,
      analytics: true,
      marketing: false,
      timestamp: new Date().toISOString()
    }));
    setVisible(false);
  };

  const acceptEssential = () => {
    localStorage.setItem('stationcab_cookie_consent', JSON.stringify({
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString()
    }));
    setVisible(false);
  };

  const savePreferences = (preferences) => {
    localStorage.setItem('stationcab_cookie_consent', JSON.stringify({
      ...preferences,
      timestamp: new Date().toISOString()
    }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-slide-up">
      <div className="max-w-4xl mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {!showDetails ? (
          // Simple view
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Cookie className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">
                  🍪 Nous utilisons des cookies
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  StationCab utilise des cookies essentiels pour le fonctionnement du site et 
                  des cookies optionnels pour améliorer votre expérience. 
                  <button 
                    onClick={() => setShowDetails(true)}
                    className="text-primary hover:underline ml-1"
                  >
                    En savoir plus
                  </button>
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={acceptAll}
                    className="bg-primary hover:bg-primary/90"
                    data-testid="accept-all-cookies"
                  >
                    Tout accepter
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={acceptEssential}
                    data-testid="accept-essential-cookies"
                  >
                    Cookies essentiels uniquement
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => setShowDetails(true)}
                    className="text-gray-400"
                  >
                    Personnaliser
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              En continuant sur ce site, vous acceptez notre{' '}
              <Link to="/politique-confidentialite" className="text-primary hover:underline">
                Politique de confidentialité
              </Link>.
            </p>
          </div>
        ) : (
          // Detailed preferences view
          <CookiePreferences 
            onSave={savePreferences} 
            onClose={() => setShowDetails(false)}
          />
        )}
      </div>
    </div>
  );
};

const CookiePreferences = ({ onSave, onClose }) => {
  const [preferences, setPreferences] = useState({
    essential: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <h3 className="text-lg font-bold text-white">Paramètres des cookies</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4 mb-6">
        {/* Essential cookies */}
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-white">Cookies essentiels</h4>
              <p className="text-sm text-gray-400">
                Nécessaires au fonctionnement du site (authentification, sécurité, préférences).
              </p>
            </div>
            <div className="px-3 py-1 bg-green-500/20 text-green-500 text-xs rounded-full">
              Toujours actifs
            </div>
          </div>
        </div>

        {/* Analytics cookies */}
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-white">Cookies analytiques</h4>
              <p className="text-sm text-gray-400">
                Nous aident à comprendre comment vous utilisez le site pour l'améliorer.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={preferences.analytics}
                onChange={(e) => setPreferences(p => ({ ...p, analytics: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        {/* Marketing cookies */}
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-white">Cookies marketing</h4>
              <p className="text-sm text-gray-400">
                Utilisés pour vous proposer des publicités personnalisées.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={preferences.marketing}
                onChange={(e) => setPreferences(p => ({ ...p, marketing: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          onClick={() => onSave(preferences)}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          Enregistrer mes préférences
        </Button>
        <Button 
          variant="outline"
          onClick={() => onSave({ essential: true, analytics: true, marketing: false })}
        >
          Tout accepter
        </Button>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Vous pouvez modifier vos préférences à tout moment dans les{' '}
        <Link to="/politique-confidentialite" className="text-primary hover:underline">
          paramètres de confidentialité
        </Link>.
      </p>
    </div>
  );
};

export default CookieConsent;
