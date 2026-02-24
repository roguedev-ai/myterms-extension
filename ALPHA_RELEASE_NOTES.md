# ConsentChain v2.0-alpha.1 Release Notes

This document contains a summary of the bug fixes and improvements addressed in the `v2.0-alpha.1` release.

## Resolved Issues

1. **BUG-01 (WalletManager Property Name Collision):** Resolved an issue where `onAccountChange` and `onNetworkChange` instance properties shadowed their respective methods, breaking wallet event callbacks.
2. **BUG-02 (Storage `markAsBatched` Race Condition):** Fixed a race condition where IndexedDB transactions would silently drop consents by forcing sequential `store.get()` queue processing.
3. **BUG-03 (WalletConnect False Positives):** Disabled the `WalletConnect` stub to prevent the system from returning a null connection and crashing on wallet restorations.
4. **BUG-04 (Production Debug Logs):** Removed verbose `[BatchDebug]` log spam from the background storage process path.
5. **BUG-05 (Unsupported Network Graceful Degradation):** Dashboard and Ethers `loadRemoteConfig` now strictly enforce supported networks (Sepolia, Localhost) to prevent silent failures on unsupported chains (e.g., Mainnet zero-address).
6. **BUG-06 (Dead Notification Button):** Removed the broken "View Transaction" button configuration from the extension background notification.
7. **BUG-07 (Dead Ethers v5 Fallback):** Overhauled `estimateGas` to strip out broken v5 code and securely rely on Try/Catch blocks with 500k base limit fallbacks if normal RPC estimations fail.
8. **BUG-08 (IndexedDB Initialization Timeout):** Removed the 1-second timeout loop inside `waitForDB()` and replaced it by directly awaiting the constructor's `initPromise` ensuring full database schema installations complete smoothly on slower machines.
9. **BUG-09 (IndexedDB Transaction Abort Cascade):** Appended `event.preventDefault()` to the `onerror` listeners within `markAsBatched()` to suppress abort propagation to the parent transaction when dealing with localized query failures.
10. **BUG-10 (Silent Contract Initialization on Empty ABI):** Fixed `ethers.js` validation to explicitly verify `contractABI.length > 0` and correctly clear the `contractAddress` on initialization failure.
11. **BUG-11 (Permanent Session Death on DB Rejection):** Caught `initPromise` rejections inside `waitForDB()` allowing a localized retry cascade rather than permanently bricking the extension's storage layer for the browser session.
12. **BUG-12 (Wrong Allowlist Message on Unloaded Network):** Separated the `chainId === 0` condition from the explicit network allowlist to inform users that network data is still syncing rather than throwing an incorrect "unsupported network" error.
