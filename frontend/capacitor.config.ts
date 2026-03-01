import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.allogo.taxi',
  appName: 'Allogo',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      showSpinner: true,
      spinnerColor: '#facc15'
    },
    StatusBar: {
      backgroundColor: '#1a1a1a',
      style: 'DARK'
    }
  }
};

export default config;
