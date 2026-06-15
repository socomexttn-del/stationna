import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import LanguageSelector from '../components/LanguageSelector';
import StationCabLogo from '../components/StationCabLogo';
import { Car, Shield, CreditCard, Star, MapPin, Clock, ArrowRight, CheckCircle, Users, Zap, Phone, ChevronRight } from 'lucide-react';

const LandingPage = () => {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0a1628 0%, #071018 100%)' }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <StationCabLogo size="default" darkMode={true} />
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <Link to="/auth">
              <Button 
                data-testid="header-login-btn"
                className="rounded-full font-semibold px-6 h-10 btn-glow transition-all"
                style={{ backgroundColor: '#00a693', color: '#ffffff' }}
              >
                {t('auth.login')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ 
            background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 166, 147, 0.15) 0%, transparent 50%)'
          }} />
          <div className="absolute inset-0" style={{ 
            background: 'radial-gradient(ellipse 60% 40% at 80% 80%, rgba(31, 63, 107, 0.2) 0%, transparent 50%)'
          }} />
        </div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `linear-gradient(rgba(0, 166, 147, 0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0, 166, 147, 0.3) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            {/* Logo animé */}
            <div className="flex justify-center mb-8 animate-float">
              <div className="relative">
                <div className="absolute inset-0 blur-3xl opacity-30" style={{ backgroundColor: '#00a693' }} />
                <StationCabLogo size="xlarge" showText={false} darkMode={true} />
              </div>
            </div>
            
            {/* Title */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-none mb-6" style={{ fontFamily: 'Space Grotesk' }}>
              <span className="text-white">Votre mobilité,</span>
              <br />
              <span className="gradient-text">simplifiée</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Réservez un VTC en quelques secondes. Chauffeurs professionnels vérifiés. 
              Paiement sécurisé. Service disponible 24h/24.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link to="/auth?role=passenger">
                <Button 
                  data-testid="hero-passenger-btn"
                  className="h-14 px-10 rounded-full font-bold text-lg shadow-[0_0_40px_rgba(0,166,147,0.4)] transition-all hover:shadow-[0_0_60px_rgba(0,166,147,0.6)] hover:scale-105"
                  style={{ backgroundColor: '#00a693', color: '#ffffff' }}
                >
                  Réserver maintenant
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/devenir-chauffeur">
                <Button 
                  data-testid="hero-driver-btn"
                  variant="outline"
                  className="h-14 px-10 rounded-full font-bold text-lg transition-all hover:scale-105"
                  style={{ 
                    borderColor: 'rgba(0, 166, 147, 0.5)', 
                    color: '#ffffff', 
                    backgroundColor: 'rgba(31, 63, 107, 0.3)'
                  }}
                >
                  Devenir chauffeur
                </Button>
              </Link>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              {[
                { value: '24/7', label: 'Disponibilité' },
                { value: '5 min', label: 'Temps moyen' },
                { value: '100%', label: 'Sécurisé' }
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold mb-1" style={{ color: '#00a693' }}>{stat.value}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 rounded-full flex items-start justify-center p-2" style={{ borderColor: 'rgba(0, 166, 147, 0.5)' }}>
            <div className="w-1.5 h-3 rounded-full" style={{ backgroundColor: '#00a693' }} />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: 'rgba(0, 166, 147, 0.1)', color: '#00a693' }}>
              Nos services
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white" style={{ fontFamily: 'Space Grotesk' }}>
              Une solution pour chaque besoin
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Que vous soyez particulier ou professionnel, nous avons le véhicule adapté
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                title: 'VTC Premium',
                description: 'Berlines confortables pour vos déplacements quotidiens',
                icon: Car,
                price: 'À partir de 15€',
                features: ['Berline récente', 'Wifi gratuit', 'Bouteille d\'eau']
              },
              {
                title: 'Van & Minibus',
                description: 'Jusqu\'à 7 passagers pour vos groupes',
                icon: Users,
                price: 'À partir de 25€',
                features: ['Jusqu\'à 7 places', 'Espace bagages XL', 'Idéal familles'],
                featured: true
              },
              {
                title: 'Taxi Conventionné',
                description: 'Tarifs réglementés pour les trajets aéroports',
                icon: CreditCard,
                price: 'Forfait aéroport',
                features: ['Prix fixe garanti', 'CDG & Orly', 'Sans surprise']
              }
            ].map((service, index) => (
              <div 
                key={index}
                className={`relative p-8 rounded-2xl transition-all duration-300 card-hover ${
                  service.featured 
                    ? 'feature-card border-2' 
                    : 'bg-card/50 border border-border/30'
                }`}
                style={service.featured ? { borderColor: 'rgba(0, 166, 147, 0.5)' } : {}}
              >
                {service.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: '#00a693', color: '#ffffff' }}>
                    POPULAIRE
                  </div>
                )}
                
                <div className="icon-container w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <service.icon className="w-7 h-7" style={{ color: '#00a693' }} />
                </div>
                
                <h3 className="text-xl font-bold mb-2 text-white">{service.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{service.description}</p>
                
                <div className="text-2xl font-bold mb-4" style={{ color: '#00a693' }}>{service.price}</div>
                
                <ul className="space-y-2 mb-6">
                  {service.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4" style={{ color: '#00a693' }} />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Link to="/auth?role=passenger">
                  <Button 
                    variant={service.featured ? "default" : "outline"}
                    className="w-full rounded-full"
                    style={service.featured ? { backgroundColor: '#00a693', color: '#ffffff' } : { borderColor: 'rgba(0, 166, 147, 0.3)' }}
                  >
                    Réserver
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(31, 63, 107, 0.1) 50%, transparent 100%)' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: 'rgba(31, 63, 107, 0.3)', color: '#00a693' }}>
              Pourquoi nous choisir
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white" style={{ fontFamily: 'Space Grotesk' }}>
              L'excellence du transport
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: MapPin,
                title: 'Suivi GPS en direct',
                description: 'Visualisez la position de votre chauffeur en temps réel sur la carte'
              },
              {
                icon: Shield,
                title: 'Chauffeurs certifiés',
                description: 'Tous nos chauffeurs sont vérifiés, assurés et formés à l\'excellence'
              },
              {
                icon: CreditCard,
                title: 'Paiement sécurisé',
                description: 'Payez en toute sécurité par carte bancaire via Stripe'
              },
              {
                icon: Clock,
                title: 'Réservation instantanée',
                description: 'Réservez en moins de 30 secondes, même pour une course immédiate'
              },
              {
                icon: Star,
                title: 'Service 5 étoiles',
                description: 'Note moyenne de 4.9/5 basée sur des milliers d\'avis clients'
              },
              {
                icon: Zap,
                title: 'Arrivée rapide',
                description: 'Temps d\'attente moyen de 5 minutes en zone urbaine'
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group p-6 rounded-xl feature-card"
              >
                <div className="icon-container w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6" style={{ color: '#00a693' }} />
                </div>
                <h3 className="text-lg font-bold mb-2 text-white">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Driver CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1f3f6b 0%, #0d2137 100%)' }} />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0, 166, 147, 0.3) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: 'rgba(0, 166, 147, 0.2)', color: '#00a693' }}>
                  Opportunité
                </span>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-white" style={{ fontFamily: 'Space Grotesk' }}>
                  Devenez chauffeur <span style={{ color: '#00a693' }}>partenaire</span>
                </h2>
                <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                  Rejoignez notre réseau de chauffeurs professionnels. Gérez votre emploi du temps, 
                  maximisez vos revenus et bénéficiez d'un support dédié 7j/7.
                </p>
                
                <ul className="space-y-4 mb-8">
                  {[
                    'Commission compétitive',
                    'Paiement hebdomadaire',
                    'Application intuitive',
                    'Support 24/7'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-200">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 166, 147, 0.2)' }}>
                        <CheckCircle className="w-4 h-4" style={{ color: '#00a693' }} />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link to="/devenir-chauffeur">
                    <Button 
                      data-testid="cta-driver-btn"
                      className="h-14 px-8 rounded-full font-bold text-lg shadow-[0_0_30px_rgba(0,166,147,0.3)]"
                      style={{ backgroundColor: '#00a693', color: '#ffffff' }}
                    >
                      S'inscrire gratuitement
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 blur-3xl opacity-20" style={{ backgroundColor: '#00a693' }} />
                <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-3xl p-8 border border-gray-700/50">
                  <div className="text-center">
                    <div className="text-6xl font-bold mb-2" style={{ color: '#00a693' }}>+2000€</div>
                    <div className="text-gray-400 mb-6">Revenus moyens/mois</div>
                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(0, 166, 147, 0.1)' }}>
                        <div className="text-2xl font-bold text-white">150+</div>
                        <div className="text-sm text-gray-400">Courses/mois</div>
                      </div>
                      <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(31, 63, 107, 0.3)' }}>
                        <div className="text-2xl font-bold text-white">4.9★</div>
                        <div className="text-sm text-gray-400">Note moyenne</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* App Download Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-white" style={{ fontFamily: 'Space Grotesk' }}>
              Réservez depuis <span style={{ color: '#00a693' }}>n'importe où</span>
            </h2>
            <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
              Notre plateforme web est optimisée pour tous vos appareils. 
              Réservez votre course en quelques clics, où que vous soyez.
            </p>
            
            <Link to="/auth?role=passenger">
              <Button 
                className="h-16 px-12 rounded-full font-bold text-xl shadow-[0_0_50px_rgba(0,166,147,0.4)] transition-all hover:shadow-[0_0_70px_rgba(0,166,147,0.6)] hover:scale-105"
                style={{ backgroundColor: '#00a693', color: '#ffffff' }}
              >
                <Phone className="w-6 h-6 mr-3" />
                Accéder à la plateforme
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t" style={{ borderColor: 'rgba(31, 63, 107, 0.3)' }}>
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <StationCabLogo size="small" darkMode={true} />
            <div className="flex items-center gap-8 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition-colors">Mentions légales</a>
              <a href="#" className="hover:text-white transition-colors">CGU</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-gray-500 text-sm">
              © 2024 StationCab. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
