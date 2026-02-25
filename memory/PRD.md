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
- [x] Session persistence (no more random logouts)

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
- [x] Address autocomplete with popular locations
- [x] Route drawing with ETA/distance
- [x] Live GPS tracking of driver
- [x] Available drivers shown with VOLT car icons
- [x] **Driver path tracking (blue line on map)** ✨ NEW

### Notifications
- [x] Real-time in-app notifications
- [x] Push notifications (PWA)
- [x] Driver/passenger notifications with ETA

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
- [x] **Driver account management (activate/deactivate)** ✨ NEW

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
- **Payments**: Stripe API (Payment Intents)
- **Auth**: JWT tokens with persistent sessions

## API Keys Configured
- Mapbox: User's key
- Stripe Secret Key: sk_test_51J5B0a...
- Stripe Publishable Key: pk_test_51J5B0a...

## Latest Updates (2025-02-25)

### Session Accomplishments
1. **Driver path tracking**: Blue line shows driver's traveled route on passenger map
2. **Admin driver management**: Activate/deactivate driver accounts from admin dashboard
3. **Session persistence fixed**: Complete rewrite of AuthContext.js
4. **Stripe payment integration**: User's Stripe keys configured
5. **VOLT car icons on map**: Available drivers visible with yellow markers

### New API Endpoints
- `GET /api/rides/{ride_id}/driver-path` - Get driver's path history
- `PUT /api/admin/drivers/{driver_id}/status` - Toggle driver account status

### Test Results (iteration_8)
- Backend: 100% (10/10 tests passed)
- Frontend: 100% (all P1 features working)

## Backlog (Priority Order)
1. ~~P1 - Live driver path on map~~ ✅ DONE
2. ~~P1 - Admin driver management~~ ✅ DONE
3. P2 - Wallet/credit system for passengers
4. P3 - Export statistics (CSV/PDF)

## Known Issues Resolved
- ~~Session persistence intermittent issues~~ ✅ FIXED
- ~~Testing agent Bad Gateway~~ ✅ FIXED
- ~~Stripe API key invalid~~ ✅ FIXED

## Last Updated
2025-02-25 - Completed P1 features: driver path tracking + admin driver management
