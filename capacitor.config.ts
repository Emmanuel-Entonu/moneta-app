import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moneta.trading',
  appName: 'Moneta',
  webDir: 'dist',
  server: {
    url: 'https://moneta-app-ten.vercel.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
