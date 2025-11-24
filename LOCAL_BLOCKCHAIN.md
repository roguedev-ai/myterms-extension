# Local Blockchain Development Guide

## 🏠 Overview

This guide covers setting up and using a **local Hardhat blockchain** for development and testing of the MyTerms extension.

---

## 🚀 Quick Start (Automated)

### Option 1: One-Command Setup
```bash
./dev-start.sh
```

This script automatically:
1. ✅ Starts Hardhat local node
2. ✅ Deploys the MyTerms contract
3. ✅ Starts dashboard server on port 8000

### Option 2: Manual Setup (Full Control)
See the manual setup section below.

---

## 📋 Prerequisites

Make sure you have:
- Node.js (v16+)
- npm or yarn
- MetaMask browser extension

---

## 🔧 Manual Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Blockchain
```bash
npx hardhat node
```

**What this does:**
- Starts a local Ethereum blockchain on `http://127.0.0.1:8545`
- Creates 20 test accounts with 10,000 ETH each
- Displays account addresses and private keys
- Chain ID: `31337`

**Keep this terminal open!** The node must stay running.

### 3. Deploy Contract (New Terminal)
```bash
npx hardhat run scripts/deploy.js --network localhost
```

**Output will show:**
```
Deploying MyTermsConsentLedger...
Contract deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

**⚠️ Important:** Save this contract address!

### 4. Update Extension Configuration

Edit `extension/utils/ethers.js`:
```javascript
'localhost': {
  address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // ← Your deployed address
  abi: [...]
}
```

### 5. Connect MetaMask to Localhost

**Add Network in MetaMask:**
1. Open MetaMask
2. Click network dropdown → "Add Network"
3. Click "Add network manually"
4. Fill in:
   - **Network Name:** `Localhost 8545`
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** `ETH`
5. Click "Save"

**Import Test Account:**
1. Copy a private key from Hardhat node output
2. MetaMask → Import Account
3. Paste private key
4. You now have 10,000 ETH for testing!

### 6. Start Dashboard Server
```bash
npm run dashboard
```

Dashboard now available at: **http://localhost:8080**

---

## 💰 Funding User Accounts

If you need to fund a specific wallet address:

```bash
npx hardhat run scripts/fund-user.js --network localhost
```

**To customize the recipient:**

Edit `scripts/fund-user.js`:
```javascript
const recipientAddress = "0xYourWalletAddress";  // ← Change this
const amountStr = "1000.0";  // Amount in ETH
```

Then run:
```bash
npx hardhat run scripts/fund-user.js --network localhost
```

---

## 🧪 Testing Workflow

### Complete Development Cycle

1. **Start local blockchain:**
   ```bash
   npx hardhat node
   ```

2. **Deploy contract:**
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

3. **Update extension config** (see step 4 above)

4. **Load extension in Chrome:**
   - `chrome://extensions`
   - Load unpacked → `extension/` folder

5. **Start dashboard server:**
   ```bash
   npm run dashboard
   ```

6. **Open dashboard:**
   - Go to `http://localhost:8080`
   - Connect MetaMask (should auto-detect Localhost network)

7. **Test the flow:**
   - Browse websites with cookie banners
   - Check popup for queued consents
   - Go to dashboard → Enable blockchain in preferences
   - Click "Force Batch" to submit to blockchain
   - View transaction on dashboard

---

## 🛠️ Available Scripts

### Blockchain Scripts

```bash
# Start local Hardhat node
npx hardhat node

# Deploy to localhost
npx hardhat run scripts/deploy.js --network localhost

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia

# Run contract tests
npm test

# Compile contracts
npm run compile

# Fund a wallet on localhost
npx hardhat run scripts/fund-user.js --network localhost

# Verify contract on Etherscan (after testnet deployment)
npx hardhat run scripts/verify-contract.js --network sepolia
```

### Dashboard Scripts

```bash
# Start dashboard server (port 8080)
npm run dashboard

# Alternative: Python server (port 8000) - deprecated
python3 -m http.server 8000
```

### Development Scripts

```bash
# One-command dev environment
./dev-start.sh

# Initial setup (run once)
./setup.sh
```

---

## 🔍 Debugging

### Check if Hardhat Node is Running
```bash
curl -X POST -H "Content-Type: application/json" \
--data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
http://127.0.0.1:8545
```

Should return current block number.

### Check Contract Deployment
```bash
npx hardhat console --network localhost
```

Then in console:
```javascript
const MyTerms = await ethers.getContractAt("MyTermsConsentLedger", "0x5FbDB..."); 
// Your contract address
await MyTerms.getAddress();
```

### Check Account Balance
```bash
npx hardhat run scripts/check-balance.js --network localhost
```

---

## 💡 Common Issues

### Issue: "Cannot connect to localhost:8545"
**Solution:** Make sure Hardhat node is running (`npx hardhat node`)

### Issue: "Nonce too low" error
**Solution:** 
1. MetaMask → Settings → Advanced
2. Click "Clear activity and nonce data"
3. Reconnect to localhost network

### Issue: Contract address changed
**Solution:** 
- Hardhat redeploys contract to same address if you restart
- If it changes, update `extension/utils/ethers.js`

### Issue: "Insufficient funds"
**Solution:** 
- Import a Hardhat test account (10,000 ETH)
- Or use `scripts/fund-user.js`

---

## 🌐 Network Comparison

| Network | Purpose | Gas Costs | Speed | Persistence |
|---------|---------|-----------|-------|-------------|
| **Localhost** | Development | Free | Instant | Resets on restart |
| **Sepolia** | Testing | Testnet ETH | ~30s | Permanent |
| **Mainnet** | Production | Real ETH | ~15s | Permanent |

**Recommendation:** Use Localhost for development, Sepolia for pre-production testing.

---

## 📊 Local Blockchain Features

### Hardhat Node Advantages:
- ✅ Instant transactions (no mining wait)
- ✅ Unlimited free ETH
- ✅ Full control over network state
- ✅ Easy to reset and restart
- ✅ Detailed console logging
- ✅ Built-in contract debugging

### Hardhat Node Limitations:
- ❌ Data lost on restart
- ❌ Only accessible locally
- ❌ Can't test real network conditions
- ❌ No external contract interactions

---

## 🎯 Best Practices

1. **Always test locally first** before deploying to testnet
2. **Use separate accounts** for testing vs. real usage
3. **Keep Hardhat node running** during development session
4. **Save contract addresses** after deployment
5. **Update extension config** immediately after local deployment
6. **Test on Sepolia** before mainnet deployment

---

## 📚 Next Steps

- [TESTING.md](./TESTING.md) - Comprehensive testing guide
- [DEVELOPMENT.md](./DEVELOPMENT.md) - General development guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [Hardhat Docs](https://hardhat.org/hardhat-runner/docs/getting-started) - Official documentation

---

## 🆘 Need Help?

If you're stuck:
1. Check the [Hardhat documentation](https://hardhat.org/docs)
2. Review the error messages carefully
3. Make sure all prerequisites are installed
4. Try restarting the Hardhat node
5. Check the browser console for errors
