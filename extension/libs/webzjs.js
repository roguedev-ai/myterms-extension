/**
 * MOCK implementation of @chainsafe/webzjs-wallet
 * Created because the actual package was not found in the public registry.
 * This allows us to implement the architecture and verify logic flow.
 */

console.log('Mock WebZjs Library Loaded');

// Mock init function
export default async function initWasm() {
    console.log('WebZjs: WASM Initialized (Mock)');
    return true;
}

export function initThreadPool(threads) {
    console.log(`WebZjs: Thread pool initialized with ${threads} threads (Mock)`);
}

export class WebWallet {
    constructor(network, proxyUrl, accountIndex) {
        this.network = network;
        this.proxyUrl = proxyUrl;
        this.accountIndex = accountIndex;
        this.address = null;
    }

    async create_account(seed, accountIndex, birthday) {
        console.log('WebZjs: Creating account...', { birthday });
        // Generate a mock z-address
        this.address = 'zs1mockaddress' + Math.random().toString(36).substring(7);
        return this.address;
    }

    async sync() {
        console.log('WebZjs: Syncing wallet... (Mock)');
        return new Promise(resolve => setTimeout(resolve, 1000));
    }

    async get_address() {
        return this.address;
    }

    async get_balance() {
        return {
            sapling_balance: 100000000n, // 1 ZEC
            verified_sapling_balance: 100000000n
        };
    }

    async send(to, amount, memo) {
        console.log(`WebZjs: Sending ${amount} to ${to} with memo: ${memo}`);
        // Return a mock transaction ID
        return 'txid_mock_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    }
}
