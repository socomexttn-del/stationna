import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import LanguageSelector from '../components/LanguageSelector';
import StationCabLogo from '../components/StationCabLogo';
import { Car, Shield, CreditCard, Star, MapPin, Clock, ArrowRight } from 'lucide-react';

const LandingPage = () => {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <StationCabLogo size="default" darkMode={true} />
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <Link to="/auth">
              <Button 
                data-testid="header-login-btn"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold px-6"
                translate="no"
              >
                {t('auth.login')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 hero-glow" />
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'url(https://images.pexels.com/photos/26604738/pexels-photo-26604738.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.3)'
          }}
        />
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-none mb-6" style={{ fontFamily: 'Space Grotesk' }}>
            <span className="text-foreground">{t('landing.heroTitle1', 'Votre course,')}</span>
            <br />
            <span className="text-primary">{t('landing.heroTitle2', 'en un éclair')}</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            {t('landing.heroSubtitle', 'Réservez un chauffeur en quelques secondes. Suivez votre trajet en temps réel. Payez en toute sécurité.')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth?role=passenger">
              <Button 
                data-testid="hero-passenger-btn"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 rounded-full font-bold text-lg shadow-[0_0_30px_rgba(250,204,21,0.3)] transition-all hover:shadow-[0_0_40px_rgba(250,204,21,0.5)]"
              >
                {t('ride.bookRide')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/devenir-chauffeur">
              <Button 
                data-testid="hero-driver-btn"
                variant="outline"
                className="h-14 px-8 rounded-full font-bold text-lg border-white/20 hover:bg-white/5"
              >
                {t('landing.becomeDriver')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-muted-foreground rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-primary rounded-full" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-semibold tracking-tight text-center mb-4" style={{ fontFamily: 'Space Grotesk' }}>
            Pourquoi choisir <span className="text-primary">StationCab</span> ?
          </h2>
          <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">
            Une expérience de transport moderne, sécurisée et efficace
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: MapPin,
                title: 'Suivi en temps réel',
                description: 'Suivez votre chauffeur sur la carte et recevez des notifications à chaque étape'
              },
              {
                icon: CreditCard,
                title: 'Paiement sécurisé',
                description: 'Payez en ligne en toute sécurité avec Stripe. Pas besoin de cash'
              },
              {
                icon: Shield,
                title: 'Chauffeurs vérifiés',
                description: 'Tous nos chauffeurs sont vérifiés et notés par les passagers'
              },
              {
                icon: Clock,
                title: 'Réservation rapide',
                description: 'Réservez votre course en moins de 30 secondes, 24h/24'
              },
              {
                icon: Star,
                title: 'Système de notation',
                description: 'Notez vos courses et aidez à maintenir un service de qualité'
              },
              {
                icon: Car,
                title: 'Tarifs transparents',
                description: 'Estimez le prix de votre course avant de réserver'
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group p-6 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Driver CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'url(https://images.pexels.com/photos/31335088/pexels-photo-31335088.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.3)'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6" style={{ fontFamily: 'Space Grotesk' }}>
              Devenez chauffeur <span className="text-primary">StationCab</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Gagnez de l'argent en conduisant avec StationCab. Choisissez vos horaires, acceptez les courses qui vous conviennent et suivez vos gains en temps réel.
            </p>
            <Link to="/devenir-chauffeur">
              <Button 
                data-testid="cta-driver-btn"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 rounded-full font-bold text-lg"
              >
                Commencer à conduire
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Car className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>StationCab</span>
            </div>
            <p className="text-muted-foreground text-sm">
              © 2024 StationCab. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
