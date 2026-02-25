# MyTerms — Local Testing Workflow

> Target audience: developer setting up the project on a new machine to verify stability and end-to-end function.

---

## Stack Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER (Chrome)                         │
│                                                              │
│  ┌─────────────────┐        ┌──────────────────────────┐    │
│  │  MyTerms        │        │  Dashboard UI             │    │
│  │  Extension      │◄──────►│  localhost:8080           │    │
│  │  (content.js +  │bridge  │  (app.js + ethers.js)     │    │
│  │   background.js)│        └──────────┬───────────────┘    │
│  └────────┬────────┘                   │                     │
│           │                            │ window.ethereum     │
│           │ IndexedDB                  ▼                     │
│           │ (consent store)   ┌────────────────┐            │
│           └──────────────────►│  MetaMask       │            │
│                               │  Extension      │            │
│                               └────────┬───────┘            │
└────────────────────────────────────────┼────────────────────┘
                                         │ JSON-RPC
                                         ▼
                          ┌──────────────────────────┐
                          │  Hardhat Local Node       │
                          │  localhost:8545           │
                          │  Chain ID: 31337          │
                          └──────────────┬────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────┐
                          │  MyTermsConsentLedger     │
                          │  Smart Contract           │
                          │  0x5FbDB231...            │
                          └──────────────────────────┘
```

---

## Prerequisites (one-time per machine)

| # | Requirement | Check |
|---|---|---|
| 1 | Node.js 18+ | `node --version` |
| 2 | npm 9+ | `npm --version` |
| 3 | Chrome browser | Any recent version |
| 4 | MetaMask extension | Installed in Chrome |
| 5 | Git | `git --version` |

---

## Setup Flow

```
  Clone Repo
      │
      ▼
  npm install
      │
      ▼
  Load Extension         ◄── Do this once. No reload needed after code changes
  in Chrome              │   unless manifest.json or background.js changed.
      │
      ▼
  npm run dev            ◄── Starts chain + deploys contract + starts dashboard
      │                       in one command. Wait for READY banner.
      │
      ├─── [optional] npm run dev:fund -- --fund 0xYourMetaMaskAddress
      │
      ▼
  Configure MetaMask     ◄── One-time per machine (settings persist)
      │
      ▼
  Open http://localhost:8080
      │
      ▼
  Run Test Scenarios
```

---

## Step-by-Step Setup

### Step 1 — Clone and Install

```bash
git clone https://github.com/roguedev-ai/myterms-extension.git
cd myterms-extension
git checkout Beta
npm install
```

---

### Step 2 — Load the Chrome Extension

1. Open Chrome → navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder inside the repo
5. Confirm the **MyTerms** extension card appears with no errors

> The extension ID shown here will be used by the background service worker.
> Do **not** reload the extension between test runs unless you change `manifest.json` or `background.js`.

---

### Step 3 — Start the Dev Environment

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

What `npm run dev` does automatically:
- Starts Hardhat local blockchain on port 8545
- Deploys `MyTermsConsentLedger` contract to `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- Starts the dashboard HTTP server on port 8080

---

### Step 4 — Configure MetaMask (one-time)

```
MetaMask → Networks → Add a network manually

  Network Name : Localhost 8545
  RPC URL      : http://127.0.0.1:8545
  Chain ID     : 31337
  Currency     : ETH
```

**Import the Hardhat test account** (pre-loaded with 10,000 ETH):

```
MetaMask → Account menu → Import account → Private key:
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

> This is a well-known public test key. Never use it on mainnet or any live network.

**Fund your own MetaMask address** (if you prefer to use a personal account):

```bash
RECIPIENT=0xYourAddress npx hardhat run scripts/fund-wallet.js --network localhost
```

---

### Step 5 — Open the Dashboard

Navigate to: **http://localhost:8080**

Click **Connect Wallet** → approve in MetaMask.

Expected state after connection:
- Header shows wallet address (truncated)
- Network resolves to `localhost`
- Timeline loads with any previously recorded consents (may be empty on fresh chain)

---

## Test Scenarios

```
┌─────────────────────────────────────────────────────────────────┐
│  TEST SCENARIO FLOW                                              │
│                                                                  │
│  1. CONSENT CAPTURE                                              │
│                                                                  │
│     Browse to any site     ──►  Cookie/ToS banner appears        │
│     with cookie banner          │                                │
│                                 ▼                                │
│                            MyTerms detects banner                │
│                                 │                                │
│                                 ▼                                │
│                            Consent decision recorded             │
│                            in IndexedDB                          │
│                                 │                                │
│                                 ▼                                │
│                            Check Dashboard → Timeline            │
│                            ✓ Entry appears with site, hash,      │
│                              timestamp, accept/decline           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  2. FORCE BATCH (Manual blockchain submission)                   │
│                                                                  │
│     Dashboard → click        ──►  MetaMask popup appears         │
│     ⚡ Force Batch                │                               │
│                                  ▼                               │
│                             Review & Confirm tx                  │
│                                  │                               │
│                             ┌────┴─────┐                         │
│                         Confirm    Reject                        │
│                             │          │                         │
│                             ▼          ▼                         │
│                       Transaction  "Transaction                  │
│                       submitted →  rejected by user"             │
│                       confirmed    (expected, non-fatal)         │
│                       in block N                                 │
│                             │                                    │
│                             ▼                                    │
│                       Consents marked as batched                 │
│                       in IndexedDB                               │
│                             │                                    │
│                             ▼                                    │
│                       Dashboard stats update:                    │
│                       Transactions count increments              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  3. COOKIE ANALYSIS (🍪 Cookies tab)                             │
│                                                                  │
│     Dashboard → Cookies tab  ──►  Click "Scan Cookies"           │
│                                        │                         │
│                                        ▼                         │
│                                   Privacy Score renders          │
│                                   Cookie count badge appears     │
│                                   Chart shows categories         │
│                                   Table lists cookie details     │
│                                        │                         │
│                                        ▼                         │
│                                   Cookie Monster button          │
│                                   enables (if cookies found)     │
│                                   Click to delete non-essential  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  4. PREFERENCES                                                  │
│                                                                  │
│     Dashboard → ⚙️ Preferences  ──►  Toggle settings             │
│                                        │                         │
│                                        ▼                         │
│                                   Click "Save Preferences"       │
│                                        │                         │
│                                        ▼                         │
│                                   Reload dashboard               │
│                                   Settings persist ✓             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Expected Console Output (healthy run)

When the dashboard loads and connects a wallet, the browser console should show:

```
MyTermsEthers: Initializing with multi-wallet support...
Contract config loaded: {address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'localhost'}
Contract initialized successfully
```

When Force Batch completes successfully:

```
Batch prepared: {sites: Array(N), hashes: Array(N), count: N}
MyTermsEthers: Resetting configuration...
Contract config loaded: {address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'localhost'}
Contract initialized successfully
Submitting consent batch to blockchain...
Current network: localhost
Estimated gas: ~31589
Transaction submitted: 0x...
Transaction confirmed in block: N
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| MetaMask "can't connect to localhost" | Hardhat node not running | `npm run dev` or `npm run dev:chain` |
| "RPC endpoint returned too many errors" (-32002) | MetaMask rate-limited after repeated failures | MetaMask → switch network away and back; or Settings → Advanced → Reset Account |
| "Wallet not connected or contract not initialized" | Wallet connected before dashboard loaded, event missed | Disconnect and reconnect wallet in MetaMask |
| "Network unknown is not supported" | MetaMask on wrong network | Switch to Localhost 8545 (Chain ID 31337) |
| "Insufficient funds" | Test wallet has no ETH on local chain | `RECIPIENT=0xYourAddr npx hardhat run scripts/fund-wallet.js --network localhost` |
| Timeline shows no data | No consents recorded yet | Browse a site with a cookie banner first |
| Dashboard blank / charts missing | Opened before `npm run dev` was ready | Reload the tab after the READY banner appears |
| Force Batch crashes after confirm | Old bug (fixed in Beta) | Ensure you are on the `Beta` branch |

---

## NPM Scripts Reference

| Command | What it does |
|---|---|
| `npm run dev` | **Start everything** — chain + deploy + dashboard |
| `npm run dev:chain` | Hardhat node only (port 8545) |
| `npm run dev:deploy` | Deploy contract to running local node |
| `npm run dev:fund` | Fund a wallet (set `RECIPIENT=0x...` env var) |
| `npm run dashboard` | Dashboard server only (port 8080) |
| `npm run compile` | Compile Solidity contracts |
| `npm run test` | Run Hardhat contract tests |

---

## Key Addresses (Localhost / Chain ID 31337)

| Item | Value |
|---|---|
| Contract | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Hardhat Account #0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Account #0 Private Key | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |

> These are the standard Hardhat deterministic test accounts. They are publicly known. Never use on mainnet.

---

*Branch: Beta — Last updated: 2026-02-25*
