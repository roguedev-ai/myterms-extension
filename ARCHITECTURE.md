# MyTerms — Architecture (delta)

**Branch**: `delta` (feature-frozen)
**Last updated**: 2026-02-25

---

## System Overview

MyTerms is a Manifest V3 Chrome extension with three layers:

1. **Content Script** — detects cookie banners on every page and captures consent decisions
2. **Background Service Worker** — stores decisions, manages batching, coordinates blockchain submission
3. **Dashboard** — local web app (localhost:8080) for viewing history and triggering blockchain writes

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (Chrome)                         │
│                                                                   │
│  ┌──────────────────┐      ┌───────────────────────────────┐    │
│  │  Any Web Page    │      │  Dashboard (localhost:8080)    │    │
│  │                  │      │                                │    │
│  │  content.js      │      │  app.js                       │    │
│  │  ─────────────   │      │  AnalysisController           │    │
│  │  CMP detection   │      │  Timeline / Sites / Cookies   │    │
│  │  Banner capture  │      │  Agreements / Preferences     │    │
│  │  Hash generation │      └──────────────┬────────────────┘    │
│  └────────┬─────────┘                     │ window.postMessage  │
│           │ chrome.runtime                 │ (bridge)            │
│           │ sendMessage                    │                     │
│           ▼                               ▼                     │
│  ┌────────────────────────────────────────────────────────┐     │
│  │               background.js (Service Worker)            │     │
│  │                                                          │     │
│  │  ConsentManager    ← queues + batches consent events    │     │
│  │  DualChainManager  ← coordinates blockchain writes      │     │
│  │  CookieClassifier  ← categorizes cookies on demand      │     │
│  │  RuleSyncService   ← keeps CMP rules up to date         │     │
│  └───────────────────────────┬────────────────────────────┘     │
│                               │                                   │
│              ┌────────────────┴──────────────────┐               │
│              │                                   │               │
│              ▼                                   ▼               │
│       ┌────────────┐                    ┌─────────────────┐      │
│       │  IndexedDB │                    │    MetaMask     │      │
│       │            │                    │                 │      │
│       │ consentQueue│                   └────────┬────────┘      │
│       │ agreements  │                            │ JSON-RPC      │
│       │ batches     │                            ▼               │
│       └────────────┘                   ┌─────────────────┐      │
│                                        │  Hardhat / ETH  │      │
│                                        │  localhost:8545  │      │
│                                        │  (or Sepolia)   │      │
│                                        └────────┬────────┘      │
└─────────────────────────────────────────────────┼───────────────┘
                                                  │
                                                  ▼
                                        MyTermsConsentLedger.sol
                                        logConsentBatch(sites, hashes)
```

---

## Component Detail

### content.js — Detection & Capture

**Hybrid detection pipeline:**

```
Page loads
    │
    ▼
RuleSyncService.getLocalRules()
    │
    ├── Rules found? ──► ConsentOMaticAdapter
    │                    (matches 200+ known CMPs via CSS selectors)
    │                    (executes ACCEPT_ALL / DECLINE_ALL actions)
    │
    └── No match ──────► Legacy heuristic detector
                         (scores DOM elements: keywords, position, buttons)
                         (threshold: score ≥ 6)
                         (excludes <style>, <script>, non-visual tags)
    │
    ▼
Banner found → recordConsent(element, decision)
    ├── Generate SHA-256 hash of banner text
    ├── Send CONSENT_CAPTURED to background.js
    │       { siteDomain, url, termsHash, bannerContent, accepted, timestamp }
    └── Mark element as scanned (data-myterms-scanned)
```

### background.js — Routing & Storage

Central message router. Handles all `chrome.runtime.sendMessage` calls from both content scripts and the dashboard bridge.

| Message type | Handler | What it does |
|---|---|---|
| `CONSENT_CAPTURED` | ConsentManager | Adds to IndexedDB queue + stores agreement text |
| `PREPARE_BATCH` | ConsentManager | Groups unsubmitted consents by domain, returns sites+hashes |
| `BATCH_COMPLETE` | ConsentManager | Marks consents as batched, records tx hash |
| `GET_ALL_CONSENTS` | Storage | Returns all consent records |
| `GET_STATS` | Storage | Returns totals (consents, sites, batches) |
| `GET_ALL_AGREEMENTS` | Storage | Returns all agreement texts |
| `GET_PREFERENCES` | chrome.storage.sync | Returns user preference settings |
| `ANALYZE_COOKIES` | CookieClassifier | Scans browser cookies, returns categories + score |
| `COOKIE_MONSTER` | CookieClassifier | Deletes cookies in specified categories |
| `REGISTER_DUAL_CHAIN_CONSENT` | DualChainManager | (Stubbed) Triggers proverb + dual-chain flow |

### Dashboard — localhost:8080

Single-page application. Communicates with the extension via a `window.postMessage` bridge (content.js running on localhost:8080 forwards messages to background.js).

**Views:**
- **📅 Timeline** — Consent history with chart
- **🌐 Sites** — Per-domain statistics
- **📈 Analytics** — Decision charts
- **📜 Agreements** — Full banner text captured per domain
- **🍪 Cookies** — Cookie scan, categorization, Cookie Monster deletion
- **⚙️ Preferences** — User settings, blockchain recording toggle

---

## Data Flow: Consent to Blockchain

```
1. User visits site with cookie banner

2. content.js detects banner
   → generates termsHash = SHA-256(bannerText)
   → sends CONSENT_CAPTURED {siteDomain, termsHash, bannerContent, accepted}

3. background.js receives CONSENT_CAPTURED
   → consentStorage.addToQueue(consent)     → IndexedDB: consentQueue
   → consentStorage.storeAgreement(...)     → IndexedDB: agreementText

4. User clicks "⚡ Force Batch" in dashboard

5. dashboard sends PREPARE_BATCH
   → background groups unsubmitted consents by domain
   → returns { sites: [...], hashes: [...], count: N }

6. dashboard calls myTermsEthers.submitConsentBatch(sites, hashes)
   → MetaMask popup for user signature
   → ethers.js submits logConsentBatch() transaction
   → waits for confirmation

7. dashboard sends BATCH_COMPLETE {txHash, blockNumber, ...}
   → background marks consents as batched in IndexedDB
```

---

## Storage Schema (IndexedDB: MyTermsExtensionDB v2)

### consentQueue
KeyPath: `id` (auto-increment)

```js
{
  id: number,
  siteDomain: string,        // "example.com"
  url: string,               // full URL
  termsHash: string,         // "0x13f244..." (bytes32)
  bannerContent: string,     // full banner text
  accepted: boolean,
  decisionType: 'accept' | 'decline',
  timestamp: number,
  batched: boolean,
  batchId: string | null,
  batchedAt: number | null
}
```

### agreementText
KeyPath: `termsHash` (unique — deduplicates identical banners)

```js
{
  termsHash: string,   // primary key
  text: string,        // full banner text
  url: string,
  siteDomain: string,
  firstSeen: number    // timestamp
}
```

### processedBatches
KeyPath: `batchId`

```js
{
  batchId: string,
  processedDate: number,
  transactionHash: string,
  consentIds: number[],
  gasUsed: string,
  blockNumber: number
}
```

---

## What Goes On-Chain

Only **domain strings** and **SHA-256 hashes** are written to Ethereum. No personal data, no banner text, no user identifiers beyond the wallet address (which the user controls).

```solidity
event ConsentLogged(
    address indexed user,    // wallet — user controls this
    string siteDomain,       // "example.com"
    bytes32 termsHash,       // hash of banner content
    uint256 timestamp
)
```

The hash serves as a verifiable fingerprint. The actual banner text stays in the user's browser. Anyone who has the text can verify it matches the on-chain hash; no one can reconstruct the text from the hash alone.

---

## Dual-Chain Architecture (Planned)

See [ROADMAP.md](ROADMAP.md) for implementation details.

The Proverb Engine (`utils/proverb-engine.js`) and DualChainManager (`utils/dual-chain.js`) are fully architected in delta. The Ethereum integration is complete. The Zcash layer is stubbed pending availability of the `@chainsafe/webzjs-wallet` WASM package.

```
Full dual-chain vision:

User preference hash ──► Zcash shielded tx memo (PRIVATE)
                              "I agreed to SD-BY terms"

Site domain + termsHash ─► Ethereum logConsentBatch (PUBLIC)
                              "0x4ddE... agreed to example.com hash"

Combined: verifiable proof of what you agreed to AND that you agreed
          without either record alone revealing both pieces.
```

---

## File Map

```
extension/
├── manifest.json
├── background.js              Service worker — message routing + storage
├── content.js                 Injected into every page — detection + capture
├── popup/
│   └── index.html             Extension toolbar popup (quick stats)
├── dashboard/
│   ├── index.html             Full dashboard UI
│   ├── app.js                 Dashboard SPA logic (~1600 lines)
│   └── style.css
├── utils/
│   ├── storage.js             IndexedDB wrapper (consentQueue, agreementText, batches)
│   ├── ethers.js              Contract interaction + wallet management
│   ├── ethers-v6.js           ethers.js v6 library (bundled)
│   ├── wallet-manager.js      Multi-wallet support
│   ├── cookie-classifier.js   Cookie → category mapping
│   ├── proverb-engine.js      SHA-256 consent proof generation
│   ├── dual-chain.js          Zcash + Ethereum orchestration
│   ├── zcash-client.js        Zcash WASM interface (stubbed)
│   └── myterms.js             IEEE P7012 agreement templates
├── lib/
│   ├── consent-o-matic/       CMP detection rules engine
│   │   ├── detector.js
│   │   ├── actions.js
│   │   └── matcher.js
│   ├── adapters/
│   │   └── consentOMatic-adapter.js
│   ├── rule-sync/
│   │   └── sync-service.js    Remote CMP rule fetching + caching
│   └── policy-extractor/
│       └── extractor.js       Privacy policy DOM parsing
├── libs/
│   ├── chart.js               Chart.js (bundled)
│   ├── idb.js                 IndexedDB helper (bundled)
│   └── webzjs.js              Zcash WASM (MOCK — see ROADMAP.md)
├── default-rules.json         Bundled CMP rules (Cookiebot, OneTrust, etc.)
└── icons/
```
