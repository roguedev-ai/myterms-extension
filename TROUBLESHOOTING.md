# Troubleshooting Guide

---

## MetaMask / Blockchain Issues

### "Can't connect to localhost" or `-32002` RPC Error

**Cause:** Hardhat node is not running, or MetaMask is rate-limited after repeated failed calls to a stopped node.

**Fix:**
1. Start the chain: `npm run dev` (or `npm run dev:chain`)
2. In MetaMask: switch to Sepolia → switch back to **Localhost 8545**
3. If still failing: MetaMask → Settings → Advanced → **Reset Account**
   (Clears cached nonce and RPC state. Does not delete your wallet.)

---

### "Wallet not connected or contract not initialized"

**Cause:** The dashboard loaded before MetaMask connected, and the wallet-change event was missed.

**Fix:** Disconnect and reconnect in MetaMask (click the account → disconnect from localhost:8080 → reconnect).

---

### "Network unknown is not supported"

**Cause:** MetaMask is on the wrong network.

**Fix:** Switch MetaMask to **Localhost 8545** (Chain ID 31337) or **Sepolia** (Chain ID 11155111).

---

### "Insufficient funds for transaction"

**Cause:** Your MetaMask wallet has no ETH on the local chain. The chain resets every time `npm run dev` starts.

**Fix:**
```bash
RECIPIENT=0xYourAddress npm run dev:fund
```

Or import the pre-funded Hardhat account (10,000 ETH):
```
Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

---

### Force Batch fails with `DataCloneError`

**Cause:** Old bug — `receipt.confirmations` in ethers.js v6 is a function, not a value. Fixed in `delta`.

**Fix:** Ensure you are on the `delta` branch: `git checkout delta`

---

### Transaction rejected — MetaMask popup appeared but I dismissed it

**Cause:** Expected. You rejected the transaction.

**Fix:** Click Force Batch again and confirm in MetaMask.

---

## Extension Issues

### "Loaded 0 CMP rules for detection"

**Cause:** On a fresh install, `chrome.storage.local` has no cached rules because the background has not yet run a sync. Fixed in `delta` — content script now bootstraps rules from `default-rules.json` on first load.

**Fix:** Ensure you are on `delta`. If still happening, check the extension service worker console for import errors.

---

### Extension detects a `<style>` tag as a cookie banner

**Cause:** Old heuristic bug — Cookiebot's injected `<style>` tag contains cookie-related CSS class names that scored above the detection threshold. Fixed in `delta`.

**Fix:** Ensure you are on `delta`.

---

### Dashboard shows "No Consents Found" after chain restart

**Cause:** The Hardhat chain was restarted (block 0 = no transaction history). The IndexedDB consent queue in the extension persists across chain restarts — only blockchain records reset.

**Fix:** Browse a site with a cookie banner to capture new consents, then click Force Batch.

---

### Timeline items are missing

**Fix:** Visit a site with an active cookie banner (e.g. any EU news site, stackoverflow.com). The extension only records consents after a banner is detected and interacted with.

---

## Dashboard Issues

### Wallet section shows "Blockchain features disabled"

**Cause:** The "Blockchain Recording" preference is off.

**Fix:** Dashboard → ⚙️ Preferences → enable **Blockchain Recording** → Save Preferences.

---

### Cookie scan shows mostly "Unknown" cookies

**Cause:** The current classifier uses ~30 regex patterns — cookies from less common platforms fall through.

**Planned fix:** The next release integrates the Open Cookie Database (826 named entries, Apache 2.0 license) as a bundled lookup table with weekly background updates. See [ROADMAP.md](ROADMAP.md).

---

### Charts not rendering

**Cause:** Dashboard opened before `npm run dev` finished starting.

**Fix:** Reload the browser tab after the READY banner appears in the terminal.

---

## Extension Not Loading

### Extension shows error badge in `chrome://extensions`

1. Click **Errors** on the extension card
2. Read the actual error text at the top (not the source listing — that's the linked file, not the error)
3. Common causes: missing JS file, syntax error, bad import path

Check the service worker console: `chrome://extensions` → MyTerms → Inspect worker → Console tab.

---

## Getting More Help

- Open an issue: https://github.com/roguedev-ai/myterms-extension/issues
- Full test workflow: [TESTING_WORKFLOW.md](TESTING_WORKFLOW.md)
