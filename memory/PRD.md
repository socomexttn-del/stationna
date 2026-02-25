# Volt Taxi - PRD (Product Requirements Document)

## Original Problem Statement
Application de taxi complète avec passagers et chauffeurs, géolocalisation, estimation prix, suivi temps réel, historique, notation/avis, paiement Stripe, authentification JWT.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python) 
- **Database**: MongoDB
- **Payment**: Stripe via emergentintegrations
- **Auth**: JWT (email/password)

## User Personas
1. **Passager**: Utilisateur qui réserve des courses
2. **Chauffeur**: Conducteur qui accepte et effectue les courses

## Core Requirements (Static)
- Authentification JWT (inscription/connexion)
- Deux rôles: passager et chauffeur
- Réservation de course avec adresses
- Estimation du prix basée sur la distance
- Acceptation/refus de course par chauffeur
- Cycle complet: pending → accepted → in_progress → completed
- Paiement Stripe après course
- Système de notation mutuel
- Historique des courses

## What's Been Implemented (Jan 2026)
- ✅ Landing page avec hero section et CTAs
- ✅ Page d'authentification (login/register)
- ✅ Dashboard passager avec formulaire de réservation
- ✅ Dashboard chauffeur avec stats et gestion disponibilité
- ✅ Estimation de tarif en temps réel
- ✅ Création et gestion des courses
- ✅ Acceptation de course par chauffeur
- ✅ Démarrage et complétion de course
- ✅ Intégration paiement Stripe
- ✅ Système de notation
- ✅ Historique des courses
- ✅ Page profil avec gestion véhicule
- ✅ Design theme "Nocturnal Velocity"

## Prioritized Backlog

### P0 - Critical (Next Phase)
- Intégration carte interactive (Mapbox/Google Maps)
- Géolocalisation réelle du chauffeur
- Notifications push en temps réel (WebSocket)

### P1 - Important
- Recherche d'adresses avec autocomplétion
- Suivi GPS du chauffeur sur la carte
- Chat in-app passager/chauffeur
- Historique des paiements détaillé

### P2 - Nice to Have
- Mode sombre/clair toggle
- Courses planifiées (réservation à l'avance)
- Favoris d'adresses
- Parrainage et codes promo
- Support multi-langues

## Next Tasks
1. Intégrer une API de cartographie (Mapbox recommandé)
2. Ajouter WebSocket pour updates temps réel
3. Implémenter l'autocomplétion d'adresses
4. Ajouter le tracking GPS chauffeur
