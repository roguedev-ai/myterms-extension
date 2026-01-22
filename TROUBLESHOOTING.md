# Troubleshooting Guide

### 3. CMP Detector Not Working
**Symptoms:** No banners are detected, or "Rules not loaded" warning in console.
**Cause:**
*   Network firewall blocking access to GitHub (Rule Source).
*   Missing `default-rules.json` fallback.
**Solution:**
*   ConsentChain V2.1 includes a **Bundled Fallback** mechanism. If the network sync fails, it automatically loads local rules.
*   Verify `extension/default-rules.json` exists.
*   Check console for "Fallback success: Synced default rules". & Fixes

### 1. "Localhost Bridge connection failed" / Dashboard not loading data
**Symptoms:**
*   The Dashboard (`http://localhost:3000`) loads but shows "0 Consents" or loading spinners forever.
*   Console error: `Request timed out` or `Message port closed`.

**Causes:**
*   The extension is not permitted to communicate with the local dashboard page.
*   The extension background script is inactive.

**Fixes:**
1.  **Reload the Extension**: Go to `chrome://extensions`, find ConsentChain, and click the refresh icon.
2.  **Reload the Dashboard**: Refresh the localhost page *after* reloading the extension.
3.  **Check Protocol**: Ensure you are using `http://localhost:3000`, NOT `file:///.../index.html`. The bridge requires HTTP/HTTPS.

---

### 2. "CMP Not Detected" (Banner stays visible)
**Symptoms:**
*   You visit a site (e.g., `example.com`) and the cookie banner remains.

**Fixes:**
1.  **Check Rules**: We support 200+ CMPs. If the site uses a custom banner, it might not be in our rule list.
2.  **Legacy Fallback**: Wait 3-5 seconds. Our heuristic detector runs after the main rule engine.
3.  **Inspect**: Open Developer Tools (`F12`) -> Console. Look for `[ConsentChain]` logs.
    *   If you see "No CMP matched", please submit an issue with the URL.

---

### 3. "Wallet not connected" / "User denied transaction"
**Symptoms:**
*   Clicking "Force Batch" does nothing or fails immediately.

**Fixes:**
1.  **Unlock MetaMask**: Ensure your wallet extension is unlocked.
2.  **Network**: Ensure MetaMask is connected to **Localhost 8545** (or Sepolia if configured), NOT Mainnet.
3.  **Reset Account**: If using Localhost, sometimes nonces get out of sync. In MetaMask: Settings -> Advanced -> Clear Activity Tab Data.

---

### 4. "Service Worker Inactive"
**Symptoms:**
*   Extension icon is gray or unresponsive.

**Fixes:**
1.  This is normal logic for Chrome Manifest V3; it puts workers to sleep.
2.  Clicking the extension icon wakes it up.
3.  If it persists, check `chrome://extensions` for errors.

---

## Debugging Mode

To see verbose logs:
1.  Open `extension/content.js`.
2.  Ensure `console.log` statements are not commented out (V2.0 has verbose logging enabled by default).
3.  Filter Console by `MyTerms` or `ConsentChain`.
