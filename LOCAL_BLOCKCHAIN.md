# Local Blockchain Guide

Reference for running the Hardhat development blockchain and the MyTermsConsentLedger smart contract.

---

## Quick Reference

| Item | Value |
|---|---|
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Dashboard | `http://localhost:8080` |
| Contract | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Deployer (Account #0) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Account #0 Private Key | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |

> All Hardhat accounts are publicly known test accounts. Never use on mainnet.

---

## Option 1 — One Command (Recommended)

```bash
npm run dev
```

Starts Hardhat node → deploys contract → starts dashboard. Waits for the READY banner before returning.

To also fund a specific wallet address:

```bash
npm run dev -- --fund 0xYourMetaMaskAddress
```

---

## Option 2 — Manual (Three Terminals)

### Terminal 1 — Start the Chain

```bash
npm run dev:chain
# or: npx hardhat node
```

Leave running. Output shows 20 pre-funded test accounts.

### Terminal 2 — Deploy the Contract

```bash
npm run dev:deploy
# or: npx hardhat run scripts/deploy.js --network localhost
```

Expected output:
```
Deploying MyTermsConsentLedger contract...
MyTermsConsentLedger deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

The contract always deploys to `0x5FbDB2315678afecb367f032d93F642f64180aa3` on a fresh Hardhat node because address derivation is deterministic. The address is hardcoded in `extension/utils/ethers.js` for localhost.

### Terminal 3 — Start the Dashboard

```bash
npm run dashboard
# or: node serve-dashboard.js
```

Dashboard available at `http://localhost:8080`.

---

## Funding a Test Wallet

```bash
RECIPIENT=0xYourAddress npm run dev:fund
```

The script sends 10 ETH from Hardhat Account #1. If the balance is already over 100 ETH, the transfer is skipped.

---

## MetaMask Setup

### Add Localhost Network (one-time)

```
MetaMask → Settings → Networks → Add a network manually

Network Name : Localhost 8545
RPC URL      : http://127.0.0.1:8545
Chain ID     : 31337
Currency symbol: ETH
```

### If MetaMask Shows Stale Balance or -32002 Error

After restarting Hardhat (which resets the chain), MetaMask caches stale nonce and RPC state from the previous session. Fix:

1. Switch MetaMask to a different network (e.g. Sepolia)
2. Switch back to Localhost 8545
3. If still broken: **MetaMask → Settings → Advanced → Reset Account**
   - This clears cached nonce and RPC history. It does NOT delete your wallet or keys.

---

## Smart Contract Reference

**Contract:** `MyTermsConsentLedger.sol`
**Location:** `contracts/MyTermsConsentLedger.sol`

### Functions

```solidity
// Log a single consent record
function logConsent(string site, bytes32 termsHash) external

// Log a batch of consents in one transaction (gas-efficient)
function logConsentBatch(string[] sites, bytes32[] hashes) external
```

### Events

```solidity
event ConsentLogged(
    address indexed user,     // wallet address
    string siteDomain,        // e.g. "example.com"
    bytes32 termsHash,        // SHA-256 of banner content
    uint256 timestamp         // block timestamp
)
```

### What Goes On-Chain

Only domain strings and SHA-256 hashes are written to the blockchain. No personal data, no banner text, no user identifiers beyond the wallet address.

```
logConsentBatch(
    sites:  ["example.com", "news-site.com"],
    hashes: ["0x13f244...",  "0xb26b39..."]
)
```

The hash is a SHA-256 fingerprint of the banner text the user saw. Anyone can verify that a given banner matches the stored hash — the text stays in the user's browser, the proof goes on-chain.

---

## Sepolia Testnet

The contract is also deployed on Sepolia:

```
Address: 0x0bF53DB13EDe40046a7232845571a93B1cceFF5f
```

To use Sepolia, switch MetaMask to the Sepolia network. The dashboard will detect the network and use the correct contract address automatically.

You need Sepolia ETH from a faucet to submit transactions. Free faucets: `sepoliafaucet.com`, `alchemy.com/faucets/ethereum-sepolia`.

---

## Contract Tests

```bash
npm run test
# or: npx hardhat test
```

Tests are in `test/`. They cover `logConsent` and `logConsentBatch` with event emission checks.

---

## Re-deploying After Chain Reset

Every time `npx hardhat node` starts fresh it resets to block 0. You must redeploy:

```bash
npm run dev:deploy
```

The contract will again land at `0x5FbDB2315678afecb367f032d93F642f64180aa3` (deterministic).
