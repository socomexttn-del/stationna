# Allogo - Product Requirements Document

## Original Problem Statement
Application de taxi complète nommée Allogo avec rôles passager/chauffeur/admin, authentification JWT, paiements Stripe, cartes Mapbox, et tarification personnalisée.

## User Language
French (Français)

## Session Accomplishments (2025-03-01)

### Features Completed This Session:
1. ✅ **Sauvegarde des cartes bancaires** - Stripe SetupIntent
2. ✅ **Arrêts intermédiaires** - Jusqu'à 3 waypoints
3. ✅ **Base de données clients admin** - Historique et factures
4. ✅ **Documents chauffeur élargis** - 11 types de documents
5. ✅ **Notifications d'expiration** - Alertes 30 jours avant
6. ✅ **UI Courses Planifiées** - Refonte complète
7. ✅ **Système de Portefeuille Passager** - Rechargement Stripe + paiement ✨ NEW

### Wallet System ✨ (NEW - 2025-03-01)
- **Page Portefeuille** (`/wallet`) accessible depuis le menu passager
- **Affichage du solde** en temps réel
- **Rechargement rapide** : 10€, 20€, 50€, 100€
- **Montant personnalisé** : 5€ à 500€
- **Intégration Stripe** : Paiement sécurisé
- **Historique des transactions** avec pagination
- **Option de paiement** dans PaymentMethodSelector
- **API Endpoints** :
  - `GET /api/wallet/balance` - Solde du portefeuille
  - `GET /api/wallet/transactions` - Historique des transactions
  - `POST /api/wallet/top-up` - Créer un paiement Stripe
  - `POST /api/wallet/confirm-topup` - Confirmer le rechargement
  - `POST /api/wallet/pay` - Payer une course avec le portefeuille

### Scheduled Rides UI Improvements
- **Design modernisé** avec cartes détaillées
- **Statistiques en haut** : total planifiées, imminentes, montant total
- **Informations complètes** : date, adresses, distance, tarif
- **Actions** : Modifier, Annuler, Activer
- **Indicateurs temporels** : "Dans X jours", "Demain", etc.

## Core Features Summary

### Ride Management
- [x] Booking flow (immediate & scheduled)
- [x] Intermediate stops (up to 3)
- [x] Real-time status updates
- [x] Vehicle type selection (Standard/Van)
- [x] Passenger count with supplements
- [x] Ride proposal system
- [x] **Enhanced scheduled rides UI** ✨

### Payments
- [x] Stripe integration
- [x] Saved card management
- [x] Pay with saved card
- [x] Invoice generation

### Admin Features
- [x] Dashboard with statistics
- [x] Client database with search
- [x] Driver management
- [x] Document expiry tracking

### Driver Features
- [x] Earnings dashboard
- [x] 11 document types
- [x] Expiry notifications
- [x] Waze/Google Maps links

## Test Accounts
- Passenger: passenger@test.com / password
- Driver: driver@test.com / password
- Admin: admin@volttaxi.com / admin123

## Backlog

### P1 - High Priority
1. **Refactorisation Backend** - server.py > 2700 lignes → routers/, models/, services/

### P2 - Medium Priority
2. **Email notifications** for document expiry (SMTP)
3. **Ride history export** (PDF)

### P3 - Future
4. **Mobile App** - Capacitor for iOS/Android
5. **Multi-language support**
6. **Promo codes system**

## Stripe Test Card
- Number: 4242 4242 4242 4242
- Exp: 12/34
- CVC: 123

## Last Updated
2025-03-01 - Wallet system completed
