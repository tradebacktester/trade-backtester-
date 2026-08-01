# Trade Lab — Android Setup Guide

This guide walks you through building and running the Trade Lab Android app from this repo.  The Android project lives in `artifacts/trade-backtest/android/` and is managed by [Capacitor 6](https://capacitorjs.com/docs).

---

## How it works

```
Vite build  →  dist/public/   →  cap sync  →  android/app/src/main/assets/public/
                                                       ↓
                                              Android Studio / Gradle
                                                       ↓
                                              APK / Play Store bundle
```

The WebView loads the bundled web app. All API calls go to your Railway backend over HTTPS — **there is no localhost backend on the device**.

---

## Prerequisites (your local machine)

| Tool | Version | How to get it |
|------|---------|---------------|
| Node.js | ≥ 18 LTS | [nodejs.org](https://nodejs.org) |
| pnpm | any | `npm i -g pnpm` |
| Java JDK | 17 | Android Studio installs it, or [adoptium.net](https://adoptium.net) |
| Android Studio | Hedgehog+ | [developer.android.com/studio](https://developer.android.com/studio) |
| Android SDK Platform | 34 | Android Studio → SDK Manager |
| Android Build Tools | 34.x | Android Studio → SDK Manager |

> **Replit note:** Java and Android SDK are not available in the Replit environment. Clone the repo and run the steps below on your local machine.

---

## Step 1 — Clone and install

```bash
git clone <your-repo-url>
cd <repo>
pnpm install
```

---

## Step 2 — Configure the Railway API URL

The WebView cannot use relative URLs — it needs the full Railway backend URL.

```bash
# Create your local override (git-ignored)
cp artifacts/trade-backtest/.env.android artifacts/trade-backtest/.env.android.local
```

Edit `.env.android.local`:

```env
VITE_API_BASE_URL=https://your-app.up.railway.app
```

---

## Step 3 — Build and sync

```bash
cd artifacts/trade-backtest
bash scripts/build-android.sh
```

This script:
1. Loads `VITE_API_BASE_URL` from `.env.android.local`
2. Runs `pnpm run build` (Vite production build)
3. Runs `cap sync android` — copies the bundle into the Android project and updates plugins

---

## Step 4 — Open in Android Studio

```bash
npx cap open android
# or from the trade-backtest directory:
pnpm run cap:open
```

Android Studio will prompt you to sync Gradle. Accept it.  First sync takes a few minutes.

---

## Step 5 — Run on a device or emulator

- **Physical device:** Enable Developer Options → USB Debugging, plug in, then click ▶ Run in Android Studio.
- **Emulator:** Create a Pixel AVD (API 34) in Android Studio → Device Manager, then click ▶ Run.

---

## Building a release APK

### Create a keystore (one-time)

```bash
keytool -genkey -v -keystore release.keystore \
  -alias tradelab \
  -keyalg RSA -keysize 2048 -validity 10000
```

Store `release.keystore` somewhere safe (not in git).

### Sign via Gradle

Create `android/keystore.properties` (git-ignored):

```properties
storeFile=../../release.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=tradelab
keyPassword=YOUR_KEY_PASSWORD
```

Then add this to `android/app/build.gradle` inside `android { }`:

```groovy
signingConfigs {
    release {
        def keystorePropertiesFile = rootProject.file("keystore.properties")
        def keystoreProperties = new Properties()
        keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

Build the APK:

```bash
cd android
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

---

## Live-reload during development

To point the WebView at your local Vite dev server (no rebuild needed after every change):

1. Find your machine's LAN IP (`ifconfig` / `ipconfig`).
2. In `capacitor.config.ts`, uncomment and fill in:
   ```ts
   server: {
     url: "http://192.168.1.100:5000",
     cleartext: true,
   }
   ```
3. In `android/app/src/main/res/xml/network_security_config.xml`, uncomment the `<domain-config>` block and set your IP.
4. Run `pnpm run cap:sync` (copies updated config) then re-run on device.
5. **Revert both files before building a release.**

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank white screen | Check `VITE_API_BASE_URL` is set and the Railway server is running |
| Network request failed | Verify `network_security_config.xml` — production builds must use HTTPS |
| `cap sync` not found | Run `pnpm install` first; CLI is a devDependency |
| Gradle sync fails | Make sure Android Studio downloaded SDK Platform 34 + Build Tools 34.x |
| App crashes on launch | Run `adb logcat` and look for Java exceptions |

---

## Project structure

```
artifacts/trade-backtest/
├── android/                   # Capacitor-managed Android project
│   ├── app/
│   │   └── src/main/
│   │       ├── java/com/tradelab/app/MainActivity.java
│   │       ├── res/
│   │       │   ├── values/strings.xml        ← app name
│   │       │   └── xml/network_security_config.xml
│   │       └── AndroidManifest.xml
│   ├── build.gradle
│   └── variables.gradle
├── capacitor.config.ts        ← Capacitor settings (webDir, scheme, etc.)
├── .env.android               ← committed template (safe — no secrets)
├── .env.android.local         ← your local overrides (git-ignored)
└── scripts/build-android.sh   ← one-command build + sync
```
