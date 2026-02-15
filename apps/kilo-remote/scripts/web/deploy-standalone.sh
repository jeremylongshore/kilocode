#!/bin/bash
set -e

echo "📦 Building standalone web app..."
rm -rf dist
npx expo export

echo "✅ Standalone web app built in 'dist/' directory."