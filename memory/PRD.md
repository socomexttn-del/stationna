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
- [x] **Intermediate stops (up to 3)** ✅
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
- [x] **Saved card management** ✅
- [x] **Pay with saved card** ✅
- [x] Payment history

### Admin Features
- [x] Admin dashboard with statistics
- [x] Driver stats and management
- [x] Driver account activation/deactivation
- [x] **Client database with search** ✅
- [x] **Client ride history** ✅
- [x] **Invoice generation per ride** ✅
- [x] **Expiring documents overview** ✅ NEW

### Driver Features
- [x] Driver dashboard with earnings
- [x] Hide/show earnings toggle
- [x] Vehicle & document management
- [x] Waze/Google Maps integration
- [x] **Expanded document system (11 types)** ✅
- [x] **Document progress tracking** ✅
- [x] **Document expiry date tracking** ✅ NEW
- [x] **Expiry notifications and alerts** ✅ NEW

### Rating System
- [x] Star ratings with comments

## Test Accounts
- Passenger: passenger@test.com / password
- Driver: driver@test.com / password
- Admin: admin@volttaxi.com / admin123

## Session Accomplishments (2025-03-01)

### 1. Saved Cards Feature ✅
- Stripe SetupIntent integration
- Card management in user profile
- Pay with saved card (one-click)

### 2. Intermediate Stops Feature ✅
- Add up to 3 waypoints in trips
- Distance calculated via all points
- +3€ supplement per stop

### 3. Admin Client Database ✅
- Client list with search/pagination
- Client details with ride history
- Invoice generation for each ride

### 4. Expanded Driver Documents ✅
- 11 document types across 4 categories
- Upload with validation

### 5. Document Expiry Notifications ✅ NEW
- Expiry date input when uploading documents
- Visual badges for expiring/expired documents
- Alert banner showing documents to renew
- API endpoints for expiry tracking:
  - `GET /api/drivers/documents/expiring` - Driver's expiring docs
  - `GET /api/admin/documents/expiring` - All drivers' expiring docs

## Document Types with Expiry
```
Documents with expiry date required:
- Assurance Véhicule ✓
- Contrôle Technique ✓
- Permis de Conduire ✓
- Carte VTC ✓
- Carte Nationale d'Identité ✓
- RC Professionnelle ✓
- Attestation URSSAF ✓

Documents without expiry:
- Carte Grise
- Justificatif de Domicile
- KBIS
- RIB
```

## Expiry Alert System
- **Expired**: Red alert, document needs immediate renewal
- **Expiring soon (30 days)**: Orange warning
- Alert banner at top of documents page
- Admin can view all expiring documents across drivers

## Backlog

### P2 - Medium Priority
1. **Scheduled rides UI enhancement**
2. **Wallet/credit system** for passengers
3. **Email notifications for expiry** (SMTP)

### P3 - Future
4. **Mobile App Conversion** - Capacitor for iOS/Android
5. **Export statistics** - CSV/PDF for admin
6. **Multi-language support**

## Stripe Test Card
- Number: 4242 4242 4242 4242
- Exp: 12/34
- CVC: 123

## Last Updated
2025-03-01 - Document expiry notifications completed
