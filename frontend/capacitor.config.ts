import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Unique app ID — matches Play Store / App Store bundle identifier
  appId: 'com.quantdesk.terminal',
  appName: 'QuantDesk',

  // Capacitor reads the built web assets from this folder
  webDir: 'dist',

  // ── Android ──────────────────────────────────────────────────────────────
  android: {
    allowMixedContent: true,  // Allow http:// API calls during dev
    captureInput: true,
    webContentsDebuggingEnabled: true,  // Chrome DevTools remote debug
  },

  // ── iOS ──────────────────────────────────────────────────────────────────
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
  },

  // ── Server ───────────────────────────────────────────────────────────────
  // During development you can live-reload from your machine's IP.
  // Comment this out for production builds.
  server: {
    // url: 'http://192.168.x.x:5173',  // Uncomment + set your LAN IP for live reload
    cleartext: true,  // Allow plain http (dev only)
    androidScheme: 'https',
  },

  // ── Plugins ──────────────────────────────────────────────────────────────
  plugins: {
    // Secure token storage (replaces localStorage for auth tokens)
    Preferences: {},

    // Status bar styling
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0a0e1a',
    },

    // Splash screen
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0a0e1a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
