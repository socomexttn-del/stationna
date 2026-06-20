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

### ✅ Authentification
- JWT-based login/register pour passagers, chauffeurs, admin
- Réinitialisation mot de passe par email

### ✅ Paiements Stripe (Autorisation/Capture) - MISE À JOUR 20/06/2025
- **Nouveau flux de paiement**:
  1. Commande → Autorisation (pas de débit)
  2. Course complétée → Capture du paiement
  3. Annulation → Annulation de l'autorisation ou capture des frais seulement
- Carte enregistrée avec SetupIntent
- Endpoints: `/payments/authorize`, `/payments/capture`, `/payments/cancel-authorization`

### ✅ Frais d'annulation - MISE À JOUR 20/06/2025
- **Avant acceptation chauffeur**: Gratuit (0€)
- **< 2 minutes après acceptation**: Gratuit (0€)
- **≥ 2 minutes après acceptation**: 8€ (VTC/Taxi), 15€ (Van)
- **Client absent (no-show)**: Si chauffeur attend ≥ 3 min → 8€/15€

### ✅ Client Absent (No-show) - NOUVEAU 20/06/2025
- Bouton "Client absent" pour le chauffeur
- Désactivé pendant les 3 premières minutes (compte à rebours visible)
- Activé après 3 min d'attente
- Frais facturés automatiquement au client
- Endpoint: `POST /rides/{id}/no-show`

### ✅ Mode Chauffeur (Keep-Alive iOS) 
- Wake Lock API pour garder l'écran allumé
- Audio silencieux en arrière-plan
- AudioContext optimisé pour iOS Safari
- Alarme sonore continue pour nouvelles courses

### ✅ Emails SMTP (Zembra/OVH) - MISE À JOUR 20/06/2025
- `contact@stationcab.fr` pour clients
- `driver@stationcab.fr` pour chauffeurs
- Emails automatiques: reset password, confirmation paiement

### ✅ Paiements Chauffeurs Hebdomadaires - NOUVEAU 20/06/2025
- Page Admin `/admin/driver-payments`
- Récapitulatif hebdomadaire par chauffeur
- Génération PDF des relevés de courses
- Bouton "Marquer payé" avec email de confirmation
- Historique des paiements
- **Règlements chaque LUNDI**

### ✅ CGV Chauffeur - NOUVEAU 20/06/2025
- Page `/cgv-chauffeur`
- Commission 18% expliquée
- Modalités de paiement (lundi)
- Règles no-show et annulations

### ✅ IBAN Chauffeur - NOUVEAU 20/06/2025
- Champ IBAN dans inscription chauffeur
- Affiché dans les relevés PDF
- Stocké dans profil utilisateur

### ✅ Arrêts Intermédiaires Drag-and-Drop - NOUVEAU 20/06/2025
- Réordonnancement par glisser-déposer
- Support tactile pour mobile
- Icône de poignée visible
- Max 3 arrêts

### ✅ Tests Automatisés - NOUVEAU 20/06/2025
- pytest pour le backend
- 11 tests couvrant: auth, rides, admin, payments
- Fichier: `/app/backend/tests/test_api.py`

### ✅ Courses (Rides)
- Réservation immédiate et programmée
- Types: VTC (Standard/Van) et Taxis réglementés
- Calcul de tarifs avec forfaits aéroport
- Arrêts intermédiaires réordonnables
- Cycle complet: pending → accepted → arrived → in_progress → completed

### ✅ Chauffeurs
- Dashboard avec gestion disponibilité
- Système de documents avec expiration (13 documents)
- Localisation GPS temps réel
- Notification de nouvelles courses
- Inscription avec IBAN

### ✅ Passagers
- Dashboard de réservation
- Suivi en temps réel du chauffeur
- Historique des courses
- Export PDF (Bon de commande conforme)
- Portefeuille avec bonus

### ✅ Admin
- Statistiques
- Gestion des codes promo
- Alertes documents expirés
- Gestion chauffeurs (activation/désactivation)
- Historique annulations avec totaux
- **Paiements chauffeurs hebdomadaires**

## Pages et Routes

### Public
- `/` - Landing page
- `/cgv` - CGV clients
- `/cgv-chauffeur` - CGV chauffeurs
- `/mentions-legales` - Mentions légales

### Auth
- `/login` - Connexion
- `/register` - Inscription passager
- `/driver-register` - Inscription chauffeur (avec IBAN)
- `/reset-password` - Réinitialisation mot de passe

### Passager
- `/passenger` - Dashboard passager

### Chauffeur
- `/driver` - Dashboard chauffeur

### Admin
- `/admin` - Dashboard admin
- `/admin/drivers` - Gestion chauffeurs
- `/admin/clients` - Liste clients
- `/admin/promo-codes` - Codes promo
- `/admin/cancellations` - Historique annulations
- `/admin/driver-payments` - Paiements chauffeurs

## Credentials de Test
- Admin: `admin@volttaxi.com` / `admin123`
- Passager: `passenger@test.com` / `password`
- Chauffeur: `driver@test.com` / `password`

## Domaine
- Production: `stationcab.fr`
- Emails: `contact@stationcab.fr`, `driver@stationcab.fr`

## Dernière mise à jour
20 Juin 2025
