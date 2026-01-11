import initWasm, { initThreadPool, WebWallet } from '../libs/webzjs.js';

export class ZcashClient {
    constructor() {
        this.wallet = null;
        this.initialized = false;
        // Mock constants - normally would be configurable
        this.GRPC_PROXY_URL = 'https://zcash-mainnet.chainsafe.dev';
    }

    async initialize() {
        if (this.initialized) return;

        console.log('ZcashClient: Initializing WASM...');
        await initWasm();

        // Initialize thread pool if supported (mock implementation does nothing but log)
        const threads = navigator.hardwareConcurrency || 4;
        try {
            initThreadPool(threads);
        } catch (e) {
            console.warn('ZcashClient: Thread pool init skipped (might be mock or not supported)', e);
        }

        this.initialized = true;
        console.log('ZcashClient: Initialized');
    }

    async createWallet(seedPhrase, birthdayHeight) {
        if (!this.initialized) await this.initialize();

        console.log('ZcashClient: Creating wallet...');
        this.wallet = new WebWallet('main', this.GRPC_PROXY_URL, 1);

        // In a real app, we'd handle errors here
        await this.wallet.create_account(seedPhrase, 0, birthdayHeight);
        console.log('ZcashClient: Wallet created');
    }

    async syncWallet() {
        if (!this.wallet) throw new Error('Wallet not initialized');
        await this.wallet.sync();
    }

    getWallet() {
        return this.wallet;
    }

    /**
     * Helper to get a ready-to-use client.
     * In a real extension, we might load seed from secure storage.
     * For this prototype, we'll use a hardcoded dev seed if one isn't provided, 
     * or rely on the user to call createWallet.
     */
    static async getInstance() {
        if (!window.zcashClientInstance) {
            window.zcashClientInstance = new ZcashClient();
            await window.zcashClientInstance.initialize();
        }
        return window.zcashClientInstance;
    }
}
