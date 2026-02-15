#!/bin/bash
set -e

echo "🧹 Cleaning web dependencies..."
rm -rf node_modules package-lock.json

echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo "✅ Web cleanup and installation complete."