import type { CapacitorConfig } from '@capacitor/cli';
import { readFileSync } from 'node:fs';

// Identité lue dans src/brand/brands.json (un seul endroit à modifier).
const { appId, productName } = JSON.parse(readFileSync('src/brand/brands.json', 'utf8')).second;

const config: CapacitorConfig = {
  appId,
  appName: productName,
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
