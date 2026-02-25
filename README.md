# MyTerms — Privacy Consent Ledger

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-v2.0--delta-blue.svg)
![Status](https://img.shields.io/badge/status-feature--frozen-brightgreen.svg)
![Branch](https://img.shields.io/badge/branch-delta-purple.svg)

**Your Privacy, On-Chain.**

MyTerms (ConsentChain) is a Manifest V3 Chrome extension that automatically detects cookie consent banners, applies your preferences, records every decision with a cryptographic hash, and commits consent proofs to the Ethereum blockchain.

> **Current Branch**: `delta` (feature-frozen, stable)
> **Ethereum**: Sepolia testnet + Hardhat localhost
> **Dual-Chain (Zcash)**: Architecture complete, implementation planned for next release

---

## What It Does

| Feature | Status | Description |
|---|---|---|
| **Hybrid CMP Detection** | ✅ Working | Consent-O-Matic rules (200+ CMPs) + heuristic fallback |
| **Automated Banner Handling** | ✅ Working | Applies your Accept/Decline preference automatically |
| **Consent Timeline** | ✅ Working | Every decision stored in IndexedDB with hash + timestamp |
| **Agreement Capture** | ✅ Working | Full banner text stored and viewable in dashboard |
| **Cookie Monster** | ✅ Working | Scan, classify, and delete tracking cookies |
| **Blockchain Batch** | ✅ Working | Submit consent proofs to Ethereum via MetaMask |
| **Privacy Dashboard** | ✅ Working | Timeline, sites, analytics, agreements, cookie analysis |
| **Proverb Engine** | ✅ Architecture | SHA-256 consent proofs + Zcash memo format (Zcash layer is stubbed) |
| **Dual-Chain (Zcash)** | 🔜 Planned | Full Zcash shielded inscription — next release |

---

## Quick Start

**Prerequisites**: Node.js 18+, Chrome, MetaMask extension, Git

```bash
# 1. Clone and install
git clone https://github.com/roguedev-ai/myterms-extension.git
cd myterms-extension
git checkout delta
npm install

# 2. Start full dev environment (chain + contract deploy + dashboard)
npm run dev

# 3. Load extension in Chrome
# chrome://extensions → Developer mode → Load unpacked → select extension/
```

Then open **http://localhost:8080** and connect MetaMask to **Localhost 8545** (Chain ID 31337).

Full instructions → **[QUICKSTART.md](QUICKSTART.md)**

---

## Documentation

| File | What It Covers |
|---|---|
| [QUICKSTART.md](QUICKSTART.md) | Step-by-step setup on a new machine |
| [TESTING_WORKFLOW.md](TESTING_WORKFLOW.md) | Test scenarios, expected console output, troubleshooting |
| [LOCAL_BLOCKCHAIN.md](LOCAL_BLOCKCHAIN.md) | Hardhat node, contract deploy, MetaMask config |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and component map |
| [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md) | Detection engine, proverb system, cookie classifier |
| [ROADMAP.md](ROADMAP.md) | Dual-chain implementation plan, cookie database upgrade |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Known issues and fixes |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Contributing, project structure, branch strategy |

---

## Architecture Overview

```
Browser Tab
    │
    ▼
content.js ──────────────────────────────────────────────►  IndexedDB
(Consent-O-Matic + heuristic detection)                     (consent queue
    │                                                         agreement text)
    │ chrome.runtime.sendMessage(CONSENT_CAPTURED)                │
    ▼                                                             │
background.js ◄──────────────────────────────────────────────────┘
(routing, storage, batch management)
    │
    │ window.postMessage bridge
    ▼
Dashboard (localhost:8080)
    │
    ├── ethers.js + MetaMask
    │       │
    │       ▼
    │   MyTermsConsentLedger.sol
    │   (Ethereum / Hardhat / Sepolia)
    │
    └── ProverbEngine + DualChainManager
            │
            ▼
        Zcash (stubbed — planned)
```

---

## NPM Scripts

| Command | What it does |
|---|---|
| `npm run dev` | **Start everything** — Hardhat node + deploy + dashboard |
| `npm run dev:chain` | Hardhat node only |
| `npm run dev:deploy` | Deploy contract to running node |
| `npm run dev:fund` | Fund a wallet (set `RECIPIENT=0x...`) |
| `npm run dashboard` | Dashboard server only (port 8080) |
| `npm run compile` | Compile Solidity |
| `npm run test` | Run contract tests |

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Last stable release |
| `alpha` | Alpha testing (v2.0-alpha.1) |
| `Beta` | Beta stabilization |
| `delta` | **Current — feature-frozen, documented** |
| `feature/*` | Individual feature development |

---

## License

MIT
