#!/bin/bash

# MyTerms Development Starter Script
# Starts Hardhat node, deploys contract, and starts Python server

set -e

cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $(jobs -p) 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

echo "🚀 Starting MyTerms Development Environment"
echo "=========================================="

# 1. Start Hardhat Node
echo "1️⃣  Starting Hardhat Node..."
npx hardhat node > /dev/null 2>&1 &
NODE_PID=$!
echo "   ✓ Node started (PID: $NODE_PID)"
echo "   ⏳ Waiting for node to initialize..."
sleep 5

# 2. Deploy Contract
echo "2️⃣  Deploying Contract..."
# Capture output to extract address
DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy.js --network localhost)
echo "$DEPLOY_OUTPUT"

# Extract address using grep/awk (taking the first match which is the contract address)
CONTRACT_ADDR=$(echo "$DEPLOY_OUTPUT" | grep -oE '0x[a-fA-F0-9]{40}' | head -n 1)

if [ -n "$CONTRACT_ADDR" ]; then
    echo "   ✓ Contract deployed at: $CONTRACT_ADDR"
    echo ""
    echo "   ⚠️  IMPORTANT: Update extension/utils/ethers.js with this address!"
else
    echo "   ⚠️  Could not auto-detect contract address. Please check output above."
fi

# 3. Start Python Server
echo "3️⃣  Starting Python Server..."
echo "   ✓ Serving current directory at http://localhost:8000"
echo "   ✓ Dashboard: http://localhost:8000/dashboard/index.html"
echo ""
echo "Press Ctrl+C to stop all services."
echo "=========================================="

python3 -m http.server 8000
