# Allogo - Product Requirements Document

## Original Problem Statement
Application de taxi complète nommée Allogo avec rôles passager/chauffeur/admin, authentification JWT, paiements Stripe, cartes Mapbox, et tarification personnalisée.

## User Language
French (Français)

## Core Features Implemented

### Authentication & Users
- [x] JWT authentication
- [x] Passenger, Driver, and Admin roles
- [x] User profiles with ratings
- [x] Automatic geolocation with permission handling
- [x] Session persistence

### Ride Management
- [x] Ride booking flow (immediate & scheduled)
- [x] **Intermediate stops (up to 3)** ✨ NEW
- [x] Real-time ride status updates
- [x] Ride cancellation
- [x] Vehicle type selection (Standard/Van)
- [x] Passenger count with supplements
- [x] Frequent trips (one-click booking)
- [x] Ride proposal system
- [x] 18% commission deduction
- [x] Page reset after ride completion

### Maps & Location
- [x] Mapbox integration with interactive map
- [x] Address autocomplete
- [x] Route drawing with ETA/distance
- [x] Live GPS tracking of driver
- [x] Driver path tracking

### Notifications
- [x] Real-time in-app notifications
- [x] Push notifications (PWA)
- [x] Sound notifications (Web Audio API)

### Payments
- [x] Stripe integration (test mode)
- [x] Fare estimation with breakdown
- [x] Stripe Elements payment form
- [x] **Saved card management** ✨ NEW
- [x] **Pay with saved card** ✨ NEW
- [x] Payment history

### Admin Features
- [x] Admin dashboard with statistics
- [x] Driver stats and management
- [x] Driver account activation/deactivation
- [x] **Client database with search** ✨ NEW
- [x] **Client ride history** ✨ NEW
- [x] **Invoice generation per ride** ✨ NEW

### Driver Features
- [x] Driver dashboard with earnings
- [x] Hide/show earnings toggle
- [x] Vehicle & document management
- [x] Waze/Google Maps integration

### Rating System
- [x] Star ratings with comments

## Test Accounts
- Passenger: passenger@test.com / password
- Driver: driver@test.com / password
- Admin: admin@volttaxi.com / admin123

## Fare Calculation
```
Base Rates:
- Prise en charge: 4.48€
- Prix/km: 1.30€
- Tarif/minute: 0.70€
- Tarif minimum: 8.00€

Supplements:
- Réservation immédiate: +4.00€
- Réservation à l'avance: +7.00€
- Van (7 places): +10.00€
- Passager supplémentaire (5e+): +5.50€/passager
- Arrêt intermédiaire: +3.00€/arrêt
```

## Session Accomplishments (2025-03-01)

### 1. Saved Cards Feature ✅
- Stripe SetupIntent integration
- Card management in user profile
- Pay with saved card (one-click)
- Tests: 100% (13/13)

### 2. Intermediate Stops Feature ✅
- Add up to 3 waypoints in trips
- Distance calculated via all points
- +3€ supplement per stop
- Tests: 100% (12/12)

### 3. Admin Client Database ✅
- Client list with search/pagination
- Client details with ride history
- Invoice generation for each ride
- Print/PDF export

## New Pages & Components
- `/admin/clients` - Admin client database page
- `AdminClientsPage.js` - Client management UI
- `IntermediateStops.js` - Stop management component
- `SavedCardsManager.js` - Card management component
- `PaymentMethodSelector.js` - Payment modal

## API Endpoints Added
```
# Saved Cards
POST /api/payments/setup-intent
GET /api/payments/saved-cards
DELETE /api/payments/saved-cards/{id}
POST /api/payments/set-default-card/{id}
POST /api/payments/pay-with-saved-card

# Admin Clients
GET /api/admin/clients
GET /api/admin/clients/{id}
GET /api/admin/clients/{id}/rides
GET /api/admin/rides/{id}/invoice
```

## Backlog

### P2 - Medium Priority
1. **Expanded driver documents** - CNI, justificatif domicile, RC-Pro
2. **Scheduled rides UI enhancement**
3. **Wallet/credit system** for passengers

### P3 - Future
4. **Mobile App Conversion** - Capacitor for iOS/Android
5. **Export statistics** - CSV/PDF for admin

## Stripe Test Card
- Number: 4242 4242 4242 4242
- Exp: 12/34
- CVC: 123

## Last Updated
2025-03-01 - Admin client database completed
