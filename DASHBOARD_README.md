# MyTerms Dashboard - Web Version

The MyTerms dashboard can now be accessed as a regular web page with full MetaMask/wallet support!

## Why Use the Web Dashboard?

When you access the dashboard via `chrome-extension://` URLs, MetaMask and other wallet providers **cannot inject** `window.ethereum`. This means:
- ❌ Can't connect wallets
- ❌ Can't sign transactions
- ❌ Can't use Force Batch feature

When you access the dashboard via `http://localhost:8080`:
- ✅ MetaMask works normally
- ✅ Can connect any wallet (MetaMask, WalletConnect, etc.)
- ✅ Can sign and submit batches to blockchain
- ✅ Full functionality available

## How to Use

### 1. Start the Dashboard Server

```bash
npm run dashboard
```

This will start a local server at `http://localhost:8080`

### 2. Reload the Extension

Go to `chrome://extensions` and click the refresh button on MyTerms Consent Manager.

### 3. Open the Dashboard

Navigate to: **http://localhost:8080**

### 4. Connect Your Wallet

Click "Connect Wallet" and approve the MetaMask connection.

### 5. Use Force Batch

Click "Force Batch" to submit your queued consents to the blockchain!

## Architecture

The web dashboard communicates with the extension using a **message bridge**:

1. Dashboard (localhost) → Content Script → Background Script
2. Background Script processes request
3. Background Script → Content Script → Dashboard

This allows the dashboard to access all extension data while running in a normal web context where wallets work.

## Security Note

The dashboard server **only** serves static files from your local extension directory. It does not:
- Accept external connections
- Store any data
- Make external requests

All data stays within your extension and local machine.
