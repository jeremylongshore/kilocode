#!/bin/bash
set -e

echo "=========================================="
echo "🧹 Deep Cleaning Android Environment"
echo "=========================================="

# Go to project root if needed (works even if run from scripts/android/)
cd "$(dirname "$0")/../.."

# 1️⃣ Remove project-level caches and build artifacts
echo "🗑️  Removing Android build folders..."
rm -rf android/.gradle
rm -rf android/app/build
rm -rf android/build

# 2️⃣ Remove JS dependencies and reinstall fresh
echo "📦 Removing node_modules and lock files..."
rm -rf node_modules package-lock.json yarn.lock pnpm-lock.yaml

echo "📦 Reinstalling dependencies..."
npm install --legacy-peer-deps

# 3️⃣ Clean Gradle cache and Expo/Metro temp data
echo "🧼 Cleaning Gradle, Metro, and Expo caches..."
rm -rf ~/.gradle/caches/
rm -rf ~/.gradle/daemon/
rm -rf ~/.expo/cache/
rm -rf ~/.expo/staging/
rm -rf ~/.expo/development/
rm -rf ~/.cache/expo
rm -rf ~/.cache/react-native
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/react-*
watchman watch-del-all 2>/dev/null || true

# 4️⃣ Run Gradle clean
if [ -d "android" ]; then
  echo "🧱 Running Gradle clean..."
  cd android && ./gradlew clean && cd ..
fi

echo "✅ Android cleanup complete!"
echo "=========================================="
