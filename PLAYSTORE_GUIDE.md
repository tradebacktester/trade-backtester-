# Trade Lab — Play Store Publishing Guide

This guide walks you through the complete process: deploying the backend → building the Android app → submitting to Google Play.

---

## Overview

```
Step 1: Publish the Replit backend  →  get your production URL
Step 2: Update eas.json with that URL
Step 3: Create EAS account + run the build
Step 4: Submit the AAB to Google Play
```

---

## Step 1 — Publish the Replit Backend

The mobile app calls your Express API. You need a permanent public URL before building.

1. In Replit, click the **Publish** button (top-right of the workspace)
2. Choose **Autoscale** deployment
3. Wait for the build to finish — you'll get a URL like:
   ```
   https://tradelab.YOURNAME.replit.app
   ```
4. Copy that URL — you'll need it in Step 2

> **Note:** The deployment is already configured to run `bash scripts/start.sh` which builds everything and starts on port 5000.

---

## Step 2 — Wire the Production API URL

Open `artifacts/TradeLab/eas.json` and replace the placeholder:

```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://REPLACE_WITH_YOUR_REPLIT_APP_URL.replit.app"
}
```

Change it to your actual URL, e.g.:
```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://tradelab.yourname.replit.app"
}
```

---

## Step 3 — Create Accounts

### 3a. Expo (EAS) Account — Free
1. Go to https://expo.dev → **Sign Up**
2. Note your **username** — you'll need it below

### 3b. Google Play Developer Account — $25 one-time
1. Go to https://play.google.com/console
2. Pay the $25 registration fee
3. Complete identity verification (takes 1–2 days)

---

## Step 4 — Configure the App with Your Expo Account

Open `artifacts/TradeLab/app.json` and add your Expo username as `owner`:

```json
{
  "expo": {
    "owner": "YOUR_EXPO_USERNAME",
    ...
  }
}
```

Then link the project to EAS:
```bash
cd artifacts/TradeLab
npx eas-cli@latest login          # login with your Expo account
npx eas-cli@latest init           # links project, fills in the projectId in app.json
```

---

## Step 5 — Build for Android (Play Store)

```bash
cd artifacts/TradeLab
npx eas-cli@latest build --platform android --profile production
```

EAS Build runs in the cloud (takes ~10–15 min). When done, download the `.aab` file from the EAS dashboard at https://expo.dev.

> **Cost:** EAS Build free tier gives you 30 builds/month. The production build uses the `app-bundle` type which produces a `.aab` (required by Play Store).

---

## Step 6 — Submit to Google Play

### 6a. Create the app in Play Console
1. Go to https://play.google.com/console
2. Click **Create app**
3. Fill in: App name = "Trade Lab", Default language, Free/Paid, App/Game
4. Accept declarations

### 6b. Set up a release track
- Go to **Testing → Internal testing** (fastest for first submission)
- Click **Create new release** → Upload your `.aab` file

### 6c. Fill in the Store Listing
Required fields:
- **Short description** (80 chars): "Backtest trading strategies with AI coaching"
- **Full description** (4000 chars): Describe features — backtesting, AI assistant, Trader DNA, paper trading
- **Screenshots**: At least 2 phone screenshots (use an Android emulator or the preview APK)
- **Feature graphic**: 1024×500 PNG banner
- **Icon**: Already configured in `app.json` (512×512 PNG at `assets/icon.png`)

### 6d. Content rating
- Complete the content rating questionnaire
- This app is Finance category, no violence/mature content

### 6e. Privacy Policy
Google requires a privacy policy URL. You'll need to host one — minimum content:
- What data you collect (email, usage data)
- How it's stored (your PostgreSQL database on Replit)
- Contact email

---

## Step 7 — Submit for Review

Once all required fields are filled, click **Review release** → **Start rollout to Internal testing**.

Internal testing is approved instantly (no Google review needed). To reach all users, promote to **Production** — Google review takes 1–7 days.

---

## Android Package Name

The current package name is `app.tradelab` (set in `artifacts/TradeLab/app.json`).

> ⚠️ **Important:** Once published to the Play Store, the package name **cannot be changed**. If `app.tradelab` is already taken by someone else, change it to something unique (e.g. `com.yourname.tradelab`) **before your first build**.

---

## Quick Reference

| What | Where |
|---|---|
| App config | `artifacts/TradeLab/app.json` |
| EAS build config | `artifacts/TradeLab/eas.json` |
| Production API URL | `eas.json` → `build.production.env.EXPO_PUBLIC_API_URL` |
| Android package | `app.json` → `expo.android.package` |
| Version code | `app.json` → `expo.android.versionCode` (increment on each update) |
| App assets | `artifacts/TradeLab/assets/` |
| EAS dashboard | https://expo.dev |
| Play Console | https://play.google.com/console |
