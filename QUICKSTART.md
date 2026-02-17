# ConsentChain Quickstart Guide (v2.0-alpha.1)

Get up and running with the ConsentChain extension in minutes.

## Prerequisites

- **Node.js**: v14+ (Recommended: v18 LTS)
- **Browser**: Google Chrome, Brave, or any Chromium-based browser.
- **Git**: To clone the repository.

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/roguedev-ai/myterms-extension.git
cd myterms-extension
```

### 2. Switch to Alpha Branch

The latest stable release is on the `alpha` branch.

```bash
git fetch origin alpha
git checkout alpha
```

### 3. Install Dependencies

```bash
npm install
```

### C. Build the Extension
The extension code is mostly raw JS, but we need to ensure local rules and libraries are ready.
```bash
npm run build  # Optional if setup.sh ran successfully
```

---

## 2. Load the Extension

1.  Open your browser (Chrome/Edge).
2.  Navigate to `chrome://extensions`.
3.  Enable **Developer Mode** (toggle in top right).
4.  Click **"Load unpacked"**.
5.  Select the `extension/` folder inside the key `myterms-extension` directory.
6.  You should see the **ConsentChain** icon appear in your toolbar.

---

## 3. Local Environment Setup

To use the full batching and verification features, you need a local blockchain and the dashboard.

### Start the Dev Environment
```bash
./dev-start.sh
```
This script will:
1.  Start a local Hardhat node (simulated blockchain).
2.  Deploy the `MyTermsConsentLedger` smart contract.
3.  Start the Dashboard server at `http://localhost:3000`.

---

## 4. Usage

### A. Configuration
1.  Click the **ConsentChain icon** in your browser toolbar.
2.  Go to **Preferences**.
3.  Set your desired logic (e.g., "Reject All" vs "Necessary Only").

### B. Browse the Web
Visit a site with a cookie banner (e.g., `stackoverflow.com`, `cookiebot.com`).
*   **Observe**: The banner should disappear automatically.
*   **Verify**: The extension icon badge will increment.

### C. The Dashboard
1.  Go to `http://localhost:3000/dashboard/index.html`.
2.  **Connect Wallet**: Click the button to connect MetaMask (use Localhost 8545 network).
3.  **Timeline**: View your recent automated consents.
4.  **Analytics**: See your Privacy Score and saved time.
5.  **Force Batch**: Click the lightning bolt to write your pending consents to the local blockchain.

---

## Next Steps
*   Explore **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** if you have issues.
*   Read **[TECHNICAL_SPEC.md](TECHNICAL_SPEC.md)** to understand the Dual-Chain architecture.
