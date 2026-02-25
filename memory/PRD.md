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

### Maps & Location
- [x] Mapbox integration with interactive map
- [x] Address autocomplete with popular locations (gares, aéroports)
- [x] Route drawing with ETA/distance
- [x] Live GPS tracking of driver
- [x] Proximity-based search (Paris default)

### Payments
- [x] Stripe integration (test mode)
- [x] Fare estimation with detailed breakdown
- [x] Official tariff structure:
  - Prise en charge: 4.48€
  - Distance: 1.30€/km
  - Temps: 0.70€/min
  - Van supplement: +10€
  - Immediate booking: +4€
  - Extra passenger (>4): +5.50€/person
  - Minimum fare: 8€

### Communication
- [x] In-app chat between passenger and driver
- [x] Real-time notifications (HTTP polling)
- [x] Driver/passenger notifications

### Additional Features
- [x] Favorite addresses
- [x] Frequent trips with use counter
- [x] Promo codes
- [x] Payment history
- [x] Ride history

## Popular Locations
```
Gares:
- Gare du Nord, 75010 Paris
- Gare de l'Est, 75010 Paris
- Gare de Lyon, 75012 Paris
- Gare Saint-Lazare, 75008 Paris
- Gare d'Austerlitz, 75013 Paris
- Gare Montparnasse, 75015 Paris

Aéroports:
- Aéroport CDG, 95700 Roissy-en-France
- Aéroport Orly, 94390 Orly
- Aéroport Beauvais, 60000 Beauvais
```

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI, MongoDB (motor)
- **Maps**: Mapbox GL JS, Geocoding API, Directions API
- **Payments**: Stripe API (test keys)
- **Auth**: JWT tokens

## Test Accounts
- Passenger: passenger@test.com / password
- Driver: driver@test.com / password

## API Keys Required
- Mapbox: Provided by user
- Stripe: Using test key (sk_test_emergent)

## Backlog (Priority Order)
1. P1 - Push notifications (PWA)
2. P2 - SMS notifications (Twilio)
3. P2 - Live driver path on map
4. P3 - Wallet/credit system
5. P3 - Session persistence improvements

## Last Updated
2025-02-25 - Added frequent trips feature
