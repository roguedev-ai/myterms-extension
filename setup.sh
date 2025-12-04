#!/bin/bash

# MyTerms Extension - Setup Script

echo "🛡️  MyTerms Extension - Setup"
echo "========================================"

# ⚠️ WARNING ABOUT SUDO
if [ "$EUID" -eq 0 ]; then
  echo "❌ WARNING: You are running as root (sudo)."
  echo "   This usually breaks NVM/Node.js detection."
  echo "   If this script fails, please try running without sudo: ./setup.sh"
  echo "   Continuing in 3 seconds..."
  sleep 3
fi

# 1. Check for Node (Try system node first)
if ! command -v node &> /dev/null; then
    # Only try to load NVM if node is not found
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # Load NVM
    [ -s "$HOME/.bashrc" ] && source "$HOME/.bashrc"  # Load bashrc
fi

# 2. Check for Node again
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

# Check for root-owned node_modules
if [ -d "node_modules" ] && [ "$EUID" -ne 0 ]; then
    OWNER=$(stat -c '%U' node_modules)
    if [ "$OWNER" = "root" ]; then
        echo ""
        echo "❌ WARNING: 'node_modules' is owned by root!"
        echo "   This likely happened because you ran 'sudo npm install' previously."
        echo "   This will cause permission errors."
        echo ""
        echo "   To fix, run:"
        echo "   sudo chown -R $(whoami) node_modules"
        echo ""
        read -p "   Press Enter to attempt fix automatically (or Ctrl+C to stop)..."
        sudo chown -R $(whoami) node_modules
        echo "   ✓ Fixed permissions."
    fi
fi

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
