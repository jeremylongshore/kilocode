#!/bin/bash

# This script is used to set up the project for development.

echo "Cleaning up old dependencies..."
rm -rf node_modules package-lock.json ios/Pods

echo "Installing new dependencies..."
npm install --legacy-peer-deps

echo "Installing Pods..."
cd ios && pod install && cd ..

echo "Prebuilding the project..."
npx expo prebuild --clean

echo "Setup complete."