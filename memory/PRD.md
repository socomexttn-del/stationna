# Allogo - Application Taxi PRD

## Problème Original
Application taxi complète "Allogo" avec support multi-rôles (Passager, Chauffeur, Admin), fonctionnalités temps réel, cycle de vie complet des courses, GPS, chat in-app, paiements Stripe, et tarifs réglementés parisiens.

## Architecture Technique
- **Backend**: FastAPI + MongoDB (motor) + JWT
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + i18next
- **Mobile**: Capacitor (Android/iOS)
- **Paiements**: Stripe
- **Cartes**: Mapbox
- **Emails**: Resend
- **Push Notifications**: Firebase Cloud Messaging (FCM)

## Fonctionnalités Implémentées

### ✅ Authentification
- JWT-based login/register pour passagers, chauffeurs, admin
- Gestion des sessions

### ✅ Courses (Rides)
- Réservation immédiate et programmée
- Types: VTC (Standard/Van) et Taxis réglementés
- Calcul de tarifs avec tarifs aéroport forfaitaires
- Arrêts intermédiaires
- Cycle complet: pending → accepted → arrived → in_progress → completed

### ✅ Chauffeurs
- Dashboard avec gestion disponibilité
- Système de documents avec expiration
- Localisation GPS temps réel
- Notification de nouvelles courses

### ✅ Passagers
- Dashboard de réservation
- Suivi en temps réel du chauffeur
- Historique des courses
- Export PDF

### ✅ Admin
- Statistiques
- Gestion des codes promo
- Alertes documents expirés
- Base clients

### ✅ Paiements (Stripe)
- Paiement one-time
- Cartes sauvegardées
- Portefeuille avec bonus

### ✅ Push Notifications (Firebase) - NOUVEAU 01/03/2026
- Firebase Admin SDK intégré au backend
- Endpoints FCM pour enregistrement tokens
- Notifications automatiques lors des événements de course
- Support Capacitor pour notifications natives Android/iOS

## Fichiers Clés
- `/app/backend/server.py` - Backend principal (monolithe actif)
- `/app/backend/services/firebase_service.py` - Service FCM
- `/app/backend/firebase-credentials.json` - Credentials Firebase
- `/app/frontend/src/services/pushNotifications.js` - Service push frontend
- `/app/frontend/src/hooks/usePushNotifications.js` - Hook notifications
- `/app/frontend/capacitor.config.ts` - Config Capacitor
- `/app/frontend/android/app/google-services.json` - Config Firebase Android

## Credentials Test
- Admin: admin@volttaxi.com / admin123
- Passager: passenger@test.com / password
- Chauffeur: driver@test.com / password

## Backlog Priorité

### P0 - Critique
- [x] Intégration Firebase Push Notifications

### P1 - Important
- [ ] Tester APK Android avec vraies notifications
- [ ] Finaliser refactoring backend (activer main.py)
- [ ] Vérifier estimation tarifs aéroport

### P2 - Normal
- [ ] Stabilité build frontend
- [ ] Tests automatisés Pytest
- [ ] Couverture i18n complète

## Notes Techniques
- AppId Capacitor: `com.allogo.app`
- Firebase Project: `allogo-43fd4`
- Sender ID: `1003171734817`
