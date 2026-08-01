#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/build-android.sh
# Build the Vite web bundle with Android-specific env vars, then sync it into
# the Capacitor Android project.
#
# Usage (run from repo root or from artifacts/trade-backtest/):
#   bash artifacts/trade-backtest/scripts/build-android.sh
#
# Prerequisites on your LOCAL machine (not needed on Replit):
#   - Node >= 18 + pnpm
#   - Android Studio with SDK platform 34+ installed
#   - ANDROID_HOME / ANDROID_SDK_ROOT set (Android Studio sets this for you)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

echo "▶  Loading Android env vars…"

# Prefer the local override file, fall back to the committed template.
ENV_FILE=".env.android.local"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE=".env.android"
fi

if [ -f "$ENV_FILE" ]; then
  # Export every non-comment, non-blank line as an env var
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
  echo "   Loaded $ENV_FILE"
else
  echo "   ⚠  No $ENV_FILE found — using whatever VITE_* vars are already in env"
fi

if [ -z "${VITE_API_BASE_URL:-}" ]; then
  echo ""
  echo "ERROR: VITE_API_BASE_URL is not set."
  echo "  Edit .env.android (or create .env.android.local) and set it to your"
  echo "  deployed Railway backend URL, e.g.:"
  echo "    VITE_API_BASE_URL=https://your-app.up.railway.app"
  echo ""
  exit 1
fi

echo "   VITE_API_BASE_URL = $VITE_API_BASE_URL"

echo ""
echo "▶  Building web bundle…"
pnpm run build

echo ""
echo "▶  Syncing web bundle into Android project…"
# cap sync copies dist/public/ → android/app/src/main/assets/public/
# and updates Capacitor plugins
npx cap sync android

echo ""
echo "▶  Done!  Next steps:"
echo ""
echo "   To open in Android Studio:"
echo "     npx cap open android"
echo ""
echo "   To build a debug APK from the command line:"
echo "     cd android && ./gradlew assembleDebug"
echo "     # Output: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "   To build a release APK (requires keystore — see ANDROID_SETUP.md):"
echo "     cd android && ./gradlew assembleRelease"
echo ""
