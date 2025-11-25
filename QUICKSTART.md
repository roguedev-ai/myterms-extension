# 🚀 Quick Start Guide - MyTerms Extension

## Complete Workflow (Start to Finish)

Follow these steps in order for local blockchain development:

---

## Prerequisites

Before you start, make sure you have:
- ✅ **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- ✅ **MetaMask** browser extension - [Install](https://metamask.io/)
- ✅ **Git** - [Download](https://git-scm.com/)
- ✅ **Chrome/Brave/Edge** browser

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/roguedev-ai/myterms-extension.git
cd myterms-extension
```

---

## Step 2: Run Setup Script

This installs all dependencies and prepares the environment:

```bash
./setup.sh
```

**What it does:**
- ✅ Installs npm dependencies
- ✅ Compiles smart contracts
- ✅ Runs tests
- ✅ Generates extension icons
- ✅ Copies dashboard to extension folder
- ✅ Creates `.env` file from template

**Important:** After setup completes, edit `.env` if you plan to deploy to Sepolia testnet (optional for local dev).

---

## Step 3: Load Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `extension/` folder
5. ✅ Extension is now installed!

---

## Step 4: Start Local Blockchain

Run the development script:

```bash
./dev-start.sh
```

**What it does:**
1. ✅ Starts Hardhat local blockchain (Chain ID: 31337)
2. ✅ Deploys MyTermsConsentLedger smart contract
3. ✅ Saves contract address to `deployments/localhost.json`
4. ✅ Shows MetaMask setup instructions
5. ✅ Asks if you want to fund a specific wallet (optional)
6. ✅ Starts dashboard server at `http://localhost:8080`

**Keep this terminal open!** The blockchain and dashboard are running here.

---

## Step 5: Configure MetaMask

### A. Add Localhost Network

1. Open MetaMask
2. Click network dropdown (top of MetaMask)
3. Click **"Add Network"** → **"Add network manually"**
4. Fill in:
   - **Network Name:** `Localhost 8545`
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** `ETH`
5. Click **"Save"**

### B. Import Test Account

You have two options:

**Option 1: Use Hardhat Test Account (Recommended)**
1. Check the terminal where `dev-start.sh` is running
2. Look at `hardhat-node.log` for private keys
3. Copy any private key (without `0x` prefix)
4. MetaMask → Click account icon → **"Import Account"**
5. Paste private key → Import
6. 🎉 You now have 10,000 test ETH!

**Option 2: Use Your Existing Wallet (Manual Funding)**
1. When `dev-start.sh` asks "Fund a specific wallet?"
2. Type `y` and press Enter
3. Paste your MetaMask address
4. It will send 1000 test ETH to your wallet

---

## Step 6: Open Dashboard

Open your browser and go to:
```
http://localhost:8080
```

1. Click **"Connect Wallet"**
2. MetaMask will pop up
3. Make sure **"Localhost 8545"** network is selected
4. Approve connection
5. ✅ Dashboard is connected!

---

## Step 7: Enable Blockchain Features

In the dashboard:
1. Click **"Preferences"** tab
2. Scroll to "Blockchain Settings"
3. Toggle **"Enable Blockchain Features"** ON
4. Click **"Save Preferences"**

Now the **"⛓️ Blockchain Dashboard"** button will appear in the extension popup!

---

## Step 8: Test the Extension

1. Visit any website with a cookie banner
2. The extension detects and records consents automatically
3. Click the extension icon to see queued consents
4. Click **"⛓️ Blockchain Dashboard"** in popup
5. In dashboard, click **"Force Batch"** to submit to blockchain
6. MetaMask will pop up - confirm the transaction
7. ✅ Consents are now on the blockchain!

---

## Complete Workflow Summary

```
1. Clone repo
   ↓
2. ./setup.sh (one-time setup)
   ↓
3. Load extension in Chrome
   ↓
4. ./dev-start.sh (starts blockchain)
   ↓
5. Configure MetaMask (add localhost network + import account)
   ↓
6. Open http://localhost:8080
   ↓
7. Enable blockchain in dashboard preferences
   ↓
8. Test on websites!
```

---

## Troubleshooting

### "MetaMask not found" error
- Make sure MetaMask extension is installed
- Try refreshing the dashboard page

### "Cannot connect to localhost:8545"
- Make sure `./dev-start.sh` is running
- Check if Hardhat node started (look at `hardhat-node.log`)

### "Insufficient funds" error
- Import a Hardhat test account (they have 10,000 ETH each)
- Or use the funding option in `dev-start.sh`

### "Nonce too low" error
- MetaMask → Settings → Advanced
- Click "Clear activity and nonce data"
- Reconnect to localhost

### Extension not working
- Go to `chrome://extensions`
- Click reload button on MyTerms extension
- Check browser console for errors

---

## Daily Development Workflow

After initial setup, your daily workflow is:

```bash
# Start local blockchain + dashboard
./dev-start.sh

# In another terminal, make code changes
# Then reload extension at chrome://extensions
```

That's it! The blockchain and dashboard stay running while you develop.

---

## What's Next?

- **[LOCAL_BLOCKCHAIN.md](LOCAL_BLOCKCHAIN.md)** - Deep dive into blockchain development
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Development best practices
- **[TESTING.md](TESTING.md)** - Testing guide
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture

---

## Need Help?

Check the documentation files above or create an issue on GitHub!
