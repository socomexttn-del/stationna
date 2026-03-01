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
- [x] Automatic geolocation on login with permission handling
- [x] Session persistence (refactored AuthContext.js)

### Ride Management
- [x] Ride booking flow (immediate & scheduled)
- [x] Real-time ride status updates
- [x] Ride cancellation
- [x] Vehicle type selection (Standard/Van)
- [x] Passenger count with supplements (>4 passengers)
- [x] Frequent trips (one-click booking)
- [x] Ride proposal system (drivers must accept)
- [x] Re-dispatch to next driver on refusal
- [x] 18% commission deduction for drivers
- [x] Detailed booking receipt for drivers
- [x] **Page reset after ride completion and rating** ✨ NEW

### Maps & Location
- [x] Mapbox integration with interactive map
- [x] Address autocomplete with popular locations (gares, aéroports)
- [x] Route drawing with ETA/distance
- [x] Live GPS tracking of driver
- [x] Available drivers shown with ALLOGO car icons
- [x] Driver path tracking (blue line on map)
- [x] **Improved geolocation permission handling** ✨ IMPROVED

### Notifications
- [x] Real-time in-app notifications (polling)
- [x] Push notifications (PWA)
- [x] Driver/passenger notifications with ETA
- [x] **Sound notifications for events** ✨ VERIFIED
  - Online/offline sounds for drivers
  - New ride proposal sounds (3x repeat)
  - Ride accepted sound for passengers
  - Driver arrived sound for passengers

### Payments
- [x] Stripe integration (test mode)
- [x] Fare estimation with detailed breakdown
- [x] Inline credit card payment form (Stripe Elements)
- [x] Payment history tracking
- [x] User's Stripe API keys configured

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
- [x] Booking receipt with commission
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
- **Payments**: Stripe API (Payment Intents)
- **Auth**: JWT tokens with persistent sessions

## API Keys Configured
- Mapbox: User's key
- Stripe Secret Key: sk_test_51J5B0a...
- Stripe Publishable Key: pk_test_51J5B0a...

## Latest Updates (2025-03-01)

### Session Accomplishments
1. **Sound notifications verified**: Web Audio API sounds working for all events
2. **Geolocation improved**: Added permission query API for better UX
3. **Page reset after ride**: Passenger dashboard resets after rating
4. **Bug fix**: /api/rides/scheduled route order corrected (returned 404 before)

### Test Results (iteration_9)
- Backend: 95.8% → 100% (scheduled rides bug fixed)
- Frontend: 100% (all P1 features working)

## Backlog (Priority Order)

### P1 - High Priority
1. **Save credit card details** - Allow users to save CC for future rides
2. **Intermediate stops** - Add waypoints to trips
3. **Admin client database** - View all clients, ride history, invoices

### P2 - Medium Priority
4. **Expanded driver documents** - CNI, justificatif domicile, RC-Pro
5. **Scheduled rides UI** - Enhance with more details
6. **Wallet/credit system** - For passengers

### P3 - Future
7. **Mobile App Conversion** - Capacitor for iOS/Android
8. **Export statistics** - CSV/PDF for admin

## Known Issues Resolved
- ~~Session persistence intermittent issues~~ ✅ FIXED
- ~~Testing agent Bad Gateway~~ ✅ FIXED
- ~~Stripe API key invalid~~ ✅ FIXED
- ~~Frontend build instability~~ ✅ STABLE
- ~~/api/rides/scheduled 404 error~~ ✅ FIXED

## Code Architecture
```
/app/
├── backend/
│   ├── .env (MONGO_URL, DB_NAME, JWT_SECRET, STRIPE_API_KEY)
│   ├── requirements.txt
│   ├── server.py (~2000 lines - needs refactoring)
│   └── tests/
│       └── test_allogo_core.py
├── frontend/
│   ├── .env (REACT_APP_BACKEND_URL, REACT_APP_MAPBOX_TOKEN)
│   ├── package.json
│   └── src/
│       ├── App.js
│       ├── context/AuthContext.js
│       ├── components/
│       │   ├── AddressAutocomplete.js
│       │   ├── MapComponent.js
│       │   ├── PaymentForm.js
│       │   ├── RatingModal.js
│       │   └── ui/ (Shadcn components)
│       └── pages/
│           ├── AdminDashboard.js
│           ├── AuthPage.js
│           ├── DriverDashboard.js
│           ├── PassengerDashboard.js
│           └── ScheduledRidesPage.js
└── memory/
    └── PRD.md
```

## Refactoring Recommendations
- **Backend server.py**: Split into routes/, models/, services/
- **API routes order**: Static paths before dynamic {id} paths

## Last Updated
2025-03-01 - Bug fixes and improvements
