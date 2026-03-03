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

### ✅ Courses (Rides)
- Réservation immédiate et programmée
- Types: VTC (Standard/Van) et Taxis réglementés
- Calcul de tarifs avec tarifs aéroport forfaitaires
- Arrêts intermédiaires (sans supplément, prix sur itinéraire total)
- Cycle complet: pending → accepted → arrived → in_progress → completed

### ✅ Chauffeurs
- Dashboard avec gestion disponibilité
- Système de documents avec expiration
- Localisation GPS temps réel
- Notification de nouvelles courses
- Bouton rafraîchir

### ✅ Passagers
- Dashboard de réservation
- Suivi en temps réel du chauffeur
- Historique des courses
- Export PDF
- Favoris pour courses planifiées
- Bouton rafraîchir

### ✅ Admin
- Statistiques
- Gestion des codes promo
- Alertes documents expirés
- Base clients avec bouton retour

### ✅ Paiements (Stripe)
- Paiement one-time
- Cartes sauvegardées
- Portefeuille avec bonus

### ✅ Push Notifications (Firebase)
- Firebase Admin SDK intégré au backend
- Endpoints FCM pour enregistrement tokens
- Notifications automatiques lors des événements de course

## Modifications Récentes (03/03/2026)

1. **Suppression frais arrêts intermédiaires** - Plus de +3€ par arrêt
2. **Tarif Taxi simplifié** - Affiche seulement "Tarif A, B ou C"
3. **Boutons réservation simplifiés** - Retiré "+4€ immédiat"
4. **Favoris courses planifiées** - Boutons cliquables ajoutés
5. **Bouton rafraîchir** - Ajouté sur PassengerDashboard et DriverDashboard
6. **Bouton retour Admin Clients** - Navigation vers /admin

## Fichiers Clés
- `/app/backend/server.py` - Backend principal
- `/app/backend/services/firebase_service.py` - Service FCM
- `/app/frontend/src/pages/PassengerDashboard.js` - Dashboard passager
- `/app/frontend/src/pages/DriverDashboard.js` - Dashboard chauffeur
- `/app/frontend/src/pages/AdminClientsPage.js` - Base clients admin
- `/app/frontend/src/pages/ScheduledRidesPage.js` - Courses planifiées
- `/app/frontend/src/components/IntermediateStops.js` - Arrêts intermédiaires

## Credentials Test
- Admin: admin@volttaxi.com / admin123
- Passager: passenger@test.com / password
- Chauffeur: driver@test.com / password

## Backlog Priorité

### P0 - Critique
- [x] Intégration Firebase Push Notifications
- [ ] Tester APK Android avec vraies notifications

### P1 - Important
- [ ] Bug envoi commentaire fin de course
- [ ] Finaliser refactoring backend (activer main.py)

### P2 - Normal
- [ ] Stabilité build frontend
- [ ] Tests automatisés Pytest

## Notes Techniques
- AppId Capacitor: `com.allogo.app`
- Firebase Project: `allogo-43fd4`
