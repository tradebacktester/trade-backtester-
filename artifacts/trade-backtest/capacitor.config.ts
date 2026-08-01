import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // ── Identity ────────────────────────────────────────────────────────────────
  appId: "com.tradelab.app",
  appName: "Trade Lab",

  // ── Web layer ────────────────────────────────────────────────────────────────
  // Points at the Vite production build.  Run `pnpm run build:android` to
  // (re)build with the correct VITE_API_BASE_URL before syncing.
  webDir: "dist/public",

  // ── Server / scheme ──────────────────────────────────────────────────────────
  server: {
    // `https` scheme ensures localStorage, cookies and JWT tokens behave
    // identically to a real HTTPS origin (required for same-site cookie flags).
    androidScheme: "https",

    // ── Live-reload (development only) ────────────────────────────────────────
    // Uncomment the line below during development so the WebView points at your
    // local Vite dev server instead of the bundled build.  Replace <YOUR_IP>
    // with the LAN IP of your dev machine (NOT localhost — that resolves to the
    // Android device itself).
    //
    //   url: "http://<YOUR_LOCAL_IP>:5000",
    //   cleartext: true,   // allow HTTP in dev
  },

  // ── Android-specific ────────────────────────────────────────────────────────
  android: {
    // Match the dark splash / near-black background of the web app
    backgroundColor: "#060606",

    // Allow mixed-content only if you absolutely must load HTTP resources.
    // Keep false for production (all API calls go to HTTPS Railway endpoint).
    allowMixedContent: false,

    // Build options — fill these in when you create a release keystore.
    // See ANDROID_SETUP.md for instructions.
    buildOptions: {
      // keystorePath: "release.keystore",
      // keystorePassword: "YOUR_KEYSTORE_PASSWORD",
      // keystoreAlias: "tradelab",
      // keystoreAliasPassword: "YOUR_KEY_PASSWORD",
      releaseType: "APK",
    },
  },

  // ── Plugin config ───────────────────────────────────────────────────────────
  plugins: {
    // SplashScreen is not added as a dep, but keep this block ready if you
    // add @capacitor/splash-screen later.
    // SplashScreen: {
    //   launchShowDuration: 1500,
    //   backgroundColor: "#060606",
    //   androidSplashResourceName: "splash",
    //   showSpinner: false,
    // },

    // CapacitorHttp — route all fetch/XHR through the native HTTP layer so
    // requests bypass the WebView's CORS sandbox.  This is the cleanest way
    // to hit your Railway API from within the Capacitor WebView.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
