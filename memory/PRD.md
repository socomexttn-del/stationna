# StationCab - Application Taxi PRD

## Problème Original
Application taxi complète "StationCab" avec support multi-rôles (Passager, Chauffeur, Admin), fonctionnalités temps réel, cycle de vie complet des courses, GPS, chat in-app, paiements Stripe, et tarifs réglementés parisiens.

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
- Calcul de tarifs avec tarifs aéroport forfaitaires (direct uniquement)
- Arrêts intermédiaires (sans supplément, prix sur itinéraire total)
- **Forfait aéroport**: Seulement pour trajets DIRECTS (pas d'arrêts)
- Cycle complet: pending → accepted → arrived → in_progress → completed

### ✅ Courses Planifiées (NEW 03/03/2026)
- Création avec statut "scheduled"
- Background task vérifie chaque minute
- Proposition aux chauffeurs 15 min avant l'heure prévue
- Badge orange "Course réservée à l'avance" dans le dashboard chauffeur
- Notification spéciale `scheduled_ride_available`

### ✅ Chauffeurs
- Dashboard avec gestion disponibilité
- Système de documents avec expiration
- Localisation GPS temps réel
- Notification de nouvelles courses (immédiates + planifiées)
- Bouton rafraîchir

### ✅ Passagers
- Dashboard de réservation
- Suivi en temps réel du chauffeur
- Historique des courses
- Export PDF
- Favoris pour courses planifiées
- Bouton rafraîchir
- Tarifs affichés: A/B/C sans jour/nuit/dimanche

### ✅ Admin
- Statistiques
- Gestion des codes promo
- Alertes documents expirés
- Base clients avec bouton retour
- Gestion courses planifiées (`GET/POST /api/admin/scheduled-rides`)
- **Gestion types véhicules chauffeurs** - Page `/admin/drivers` avec 3 toggles indépendants (VTC, Van, Taxi)

### ✅ Paiements (Stripe)
- Paiement one-time
- Cartes sauvegardées
- Portefeuille avec bonus

### ✅ Push Notifications (Firebase)
- Firebase Admin SDK intégré au backend
- Endpoints FCM pour enregistrement tokens
- Notifications automatiques lors des événements de course

## Modifications Récentes (18/06/2026)

### Session 2 - Corrections P0 Dashboard Chauffeur

1. **UI Dashboard Chauffeur - Boutons en haut** :
   - Réorganisation de la carte "Course active" pour mettre les boutons d'action EN PREMIER
   - Ordre: Boutons d'action → Navigation (Waze/GMaps) → Prix → Passager → Adresses → Bon de réservation
   - Le chauffeur n'a plus besoin de scroller pour accéder aux boutons "Je suis arrivé", "Démarrer", "Terminer"
   - Tests validés: boutons visibles dans viewport 390x844 sans scroll

2. **Bug Annulation Passager - Corrigé** :
   - Ajout de `prevActiveRideRef` dans DriverDashboard pour détecter quand une course disparaît
   - Si le passager annule une course acceptée/arrivée/en_progress, le chauffeur voit:
     - Toast "⚠️ Course annulée par le client"
     - Son de notification
     - Remise en disponibilité automatique
   - Backend: endpoint `/api/rides/{id}/cancel` amélioré avec notifications Firebase
   - Le chauffeur ne crash/déconnecte plus lors d'une annulation passager

### Session 1 - Flux de course et paiements

1. **Correction du flux de course complet** :
   - Ajout du statut "arrived" (chauffeur arrivé)
   - Flux : pending → accepted → arrived → in_progress → completed
   - Chauffeur : Boutons séparés "Je suis arrivé", "Démarrer la course", "Terminer la course"
   - Client : Affichage clair de chaque étape (en route → arrivé → course en cours → terminée)

2. **Notification sonore limitée à 3 fois** :
   - Son de notification joué maximum 3 fois pour éviter d'être trop insistant

3. **Paiement automatique avec carte enregistrée** :
   - Client enregistre sa carte une seule fois
   - Paiement automatique à chaque réservation
   - Pas de redirection vers Stripe à chaque course

## Modifications (15/06/2026)

1. **NOUVEAU - CGV et Mentions Légales** :
   - Page Mentions Légales (`/mentions-legales`) avec infos complètes A&S Prestige
   - Page CGV (`/cgv`) avec 11 articles détaillés (annulation, remboursement, tarifs)
   - Case à cocher obligatoire pour inscription passagers
   - Case à cocher obligatoire pour inscription chauffeurs (CGV + Mentions Légales)
   - Liens dans le footer de la landing page
   - Copyright "A&S Prestige SASU" dans le footer

2. **NOUVEAU - Standards de Qualité Chauffeurs** :
   - Texte complet des 6 articles des Standards de Qualité StationCab
   - Affiché dans une zone scrollable à l'étape "Vérification"
   - Case à cocher obligatoire séparée pour accepter les Standards
   - Le chauffeur ne peut pas soumettre sans accepter les deux (CGV + Standards)

3. **Calculateur de prix sur Landing Page** :
   - Autocomplétion d'adresses avec Mapbox
   - Affichage des prix pour VTC, Van, Taxi
   - Distance et durée estimées

## Modifications (13/06/2026)

1. **NOUVEAU - Refus de course avec réassignation** :
   - Endpoint POST `/api/rides/{ride_id}/refuse` pour refuser une course disponible
   - Le chauffeur qui refuse est ajouté à la liste `refused_by` de la course
   - La course disparaît de sa liste mais reste visible pour les autres chauffeurs
   - Après 5 secondes, le backend propose la course au prochain chauffeur le plus proche
   - Frontend: `dismissRide()` appelle maintenant l'API `/refuse`
   - Filtrage `refused_by.$nin` dans `/rides/available` pour exclure les courses refusées

## Modifications (06/03/2026)

1. **BUG CORRIGÉ - Filtrage courses par type véhicule** :
   - `find_nearest_driver()` reçoit maintenant le `vehicle_type`
   - `/rides/available` filtre les courses selon les types du chauffeur
   - Un chauffeur VAN ne voit plus les courses TAXI
   - Un chauffeur TAXI ne voit plus les courses VAN

2. **NOUVEAU - Réinitialisation mot de passe** :
   - Page `/forgot-password` pour demande par email
   - Email avec lien de réinitialisation (via Resend)
   - Page `/reset-password?token=xxx` pour créer nouveau MDP
   - Admin peut réinitialiser le MDP via `/admin/drivers`
   - Endpoint `/api/admin/reset-user-password`

## Modifications (05/03/2026)

1. **Passager - ETA vers destination** : Affichage du temps restant et distance pendant la course (in_progress)
2. **Chauffeur - Isolation des courses** : Un chauffeur avec une course active ne reçoit plus de nouvelles demandes
3. **Backend - Double protection** : Vérification avant accept_ride + filtrage dans get_available_rides
4. **Synchronisation état chauffeur** : L'état "en ligne" se met automatiquement à false quand course active

## Modifications (04/03/2026)

1. **Bug notation/commentaire CORRIGÉ** - Erreur ObjectId MongoDB résolue
2. **Reset état RatingModal** - Ajout useEffect pour réinitialiser à chaque ouverture
3. **Logs debugging ajoutés** - Console.log pour diagnostiquer les problèmes
4. **Build React terminé** - Dossier `build/` prêt pour déploiement mobile
5. **Configuration Android complète** - Capacitor, Firebase, google-services.json

## Modifications (03/03/2026)

1. **Suppression frais arrêts intermédiaires** - Plus de +3€ par arrêt
2. **Tarif Taxi simplifié** - Affiche seulement "Tarif A, B ou C"
3. **Boutons réservation simplifiés** - Retiré "+4€ immédiat"
4. **Favoris courses planifiées** - Boutons cliquables ajoutés
5. **Bouton rafraîchir** - Ajouté sur PassengerDashboard et DriverDashboard
6. **Bouton retour Admin Clients** - Navigation vers /admin
7. **Forfait aéroport** - Seulement pour trajets DIRECTS (sans arrêts)
8. **Courses planifiées** - Proposition aux chauffeurs 15 min avant
9. **Types véhicules chauffeurs (3 indépendants)** - VTC, Van, Taxi avec logique métier:
   - Course Van → uniquement chauffeurs avec "van"
   - Course Taxi → uniquement chauffeurs avec "taxi"
   - Course VTC → chauffeurs avec "vtc" OU "taxi" (car un taxi peut faire du VTC)

## Fichiers Clés
- `/app/backend/server.py` - Backend principal
- `/app/backend/services/firebase_service.py` - Service FCM
- `/app/frontend/src/pages/PassengerDashboard.js` - Dashboard passager
- `/app/frontend/src/pages/DriverDashboard.js` - Dashboard chauffeur
- `/app/frontend/src/pages/AdminClientsPage.js` - Base clients admin
- `/app/frontend/src/pages/AdminDriversPage.js` - Gestion types véhicules chauffeurs
- `/app/frontend/src/pages/ScheduledRidesPage.js` - Courses planifiées
- `/app/frontend/src/components/IntermediateStops.js` - Arrêts intermédiaires

## Credentials Test
- Admin: admin@volttaxi.com / admin123
- Passager: passenger@test.com / password
- Chauffeur: driver@test.com / password

## Backlog Priorité

### P0 - Critique
- [x] CGV et Mentions Légales avec case à cocher obligatoire (15/06/2026)
- [x] Calculateur de prix landing page avec autocomplétion et géolocalisation (15/06/2026)
- [x] Refus de course avec réassignation au prochain chauffeur après 5s (13/06/2026)
- [ ] Test notifications push Firebase sur appareil Android (APK via déploiement Emergent)

### P1 - Important  
- [ ] Finaliser refactoring backend (activer main.py) - 25 endpoints manquants dans routers modulaires
- [x] Vérifier ordre des arrêts intermédiaires - Vérifié OK, affichage ajouté dans BookingReceipt et DriverDashboard

### P2 - Normal
- [ ] Stabilité build frontend
- [ ] Tests automatisés Pytest
- [ ] Drag-and-drop pour réordonner arrêts
- [ ] Configuration Resend pour domaine stationcab.fr

### ✅ TERMINÉ
- [x] CGV et Mentions Légales complètes avec case obligatoire (15/06/2026)
- [x] Calculateur de prix landing page avec autocomplétion, géolocalisation et prix VTC/Van/Taxi (15/06/2026)
- [x] Refus de course avec réassignation (13/06/2026)

## Informations Légales (A&S Prestige)
- **Société**: A&S Prestige (SASU)
- **Capital**: 1 500 €
- **SIRET**: 827 808 866 00012
- **RCS**: Meaux
- **Adresse**: 9 rue Victor Baltard, 77410 Claye-Souilly
- **Email**: contact@stationcab.fr
- **TVA**: Non assujetti (Article 293B du CGI)
- **Hébergeur**: OVH SAS
- [x] Arrêts intermédiaires: ordre vérifié OK, affichage ajouté dans reçu et dashboard chauffeur (13/06/2026)
- [x] Tarifs aéroport: vérifiés conformes aux tarifs officiels 2025 (13/06/2026)
- [x] Bug notation/commentaire fin de course (04/03/2026)
- [x] Types véhicules chauffeurs VTC/Van/Taxi (03/03/2026)
- [x] Courses planifiées dispatch 15 min avant (03/03/2026)

## Notes Techniques
- AppId Capacitor: `com.stationcab.app`
- Firebase Project: `stationcab-43fd4`
- Scheduled rides checker: Runs every 60 seconds
- Rides proposed 15 minutes before scheduled_time (13-17 min window)
