#!/bin/bash

# MyTerms Development Starter Script
# Starts local Hardhat blockchain, deploys contract, funds accounts, and starts dashboard

set -e

cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $(jobs -p) 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

echo "🚀 MyTerms Local Blockchain Development"
echo "========================================"
echo ""

# Try to load NVM if present
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js command not found."
    echo "   Please ensure Node.js is installed and in your PATH."
    # We don't exit here, we let it try to fail on the actual command if needed, 
    # or the user might have aliases.
fi

# Check for npx
if ! command -v npx &> /dev/null; then
    echo "⚠️  npx command not found."
    echo "   This script requires npx (usually comes with Node.js)."
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "   Run ./setup.sh first or copy .env.example to .env"
    exit 1
fi

# 1. Start Hardhat Node
echo "1️⃣  Starting Hardhat Local Blockchain..."
echo "   Chain ID: 31337"
echo "   RPC: http://127.0.0.1:8545"
npx hardhat node > hardhat-node.log 2>&1 &
NODE_PID=$!
echo "   ✓ Node started (PID: $NODE_PID)"
echo "   📝 Full output: hardhat-node.log"
echo "   ⏳ Waiting for node to initialize..."
sleep 5

# Check if node is actually running
if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "   ❌ Hardhat node failed to start. Check hardhat-node.log"
    exit 1
fi

# 2. Deploy Contract
echo ""
echo "2️⃣  Deploying MyTermsConsentLedger Contract..."
# Capture output
DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy.js --network localhost 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract contract address
CONTRACT_ADDR=$(echo "$DEPLOY_OUTPUT" | grep -oE '0x[a-fA-F0-9]{40}' | head -n 1)

if [ -n "$CONTRACT_ADDR" ]; then
    echo "   ✓ Contract deployed at: $CONTRACT_ADDR"
    
    # Save to deployments
    mkdir -p deployments
    echo "{\"address\": \"$CONTRACT_ADDR\", \"network\": \"localhost\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > deployments/localhost.json
    echo "   ✓ Saved to deployments/localhost.json"
else
    echo "   ⚠️  Could not detect contract address"
    CONTRACT_ADDR="0x5FbDB2315678afecb367f032d93F642f64180aa3" # Default Hardhat address
    echo "   Using default: $CONTRACT_ADDR"
fi

# 3. Display Hardhat Test Accounts
echo ""
echo "3️⃣  Available Test Accounts:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   📝 Check hardhat-node.log for full list"
echo "   Each account has 10,000 ETH for testing"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 4. Setup MetaMask Instructions
echo ""
echo "4️⃣  MetaMask Setup:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   1. Add Localhost Network:"
echo "      • Network Name: Localhost 8545"
echo "      • RPC URL: http://127.0.0.1:8545"
echo "      • Chain ID: 31337"
echo "      • Currency: ETH"
echo ""
echo "   2. Import Test Account:"
echo "      • Check hardhat-node.log for private keys"
echo "      • Copy any private key (without 0x)"
echo "      • MetaMask → Import Account → Paste key"
echo "      • You'll have 10,000 test ETH!"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 5. Optional: Fund specific wallet
echo ""
echo "5️⃣  Fund Specific Wallet (Optional):"
read -p "   Do you want to fund a specific wallet address? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "   Enter wallet address: " WALLET_ADDR
    
    if [[ $WALLET_ADDR =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        echo "   💰 Funding $WALLET_ADDR with 1000 ETH..."
        
        # Create temporary funding script
        cat > /tmp/fund-temp.js << EOF
const hre = require("hardhat");

async function main() {
    const recipientAddress = "$WALLET_ADDR";
    const amount = hre.ethers.parseEther("1000.0");
    
    const [sender] = await hre.ethers.getSigners();
    const tx = await sender.sendTransaction({
        to: recipientAddress,
        value: amount,
    });
    await tx.wait();
    
    console.log("   ✓ Funded successfully!");
    console.log("   Transaction: " + tx.hash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
EOF
        npx hardhat run /tmp/fund-temp.js --network localhost
        rm /tmp/fund-temp.js
    else
        echo "   ⚠️  Invalid address format"
    fi
fi

# 6. Start Dashboard Server
echo ""
echo "6️⃣  Starting Dashboard Server..."
echo "   ✓ Server: http://localhost:8080"
echo "   ✓ Dashboard available for wallet connection"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Local Blockchain Environment Ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Quick Access:"
echo "   • Dashboard: http://localhost:8080"
echo "   • Blockchain RPC: http://127.0.0.1:8545"
echo "   • Contract: $CONTRACT_ADDR"
echo ""
echo "📝 Logs:"
echo "   • Hardhat Node: hardhat-node.log"
echo "   • Dashboard: This terminal"
echo ""
echo "🛑 Press Ctrl+C to stop all services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start dashboard server (foreground)
node serve-dashboard.js
