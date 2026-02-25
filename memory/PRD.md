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
- **Payments**: Stripe API (Payment Intents for inline card, Checkout for redirect)
- **Auth**: JWT tokens

## API Keys Required
- Mapbox: Configured
- Stripe: Using test key (sk_test_emergent)

## Latest Updates (2025-02-25)

### Session Accomplishments
1. **Fixed driver routing**: Driver login correctly redirects to /driver dashboard
2. **Added VOLT car icons on map**: Available drivers now appear on passenger map with yellow VOLT-branded car markers with hover info
3. **Implemented Stripe Elements payment**: Passengers can now enter credit card details directly in the app via embedded form
4. **Testing agent restored**: The testing_agent_v3 is now working correctly
5. **React warning fixes**: Fixed button nesting issues in frequent trips

### New Components Created
- `/app/frontend/src/components/PaymentForm.js` - Stripe Elements card form

### API Endpoints Added
- `POST /api/payments/create-payment-intent` - Creates Stripe Payment Intent
- `POST /api/payments/confirm-payment` - Confirms successful payment

## Backlog (Priority Order)
1. P1 - Live driver path on map (show route history)
2. P1 - Admin driver management (activate/deactivate)
3. P2 - Session persistence improvements
4. P2 - Wallet/credit system for passengers
5. P3 - Export statistics (CSV/PDF)

## Known Issues
- React hydration warnings in console (minor, non-blocking)
- Session persistence may have intermittent issues (P2)

## Last Updated
2025-02-25 - Added inline Stripe payment + VOLT driver markers on map
