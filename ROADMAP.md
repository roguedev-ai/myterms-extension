# MyTerms — Roadmap

This document describes features that are architected and stubbed in the `delta` branch but deferred to future releases, along with the implementation plan for each.

---

## Feature 1 — Dual-Chain (Zcash Privacy Layer)

### What It Is

The Proverb Engine generates a compact, cryptographic proof of a user's consent preferences and inscribes it into a Zcash **shielded transaction** memo field. This creates a private, tamper-proof record of *what* a user agreed to, while the Ethereum layer records *that* they agreed (publicly, with the domain and hash).

The two chains complement each other:

```
ZCASH (private)                        ETHEREUM (public)
─────────────────────────────          ──────────────────────────────
Proverb memo:                          logConsentBatch():
  { v:1, t:'proverb',                    sites: ["example.com"]
    a:'SD-BY', b:0b00001,                hashes: ["0x13f244..."]
    ts:1771970006385 }                 → ConsentLogged event on-chain
  → shielded self-send tx
  → txid: abc123...

User can prove what they agreed to      Anyone can verify the domain+hash
without revealing it publicly.          without knowing the content.
```

### Current State in `delta`

All architecture is in place. The Ethereum half works end-to-end. The Zcash half is stubbed:

| Component | File | Status |
|---|---|---|
| ProverbEngine | `extension/utils/proverb-engine.js` | ✅ Complete — hash generation, bit encoding, memo format |
| DualChainManager | `extension/utils/dual-chain.js` | ✅ Complete — orchestration flow |
| ZcashClient | `extension/utils/zcash-client.js` | ⚠️ Stubbed — uses mock `webzjs.js` |
| webzjs.js | `extension/libs/webzjs.js` | ❌ Mock — real library not yet available |
| Ethereum tx in dual-chain | `dual-chain.js` line 83 | ❌ Returns `0xmockethhash + Date.now()` |
| UI trigger | — | ❌ `REGISTER_DUAL_CHAIN_CONSENT` message never sent from UI |

### Implementation Plan

**Step 1 — Replace the Zcash WASM stub**

The code targets `@chainsafe/webzjs-wallet`. When the package becomes available on npm or as a distributable WASM bundle:

```bash
npm install @chainsafe/webzjs-wallet
# replace extension/libs/webzjs.js with the real package output
```

The `ZcashClient` API surface (`initialize()`, `createWallet()`, `getWallet()`) is already written to match the expected real API. Only the library file needs replacing.

**Step 2 — Replace the mock Ethereum registration**

In `extension/utils/dual-chain.js`, replace line 83:

```js
// REMOVE:
const ethereumTxHash = '0xmockethhash' + Date.now();

// REPLACE WITH:
const tx = await this.consentContract.registerDualChainConsent(
    agreementHash,
    proverbHashBytes,
    zcashTxRef
);
await tx.wait(1);
const ethereumTxHash = tx.hash;
```

This requires deploying an updated `MyTermsConsentLedger.sol` with a `registerDualChainConsent()` function, and initializing `this.consentContract` in `DualChainManager.initialize()`.

**Step 3 — Wire UI trigger**

Add a "Register with Dual-Chain" button to the dashboard preferences or consent detail view that sends:

```js
chrome.runtime.sendMessage({
    type: 'REGISTER_DUAL_CHAIN_CONSENT',
    payload: { preferences, dataController, agreementId }
});
```

The background handler at `background.js:348` is already written and waiting.

**Step 4 — User Zcash wallet flow**

Users need to create or import a Zcash shielded address. Add a wallet setup step to the preferences view:
- Generate a new wallet from a seed phrase
- Or import an existing Zcash address
- Store the seed phrase encrypted in `chrome.storage.local`

---

## Feature 2 — Cookie Database Upgrade

### Current State

The cookie classifier (`extension/utils/cookie-classifier.js`) uses ~30 hardcoded regex patterns. Cookies that don't match any pattern are classified as **Unknown**. On most modern sites, Unknown makes up 40–60% of all cookies.

### Planned Upgrade: Open Cookie Database Integration

**Source:** [Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database)
- 826 named cookies from major platforms
- CSV + JSON formats
- Apache 2.0 license (free to bundle and redistribute)
- Actively maintained (community, 24+ contributors, last updated 2025)
- Categories: `Functional`, `Analytics`, `Marketing`, `Security` — exact match with current classifier

**Supplementary source:** [CookieBlock known_cookies.json](https://github.com/dibollinger/CookieBlock) (MIT license)
- ~150 high-confidence domain-specific overrides
- Handles cookies where the same name has different meanings per domain

### Implementation Plan

**Step 1 — Build script: flatten the Open Cookie Database**

Create `scripts/build-cookie-lookup.js`:

```js
// Fetches open-cookie-database.json and transforms:
// { platform: { cookies: [{name, category, wildcardMatch}] } }
// into flat lookup:
// { "_ga": "Analytics", "_fbp": "Marketing", ... }
// Plus a wildcard array: [{ prefix: "_ga_", category: "Analytics" }]
```

Run at release time:
```bash
node scripts/build-cookie-lookup.js > extension/data/cookie-lookup.json
```

**Step 2 — Update cookie-classifier.js**

Classification priority order:

1. Domain + name exact match (CookieBlock overrides)
2. Name exact match (Open Cookie Database flat lookup from `chrome.storage.local`)
3. Wildcard/prefix match (Open Cookie Database wildcard entries)
4. Existing regex patterns (current classifier — catches patterns not in DB)
5. Unknown

**Step 3 — Background weekly refresh**

In `background.js`, add a weekly fetch from jsDelivr CDN:

```js
const LOOKUP_URL = 'https://cdn.jsdelivr.net/gh/jkwakman/Open-Cookie-Database@master/open-cookie-database.json';
```

On success, flatten and store in `chrome.storage.local` as `cookieLookup`. The classifier reads from storage first, falls back to bundled `cookie-lookup.json` if storage is empty.

**Expected impact:** Unknown classifications drop from ~50% to under 10% on typical browsing sessions.

---

## Feature 3 — Chrome Web Store Publication

Before publishing to the Chrome Web Store:

1. Replace all `http://localhost` references with production URLs
2. Finalize Sepolia contract address as the primary network
3. Remove Hardhat/localhost network from the supported networks list (or gate it behind a developer mode flag)
4. Add extension icon set (16, 32, 48, 128px)
5. Write the store listing description and screenshots
6. Submit for Chrome Web Store review (~1–3 business days)

---

## Branch Strategy Going Forward

```
delta (feature-frozen)
    │
    ├── feature/dual-chain-zcash     ← replace webzjs stub
    ├── feature/cookie-database      ← Open Cookie Database integration
    └── feature/webstore-prep        ← production config + store listing
            │
            ▼
          epsilon (next release)
```

---

*Last updated: 2026-02-25 — Branch: delta*
