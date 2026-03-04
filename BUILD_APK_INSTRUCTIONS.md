# Instructions pour construire l'APK Android - Allogo

## Option 1: Via Emergent (quand le problème sera résolu)
```bash
cd /app/frontend
rm -rf build
CI=false yarn build
npx cap sync android
# L'APK sera disponible après build Android Studio
```

## Option 2: Sur votre machine locale

### Prérequis
1. **Node.js v18+**: https://nodejs.org
2. **Android Studio**: https://developer.android.com/studio
3. **Java JDK 17**

### Étapes
1. Téléchargez le code depuis Emergent (bouton "Download Code")
2. Ouvrez un terminal dans le dossier `frontend`
3. Exécutez:
```bash
npm install
npm run build
npx cap sync android
npx cap open android
```
4. Dans Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)
5. APK généré dans: `android/app/build/outputs/apk/debug/app-debug.apk`

## Configuration Firebase (déjà faite)
- `android/app/google-services.json` ✅
- `capacitor.config.ts` configuré ✅

## Contact Support Emergent
- Discord: https://discord.gg/VzKfwCXC4A
- Email: support@emergent.sh
