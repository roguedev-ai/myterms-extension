# Quickstart: Dual-Chain Protocol Feature

This branch (`feature/dual-chain-protocol`) implements the **Generic Dual-Chain Consent Protocol** using a Vanilla JS adapter approach.

## Prerequisites
- Node.js & npm (for installing dependencies)
- Chrome Browser (for loading the extension)
- Git

## Installation

1.  **Checkout the Branch**
    ```bash
    git checkout feature/dual-chain-protocol
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Vendor Libraries**
    Run the helper script to copy necessary node modules to the extension directory:
    ```bash
    node scripts/vendor-libs.js
    ```
    *This creates/updates `extension/libs/idb.js`.*
    *Note: `extension/libs/webzjs.js` is currently a MOCK implementation included in the repo.*

## Loading the Extension

1.  Open Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer Mode** (top right).
3.  Click **Load unpacked**.
4.  Select the `extension/` directory inside this repository.

## Verification Steps

### 1. Verify Structure
Open the extension's background page (Service Worker) DevTools:
- Go to `chrome://extensions`.
- Click "service worker" under "ConsentChain".
- In the Console, ensure there are no errors.
- You should see: `DualChainManager: Initialized`.

### 2. Test Dual-Chain Registration
Run the following command in the **Service Worker Console** to simulate a Dapp requesting consent registration:

```javascript
chrome.runtime.sendMessage({
  type: 'REGISTER_DUAL_CHAIN_CONSENT',
  payload: {
    preferences: { 
        trackingAllowed: false,
        analyticsAllowed: true 
    },
    dataController: '0x1234567890123456789012345678901234567890',
    agreementId: 'SD-BY-A'
  }
}, (response) => {
    console.log('Registration Result:', response);
});
```

### 3. Expected Output
You should see a JSON response logged:
```json
{
    "success": true,
    "result": {
        "ethereumTxHash": "0xmockethhash...",
        "zcashTxId": "txid_mock_...",
        "proverbHash": "...",
        "agreementHash": "...",
        "timestamp": 1700000000000
    }
}
```

## Troubleshooting
- **"DualChainManager is not defined"**: Ensure you reloaded the extension after running the vendor script.
- **"npm install failed"**: If `@chainsafe/webzjs-wallet` fails to install, ensure you are using the mock provided in `extension/libs/webzjs.js` and not trying to import the missing package directly.
