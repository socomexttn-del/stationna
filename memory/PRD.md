# StationCab - Application Taxi PRD

## Problème Original
Application taxi complète "StationCab" avec support multi-rôles (Passager, Chauffeur, Admin), fonctionnalités temps réel, cycle de vie complet des courses, GPS, chat in-app, paiements Stripe, et tarifs réglementés parisiens.

## Architecture Technique
- **Backend**: FastAPI + MongoDB (motor) + JWT
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Mobile**: Capacitor (Android/iOS)
- **Paiements**: Stripe (Mode LIVE - Autorisation/Capture)
- **Cartes**: Mapbox
- **Emails**: SMTP Zembra/OVH (contact@stationcab.fr, driver@stationcab.fr)
- **Push Notifications**: Firebase Cloud Messaging (FCM)

## Fonctionnalités Implémentées

### ✅ SEO Complet - 20/06/2025
- **Balises Meta** optimisées dans `index.html` (title, description, keywords, robots, canonical)
- **Open Graph** (Facebook, LinkedIn) : og:title, og:description, og:image, og:url, og:site_name
- **Twitter Cards** : summary_large_image avec image, titre, description
- **robots.txt** : Autorise indexation pages publiques, bloque pages protégées
- **sitemap.xml** : Liste les 7 pages principales avec priorités et fréquences
- **Favicon et Apple Touch Icon** configurés

### ✅ Backlog Travail - 20/06/2025
- **Code mort nettoyé** : Dépendance `resend` retirée de requirements.txt
- **Structure modulaire créée** :
  - `/app/backend/core/` : config.py, database.py, security.py
  - `/app/backend/models/schemas.py` : Tous les modèles Pydantic extraits
  - `/app/backend/services/` : celery_app.py, tasks.py (prêts pour activation)
- **Celery/Redis préparé** : Tasks créées pour réassignation courses, nettoyage autorisations
- **Guide de refactorisation** : `/app/backend/REFACTORING_GUIDE.md`

### ✅ RGPD Complet - 20/06/2025
- **Bandeau cookies** avec personnalisation (essentiels, analytiques, marketing)
- **Politique de confidentialité** complète (`/politique-confidentialite`)
- **Export des données** (JSON) - Droit à la portabilité
- **Suppression de compte** - Droit à l'effacement
- **Consentement explicite** à l'inscription
- **Section "Mes données personnelles"** dans le profil utilisateur

### ✅ Authentification
- JWT-based login/register pour passagers, chauffeurs, admin
- Réinitialisation mot de passe par email

### ✅ Paiements Stripe (Autorisation/Capture)
- Nouveau flux de paiement (autorisation puis capture)
- Carte enregistrée avec SetupIntent
- Frais d'annulation avec délai de grâce 2 min

### ✅ Frais d'annulation
- Avant acceptation chauffeur: Gratuit (0€)
- < 2 minutes après acceptation: Gratuit (0€)
- ≥ 2 minutes après acceptation: 8€ (VTC/Taxi), 15€ (Van)
- Client absent (no-show ≥ 3 min): 8€/15€

### ✅ Mode Chauffeur (Keep-Alive iOS)
- Wake Lock API + Audio silencieux + AudioContext optimisé pour Safari

### ✅ Emails SMTP (Zembra/OVH)
- `contact@stationcab.fr` pour clients
- `driver@stationcab.fr` pour chauffeurs

### ✅ Paiements Chauffeurs Hebdomadaires
- Relevés hebdo + PDF + historique + email confirmation
- Règlements chaque LUNDI

### ✅ Arrêts Intermédiaires Drag-and-Drop
- Réordonnancement par glisser-déposer (desktop + mobile)

### ✅ Tests Automatisés
- 11 tests pytest (auth, rides, admin, payments)

### ✅ Courses (Rides)
- Réservation immédiate et programmée
- Types: VTC (Standard/Van) et Taxis réglementés
- Calcul de tarifs avec forfaits aéroport

### ✅ Chauffeurs
- Dashboard + gestion documents (13 types) + IBAN
- CGV Chauffeur (`/cgv-chauffeur`)

### ✅ Passagers
- Dashboard + suivi temps réel + historique + export PDF

### ✅ Admin
- Statistiques + codes promo + alertes documents + paiements chauffeurs

## Pages et Routes

### Public
- `/` - Landing page
- `/cgv` - CGV clients
- `/cgv-chauffeur` - CGV chauffeurs
- `/mentions-legales` - Mentions légales
- `/politique-confidentialite` - Politique de confidentialité (RGPD)

### Auth
- `/login`, `/register`, `/driver-register`, `/reset-password`

### Passager
- `/passenger` - Dashboard passager
- `/profile` - Profil (avec section RGPD)

### Chauffeur
- `/driver` - Dashboard chauffeur

### Admin
- `/admin` - Dashboard admin
- `/admin/drivers`, `/admin/clients`, `/admin/promo-codes`
- `/admin/cancellations`, `/admin/driver-payments`

## Credentials de Test
- Admin: `admin@volttaxi.com` / `admin123`
- Passager: `passenger@test.com` / `password`
- Chauffeur: `driver@test.com` / `password`

## Domaine
- Production: `stationcab.fr`
- Emails: `contact@stationcab.fr`, `driver@stationcab.fr`

## Fichiers Importants
- `/app/frontend/public/robots.txt` - SEO
- `/app/frontend/public/sitemap.xml` - SEO
- `/app/backend/REFACTORING_GUIDE.md` - Guide migration modulaire
- `/app/backend/core/` - Configuration, DB, Security
- `/app/backend/models/schemas.py` - Modèles Pydantic
- `/app/backend/services/` - Celery tasks (prêts)

## Tâches Restantes

### P1 - Pour activer Celery/Redis
1. Installer Redis sur le serveur de production
2. Ajouter `celery` et `redis` à requirements.txt
3. Configurer `REDIS_URL` dans .env
4. Démarrer le worker Celery

### P2 - Migration progressive server.py
1. Suivre `/app/backend/REFACTORING_GUIDE.md`
2. Extraire les routes une par une
3. Tester après chaque extraction

## Dernière mise à jour
20 Juin 2025
