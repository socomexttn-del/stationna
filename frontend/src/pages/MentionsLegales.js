import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft, Building, Mail, Globe, Server } from 'lucide-react';
import StationCabLogo from '../components/StationCabLogo';

const MentionsLegales = () => {
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
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-white" style={{ fontFamily: 'Space Grotesk' }}>
          Mentions Légales
        </h1>

        <div className="space-y-8 text-gray-300">
          {/* Éditeur du site */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Building className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Éditeur du site</h2>
            </div>
            <div className="space-y-2 ml-13">
              <p><strong className="text-white">Raison sociale :</strong> A&S Prestige</p>
              <p><strong className="text-white">Forme juridique :</strong> SASU (Société par Actions Simplifiée Unipersonnelle)</p>
              <p><strong className="text-white">Capital social :</strong> 1 500 €</p>
              <p><strong className="text-white">Siège social :</strong> 9 rue Victor Baltard, 77410 Claye-Souilly, France</p>
              <p><strong className="text-white">SIRET :</strong> 827 808 866 00012</p>
              <p><strong className="text-white">RCS :</strong> Meaux</p>
              <p><strong className="text-white">TVA :</strong> Non assujetti (Article 293B du CGI)</p>
            </div>
          </section>

          {/* Directeur de publication */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Directeur de publication</h2>
            </div>
            <p className="ml-13">A&S Prestige (SASU)</p>
          </section>

          {/* Contact */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Contact</h2>
            </div>
            <div className="space-y-2 ml-13">
              <p><strong className="text-white">Email :</strong> <a href="mailto:contact@stationcab.fr" className="text-primary hover:underline">contact@stationcab.fr</a></p>
              <p><strong className="text-white">Site web :</strong> <a href="https://stationcab.fr" className="text-primary hover:underline">www.stationcab.fr</a></p>
            </div>
          </section>

          {/* Hébergement */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Server className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Hébergement</h2>
            </div>
            <div className="space-y-2 ml-13">
              <p><strong className="text-white">Hébergeur :</strong> OVH SAS</p>
              <p><strong className="text-white">Adresse :</strong> 2 rue Kellermann, 59100 Roubaix, France</p>
              <p><strong className="text-white">Téléphone :</strong> 1007</p>
              <p><strong className="text-white">Site web :</strong> <a href="https://www.ovhcloud.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.ovhcloud.com</a></p>
            </div>
          </section>

          {/* Propriété intellectuelle */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Propriété intellectuelle</h2>
            <div className="space-y-4">
              <p>
                L&apos;ensemble du contenu du site StationCab (logos, textes, éléments graphiques, vidéos, etc.) 
                est protégé par le droit d&apos;auteur et le droit des marques.
              </p>
              <p>
                Toute reproduction, représentation, modification, publication, adaptation de tout ou partie 
                des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite, 
                sauf autorisation écrite préalable de A&S Prestige.
              </p>
              <p>
                Toute exploitation non autorisée du site ou de l&apos;un quelconque des éléments qu&apos;il contient 
                sera considérée comme constitutive d&apos;une contrefaçon et poursuivie conformément aux 
                dispositions des articles L.335-2 et suivants du Code de la Propriété Intellectuelle.
              </p>
            </div>
          </section>

          {/* Protection des données */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Protection des données personnelles</h2>
            <div className="space-y-4">
              <p>
                Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi 
                Informatique et Libertés du 6 janvier 1978 modifiée, vous disposez des droits suivants 
                concernant vos données personnelles :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Droit d&apos;accès</li>
                <li>Droit de rectification</li>
                <li>Droit à l&apos;effacement</li>
                <li>Droit à la limitation du traitement</li>
                <li>Droit à la portabilité des données</li>
                <li>Droit d&apos;opposition</li>
              </ul>
              <p>
                Pour exercer ces droits ou pour toute question relative à la protection de vos données, 
                vous pouvez nous contacter à l&apos;adresse : <a href="mailto:contact@stationcab.fr" className="text-primary hover:underline">contact@stationcab.fr</a>
              </p>
              <p>
                Vous pouvez également introduire une réclamation auprès de la CNIL (Commission Nationale 
                de l&apos;Informatique et des Libertés) : <a href="https://www.cnil.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>
              </p>
            </div>
          </section>

          {/* Cookies */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Cookies</h2>
            <div className="space-y-4">
              <p>
                Le site StationCab utilise des cookies pour améliorer l&apos;expérience utilisateur et 
                assurer le bon fonctionnement de nos services. Ces cookies sont essentiels pour :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintenir votre session de connexion</li>
                <li>Mémoriser vos préférences de langue</li>
                <li>Assurer la sécurité de vos transactions</li>
              </ul>
              <p>
                En utilisant notre site, vous acceptez l&apos;utilisation de ces cookies essentiels.
              </p>
            </div>
          </section>

          {/* Limitation de responsabilité */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Limitation de responsabilité</h2>
            <div className="space-y-4">
              <p>
                A&S Prestige ne pourra être tenue responsable des dommages directs et indirects causés 
                au matériel de l&apos;utilisateur lors de l&apos;accès au site StationCab, résultant soit de 
                l&apos;utilisation d&apos;un matériel ne répondant pas aux spécifications, soit de l&apos;apparition 
                d&apos;un bug ou d&apos;une incompatibilité.
              </p>
              <p>
                A&S Prestige ne pourra également être tenue responsable des dommages indirects consécutifs 
                à l&apos;utilisation du site StationCab.
              </p>
            </div>
          </section>

          {/* Liens */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Liens hypertextes</h2>
            <p>
              Le site StationCab peut contenir des liens vers d&apos;autres sites. A&S Prestige n&apos;exerce 
              aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.
            </p>
          </section>

          {/* Droit applicable */}
          <section className="bg-card/50 rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-white mb-4">Droit applicable</h2>
            <p>
              Les présentes mentions légales sont régies par le droit français. En cas de litige, 
              les tribunaux français seront seuls compétents.
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

export default MentionsLegales;
