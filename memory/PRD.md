# Volt Taxi - Product Requirements Document

## Original Problem Statement
Application de taxi complète avec rôles passager/chauffeur/admin, authentification JWT, paiements Stripe, cartes Mapbox interactives, et tarification personnalisée.

## User Language
French (Français)

## Core Features Implemented

### Authentication & Users
- [x] JWT authentication
- [x] Passenger, Driver, and Admin roles
- [x] User profiles with ratings
- [x] Automatic geolocation on login
- [x] **Session persistence fixed** (no more random logouts)

### Ride Management
- [x] Ride booking flow (immediate & scheduled)
- [x] Real-time ride status updates
- [x] Ride cancellation
- [x] Vehicle type selection (Standard/Van)
- [x] Passenger count with supplements (>4 passengers)
- [x] Frequent trips (one-click booking)
- [x] Auto-assignment to nearest driver
- [x] 18% commission deduction for drivers
- [x] Detailed booking receipt for drivers

### Maps & Location
- [x] Mapbox integration with interactive map
- [x] Address autocomplete with popular locations (gares, aéroports)
- [x] Route drawing with ETA/distance
- [x] Live GPS tracking of driver
- [x] **Available drivers shown on passenger map with VOLT car icons**
- [x] Proximity-based search (Paris default)

### Notifications
- [x] Real-time in-app notifications (HTTP polling)
- [x] Push notifications (PWA/Service Worker)
- [x] Driver/passenger notifications with ETA

### Payments
- [x] Stripe integration (test mode)
- [x] Fare estimation with detailed breakdown
- [x] **Inline credit card payment form (Stripe Elements)**
- [x] Payment history tracking
- [x] **User's Stripe API keys configured**

### Communication
- [x] In-app chat between passenger and driver
- [x] Driver/passenger notifications

### Admin Features
- [x] Admin dashboard with statistics
- [x] Driver stats (earnings, rides, rating)
- [x] Recent rides overview
- [x] Driver document validation

### Driver Features
- [x] Driver dashboard with earnings
- [x] Vehicle & document management
- [x] Booking receipt with commission

### Rating System
- [x] Star ratings with comments
- [x] Quick-selection tags

## Test Accounts
- Passenger: passenger@test.com / password
- Driver: driver@test.com / password
- Admin: admin@volttaxi.com / admin123

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI, Stripe Elements
- **Backend**: FastAPI, MongoDB (motor)
- **Maps**: Mapbox GL JS, Geocoding API, Directions API
- **Payments**: Stripe API (Payment Intents for inline card)
- **Auth**: JWT tokens with persistent sessions

## API Keys Configured
- Mapbox: User's key
- Stripe Secret Key: sk_test_51J5B0a...
- Stripe Publishable Key: pk_test_51J5B0a...

## Latest Updates (2025-02-25)

### Session 1 Accomplishments
1. **Fixed driver routing**: Driver login correctly redirects to /driver dashboard
2. **Added VOLT car icons on map**: Available drivers now appear on passenger map with yellow VOLT-branded car markers
3. **Implemented Stripe Elements payment**: Passengers can enter credit card details directly in the app
4. **Testing agent restored**: testing_agent_v3 now working
5. **Stripe API keys configured**: User's real Stripe test keys integrated

### Session 2 Accomplishments
6. **Session persistence fixed**: Complete rewrite of AuthContext.js
   - Stable API instance with useMemo
   - Axios interceptors for automatic token handling
   - Only logout on 401 errors, not network errors
   - LocalStorage sync between tabs
   - Memoized callbacks for performance

### E2E Test Results
- ✅ Ride flow (create → accept → start → complete): WORKING
- ✅ Payment Intent creation with Stripe: WORKING
- ✅ Session persistence after navigation: WORKING
- ✅ Session persistence after hard refresh: WORKING

## Backlog (Priority Order)
1. P1 - Live driver path on map (show route history)
2. P1 - Admin driver management (activate/deactivate)
3. P3 - Wallet/credit system for passengers
4. P3 - Export statistics (CSV/PDF)

## Known Issues Resolved
- ~~Session persistence intermittent issues~~ ✅ FIXED
- ~~Testing agent Bad Gateway~~ ✅ FIXED
- ~~Stripe API key invalid~~ ✅ FIXED

## Last Updated
2025-02-25 - Fixed session persistence + Stripe payment integration complete
