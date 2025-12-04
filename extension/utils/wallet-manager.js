// Multi-Wallet Manager for MyTerms extension
// Supports MetaMask, WalletConnect, Trust Wallet, Coinbase Wallet, and more

import { ethers } from './ethers-v6.js';

// WalletConnect import would be added for full implementation
// import { Core } from '@walletconnect/v2-core';
// import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
// import { SignClient } from '@walletconnect/sign-client';

class WalletManager {
  constructor() {
    this.wallets = {
      metamask: null,
      walletconnect: null,
      trustWallet: null,
      coinbaseWallet: null,
      rainbowWallet: null
    };

    this.connectedWallet = null;
    this._onWalletChangeCallback = null;
    this.onAccountChange = null;
    this.onNetworkChange = null;

    // Only initialize wallet detection in browser contexts (not service workers)
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  // Initialize wallet detection and connection
  async init() {
    console.log('WalletManager: Initializing multi-wallet support...');

    // Detect available wallets
    await this.detectAvailableWallets();

    // Restore connection if possible
    await this.restoreConnection();

    // Set up event listeners
    this.setupEventListeners();
  }

  // Detect installed wallets
  async detectAvailableWallets() {
    console.log('Detecting available wallets...');

    // Check for MetaMask
    this.wallets.metamask = this.isMetaMaskInstalled();

    // Check for WalletConnect (always available as fallback)
    this.wallets.walletconnect = true;

    // Check for Trust Wallet
    this.wallets.trustWallet = this.isTrustWalletInstalled();

    // Check for Coinbase Wallet
    this.wallets.coinbaseWallet = this.isCoinbaseWalletInstalled();

    // Check for Rainbow Wallet
    this.wallets.rainbowWallet = this.isRainbowWalletInstalled();

    console.log('Available wallets:', this.getAvailableWalletList());
    return this.wallets;
  }

  // Wallet detection helpers
  isMetaMaskInstalled() {
    return typeof window !== 'undefined' &&
      window.ethereum &&
      window.ethereum.isMetaMask;
  }

  isTrustWalletInstalled() {
    return typeof window !== 'undefined' &&
      window.ethereum &&
      window.ethereum.isTrust;
  }

  isCoinbaseWalletInstalled() {
    return typeof window !== 'undefined' &&
      window.ethereum &&
      window.ethereum.isCoinbaseWallet;
  }

  isRainbowWalletInstalled() {
    return typeof window !== 'undefined' &&
      window.ethereum &&
      (window.ethereum.isRainbow || window.RainbowKit);
  }

  // Get list of available wallets
  getAvailableWalletList() {
    return Object.entries(this.wallets)
      .filter(([name, available]) => available)
      .map(([name, available]) => name);
  }

  // Connect to specific wallet
  async connectWallet(walletType, options = {}) {
    console.log(`Connecting to ${walletType}...`);

    try {
      let connection;

      switch (walletType) {
        case 'metamask':
          connection = await this.connectMetaMask();
          break;
        case 'walletconnect':
          connection = await this.connectWalletConnect(options);
          break;
        case 'trustWallet':
          connection = await this.connectTrustWallet();
          break;
        case 'coinbaseWallet':
          connection = await this.connectCoinbaseWallet();
          break;
        case 'rainbowWallet':
          connection = await this.connectRainbowWallet();
          break;
        default:
          throw new Error(`Unsupported wallet type: ${walletType}`);
      }

      this.connectedWallet = {
        type: walletType,
        ...connection
      };

      // Save connection preference
      await this.saveConnectionPreference(walletType);

      console.log(`Successfully connected to ${walletType}:`, this.connectedWallet.account);

      // Notify listeners
      if (this._onWalletChangeCallback) {
        this._onWalletChangeCallback(this.connectedWallet);
      }

      return this.connectedWallet;
    } catch (error) {
      console.error(`Failed to connect to ${walletType}:`, error);
      throw error;
    }
  }

  // Injected wallet connection (MetaMask, Brave, etc.)
  async connectMetaMask() {
    // Check if we're in an extension context (chrome-extension://)
    const isExtensionContext = window.location.protocol === 'chrome-extension:';

    if (isExtensionContext) {
      // Extension pages don't have window.ethereum injected
      // We need to use a different approach: open a helper window
      return this.connectMetaMaskViaHelper();
    }

    // Check for any injected provider (window.ethereum)
    // We poll briefly to handle race conditions where the provider is injected asynchronously
    if (!window.ethereum) {
      // Increase timeout to 10 seconds (100 * 100ms) for slower remote connections
      for (let i = 0; i < 100; i++) {
        if (window.ethereum) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (!window.ethereum) {
      throw new Error('No crypto wallet found. Please install MetaMask, Brave, or another Ethereum wallet.');
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts connected');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      provider.pollingInterval = 60000; // Reduce polling frequency to avoid rate limits
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      return {
        provider,
        signer,
        account: accounts[0],
        network: {
          name: network.name,
          chainId: network.chainId
        }
      };
    } catch (error) {
      if (error.code === 4001) {
        throw new Error('Connection rejected by user');
      }
      throw error;
    }
  }

  // Connect MetaMask from extension context via helper window
  async connectMetaMaskViaHelper() {
    // Simpler approach: Show instructions to user
    throw new Error(
      'Wallet connections are not available in extension pages. ' +
      'Please use the popup (click extension icon) or open this dashboard in a new tab to connect your wallet.'
    );
  }

  // WalletConnect connection (simplified for this demo)
  async connectWalletConnect(options = {}) {
    // In a full implementation, this would:
    // 1. Initialize WalletConnect SignClient
    // 2. Pair with wallet app via QR code/Universal Link
    // 3. Establish connection and return provider

    // For now, provide fallback connection info
    return {
      provider: null, // Would be WC provider
      signer: null,   // Would be WC signer
      account: null,  // Would be connected account
      network: {
        name: 'walletconnect',
        chainId: 1 // Default to Ethereum mainnet
      }
    };
  }

  // Trust Wallet connection
  async connectTrustWallet() {
    return this.connectGenericWallet('Trust Wallet');
  }

  // Coinbase Wallet connection
  async connectCoinbaseWallet() {
    return this.connectGenericWallet('Coinbase Wallet');
  }

  // Rainbow Wallet connection
  async connectRainbowWallet() {
    return this.connectGenericWallet('Rainbow Wallet');
  }

  // Generic wallet connection (for wallets that use window.ethereum)
  async connectGenericWallet(name) {
    if (!this.wallets[name.toLowerCase().replace(' wallet', 'Wallet')]) {
      throw new Error(`${name} not detected`);
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts connected');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      provider.pollingInterval = 60000; // Reduce polling frequency to avoid rate limits
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      return {
        provider,
        signer,
        account: accounts[0],
        network: {
          name: network.name,
          chainId: network.chainId
        }
      };
    } catch (error) {
      if (error.code === 4001) {
        throw new Error(`Connection rejected by ${name}`);
      }
      throw error;
    }
  }

  // Disconnect wallet
  async disconnectWallet() {
    try {
      this.connectedWallet = null;

      // Clear saved preferences
      await this.clearConnectionPreference();

      // Reset provider/signer (only in browser context)
      if (typeof window !== 'undefined' && window.ethereum && window.ethereum.disconnect) {
        await window.ethereum.disconnect();
      }

      console.log('Wallet disconnected');

      // Notify listeners
      if (this._onWalletChangeCallback) {
        this._onWalletChangeCallback(null);
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }

  // Get current wallet info
  getConnectedWallet() {
    return this.connectedWallet;
  }

  // Check if wallet is connected
  isWalletConnected() {
    return !!this.connectedWallet && !!this.connectedWallet.account;
  }

  // Restore previous connection
  async restoreConnection() {
    try {
      const savedPreference = await this.getSavedConnectionPreference();

      if (savedPreference && this.wallets[savedPreference]) {
        console.log(`Attempting to restore ${savedPreference} connection...`);
        await this.connectWallet(savedPreference, { silent: true });
      }
    } catch (error) {
      console.log('Could not restore previous connection:', error.message);
    }
  }

  // Setup event listeners for wallet changes
  setupEventListeners() {
    if (typeof window === 'undefined' || !window.ethereum) {
      // Not in a browser context or no ethereum provider
      return;
    }

    // Account changes
    window.ethereum.on('accountsChanged', (accounts) => {
      if (this.connectedWallet) {
        this.connectedWallet.account = accounts[0] || null;

        if (this.onAccountChange) {
          this.onAccountChange(this.connectedWallet.account);
        }
      }
    });

    // Network changes
    window.ethereum.on('chainChanged', async () => {
      if (this.connectedWallet && this.connectedWallet.provider) {
        const network = await this.connectedWallet.provider.getNetwork();
        this.connectedWallet.network = {
          name: network.name,
          chainId: network.chainId
        };

        if (this.onNetworkChange) {
          this.onNetworkChange(this.connectedWallet.network);
        }
      }
    });

    // WalletConnect events would be added here
    // window.ethereum.on('walletconnect_disconnect', ...)
  }

  // Storage helpers
  async saveConnectionPreference(walletType) {
    const data = { walletType, timestamp: Date.now() };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ walletPreference: data });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem('myterms_wallet_preference', JSON.stringify(data));
    }
  }

  async getSavedConnectionPreference() {
    try {
      let data;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        data = await chrome.storage.local.get(['walletPreference']);
        return data?.walletPreference?.walletType;
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('myterms_wallet_preference');
        if (stored) {
          const parsed = JSON.parse(stored);
          return parsed.walletType;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting saved preference:', error);
      return null;
    }
  }

  async clearConnectionPreference() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(['walletPreference']);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('myterms_wallet_preference');
      }
    } catch (error) {
      console.error('Error clearing preference:', error);
    }
  }

  // Enhanced signing functionality for different wallet types
  async signMessage(message) {
    if (!this.connectedWallet) {
      throw new Error('No wallet connected');
    }

    const { signer } = this.connectedWallet;

    if (!signer) {
      throw new Error('Signer not available for connected wallet');
    }

    try {
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error) {
      if (error.code === 4001) {
        throw new Error('Message signing rejected by user');
      }
      throw error;
    }
  }

  // Enhanced transaction sending
  async sendTransaction(txRequest) {
    if (!this.connectedWallet) {
      throw new Error('No wallet connected');
    }

    const { signer } = this.connectedWallet;

    if (!signer) {
      throw new Error('Signer not available for connected wallet');
    }

    try {
      const tx = await signer.sendTransaction(txRequest);
      return tx;
    } catch (error) {
      if (error.code === 4001) {
        throw new Error('Transaction rejected by user');
      } else if (error.code === -32602) {
        throw new Error('Invalid transaction parameters');
      }
      throw error;
    }
  }

  // Set event listeners
  onWalletChange(callback) {
    this._onWalletChangeCallback = callback;
  }

  onAccountChange(callback) {
    this.onAccountChange = callback;
  }

  onNetworkChange(callback) {
    this.onNetworkChange = callback;
  }

  // Get wallet availability status
  getWalletAvailability() {
    return {
      ...this.wallets,
      connected: this.connectedWallet?.type || null,
      availableWallets: this.getAvailableWalletList()
    };
  }
}

// Create global instance
const walletManager = new WalletManager();

// Export for use in other modules
export { walletManager };

// Make available globally for background script
if (typeof chrome !== 'undefined' && chrome.runtime) {
  if (typeof window !== 'undefined') {
    window.walletManager = walletManager;
  } else if (typeof self !== 'undefined') {
    self.walletManager = walletManager;
  }
}
