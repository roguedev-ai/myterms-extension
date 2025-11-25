#!/bin/bash

# MyTerms Development Starter Script
# Starts local Hardhat blockchain, deploys contract, funds accounts, and starts dashboard

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

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "   Run ./setup.sh first or copy .env.example to .env"
    exit 1
fi

# 1. Start Hardhat Node
echo "1️⃣  Starting Hardhat Local Blockchain..."
npx hardhat node > hardhat-node.log 2>&1 &
NODE_PID=$!
echo "   ✓ Node started (PID: $NODE_PID)"
echo "   ⏳ Waiting for node to initialize..."
sleep 5

# 2. Deploy Contract
echo ""
echo "2️⃣  Deploying MyTermsConsentLedger Contract..."
DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy.js --network localhost 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract contract address
CONTRACT_ADDR=$(echo "$DEPLOY_OUTPUT" | grep -oE '0x[a-fA-F0-9]{40}' | head -n 1)

if [ -n "$CONTRACT_ADDR" ]; then
    echo "   ✓ Contract deployed at: $CONTRACT_ADDR"
    
    # Save to deployments
    mkdir -p deployments
    echo "{\"address\": \"$CONTRACT_ADDR\", \"network\": \"localhost\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > deployments/localhost.json
else
    echo "   ⚠️  Could not detect contract address"
    CONTRACT_ADDR="0x5FbDB2315678afecb367f032d93F642f64180aa3" # Default Hardhat address
fi

# 3. Display Info
echo ""
echo "3️⃣  MetaMask Setup:"
echo "   • Network: Localhost 8545"
echo "   • RPC URL: http://127.0.0.1:8545"
echo "   • Chain ID: 31337"
echo ""
echo "   Import a test account private key from hardhat-node.log"
echo ""

# 4. Optional: Fund specific wallet
echo "4️⃣  Fund Specific Wallet (Optional):"
read -p "   Do you want to fund a specific wallet address? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "   Enter wallet address: " WALLET_ADDR
    
    if [[ $WALLET_ADDR =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        echo "   💰 Funding $WALLET_ADDR with 1000 ETH..."
        
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
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
EOF
        npx hardhat run /tmp/fund-temp.js --network localhost
        rm /tmp/fund-temp.js
    fi
fi

# 5. Start Dashboard Server
echo ""
echo "5️⃣  Starting Dashboard Server..."
echo "   ✓ Server: http://localhost:8080"
echo ""
echo "🛑 Press Ctrl+C to stop all services"
echo "========================================"

# Start dashboard server (foreground)
node serve-dashboard.js
