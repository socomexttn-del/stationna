import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Globe } from 'lucide-react';

const LanguageSelector = ({ className = '' }) => {
  const { i18n } = useTranslation();
  
  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className={`gap-2 ${className}`}
      data-testid="language-selector"
    >
      <Globe className="w-4 h-4" />
      <span className="uppercase font-medium">{i18n.language}</span>
    </Button>
  );
};

export default LanguageSelector;
