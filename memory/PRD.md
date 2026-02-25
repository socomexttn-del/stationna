# Volt Taxi - Product Requirements Document

## Original Problem Statement
Application de taxi complète avec rôles passager/chauffeur, authentification JWT, paiements Stripe, cartes Mapbox interactives, et tarification personnalisée.

## User Language
French (Français)

## Core Features Implemented

### Authentication & Users
- [x] JWT authentication
- [x] Passenger and Driver roles
- [x] User profiles with ratings

### Ride Management
- [x] Ride booking flow
- [x] Real-time ride status updates
- [x] Ride cancellation
- [x] Scheduled rides
- [x] Vehicle type selection (Standard/Van)
- [x] Passenger count with supplements
- [x] Frequent trips (one-click booking)
- [x] **Auto-assignment to nearest driver**

### Maps & Location
- [x] Mapbox integration with interactive map
- [x] Address autocomplete with popular locations (gares, aéroports)
- [x] Route drawing with ETA/distance
- [x] Live GPS tracking of driver
- [x] Proximity-based search (Paris default)
- [x] **Nearest driver calculation (Haversine formula)**

### Notifications
- [x] Real-time in-app notifications (HTTP polling)
- [x] **Push notifications (PWA/Service Worker)**
- [x] Driver/passenger notifications with ETA

### Payments
- [x] Stripe integration (test mode)
- [x] Fare estimation with detailed breakdown
- [x] Official tariff structure

### Communication
- [x] In-app chat between passenger and driver
- [x] Driver/passenger notifications

### Additional Features
- [x] Favorite addresses
- [x] Frequent trips with use counter
- [x] Promo codes
- [x] Payment history
- [x] Ride history

## Popular Locations
```
Gares: Nord, Est, Lyon, Saint-Lazare, Austerlitz, Montparnasse
Aéroports: CDG, Orly, Beauvais
```

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI, Service Worker (PWA)
- **Backend**: FastAPI, MongoDB (motor)
- **Maps**: Mapbox GL JS, Geocoding API, Directions API
- **Payments**: Stripe API (test keys)
- **Auth**: JWT tokens

## Test Accounts
- Passenger: passenger@test.com / password
- Driver: driver@test.com / password

## API Keys Required
- Mapbox: Provided by user
- Stripe: Using test key

## Backlog (Priority Order)
1. P2 - Live driver path on map
2. P2 - Enhanced rating system with comments
3. P3 - Wallet/credit system
4. P3 - Session persistence improvements

## Last Updated
2025-02-25 - Added auto-assignment to nearest driver + push notifications
