#!/usr/bin/env bash
# ===================================================================
# 🚀 Standalone Android Build & Deployment Script for Expo/Bare
# - Builds release APK (no Metro)
# - Handles multiple devices
# - Fast/parallel mode (--fast)
# - Auto port reversal for emulators
# ===================================================================

set -e  # Exit on error

# ========== CONFIG ==========
APP_PACKAGE_DEFAULT="com.aet.kilocanvas"
APP_REL_PATH="android/app/build/outputs/apk/release/app-release.apk"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
FAST_MODE=false
TARGET_DEVICE=""
# ============================

# --- Parse CLI Arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fast)
      FAST_MODE=true
      shift
      ;;
    --device)
      TARGET_DEVICE="$2"
      shift 2
      ;;
    *)
      echo "⚠️ Unknown argument: $1"
      shift
      ;;
  esac
done

echo "=========================================="
echo "📦 Building and deploying standalone Android app"
echo "=========================================="

cd "$PROJECT_ROOT"

# 1️⃣ Ensure Android SDK (adb) is available
if ! command -v adb &>/dev/null; then
  echo "❌ Error: Android SDK 'adb' not found in PATH."
  echo "👉 Please ensure ANDROID_HOME/platform-tools is added to your PATH."
  exit 1
fi

# 2️⃣ Check connected devices
echo "🔍 Checking for connected devices..."
DEVICE_LIST=($(adb devices | awk 'NR>1 && $2=="device"{print $1}'))

if [ ${#DEVICE_LIST[@]} -eq 0 ]; then
  echo "❌ No Android devices or emulators detected."
  echo "👉 Start one with: emulator -avd <device_name>"
  exit 1
elif [ ${#DEVICE_LIST[@]} -eq 1 ]; then
  TARGET_DEVICE="${DEVICE_LIST[0]}"
  echo "✅ Found single device: $TARGET_DEVICE"
else
  if [ -z "$TARGET_DEVICE" ]; then
    echo "📱 Multiple devices found:"
    select TARGET_DEVICE in "${DEVICE_LIST[@]}"; do
      [ -n "$TARGET_DEVICE" ] && break
    done
  fi
  echo "✅ Using selected device: $TARGET_DEVICE"
fi

# 3️⃣ Set environment
export NODE_ENV=production
echo "🌎 NODE_ENV=production"

# 4️⃣ Ensure Android project exists
if [ ! -d "$ANDROID_DIR" ]; then
  echo "⚙️  Android directory missing. Running Expo prebuild..."
  npx expo prebuild --clean --platform android
fi

# 5️⃣ Clean or fast mode
cd "$ANDROID_DIR"
if [ "$FAST_MODE" = true ]; then
  echo "⚡ Fast mode: incremental parallel Gradle build"
  ./gradlew assembleRelease --parallel
else
  echo "🧹 Cleaning and building from scratch..."
  ./gradlew clean
  ./gradlew assembleRelease
fi
cd "$PROJECT_ROOT"

# 6️⃣ Verify build output
APK_PATH="$APP_REL_PATH"
if [ ! -f "$APK_PATH" ]; then
  echo "❌ Build failed: APK not found at $APK_PATH"
  echo "🔍 Searching manually..."
  APK_PATH=$(find "$ANDROID_DIR/app/build" -name "*.apk" | head -n 1)
fi

if [ ! -f "$APK_PATH" ]; then
  echo "❌ No APK found. Check Gradle logs."
  exit 1
fi

echo "✅ APK built successfully: $APK_PATH"

# 7️⃣ Copy APK to root for convenience
cp "$APK_PATH" ./app-release.apk 2>/dev/null || true
echo "📦 Copied APK to project root: ./app-release.apk"

# 8️⃣ Install APK
echo "📲 Installing APK on device: $TARGET_DEVICE"
adb -s "$TARGET_DEVICE" install -r "$APK_PATH"

# 9️⃣ Get package name
PACKAGE_NAME=$(grep "applicationId" "$ANDROID_DIR/app/build.gradle" | awk '{print $2}' | tr -d '"')
PACKAGE_NAME=${PACKAGE_NAME:-$APP_PACKAGE_DEFAULT}

# 🔎 Print APK install path
echo "🔎 Locating installed APK path..."
DEVICE_APK_PATH=$(adb -s "$TARGET_DEVICE" shell pm path "$PACKAGE_NAME" | sed 's/package://')
echo "📦 Installed on device at: $DEVICE_APK_PATH"

# 🔁 Reverse local dev ports for emulator
if [[ "$TARGET_DEVICE" == emulator-* ]]; then
  echo "🔁 Emulator detected — scanning for active local dev ports..."
  
  # Detect active localhost ports (3000, 5173, 8000, etc.)
  ACTIVE_PORTS=$(lsof -iTCP -sTCP:LISTEN -n -P | grep -E ':(3000|5173|8000|8080|9000)' | awk '{print $9}' | sed -E 's/.*:([0-9]+)->.*/\1/' | sort -u)

  if [ -n "$ACTIVE_PORTS" ]; then
    echo "🔌 Found active ports: $ACTIVE_PORTS"
    for PORT in $ACTIVE_PORTS; do
      echo "↔️  Reversing tcp:$PORT (emulator → host)"
      adb -s "$TARGET_DEVICE" reverse tcp:$PORT tcp:$PORT || true
    done
  else
    echo "ℹ️ No local dev ports detected for reversal."
  fi
else
  echo "🪶 Physical device detected — skipping port reversal."
fi

# 🚀 Launch the app
echo "🚀 Launching app: $PACKAGE_NAME"
adb -s "$TARGET_DEVICE" shell monkey -p "$PACKAGE_NAME" -c android.intent.category.LAUNCHER 1

echo "=========================================="
echo "✅ Standalone build & deployment complete!"
if [ "$FAST_MODE" = true ]; then
  echo "⚡ Built using fast mode (parallel, incremental)."
fi
echo "=========================================="
