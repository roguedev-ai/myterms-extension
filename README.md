# ConsentChain (Alpha)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-v2.0--alpha.1-orange.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

**Your Privacy, On-Chain.**

ConsentChain (formerly MyTerms) is a Web3-powered browser extension that automates your cookie consent preferences and secures your choices on the blockchain.

> **Current Release**: `v2.0-alpha.1` (Branch: `alpha`)
> **Core Features**: Hybrid Detection (Consent-O-Matic + Heuristics), Zcash Inscriptions (Mock), Ethereum Registry (Sepolia).

## 🚀 Key Features

*   **🛡️ Automated Protection**: Instantly detects and handles 200+ CMP types (OneTrust, Quantcast, Cookiebot, etc.).
*   **🍪 Cookie Monster**: Visualize and delete tracking cookies directly from the dashboard.
*   **🔗 Blockchain Verified**: Inscribes a privacy "Proverb" to Zcash (Shielded) and registers the commitment on Ethereum.
*   **📊 Transparency Dashboard**: Track every consent decision with cryptographic proof.

---

## Key Features

| Feature | Description |
| :--- | :--- |
| **Hybrid Detection Engine** | Combines **Consent-O-Matic** rules (200+ sites) with custom semantic heuristics for maximum coverage. |
| **Privacy Proverbs** | Generates a hash (`SHA-256`) of your specific policy preferences (e.g., "Analytics: NO", "Functional: YES"). |
| **Dual-Chain Storage** | **Public**: Ethereum/Sepolia for immutable policy anchoring.<br>**Private**: Zcash shielded transactions for user anonymity. |
| **Cookie Monster** | Scans your browser for tracking cookies and deletes them if they mismatch your defined policy. |
| **Dashboard** | A clean, local interface to view your consent timeline, manage keys, and verify blockchain proofs. |

---

## 🚀 Getting Started

We have simplified the setup process. Please refer to our **[QUICKSTART.md](QUICKSTART.md)** for a step-by-step guide.

### Quick Command Line Setup
```bash
# 1. Clone the repo
git clone https://github.com/roguedev-ai/myterms-extension.git
cd myterms-extension

# 2. Setup dependencies (includes rule sync)
./setup.sh

# 3. Start local development environment
./dev-start.sh
```

---

## Documentation

*   **[QUICKSTART.md](QUICKSTART.md)**: Installation, Wallet Setup, and First Run.
*   **[ALPHA_RELEASE_NOTES.md](ALPHA_RELEASE_NOTES.md)**: Latest bug fixes and patch notes for the alpha build.
*   **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**: Common issues (Localhost bridge, CMP detection failures).
*   **[TECHNICAL_SPEC.md](TECHNICAL_SPEC.md)**: Deep dive into the Hybrid Architecture, Adapters, and Proverb Engine.
*   **[EXECUTIVE_BRIEF.md](EXECUTIVE_BRIEF.md)**: High-level summary for stakeholders.

---

## Architecture: The V2 Hybrid Engine

ConsentChain V2 uses a layered approach to handling banners:

1.  **Rule-Based Detection (Fast)**: Checks the site against a local cache of ~200 known CMP rules (synced from Consent-O-Matic). If a match is found (e.g., OneTrust), it uses the specific rule to extract policy data and execute the decision.
2.  **Heuristic Fallback (Smart)**: If no rule matches, the legacy `EnhancedBannerDetector` scans the DOM for common patterns (buttons labeled "Technically Necessary", "Reject All", etc.) and attempts to negotiate.

### System Components
*   **Extension**: Manifest V3, Content Scripts, Background Worker.
*   **Smart Contract**: `MyTermsConsentLedger.sol` (Batch logging).
*   **Dashboard**: Local web app for analytics and control.

---

## Contributing

We welcome contributions! Specifically:
*   **New CMP Rules**: Add support for more banner types via the `extension/lib/rules` directory.
*   **Core Logic**: Improvements to the Proverb Engine or Chain Adapters.

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for details.

---

## License
MIT
