import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft, Shield, Database, Eye, Trash2, Download, Lock, Mail, MapPin } from 'lucide-react';
import StationCabLogo from '../components/StationCabLogo';

const PolitiqueConfidentialite = () => {
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
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
              Politique de Confidentialité
            </h1>
            <p className="text-gray-400">Dernière mise à jour : Juin 2025</p>
          </div>
        </div>

        <div className="space-y-8 text-gray-300">
          {/* Introduction */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Introduction</h2>
            <p>
              La société <strong className="text-white">A&S Prestige SASU</strong> (ci-après "StationCab", "nous") 
              s'engage à protéger la vie privée de ses utilisateurs. Cette politique de confidentialité explique 
              comment nous collectons, utilisons et protégeons vos données personnelles conformément au 
              <strong className="text-primary"> Règlement Général sur la Protection des Données (RGPD)</strong>.
            </p>
          </section>

          {/* Responsable du traitement */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-white">1. Responsable du traitement</h2>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p><strong className="text-white">A&S Prestige SASU</strong></p>
              <p>9 rue Victor Baltard, 77410 Claye-Souilly</p>
              <p>SIRET : 827 808 866 00012</p>
              <p className="mt-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Contact DPO : <a href="mailto:contact@stationcab.fr" className="text-primary hover:underline">contact@stationcab.fr</a>
              </p>
            </div>
          </section>

          {/* Données collectées */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-white">2. Données collectées</h2>
            </div>
            
            <h3 className="font-semibold text-white mt-4 mb-2">2.1 Données d'identification</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Nom et prénom</li>
              <li>Adresse email</li>
              <li>Numéro de téléphone</li>
              <li>Mot de passe (chiffré)</li>
            </ul>

            <h3 className="font-semibold text-white mt-4 mb-2">2.2 Données de paiement</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Informations de carte bancaire (stockées par Stripe, pas par nous)</li>
              <li>Historique des transactions</li>
              <li>IBAN (pour les chauffeurs uniquement)</li>
            </ul>

            <h3 className="font-semibold text-white mt-4 mb-2">2.3 Données de géolocalisation</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Position GPS (uniquement pendant l'utilisation de l'application)</li>
              <li>Adresses de prise en charge et de destination</li>
              <li>Historique des trajets</li>
            </ul>

            <h3 className="font-semibold text-white mt-4 mb-2">2.4 Données professionnelles (chauffeurs)</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Carte professionnelle VTC/Taxi</li>
              <li>Permis de conduire</li>
              <li>Documents du véhicule</li>
              <li>SIRET et informations de société</li>
            </ul>
          </section>

          {/* Finalités */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-white">3. Finalités du traitement</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                <div>
                  <p className="font-semibold text-white">Exécution du contrat</p>
                  <p className="text-sm">Mise en relation passagers/chauffeurs, gestion des courses et paiements</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                <div>
                  <p className="font-semibold text-white">Sécurité</p>
                  <p className="text-sm">Vérification des documents, prévention de la fraude</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                <div>
                  <p className="font-semibold text-white">Obligations légales</p>
                  <p className="text-sm">Conservation des factures, conformité fiscale</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2"></div>
                <div>
                  <p className="font-semibold text-white">Amélioration du service (avec consentement)</p>
                  <p className="text-sm">Statistiques d'utilisation, personnalisation</p>
                </div>
              </div>
            </div>
          </section>

          {/* Durée de conservation */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">4. Durée de conservation</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-white">Type de données</th>
                    <th className="text-left py-2 text-white">Durée</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-2">Compte utilisateur</td>
                    <td className="py-2">Jusqu'à suppression du compte + 3 ans</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2">Historique des courses</td>
                    <td className="py-2">5 ans (obligation comptable)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2">Factures et paiements</td>
                    <td className="py-2">10 ans (obligation fiscale)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2">Documents chauffeurs</td>
                    <td className="py-2">Durée du partenariat + 5 ans</td>
                  </tr>
                  <tr>
                    <td className="py-2">Données de géolocalisation</td>
                    <td className="py-2">1 an</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Vos droits */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-bold text-white">5. Vos droits RGPD</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-white">Droit d'accès</h4>
                </div>
                <p className="text-sm">Obtenir une copie de vos données personnelles</p>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-white">Droit de rectification</h4>
                </div>
                <p className="text-sm">Corriger des données inexactes</p>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 className="w-4 h-4 text-red-500" />
                  <h4 className="font-semibold text-white">Droit à l'effacement</h4>
                </div>
                <p className="text-sm">Supprimer votre compte et vos données</p>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-white">Droit à la portabilité</h4>
                </div>
                <p className="text-sm">Récupérer vos données dans un format lisible</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <p className="font-semibold text-white mb-2">Comment exercer vos droits ?</p>
              <p className="text-sm">
                Connectez-vous à votre compte et accédez à <strong>Mon Profil → Mes données personnelles</strong>, 
                ou envoyez un email à <a href="mailto:contact@stationcab.fr" className="text-primary hover:underline">contact@stationcab.fr</a> 
                avec une copie de votre pièce d'identité.
              </p>
            </div>
          </section>

          {/* Transferts */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">6. Partage et transfert des données</h2>
            <p className="mb-4">Vos données peuvent être partagées avec :</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                <span><strong className="text-white">Stripe</strong> - Traitement des paiements (USA, clauses contractuelles types)</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                <span><strong className="text-white">Mapbox</strong> - Services de cartographie (USA, clauses contractuelles types)</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                <span><strong className="text-white">OVH</strong> - Hébergement et emails (France)</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                <span><strong className="text-white">Firebase</strong> - Notifications push (USA, clauses contractuelles types)</span>
              </li>
            </ul>
          </section>

          {/* Cookies */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">7. Cookies</h2>
            <p className="mb-4">Nous utilisons les types de cookies suivants :</p>
            
            <div className="space-y-3">
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="font-semibold text-green-400">Cookies essentiels (toujours actifs)</p>
                <p className="text-sm">Authentification, sécurité, préférences de session</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="font-semibold text-white">Cookies analytiques (optionnels)</p>
                <p className="text-sm">Statistiques d'utilisation pour améliorer le service</p>
              </div>
            </div>
            
            <p className="mt-4 text-sm">
              Vous pouvez modifier vos préférences de cookies à tout moment en cliquant sur le lien 
              "Paramètres des cookies" en bas de page.
            </p>
          </section>

          {/* Sécurité */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-bold text-white">8. Sécurité des données</h2>
            </div>
            <p>Nous mettons en œuvre les mesures suivantes :</p>
            <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
              <li>Chiffrement des données en transit (HTTPS/TLS)</li>
              <li>Mots de passe hashés (bcrypt)</li>
              <li>Tokens d'authentification sécurisés (JWT)</li>
              <li>Accès restreint aux données personnelles</li>
              <li>Sauvegardes régulières</li>
            </ul>
          </section>

          {/* Contact */}
          <section className="bg-primary/10 rounded-2xl p-6 border border-primary/30">
            <h2 className="text-xl font-bold text-white mb-4">9. Contact</h2>
            <p>
              Pour toute question relative à cette politique ou pour exercer vos droits :
            </p>
            <div className="mt-4 space-y-2">
              <p>
                <Mail className="w-4 h-4 inline mr-2" />
                <a href="mailto:contact@stationcab.fr" className="text-primary hover:underline">contact@stationcab.fr</a>
              </p>
              <p>
                <MapPin className="w-4 h-4 inline mr-2" />
                A&S Prestige SASU, 9 rue Victor Baltard, 77410 Claye-Souilly
              </p>
            </div>
            <p className="mt-4 text-sm text-gray-400">
              Vous pouvez également introduire une réclamation auprès de la CNIL : 
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                www.cnil.fr
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PolitiqueConfidentialite;
