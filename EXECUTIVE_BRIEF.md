# Executive Brief: MyTerms Feature Expansion

This document outlines the two major feature sets recently implemented in the MyTerms extension: **Dual-Chain Consent Automation** and **Cookie Monster Privacy Protection**. These features significantly enhance the user's control over their digital footprint through automated consent negotiation and active tracking elimination.

## 1. Dual-Chain Protocol (Consent Automation)
**Branch:** `feature/dual-chain-protocol`

### Overview
This feature transforms specific user consent preferences into immutable, verifiable actions recorded on-chain. It bridges the gap between local browser automation and decentralized verification.

### Key Capabilities
*   **Automated Negotiation:** The extension detects cookie banners and automatically clicks "Reject All" (or "Accept Necessary") based on the user's profile, without manual intervention.
*   **Proof of Rejection:** Every automated consent decision is hashed and batched.
*   **dual-Chain Architecture:**
    *   **Local/Fast Chain:** Immediate logging of user intent for responsive UI updates.
    *   **Public/Verifiable Chain:** Periodic batching of consent proofs to the blockchain (Zcash/Ethereum compatible layers) to create an immutable audit trail of the user's rejection of tracking terms.

### Value Proposition
Users can browse seamlessly while maintaining a cryptographic record of their refusal to be tracked, providing legal and technical leverage against non-compliant data collectors.

---


## 2. Agreements & Proverb Engine
**Core Logic:** `ProverbEngine` & `MyTermsParser`

### Overview
MyTerms introduces the **Privacy Proverb**—a cryptographic proof of intent. This engine allows both users and websites to publish and verify agreement terms on-chain without centralized intermediaries.

### Key Capabilities
*   **Privacy Proverb:** A hash representing the user's specific consent profile (e.g., "Tracking Disallowed", "Analytics Allowed").
*   **Policy Publishing:** Websites can publish their Terms of Service (P7012 Standard) to the chain, creating an immutable reference.
*   **Decentralized Verification:**
# Executive Brief: ConsentChain (v2.0-alpha.1)

**Status**: Alpha Release (Feature Frozen)
**Date**: February 2026
**Branch**: `alpha`

## 🎯 Executive Summary
ConsentChain (formerly MyTerms) has reached the **Alpha Release** milestone. This version introduces the **Hybrid Detection Engine**, combining Consent-O-Matic's rule-based precision with our custom heuristics, enabling support for 200+ Consent Management Platforms (CMPs).

## 📊 Key Metrics
*   **CMP Support**: ~200 Providers (OneTrust, Quantcast, Cookiebot, etc.)
*   **Detection Speed**: < 500ms on average.
*   **Blockchain Integration**:
    *   **Zcash**: Inscription Simulation (Mocks ready for integration).
    *   **Ethereum**: Sepolia Testnet Registry (Mock Contract).

## 🛣️ Roadmap
1.  **Alpha (Current)**: Remote Deployment & "Fresh Install" Verification.
2.  **Beta**: Enable Real Zcash Inscriptions & Mainnet Contracts.
3.  **V2.0 Launch**: Chrome Web Store Release.

---

## 4. Cookie Monster (Classification & Analysis)
**Branch:** `feature/cookie-monster`

### Overview
While the Dual-Chain Protocol prevents *future* tracking, the Cookie Monster feature analyzes and neutralizes *existing* tracking vectors. It provides a real-time health check of the browser's cookie jar.

### Key Capabilities
*   **Intelligent Classification:** Uses a regex-based heuristic engine to categorize cookies into:
    *   🟢 **Security/Necessary** (Preserved)
    *   🔵 **Functional** (Preserved)
    *   🟠 **Analytics** (Flagged)
    *   🔴 **Marketing/Tracking** (Flagged)
*   **Privacy Score:** Calculates a dynamic 0-100 score based on the ratio of safe vs. invasive cookies.
*   **"Eat Cookies" (One-Click Cleanup):** A single action to safely purge all Analytics and Marketing cookies while keeping sessions (Security/Functional) intact.
*   **Dashboard Integration:** Fully integrated into the MyTerms Dashboard under the "Analytics" view for easy access.

### Value Proposition
Gives users immediate visibility into who is tracking them and a simple "panic button" to clean their digital footprint without logging them out of important services.

---

## Technical Summary
These features combine client-side heuristics (`EnhancedBannerDetector`, `CookieClassifier`) with decentralized infrastructure (`DualChainManager`), managed via a unified Dashboard SPA interface.

*   **Frontend:** Vanilla JS / Chart.js / CSS Grid
*   **Logic:** Service Workers (Background) + Content Scripts (DOM Injection)
*   **Storage:** IndexedDB + EVM/Zcash Bridge
