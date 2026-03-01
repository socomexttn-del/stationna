# Allogo - Product Requirements Document

## Original Problem Statement
Application de taxi complète nommée Allogo (anciennement Volt Taxi) avec rôles passager/chauffeur/admin, authentification JWT, paiements Stripe, cartes Mapbox interactives, et tarification personnalisée.

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
- [x] Passenger count with supplements (>4 passengers)
- [x] Frequent trips (one-click booking)
- [x] Ride proposal system (drivers must accept)
- [x] Re-dispatch to next driver on refusal
- [x] 18% commission deduction for drivers
- [x] Page reset after ride completion

### Maps & Location
- [x] Mapbox integration with interactive map
- [x] Address autocomplete with popular locations
- [x] Route drawing with ETA/distance
- [x] Live GPS tracking of driver
- [x] Available drivers shown with ALLOGO car icons
- [x] Driver path tracking (blue line on map)

### Notifications
- [x] Real-time in-app notifications (polling)
- [x] Push notifications (PWA)
- [x] Sound notifications for events (Web Audio API)

### Payments ✨ ENHANCED
- [x] Stripe integration (test mode)
- [x] Fare estimation with detailed breakdown
- [x] Inline credit card payment form (Stripe Elements)
- [x] **Saved card management** ✨ RECENT
- [x] **Pay with saved card (one-click)** ✨ RECENT
- [x] Payment history tracking

### Communication
- [x] In-app chat between passenger and driver

### Admin Features
- [x] Admin dashboard with statistics
- [x] Driver stats (earnings, rides, rating)
- [x] Recent rides overview
- [x] Driver document validation
- [x] Driver account management (activate/deactivate)

### Driver Features
- [x] Driver dashboard with earnings
- [x] Hide/show earnings toggle
- [x] Vehicle & document management
- [x] Waze/Google Maps integration links

### Rating System
- [x] Star ratings with comments
- [x] Quick-selection tags

## Test Accounts
- Passenger: passenger@test.com / password
- Driver: driver@test.com / password
- Admin: admin@volttaxi.com / admin123

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Shadcn UI, Stripe Elements
- **Backend**: FastAPI, MongoDB (motor)
- **Maps**: Mapbox GL JS, Geocoding API, Directions API
- **Payments**: Stripe API (Payment Intents, SetupIntents, Customers)
- **Auth**: JWT tokens with persistent sessions

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
- Arrêt intermédiaire: +3.00€/arrêt ✨ NEW
```

## Latest Updates (2025-03-01)

### Session Accomplishments
1. **Intermediate stops feature complete** ✨ NEW
   - Add up to 3 waypoints in a trip
   - Distance calculated via all points
   - +3€ supplement per stop
   - Route summary in estimation
   
2. **Saved cards feature complete**
   - Full Stripe SetupIntent integration
   - Card management in profile
   - One-click payment with saved card

3. **Sound notifications verified**
4. **Geolocation improved**
5. **Page reset after ride**

### Test Results (iteration_11)
- Backend: 100% (12/12 tests)
- Frontend: 100% (all components verified)

## New Components Created This Session
- `/app/frontend/src/components/IntermediateStops.js` - Stop management UI
- `/app/frontend/src/components/SavedCardsManager.js` - Card management
- `/app/frontend/src/components/PaymentMethodSelector.js` - Payment modal

## New API Endpoints This Session
- `POST /api/payments/setup-intent`
- `GET /api/payments/saved-cards`
- `DELETE /api/payments/saved-cards/{id}`
- `POST /api/payments/set-default-card/{id}`
- `POST /api/payments/pay-with-saved-card`
- `POST /api/rides/estimate` - Updated for stops support
- `POST /api/rides` - Updated for stops support

## Backlog (Priority Order)

### P1 - High Priority
1. ~~**Save credit card details**~~ ✅ COMPLETED
2. ~~**Intermediate stops**~~ ✅ COMPLETED
3. **Admin client database** - View all clients, ride history, invoices

### P2 - Medium Priority
4. **Expanded driver documents** - CNI, justificatif domicile, RC-Pro
5. **Scheduled rides UI** - Enhance with more details
6. **Wallet/credit system** - For passengers

### P3 - Future
7. **Mobile App Conversion** - Capacitor for iOS/Android
8. **Export statistics** - CSV/PDF for admin

## Code Architecture
```
/app/
├── backend/
│   ├── server.py (~2300 lines - consider refactoring)
│   └── tests/
│       ├── test_saved_cards_payments.py
│       └── test_intermediate_stops.py
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── IntermediateStops.js ✨ NEW
│       │   ├── SavedCardsManager.js ✨ NEW
│       │   ├── PaymentMethodSelector.js ✨ NEW
│       │   └── ...
│       └── pages/
│           ├── PassengerDashboard.js (updated for stops)
│           ├── ProfilePage.js (updated for cards)
│           └── ...
└── memory/
    └── PRD.md
```

## Stripe Test Card
- Card Number: 4242 4242 4242 4242
- Exp: Any future date (12/34)
- CVC: Any 3 digits (123)

## Last Updated
2025-03-01 - Intermediate stops feature completed
