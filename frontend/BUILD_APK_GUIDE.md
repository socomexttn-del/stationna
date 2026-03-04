# Guide de Construction APK Android - Allogo

## Pourquoi le build ne fonctionne pas ici ?
Le serveur Emergent utilise une architecture ARM64, mais les outils de build Android (AAPT2) ne sont disponibles que pour x86_64.

## Solution : Construire sur votre machine ou via un service

### Option 1 : Sur votre machine Windows/Mac/Linux

**Prérequis :**
1. Node.js v18+ : https://nodejs.org
2. Android Studio : https://developer.android.com/studio
3. Java JDK 17

**Étapes :**
```bash
# 1. Téléchargez le code depuis Emergent (bouton "Download Code")

# 2. Dans le terminal, allez dans le dossier frontend
cd frontend

# 3. Installez les dépendances
npm install

# 4. Construisez l'application web
npm run build

# 5. Synchronisez avec Android
npx cap sync android

# 6. Ouvrez dans Android Studio
npx cap open android

# 7. Dans Android Studio :
#    - Build > Build Bundle(s) / APK(s) > Build APK(s)
#    - L'APK sera dans : android/app/build/outputs/apk/debug/app-debug.apk
```

### Option 2 : Demander à quelqu'un

Si vous connaissez un développeur, donnez-lui :
1. Le code téléchargé depuis Emergent
2. Ce fichier d'instructions

### Option 3 : Service en ligne (GitHub Actions)

1. Créez un compte GitHub
2. Uploadez le code
3. Utilisez GitHub Actions pour builder automatiquement

## Fichiers importants déjà configurés
- `android/app/google-services.json` ✅ Firebase
- `capacitor.config.ts` ✅ Configuration Capacitor
- `build/` ✅ Application web compilée

## Test de l'application (sans APK)
L'application fonctionne déjà en version web sur mobile :
https://taxi-connect-47.preview.emergentagent.com

Ouvrez ce lien sur votre smartphone pour tester !
