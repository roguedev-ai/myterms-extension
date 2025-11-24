#!/bin/bash

# MyTerms Extension - Quick Setup Script
# This script helps you get started with the MyTerms extension quickly

set -e

echo "🛡️  MyTerms Extension - Quick Setup"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &gt; /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Compile smart contract
echo "🔨 Compiling smart contract..."
npx hardhat compile
echo "✓ Contract compiled"
echo ""

# Run tests
echo "🧪 Running tests..."
npm test
echo "✓ Tests passed"
echo ""

# Generate icons
echo "🎨 Generating extension icons..."
node scripts/generate-icons.js
echo "✓ Icons generated"
echo ""

# Copy dashboard to extension
echo "Copying dashboard to extension..."
cp -r dashboard extension/
echo "✓ Dashboard copied"
echo ""

echo "Setup complete! Load the 'extension' directory in Chrome."
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and configure your settings"
echo "2. Load the extension in Chrome:"
echo "   - Open chrome://extensions/"
echo "   - Enable 'Developer mode'"
echo "   - Click 'Load unpacked'"
echo "   - Select the 'extension' folder"
echo ""
echo "3. (Optional) Deploy to Sepolia testnet:"
echo "   npx hardhat run scripts/deploy.js --network sepolia"
echo ""
echo "For more information, see DEVELOPMENT.md and TESTING.md"
echo ""
