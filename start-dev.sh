#!/usr/bin/env bash

# VANTA Research Chat - Development Start Script

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "🚀 VANTA Research Chat - Development"
echo "=================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo ""
echo "🎨 Starting development server..."
echo "📍 Open http://localhost:3000 in your browser"
echo ""

npm run dev
