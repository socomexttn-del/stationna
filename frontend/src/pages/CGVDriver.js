import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft, FileText, Euro, Calendar, AlertTriangle, Shield, Car } from 'lucide-react';
import StationCabLogo from '../components/StationCabLogo';

const CGVDriver = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/">
            <StationCabLogo size="small" darkMode={true} />
          </Link>
          <Link to="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white" style={{ fontFamily: 'Space Grotesk' }}>
          Conditions Générales Chauffeurs
        </h1>
        <p className="text-gray-400 mb-8">Contrat de partenariat StationCab - Chauffeurs VTC et Taxi</p>

        <div className="space-y-8 text-gray-300">
          {/* Préambule */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 1 - Objet du partenariat</h2>
            </div>
            <div className="space-y-4">
              <p>
                Les présentes conditions régissent le partenariat entre les chauffeurs indépendants 
                (VTC ou Taxi) et la plateforme <strong className="text-white">StationCab</strong>, 
                éditée par A&S Prestige SASU.
              </p>
              <p>
                StationCab est une plateforme de mise en relation entre passagers et chauffeurs. 
                Le chauffeur reste un prestataire <strong className="text-white">indépendant</strong> et 
                n&apos;est en aucun cas salarié de StationCab.
              </p>
            </div>
          </section>

          {/* Commission */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Euro className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 2 - Commission et rémunération</h2>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-white">2.1 Commission StationCab</h3>
              <p>
                StationCab prélève une commission de <strong className="text-primary text-lg">18%</strong> sur 
                chaque course effectuée via la plateforme. Cette commission rémunère :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>La mise en relation avec les clients</li>
                <li>La gestion des paiements</li>
                <li>Le support client et chauffeur</li>
                <li>La maintenance de la plateforme</li>
              </ul>
              
              <h3 className="font-semibold text-white mt-6">2.2 Calcul de la rémunération</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-center">
                  <strong className="text-white text-lg">Votre gain = Prix de la course × 82%</strong>
                </p>
                <p className="text-sm text-gray-400 text-center mt-2">
                  Exemple : Course à 50€ → Vous recevez 41€
                </p>
              </div>
            </div>
          </section>

          {/* Paiements */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 3 - Modalités de paiement</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-green-400 mb-2">Règlement hebdomadaire</h3>
                <p>
                  Les règlements des courses sont effectués <strong className="text-white">chaque lundi</strong> par 
                  virement bancaire sur le compte (IBAN) que vous avez renseigné lors de votre inscription.
                </p>
              </div>
              
              <h3 className="font-semibold text-white">3.1 Cycle de facturation</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>La semaine de référence va du <strong className="text-white">lundi au dimanche</strong></li>
                <li>Le relevé est généré le <strong className="text-white">lundi matin</strong></li>
                <li>Le virement est effectué le <strong className="text-white">lundi</strong> (délai bancaire : 1-2 jours ouvrés)</li>
              </ul>
              
              <h3 className="font-semibold text-white mt-4">3.2 Relevé de courses</h3>
              <p>
                Un relevé détaillé de vos courses est disponible dans votre espace chauffeur. 
                Ce document fait office de facture et récapitule :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Toutes les courses effectuées</li>
                <li>Le montant total facturé</li>
                <li>La commission prélevée (18%)</li>
                <li>Le montant net à percevoir</li>
              </ul>
              
              <h3 className="font-semibold text-white mt-4">3.3 Minimum de virement</h3>
              <p>
                Aucun minimum de virement n&apos;est requis. Même pour de petits montants, 
                le règlement est effectué chaque lundi.
              </p>
            </div>
          </section>

          {/* IBAN */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 4 - Coordonnées bancaires</h2>
            </div>
            <div className="space-y-4">
              <p>
                Vous devez fournir un <strong className="text-white">IBAN valide</strong> lors de votre inscription 
                pour recevoir vos paiements. Cet IBAN doit correspondre à un compte :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>À votre nom ou au nom de votre société</li>
                <li>Domicilié dans la zone SEPA</li>
              </ul>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-200">
                    <strong>Important :</strong> En cas de changement de coordonnées bancaires, 
                    prévenez-nous au moins 7 jours avant le prochain règlement pour éviter tout retard.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Obligations */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Car className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 5 - Obligations du chauffeur</h2>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-white">5.1 Documents obligatoires</h3>
              <p>
                Le chauffeur s&apos;engage à maintenir à jour tous les documents requis :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Carte professionnelle VTC ou licence Taxi valide</li>
                <li>Permis de conduire</li>
                <li>Carte grise du véhicule</li>
                <li>Attestation d&apos;assurance RC Pro</li>
                <li>Contrôle technique valide</li>
                <li>Kbis ou extrait INSEE</li>
              </ul>
              
              <h3 className="font-semibold text-white mt-4">5.2 Qualité de service</h3>
              <p>Le chauffeur s&apos;engage à :</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Maintenir son véhicule propre et en bon état</li>
                <li>Être ponctuel aux rendez-vous</li>
                <li>Traiter les clients avec respect et courtoisie</li>
                <li>Respecter le code de la route</li>
                <li>Ne pas annuler de courses sans motif valable</li>
              </ul>
            </div>
          </section>

          {/* Annulations */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 6 - Annulations et no-show</h2>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-white">6.1 Client absent (No-show)</h3>
              <p>
                Si vous arrivez au point de rendez-vous et que le client ne se présente pas 
                dans les <strong className="text-white">3 minutes</strong> suivant votre arrivée, 
                vous pouvez signaler son absence via l&apos;application.
              </p>
              <p className="mt-2">
                Des frais d&apos;annulation seront alors facturés au client et vous seront reversés :
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 mt-2">
                <div className="flex justify-between items-center">
                  <span>VTC / Taxi</span>
                  <span className="text-green-400 font-bold">6,56€ net</span>
                  <span className="text-gray-500 text-sm">(8€ - 18%)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Van</span>
                  <span className="text-green-400 font-bold">12,30€ net</span>
                  <span className="text-gray-500 text-sm">(15€ - 18%)</span>
                </div>
              </div>
              
              <h3 className="font-semibold text-white mt-4">6.2 Annulation par le chauffeur</h3>
              <p>
                Les annulations répétées sans motif valable peuvent entraîner une suspension 
                temporaire ou définitive de votre compte.
              </p>
            </div>
          </section>

          {/* Résiliation */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Article 7 - Résiliation</h2>
            <div className="space-y-4">
              <p>
                Chaque partie peut mettre fin au partenariat à tout moment, sans préavis ni indemnité.
              </p>
              <p>
                En cas de résiliation, les courses effectuées avant la date de résiliation 
                seront réglées selon les modalités habituelles (virement du lundi suivant).
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-primary/10 rounded-2xl p-6 border border-primary/30">
            <h2 className="text-xl font-bold text-white mb-4">Contact</h2>
            <p>
              Pour toute question concernant vos paiements ou ces conditions :
            </p>
            <p className="mt-2">
              <strong className="text-primary">Email :</strong>{' '}
              <a href="mailto:driver@stationcab.fr" className="text-white hover:text-primary">
                driver@stationcab.fr
              </a>
            </p>
          </section>

          {/* Version */}
          <p className="text-center text-gray-500 text-sm">
            Version 1.0 - Dernière mise à jour : Juin 2025
          </p>
        </div>
      </main>
    </div>
  );
};

export default CGVDriver;
