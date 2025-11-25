#!/bin/bash

# MyTerms Development Starter Script

cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $(jobs -p) 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

echo "🚀 MyTerms Local Blockchain Development"
echo "========================================"

# ⚠️ WARNING ABOUT SUDO
if [ "$EUID" -eq 0 ]; then
  echo "❌ WARNING: You are running as root (sudo)."
  echo "   This usually breaks NVM/Node.js detection."
  echo "   Please run without sudo: ./dev-start.sh"
  echo ""
  read -p "   Press Enter to continue anyway (or Ctrl+C to stop)..."
fi

# Try to load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Check for Node
if ! command -v node &> /dev/null; then
    echo ""
    echo "❌ Error: 'node' command not found."
    echo ""
    echo "👉 PLEASE RUN THESE COMMANDS MANUALLY IN SEPARATE TERMINALS:"
    echo ""
    echo "   Terminal 1 (Blockchain):"
    echo "   npx hardhat node"
    echo ""
    echo "   Terminal 2 (Deploy & Dashboard):"
    echo "   npx hardhat run scripts/deploy.js --network localhost"
    echo "   node serve-dashboard.js"
    echo ""
    exit 1
fi

# Check .env
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found! Copying from example..."
    cp .env.example .env
fi

# 1. Start Hardhat Node
echo "1️⃣  Starting Hardhat Local Blockchain..."
npx hardhat node > hardhat-node.log 2>&1 &
NODE_PID=$!
echo "   ✓ Node started (PID: $NODE_PID)"
sleep 5

# 2. Deploy Contract
echo ""
echo "2️⃣  Deploying Contract..."
npx hardhat run scripts/deploy.js --network localhost

# 3. Start Dashboard
echo ""
echo "3️⃣  Starting Dashboard Server..."
echo "   ✓ Server: http://localhost:8080"
echo ""
echo "🛑 Press Ctrl+C to stop all services"
echo "========================================"

node serve-dashboard.js
