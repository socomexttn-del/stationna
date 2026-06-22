import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft, FileText, Clock, CreditCard, AlertTriangle, Shield, Car } from 'lucide-react';
import StationCabLogo from '../components/StationCabLogo';

const CGV = () => {
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
          Conditions Générales de Vente
        </h1>
        <p className="text-gray-400 mb-8">Application StationCab - Service de réservation VTC et Taxi</p>

        <div className="space-y-8 text-gray-300">
          {/* Préambule */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 1 - Préambule</h2>
            </div>
            <div className="space-y-4">
              <p>
                Les présentes Conditions Générales de Vente (CGV) régissent l&apos;utilisation de la plateforme 
                StationCab, éditée par la société <strong className="text-white">A&S Prestige</strong>, SASU au capital de 1 500 €, 
                immatriculée au RCS de Meaux sous le numéro SIRET 827 808 866 00012, dont le siège social 
                est situé au 9 rue Victor Baltard, 77410 Claye-Souilly, France.
              </p>
              <p>
                StationCab est une plateforme de mise en relation entre des passagers et des chauffeurs 
                VTC (Voiture de Transport avec Chauffeur) et Taxis indépendants.
              </p>
              <p>
                <strong className="text-white">En utilisant nos services, vous acceptez sans réserve les présentes CGV.</strong>
              </p>
            </div>
          </section>

          {/* Objet */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Article 2 - Objet</h2>
            <div className="space-y-4">
              <p>
                StationCab propose un service de réservation de courses avec chauffeur privé, comprenant :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">VTC</strong> : Véhicules confortables (1 à 4 passagers)</li>
                <li><strong className="text-white">Van</strong> : Véhicules spacieux (1 à 7 passagers)</li>
                <li><strong className="text-white">Taxi Officiel</strong> : Taxis parisiens réglementés avec tarifs officiels</li>
              </ul>
            </div>
          </section>

          {/* Réservation */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 3 - Délais de réservation</h2>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-white">3.1 Course immédiate</h3>
              <p>
                Vous pouvez commander une course pour un départ immédiat. La demande est envoyée aux 
                chauffeurs disponibles à proximité.
              </p>
              
              <h3 className="font-semibold text-white">3.2 Réservation à l&apos;avance (Planification classique)</h3>
              <p>
                Vous pouvez programmer une course de <strong className="text-white">30 minutes à 30 jours</strong> à l&apos;avance. 
                La demande sera envoyée aux chauffeurs peu avant l&apos;heure prévue.
              </p>
              
              <h3 className="font-semibold text-white">3.3 StationCab Reserve (Service premium)</h3>
              <p>
                Ce service permet de réserver une course jusqu&apos;à <strong className="text-white">90 jours</strong> à l&apos;avance 
                (minimum 2 heures avant le départ). Les prix sont <strong className="text-white">fixes et garantis</strong> dès la réservation.
              </p>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-200">
                    <strong>Important :</strong> Planifier à l&apos;avance ne garantit pas à 100% qu&apos;un chauffeur 
                    acceptera la course. StationCab envoie la demande aux chauffeurs peu avant l&apos;heure prévue. 
                    Votre course est réellement validée lorsque vous recevez les détails du chauffeur dans l&apos;application.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Annulation */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 4 - Conditions d&apos;annulation</h2>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-white mb-3">4.1 Annulation d&apos;une course immédiate</h3>
                <p className="mb-3">
                  L&apos;annulation est <strong className="text-green-400">toujours gratuite</strong> tant qu&apos;aucun 
                  chauffeur n&apos;a accepté votre demande.
                </p>
                <p className="mb-3">Après acceptation du chauffeur :</p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span>VTC / Taxi</span>
                    <span className="text-white">Gratuit les 2 premières minutes, puis <strong className="text-red-400">8 €</strong></span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Van</span>
                    <span className="text-white">Gratuit les 2 premières minutes, puis <strong className="text-red-400">15 €</strong></span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-white mb-3">4.2 Annulation d&apos;une course réservée à l&apos;avance</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span><strong className="text-white">Plus de 60 minutes avant</strong> : Annulation gratuite</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span><strong className="text-white">Moins de 60 minutes avant</strong> : Facturation intégrale de la course</span>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-3">
                  Le chauffeur a bloqué son créneau pour vous. Une annulation tardive lui cause un préjudice.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-white mb-3">4.3 Non-présentation du passager (No-show)</h3>
                <p>
                  Une fois que le chauffeur arrive à votre point de rendez-vous et signale son arrivée dans l&apos;application, 
                  vous disposez d&apos;un délai de <strong className="text-white">3 minutes</strong> pour le rejoindre.
                </p>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-3">
                  <p className="text-red-200">
                    <strong>Passé ce délai de 3 minutes</strong>, si vous ne vous êtes pas présenté, le chauffeur 
                    peut signaler votre absence. La course sera alors annulée et vous serez facturé des frais d&apos;annulation :
                  </p>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between items-center">
                      <span>VTC / Taxi</span>
                      <span className="font-bold text-red-400">8 €</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Van</span>
                      <span className="font-bold text-red-400">15 €</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-3">
                  <strong>Conseil :</strong> Activez les notifications pour être alerté dès l&apos;arrivée de votre chauffeur.
                </p>
              </div>
            </div>
          </section>

          {/* Tarifs */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 5 - Tarifs et paiement</h2>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-white">5.1 Calcul du prix</h3>
              <p>
                Le prix de la course est calculé en fonction de :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>La distance parcourue</li>
                <li>Le temps de trajet estimé</li>
                <li>Le type de véhicule choisi</li>
                <li>Les éventuels suppléments (réservation, nombre de passagers)</li>
              </ul>
              
              <h3 className="font-semibold text-white mt-4">5.2 Prix fixe garanti</h3>
              <p>
                Pour les VTC et Vans, le prix affiché lors de la réservation est un <strong className="text-white">prix fixe garanti</strong>, 
                qui ne changera pas même en cas d&apos;embouteillages.
              </p>
              
              <h3 className="font-semibold text-white mt-4">5.3 Tarifs Taxi</h3>
              <p>
                Pour les Taxis officiels, les tarifs sont <strong className="text-white">réglementés par la Préfecture de Paris</strong>. 
                Le prix final sera celui indiqué au compteur, sauf pour les forfaits aéroport qui sont fixes.
              </p>
              
              <h3 className="font-semibold text-white mt-4">5.4 Moyens de paiement</h3>
              <p>
                Les paiements sont acceptés par :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Carte bancaire (Visa, Mastercard, American Express)</li>
                <li>Portefeuille StationCab</li>
                <li>Espèces (directement au chauffeur)</li>
              </ul>
            </div>
          </section>

          {/* Remboursement */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Article 6 - Remboursements</h2>
            <div className="space-y-4">
              <p>
                En cas de remboursement validé (annulation dans les délais, problème technique, etc.), 
                le délai de traitement est de <strong className="text-white">72 heures ouvrées</strong>.
              </p>
              <p>
                Le délai de crédit sur votre compte bancaire dépend ensuite de votre établissement bancaire 
                (généralement 3 à 5 jours ouvrés) et peut être allongé en cas de jours fériés.
              </p>
              <p>
                Pour toute demande de remboursement, contactez-nous à : <a href="mailto:contact@stationcab.fr" className="text-primary hover:underline">contact@stationcab.fr</a>
              </p>
            </div>
          </section>

          {/* Chauffeurs */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Car className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 7 - Obligations des chauffeurs</h2>
            </div>
            <div className="space-y-4">
              <p>Les chauffeurs partenaires de StationCab s&apos;engagent à :</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Être titulaires de toutes les autorisations légales (carte professionnelle VTC ou licence Taxi)</li>
                <li>Disposer d&apos;une assurance professionnelle en cours de validité</li>
                <li>Maintenir leur véhicule en parfait état de propreté et de fonctionnement</li>
                <li>Respecter le Code de la route et les réglementations en vigueur</li>
                <li>Adopter un comportement professionnel et courtois</li>
                <li>Fournir les documents requis avec leurs dates de validité</li>
              </ul>
            </div>
          </section>

          {/* Responsabilité */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Article 8 - Responsabilité</h2>
            </div>
            <div className="space-y-4">
              <p>
                StationCab agit en qualité de <strong className="text-white">plateforme de mise en relation</strong>. 
                Les chauffeurs sont des professionnels indépendants et non des salariés de A&S Prestige.
              </p>
              <p>
                A&S Prestige ne saurait être tenue responsable :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Des retards dus à des circonstances indépendantes de sa volonté (trafic, intempéries, etc.)</li>
                <li>Des objets oubliés dans les véhicules</li>
                <li>Des dommages causés par les chauffeurs dans l&apos;exercice de leur activité</li>
              </ul>
              <p>
                En cas de litige avec un chauffeur, contactez notre service client pour une médiation.
              </p>
            </div>
          </section>

          {/* Données personnelles */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Article 9 - Protection des données personnelles</h2>
            <div className="space-y-4">
              <p>
                Les données personnelles collectées sont nécessaires à la fourniture de nos services et sont traitées 
                conformément au RGPD. Pour plus d&apos;informations, consultez nos <Link to="/mentions-legales" className="text-primary hover:underline">Mentions Légales</Link>.
              </p>
            </div>
          </section>

          {/* Modification */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Article 10 - Modification des CGV</h2>
            <p>
              A&S Prestige se réserve le droit de modifier les présentes CGV à tout moment. 
              Les utilisateurs seront informés de toute modification substantielle. 
              La poursuite de l&apos;utilisation des services après modification vaut acceptation des nouvelles CGV.
            </p>
          </section>

          {/* Droit applicable */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Article 11 - Droit applicable et litiges</h2>
            <div className="space-y-4">
              <p>
                Les présentes CGV sont soumises au droit français.
              </p>
              <p>
                En cas de litige, une solution amiable sera recherchée avant toute action judiciaire. 
                À défaut d&apos;accord, les tribunaux compétents seront ceux du ressort du siège social de A&S Prestige.
              </p>
              <p>
                Conformément à l&apos;article L.612-1 du Code de la consommation, vous pouvez recourir gratuitement 
                au service de médiation MEDICYS : <a href="https://www.medicys.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.medicys.fr</a>
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-primary/10 border border-primary/30 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Contact</h2>
            <p>
              Pour toute question concernant ces CGV, contactez-nous :
            </p>
            <p className="mt-2">
              <strong className="text-white">Email :</strong> <a href="mailto:contact@stationcab.fr" className="text-primary hover:underline">contact@stationcab.fr</a>
            </p>
            <p>
              <strong className="text-white">Adresse :</strong> A&S Prestige - 9 rue Victor Baltard, 77410 Claye-Souilly, France
            </p>
          </section>

          {/* Date de mise à jour */}
          <p className="text-sm text-gray-500 text-center pt-8">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </main>
    </div>
  );
};

export default CGV;
