#!/bin/bash

# MyTerms Extension - Simple Setup Script
# Sets up the entire development environment

# Don't exit on error immediately, let us see what happens
# set -e 

echo "🛡️  MyTerms Extension - Setup"
echo "========================================"
echo ""

# Try to load NVM if present (just in case)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "ℹ️  Using Node: $(node --version 2>/dev/null || echo 'Not found')"
echo "ℹ️  Using NPM: $(npm --version 2>/dev/null || echo 'Not found')"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed"
else
    echo "❌ npm install failed. Please run 'npm install' manually."
    exit 1
fi
echo ""

# Compile smart contract
echo "🔨 Compiling smart contract..."
npx hardhat compile
echo "✓ Contract compiled"
echo ""

# Run tests
echo "🧪 Running smart contract tests..."
npm test
echo ""

# Generate icons if script exists
if [ -f "scripts/generate-icons.js" ]; then
    echo "🎨 Generating extension icons..."
    node scripts/generate-icons.js
    echo "✓ Icons generated"
    echo ""
fi

# Copy dashboard to extension folder
echo "📂 Setting up extension dashboard..."
rm -rf extension/dashboard 2>/dev/null || true
cp -r dashboard extension/
echo "✓ Dashboard copied"
echo ""

# Setup environment file
if [ ! -f ".env" ]; then
    echo "📝 Setting up environment file..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✓ Created .env from .env.example"
    fi
fi

echo ""
echo "✅ Setup complete!"
