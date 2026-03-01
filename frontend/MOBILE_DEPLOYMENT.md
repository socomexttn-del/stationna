# Guide de Déploiement Mobile - Allogo

## Prérequis

### Pour Android
- Android Studio (2022.3.1+)
- JDK 17+
- Android SDK

### Pour iOS (Mac uniquement)
- Xcode 14+
- CocoaPods
- macOS 12+

## Installation

### 1. Installer les dépendances mobiles

```bash
cd frontend
yarn add @capacitor/android @capacitor/ios
```

### 2. Ajouter les plateformes

```bash
# Android
npx cap add android

# iOS (Mac uniquement)
npx cap add ios
```

### 3. Build et Sync

```bash
# Build le projet React
yarn build

# Synchroniser avec les projets natifs
npx cap sync
```

## Développement

### Android

```bash
# Ouvrir dans Android Studio
npx cap open android

# Ou lancer directement sur émulateur/device
npx cap run android
```

### iOS

```bash
# Ouvrir dans Xcode
npx cap open ios

# Ou lancer sur simulateur
npx cap run ios
```

## Configuration Supplémentaire

### Permissions Android

Ajoutez dans `android/app/src/main/AndroidManifest.xml` :

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.VIBRATE" />
```

### Permissions iOS

Ajoutez dans `ios/App/App/Info.plist` :

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Allogo a besoin de votre position pour vous localiser et trouver les chauffeurs à proximité.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Allogo utilise votre position pour le suivi en temps réel de votre course.</string>
```

## Workflow de Développement

1. Modifier le code React
2. `yarn build`
3. `npx cap sync`
4. Tester sur émulateur/device

## Plugins Capacitor Recommandés

```bash
# Géolocalisation
yarn add @capacitor/geolocation

# Notifications Push
yarn add @capacitor/push-notifications

# Vibration
yarn add @capacitor/haptics

# Stockage local
yarn add @capacitor/preferences

# Caméra (pour documents chauffeur)
yarn add @capacitor/camera
```

## Publication

### Google Play Store
1. Créer un compte développeur ($25 one-time)
2. Générer un keystore signé
3. Build APK/AAB signé depuis Android Studio
4. Upload sur Play Console

### Apple App Store
1. Créer un compte Apple Developer ($99/an)
2. Configurer les certificats dans Xcode
3. Archive et upload depuis Xcode
4. Soumettre pour review

## Support

Pour toute question, consultez la documentation Capacitor :
https://capacitorjs.com/docs
