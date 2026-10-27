import type { CapacitorConfig } from '@capacitor/cli';
import { readFileSync } from 'node:fs';

// Identité lue dans src/brand/brands.json (un seul endroit à modifier).
const brands = JSON.parse(readFileSync('src/brand/brands.json', 'utf8'));
const { appId, productName } = Object.values(brands)[0] as { appId: string; productName: string };

const config: CapacitorConfig = {
  appId,
  appName: productName,
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0a6742',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false
    }
  }
};

export default config;
