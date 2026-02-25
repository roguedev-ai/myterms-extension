# MyTerms — Quickstart Guide

Get the full local development stack running from a clean machine in under 10 minutes.

---

## Prerequisites

| Requirement | Minimum | Check |
|---|---|---|
| Node.js | 18 LTS | `node --version` |
| npm | 9+ | `npm --version` |
| Chrome | Any recent | — |
| MetaMask | Any recent | Install from Chrome Web Store |
| Git | Any | `git --version` |

---

## Step 1 — Clone and Install

```bash
git clone https://github.com/roguedev-ai/myterms-extension.git
cd myterms-extension
git checkout delta
npm install
```

---

## Step 2 — Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder inside the repo
5. Confirm the **MyTerms** card appears with no error badge

> You only need to do this once. The extension does not need to be reloaded when you change dashboard code — only when `manifest.json` or `background.js` change.

---

## Step 3 — Start the Dev Environment

```bash
npm run dev
```

Wait for the ready banner:

```
╔══════════════════════════════════════════════════════════╗
║  MyTerms Dev Environment — READY                         ║
╠══════════════════════════════════════════════════════════╣
║  Blockchain RPC  :  http://localhost:8545                ║
║  Dashboard UI    :  http://localhost:8080                ║
╚══════════════════════════════════════════════════════════╝
```

`npm run dev` automatically:
- Starts Hardhat local blockchain on port 8545
- Deploys `MyTermsConsentLedger` to `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- Starts dashboard HTTP server on port 8080

> **Keep this terminal open.** Both services must stay running.

---

## Step 4 — Configure MetaMask

This is a one-time setup per machine. The settings persist.

### Add Localhost Network

In MetaMask: **Settings → Networks → Add a network manually**

```
Network Name : Localhost 8545
RPC URL      : http://127.0.0.1:8545
Chain ID     : 31337
Currency     : ETH
```

### Option A — Import the Hardhat Test Account (easiest)

This account already has 10,000 ETH on the local chain.

MetaMask → **Account menu → Import account → Private key:**
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

> This is a publicly known Hardhat test key. **Never use it on mainnet or any live network.**

### Option B — Fund Your Own MetaMask Address

If you prefer to use your existing MetaMask account:

```bash
RECIPIENT=0xYourAddress npm run dev:fund
```

---

## Step 5 — Open the Dashboard

Navigate to: **http://localhost:8080**

1. Click **Connect Wallet** → Approve in MetaMask
2. Confirm the wallet address appears in the header
3. Check the browser console — you should see:
   ```
   Contract config loaded: {address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'localhost'}
   Contract initialized successfully
   ```

---

## Step 6 — Verify It Works

### Test Consent Capture
1. Browse to any site with a cookie banner (e.g. a news site)
2. Interact with the banner (accept or decline)
3. Open the dashboard → **📅 Timeline** — your consent should appear

### Test Force Batch
1. Dashboard → click **⚡ Force Batch**
2. MetaMask popup appears — click **Confirm**
3. Console shows:
   ```
   Transaction submitted: 0x...
   Transaction confirmed in block: N
   ```

### Test Agreements View
1. Dashboard → **📜 Agreements**
2. Banner text captured from sites you visited appears as collapsible cards

### Test Cookie Analysis
1. Dashboard → **🍪 Cookies** → click **Scan Cookies**
2. Privacy score, cookie chart, and table populate

---

## Stopping the Dev Environment

Press `Ctrl+C` in the terminal running `npm run dev`. Both the Hardhat node and dashboard server will shut down cleanly.

---

## Next Steps

- **[TESTING_WORKFLOW.md](TESTING_WORKFLOW.md)** — Full test scenario guide with expected outputs
- **[LOCAL_BLOCKCHAIN.md](LOCAL_BLOCKCHAIN.md)** — Detailed blockchain and contract reference
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** — If something doesn't work
