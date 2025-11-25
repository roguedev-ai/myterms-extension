#!/bin/bash

# MyTerms Extension - Complete Setup Script
# Sets up the entire development environment

set -e

echo "🛡️  MyTerms Extension - Complete Setup"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
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
echo "🧪 Running smart contract tests..."
npm test
if [ $? -ne 0 ]; then
    echo "⚠️  Tests failed, but continuing setup..."
fi
echo ""

# Generate icons if script exists
if [ -f "scripts/generate-icons.js" ]; then
    echo "🎨 Generating extension icons..."
    node scripts/generate-icons.js
    echo "✓ Icons generated"
    echo ""
fi

# Copy dashboard to extension folder (for extension-mode access)
echo "📂 Setting up extension dashboard..."
if [ -d "dashboard" ]; then
    # Remove old dashboard if exists
    rm -rf extension/dashboard 2>/dev/null || true
    
    # Copy dashboard files
    cp -r dashboard extension/
    echo "✓ Dashboard copied to extension/"
else
    echo "⚠️  Dashboard folder not found, skipping..."
fi
echo ""

# Setup environment file
if [ ! -f ".env" ]; then
    echo "📝 Setting up environment file..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✓ Created .env from .env.example"
        echo ""
        echo "⚠️  IMPORTANT: Edit .env and add your configuration!"
        echo "   - Add your Sepolia RPC URL (or use the default)"
        echo "   - Add your private key (for testnet only!)"
        echo "   - Never commit .env to git!"
    else
        echo "⚠️  .env.example not found, skipping..."
    fi
else
    echo "✓ .env already exists"
fi
echo ""

echo "✅ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Load Extension in Chrome:"
echo "   • Open chrome://extensions/"
echo "   • Enable 'Developer mode'"
echo "   • Click 'Load unpacked'"
echo "   • Select the 'extension' folder"
echo ""
echo "2️⃣  For Local Blockchain Development:"
echo "   • Run: ./dev-start.sh"
echo "   • This starts Hardhat node + deploys contract + starts dashboard"
echo ""
echo "3️⃣  For Production Dashboard Only:"
echo "   • Run: npm run dashboard"
echo " • Opens at http://localhost:8080"
echo ""
echo "4️⃣  (Optional) Deploy to Sepolia Testnet:"
echo "   • Configure .env with your private key"
echo "   • Run: npx hardhat run scripts/deploy.js --network sepolia"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Documentation:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   • LOCAL_BLOCKCHAIN.md - Local blockchain setup"
echo "   • DEVELOPMENT.md - Development guide"
echo "   • TESTING.md - Testing guide"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
