# Guide de Refactorisation Backend StationCab

## Structure Actuelle
Le backend est actuellement dans un seul fichier `server.py` (6700+ lignes).

## Structure Cible

```
/app/backend/
├── server.py              # Point d'entrée principal (réduit)
├── core/
│   ├── __init__.py
│   ├── config.py          # ✅ Configuration (créé)
│   ├── database.py        # ✅ Connexion MongoDB (créé)
│   └── security.py        # ✅ Auth JWT, hashing (créé)
├── models/
│   ├── __init__.py
│   └── schemas.py         # ✅ Modèles Pydantic (créé)
├── routers/
│   ├── __init__.py
│   ├── auth.py            # Routes /api/auth/*
│   ├── users.py           # Routes /api/users/*
│   ├── rides.py           # Routes /api/rides/*
│   ├── payments.py        # Routes /api/payments/*
│   ├── admin.py           # Routes /api/admin/*
│   ├── chat.py            # Routes /api/chat/*
│   ├── notifications.py   # Routes push/FCM
│   └── drivers.py         # Routes /api/drivers/*
├── services/
│   ├── __init__.py
│   ├── celery_app.py      # ✅ Config Celery (créé)
│   ├── tasks.py           # ✅ Tâches background (créé)
│   ├── email.py           # Service email SMTP
│   ├── notifications.py   # Service notifications
│   └── stripe.py          # Service paiements
└── tests/
    └── test_api.py        # Tests existants
```

## Migration Progressive

### Phase 1 (Actuel) ✅
- Créer la structure de dossiers
- Créer les fichiers core/ et models/
- Créer les services Celery (prêts à être activés)

### Phase 2 (À faire)
- Extraire les services (email, notifications, stripe) dans /services
- Tester que l'import fonctionne

### Phase 3 (À faire)
- Extraire les routes une par une dans /routers
- Commencer par les plus simples (auth, users)
- Garder server.py fonctionnel à chaque étape

### Phase 4 (À faire)
- Réduire server.py au minimum (imports + app setup)
- Supprimer le code dupliqué

## Comment activer Celery

1. **Installer Redis**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

2. **Ajouter les dépendances**
```bash
pip install celery redis
```

3. **Configurer REDIS_URL dans .env**
```
REDIS_URL=redis://localhost:6379/0
```

4. **Démarrer le worker Celery**
```bash
cd /app/backend
celery -A services.celery_app worker --loglevel=info
```

5. **Démarrer le scheduler (optionnel)**
```bash
celery -A services.celery_app beat --loglevel=info
```

## Notes
- Ne jamais casser la production pendant la migration
- Tester chaque changement avant de passer au suivant
- Garder les tests fonctionnels

## Dernière mise à jour
20 Juin 2025
