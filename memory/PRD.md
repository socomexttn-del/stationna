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

### Driver Features
- [x] Driver dashboard with earnings
- [x] Hide/show earnings toggle
- [x] Vehicle & document management
- [x] Waze/Google Maps integration
- [x] **Expanded document system (11 types)** ✅ NEW
  - Documents Véhicule: Carte Grise, Assurance, Contrôle Technique
  - Documents Personnels: Permis, CNI, Justificatif Domicile
  - Documents Professionnels: Carte VTC, RC-Pro, KBIS, Attestation URSSAF
  - Documents Financiers: RIB
- [x] **Document progress tracking** ✅ NEW
- [x] **Document status (pending/approved/rejected)** ✅ NEW

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
- Print/PDF export

### 4. Expanded Driver Documents ✅ NEW
- 11 document types across 4 categories
- Upload with validation (JPG, PNG, PDF, max 5MB)
- Progress bar showing completion %
- Document preview modal
- Delete/re-upload functionality
- Status tracking (pending/approved/rejected)

## Document Types
```
Vehicle Documents (Required):
- carte_grise: Carte Grise
- assurance: Assurance Véhicule  
- controle_technique: Contrôle Technique

Personal Documents (Required):
- permis_conduire: Permis de Conduire
- cni: Carte Nationale d'Identité
- justificatif_domicile: Justificatif de Domicile

Professional Documents:
- carte_vtc: Carte VTC (Required)
- rc_pro: RC Professionnelle (Required)
- kbis: Extrait KBIS (Optional)
- attestation_vigilance: Attestation URSSAF (Optional)

Financial Documents (Required):
- rib: RIB
```

## API Endpoints Added This Session
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

# Driver Documents
GET /api/drivers/documents/status
DELETE /api/drivers/documents/{doc_type}
```

## Backlog

### P2 - Medium Priority
1. **Scheduled rides UI enhancement**
2. **Wallet/credit system** for passengers
3. **Document expiry notifications**

### P3 - Future
4. **Mobile App Conversion** - Capacitor for iOS/Android
5. **Export statistics** - CSV/PDF for admin
6. **Multi-language support**

## Stripe Test Card
- Number: 4242 4242 4242 4242
- Exp: 12/34
- CVC: 123

## Last Updated
2025-03-01 - Expanded driver documents completed
