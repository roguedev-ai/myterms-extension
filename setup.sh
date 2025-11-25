#!/bin/bash

# MyTerms Extension - Setup Script

echo "🛡️  MyTerms Extension - Setup"
echo "========================================"

# ⚠️ WARNING ABOUT SUDO
if [ "$EUID" -eq 0 ]; then
  echo "❌ WARNING: You are running as root (sudo)."
  echo "   This usually breaks NVM/Node.js detection."
  echo "   Please run without sudo: ./setup.sh"
  echo ""
  read -p "   Press Enter to continue anyway (or Ctrl+C to stop)..."
fi

# 1. Try to load environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # Load NVM
[ -s "$HOME/.bashrc" ] && source "$HOME/.bashrc"  # Load bashrc

# 2. Check for Node
if ! command -v node &> /dev/null; then
    echo ""
    echo "❌ Error: 'node' command still not found."
    echo "   The script cannot see your Node.js installation."
    echo ""
    echo "👉 PLEASE RUN THESE COMMANDS MANUALLY INSTEAD:"
    echo "   (Copy and paste them one by one)"
    echo ""
    echo "   npm install"
    echo "   npx hardhat compile"
    echo "   npm test"
    echo "   node scripts/generate-icons.js"
    echo "   cp -r dashboard extension/"
    echo "   cp .env.example .env"
    echo ""
    exit 1
fi

echo "✓ Using Node: $(node --version)"

# 3. Run Setup Steps
echo ""
echo "📦 Installing dependencies..."
npm install || exit 1

echo ""
echo "🔨 Compiling smart contract..."
npx hardhat compile || exit 1

echo ""
echo "🧪 Running tests..."
npm test

echo ""
echo "🎨 Generating icons..."
if [ -f "scripts/generate-icons.js" ]; then
    node scripts/generate-icons.js
fi

echo ""
echo "📂 Setting up dashboard..."
rm -rf extension/dashboard 2>/dev/null || true
cp -r dashboard extension/

echo ""
echo "📝 Setting up .env..."
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
fi

echo ""
echo "✅ Setup complete!"
