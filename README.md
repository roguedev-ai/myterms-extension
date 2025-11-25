# MyTerms Browser Plugin + Consent Ledger

## Overview

The MyTerms plugin replaces annoying cookie banners with automated consent handling powered by your own MyTerms Profile.

It:

- Auto-applies your privacy preferences.
- Stores each consent decision locally.
- Batch-logs hashes of decisions on-chain once per day for proof + accountability.

Provides a dashboard to review all logged consents.

## Features

✅ Auto-accept/decline cookie banners.\
✅ Local queue for consents (IndexedDB).\
✅ Daily batch blockchain write (reduces wallet signing fatigue).\
✅ Smart contract ledger (MyTermsConsentLedger.sol).\
✅ Dashboard for history + verification.

## Tech Stack

Smart Contract: Solidity, Hardhat.\
Extension: JavaScript/TypeScript, Manifest v3, IndexedDB.\
Blockchain Interaction: ethers.js.\
UI: Plain JS + minimal HTML/CSS (upgradeable to React).

## Quick Start

> 📖 **New to the project? See [QUICKSTART.md](QUICKSTART.md) for a complete step-by-step guide!**

### Automated Setup (Recommended)
```bash
# 1. Clone and setup
git clone https://github.com/roguedev-ai/myterms-extension.git
cd myterms-extension
./setup.sh

# 2. Load extension in Chrome (see QUICKSTART.md)

# 3. Start local blockchain development
./dev-start.sh
```

### Manual Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile + Test Smart Contract
```bash
npx hardhat compile
npx hardhat test
```

### 3. (Optional) Deploy to Sepolia
```bash
# Copy and configure .env file
cp .env.example .env
# Edit .env with your settings

# Deploy
npx hardhat run scripts/deploy.js --network sepolia
```

### 4. Load Extension in Browser

Open Chrome/Edge → Extensions → "Load unpacked".\
Select `extension/` folder.\
The plugin will auto-run on supported websites.

**For detailed testing instructions, see [TESTING.md](TESTING.md)**

### 5. Dashboard

Open `dashboard/index.html` in a browser.\
Connect wallet → view logged consent history.

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - **⭐ Complete beginner's guide** (start here!)
- **[README.md](README.md)** - This file (overview and quick start)
- **[LOCAL_BLOCKCHAIN.md](LOCAL_BLOCKCHAIN.md)** - Local blockchain setup with Hardhat
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Development guide and workflows
- **[TESTING.md](TESTING.md)** - Comprehensive testing guide
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Dual-dashboard architecture
- **[DASHBOARD_README.md](DASHBOARD_README.md)** - Dashboard server guide

## Repository Structure

```
myterms-consent-plugin/
├── contracts/
│   └── MyTermsConsentLedger.sol     # Solidity smart contract
├── hardhat.config.js                # Hardhat setup for deploy/tests
├── package.json
├── README.md
├── extension/
│   ├── manifest.json                # Browser extension manifest v3
│   ├── background.js                # Handles batching + blockchain writes
│   ├── content.js                   # Injected script to intercept cookie banners
│   ├── popup/
│   │   ├── index.html               # Extension popup UI
│   │   └── popup.js                 # UI logic
│   └── utils/
│       ├── storage.js               # IndexedDB queue logic
│       └── ethers.js                # Blockchain interaction
└── dashboard/
    ├── index.html                   # Simple web dashboard
    ├── app.js                       # Shows consent history
    └── style.css
```

## Development

### Smart Contract

The core contract `MyTermsConsentLedger.sol` provides:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MyTermsConsentLedger {
    event ConsentLogged(address indexed user, string site, bytes32 termsHash, uint timestamp);

    function logConsentBatch(string[] calldata sites, bytes32[] calldata hashes) external {
        require(sites.length == hashes.length, "Mismatched input");
        for (uint i = 0; i < sites.length; i++) {
            emit ConsentLogged(msg.sender, sites[i], hashes[i], block.timestamp);
        }
    }
}
```

**Events:**
- `ConsentLogged(user, siteDomain, termsHash, timestamp)`

**Functions:**
- `logConsent(siteDomain, termsHash)` - Single consent (gas inefficient).
- `logConsentBatch(sites[], hashes[])` - Batch multiple consents.

### Browser Extension

**Manifest v3 Structure:**
- Manages permissions for storage, host access, activeTab.
- Background script for blockchain interactions.
- Content script for DOM manipulation.
- Popup for status + controls.

**Workflow:**
1. Detect cookie banner via DOM observation.
2. Match against stored MyTerms profile.
3. Auto-interact (click accept/decline).
4. Queue consent data locally (IndexedDB).
5. Background job batches.submit after threshold/timer.

### Dashboard

Plain HTML/JS dashboard for viewing logged consents:
- Connect MetaMask/other wallet.
- Display consent timeline.
- Verify proof hashes.
- Export consent data.

## Testnet Deployment

Deployed to Sepolia testnet for development:

```bash
// Contract address (after deployment)
// 0x...MyTermsContractAddress

// Usage in extension:
const contract = new ethers.Contract(
  contractAddress,
  MyTermsConsentLedgerABI,
  signer
);
```

## Roadmap

- **v0.1**: Local consent interception + queue. *(Current)*
- **v0.2**: Smart contract batch logging.
- **v0.3**: Dashboard with verification.
- **v0.4**: Profile-driven negotiations (Agent ↔ Agent).

## Contributing

Fork → Create feature branch → PR.

```bash
git clone https://github.com/roguedev-ai/myterms-consent-plugin.git
cd myterms-consent-plugin
npm install
# Make changes
git add .
git commit -m "Add feature"
git push origin main
