---
name: Capacitor Android setup
description: How Capacitor 6 was added to artifacts/trade-backtest and key gotchas for future changes.
---

## What was done

Capacitor 6 added to `artifacts/trade-backtest/` to wrap the Vite/React app as an Android APK.

- `@capacitor/core@6`, `@capacitor/android@6` (deps), `@capacitor/cli@6` (devDep)
- `capacitor.config.ts` at package root — appId `com.tradelab.app`, webDir `dist/public`, androidScheme `https`
- `android/` — full Capacitor Android Gradle project

## Key gotcha: Capacitor 8 CLI requires Node 22

Replit runs Node 20. `@capacitor/cli@8` throws `[fatal] The Capacitor CLI requires NodeJS >=22.0.0`. Use Capacitor **6** (supports Node ≥ 18).

## Key gotcha: cap CLI fails on pnpm (missing `tar` module)

Even with Capacitor 6, running `npx cap add android` inside the pnpm workspace fails:
```
[fatal] Cannot find module 'tar'
```
`tar` is a dep of `@capacitor/cli` but pnpm doesn't hoist it. Workaround: extract the template archive directly with the system `tar`:

```bash
# Extract Android project template
tar -xzf node_modules/.pnpm/@capacitor+cli@6.2.1/.../assets/android-template.tar.gz \
    -C android/

# Extract cordova-plugins sub-project template (extracts as src/ — move it)
tar -xzf .../assets/capacitor-cordova-android-plugins.tar.gz -C android/
mkdir -p android/capacitor-cordova-android-plugins
mv android/src android/capacitor-cordova-android-plugins/src
```

## Files that cap sync normally generates (created manually)

These are regenerated each time `cap sync` runs but must exist for Gradle to compile:

- `android/capacitor.settings.gradle` — includes `:capacitor-android` pointing at `../node_modules/@capacitor/android/capacitor`
- `android/app/capacitor.build.gradle` — sets Java 17 compile options, no plugins
- `android/capacitor-cordova-android-plugins/build.gradle` — empty Cordova plugin library
- `android/capacitor-cordova-android-plugins/cordova.variables.gradle` — empty ext block
- `android/app/src/main/assets/capacitor.config.json` — runtime copy of capacitor.config.ts

**Why:** Gradle fails at configure time if these files are absent, even before any Java compilation.

## App ID customisation after template extraction

Files that need the default `com.getcapacitor.myapp` / `com.getcapacitor.app` replaced:
- `android/app/build.gradle` — `namespace` and `applicationId`
- `android/app/src/main/res/values/strings.xml` — `app_name`, `package_name`, `custom_url_scheme`
- `android/app/src/main/java/…/MainActivity.java` — package declaration + move to correct directory
- Test files under `src/androidTest/` and `src/test/`

## VITE_API_BASE_URL is mandatory for Android builds

The WebView loads from `https://localhost` — relative URLs don't reach the Railway API.
The build script (`scripts/build-android.sh`) reads `.env.android.local` (git-ignored) and
aborts if `VITE_API_BASE_URL` is not set.

## How to apply (on a local machine with Java/Android SDK)

```bash
cp .env.android .env.android.local
# edit .env.android.local: set VITE_API_BASE_URL=https://your-app.up.railway.app
bash scripts/build-android.sh    # build + cap sync
npx cap open android              # open Android Studio
```
