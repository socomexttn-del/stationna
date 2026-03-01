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
6. ✅ **UI Courses Planifiées** - Refonte complète ✨ NEW

### Scheduled Rides UI Improvements ✨
- **Design modernisé** avec cartes détaillées
- **Statistiques en haut** : total planifiées, imminentes, montant total
- **Informations complètes** :
  - Date et heure en français (jeudi 26 février à 12:45)
  - Adresses de départ et destination
  - Distance, type de véhicule, nombre de passagers
  - Tarif estimé en grand
  - Badge de statut (Passée, Imminente, etc.)
- **Actions** : Modifier, Annuler, Activer
- **Modification de course** : nouvelle date/heure, adresses, véhicule, passagers
- **Indicateurs temporels** : "Dans X jours", "Demain", "Dans Xh", "Dans X min"
- **Rappels visuels** : Notification 1h avant le départ

### New API Endpoint
- `PUT /api/rides/{ride_id}/reschedule` - Modifier une course planifiée

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

### P2 - Medium Priority
1. **Wallet/credit system** for passengers
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
2025-03-01 - Scheduled rides UI enhanced
