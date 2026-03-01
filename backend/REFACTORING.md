# Backend Refactoring Guide

## Current State
The `server.py` file contains 3000+ lines and needs to be refactored into a modular structure.

## Target Structure
```
/app/backend/
├── server.py          # Main app entry point (minimal)
├── config.py          # ✅ Created - Settings & constants
├── database.py        # ✅ Created - MongoDB connection
├── models/            # ✅ Created - Pydantic schemas
│   ├── user.py
│   ├── ride.py
│   ├── payment.py
│   └── chat.py
├── routers/           # 🔄 In Progress - API endpoints
│   ├── auth.py        # ✅ Created
│   ├── users.py       # ✅ Created
│   ├── drivers.py     # TODO
│   ├── rides.py       # TODO
│   ├── payments.py    # TODO
│   ├── wallet.py      # TODO
│   ├── admin.py       # TODO
│   ├── chat.py        # TODO
│   └── promo.py       # TODO
├── services/          # ✅ Created - Business logic
│   ├── auth.py
│   ├── fare.py
│   └── notifications.py
└── utils/             # ✅ Created - Helpers
```

## Migration Steps

### Phase 1: Models (DONE)
- Extract Pydantic models to `/models/`
- Import from models in server.py

### Phase 2: Services (DONE)
- Extract business logic to `/services/`
- Auth, fare calculation, notifications

### Phase 3: Routers (TODO)
For each router:
1. Create the router file
2. Move endpoints from server.py
3. Update imports in server.py
4. Test thoroughly

Order of migration:
1. auth.py (simple, few dependencies)
2. users.py
3. drivers.py
4. rides.py (complex, many dependencies)
5. payments.py
6. wallet.py
7. admin.py
8. chat.py
9. promo.py

### Phase 4: Final Cleanup
- Remove duplicate code from server.py
- Update all imports
- Final testing

## Backup
Original server.py backed up to `server_backup.py`

## Testing After Each Change
```bash
# Restart backend
sudo supervisorctl restart backend

# Test login
curl -X POST https://[url]/api/auth/login -H "Content-Type: application/json" -d '{"email":"passenger@test.com","password":"password"}'
```
