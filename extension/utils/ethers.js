// Enhanced Ethers.js utility for MyTerms blockchain interactions
// Supports multiple wallets: MetaMask, WalletConnect, Trust Wallet, etc.

import { ethers } from './ethers-v6.js';
import { walletManager } from './wallet-manager.js';

class MyTermsEthers {
  constructor() {
    this.contract = null;
    this.contractAddress = null;
    this.contractABI = null;

    // Initialize multi-wallet support
    this.initialize();
  }

  // Initialize with multi-wallet support
  async initialize() {
    console.log('MyTermsEthers: Initializing with multi-wallet support...');

    // Only initialize wallet manager in browser contexts (not service workers)
    if (typeof window !== 'undefined' && walletManager.init) {
      await walletManager.init();
    }

    await this.loadContractConfig();
    await this.initializeContract();
  }

  // Connect to specific wallet type
  async connectWallet(walletType, options = {}) {
    try {
      const walletInfo = await walletManager.connectWallet(walletType, options);
      await this.handleWalletConnected(walletInfo);
      return walletInfo.account;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  // Handle wallet connection event
  async handleWalletConnected(walletInfo) {
    console.log('Wallet connected for contract interactions:', walletInfo.type);
    // Update contract with new provider/signer
    if (walletInfo.provider && walletInfo.signer) {
      await this.initializeContract();
    }
  }

  // Disconnect current wallet
  disconnectWallet() {
    walletManager.disconnectWallet();
    this.contract = null;
  }

  // Get current wallet info
  getConnectedWallet() {
    return walletManager.getConnectedWallet();
  }

  // Get available wallet types
  getAvailableWallets() {
    return walletManager.getWalletAvailability();
  }

  // Is wallet connected and ready?
  isReady() {
    const wallet = this.getConnectedWallet();
    return wallet && wallet.signer && wallet.account && this.contract;
  }

  // Load contract configuration
  async loadContractConfig() {
    try {
      // Try to load from extension storage first (user-specific deployments)
      const config = await this.getStorageConfig();

      if (config && config.contractAddress && config.contractABI) {
        this.contractAddress = config.contractAddress;
        this.contractABI = config.contractABI;
      } else {
        // Load from remote configuration (for different networks)
        await this.loadRemoteConfig();
      }

      console.log('Contract config loaded:', {
        address: this.contractAddress,
        network: await this.getNetworkName()
      });
    } catch (error) {
      console.error('Failed to load contract config:', error);
      throw error;
    }
  }

  // Get stored contract configuration
  async getStorageConfig() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['contractAddress', 'contractABI']).then((result) => {
          resolve(result.contractAddress && result.contractABI ? result : null);
        });
      } else {
        resolve(null);
      }
    });
  }

  // Load configuration from remote source
  async loadRemoteConfig() {
    try {
      // Get current network from connected wallet
      const wallet = this.getConnectedWallet();
      let network = 'sepolia'; // Default

      if (wallet && wallet.network) {
        network = wallet.network.name;
      }

      const networks = {
        'sepolia': {
          address: '0x...', // Replace with actual deployed address
          abi: [
            {
              "inputs": [
                { "internalType": "string[]", "name": "sites", "type": "string[]" },
                { "internalType": "bytes32[]", "name": "hashes", "type": "bytes32[]" }
              ],
              "name": "logConsentBatch",
              "outputs": [],
              "stateMutability": "nonpayable",
              "type": "function"
            },
            {
              "inputs": [
                { "internalType": "string", "name": "site", "type": "string" },
                { "internalType": "bytes32", "name": "termsHash", "type": "bytes32" }
              ],
              "name": "logConsent",
              "outputs": [],
              "stateMutability": "nonpayable",
              "type": "function"
            },
            {
              "anonymous": false,
              "inputs": [
                { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
                { "indexed": false, "internalType": "string", "name": "siteDomain", "type": "string" },
                { "indexed": false, "internalType": "bytes32", "name": "termsHash", "type": "bytes32" },
                { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
              ],
              "name": "ConsentLogged",
              "type": "event"
            }
          ]
        },
        'mainnet': {
          address: '0x...',
          abi: []
        }
      };

      if (networks[network]) {
        this.contractAddress = networks[network].address;
        this.contractABI = networks[network].abi;
      } else {
        throw new Error(`Network ${network} not supported`);
      }
    } catch (error) {
      console.error('Failed to load remote config:', error);
      // Fallback to default values
      this.contractABI = [];
    }
  }

  // Initialize contract instance
  async initializeContract() {
    const wallet = this.getConnectedWallet();

    if (!this.contractAddress || !this.contractABI || !wallet || !wallet.signer) {
      console.warn('Cannot initialize contract: missing wallet, configuration, or signer');
      return null;
    }

    try {
      this.contract = new ethers.Contract(
        this.contractAddress,
        this.contractABI,
        wallet.signer
      );

      console.log('Contract initialized successfully');
      return this.contract;
    } catch (error) {
      console.error('Failed to initialize contract:', error);
      throw error;
    }
  }

  // Get current network name from connected wallet
  async getNetworkName() {
    const wallet = this.getConnectedWallet();

    if (!wallet || !wallet.provider) return 'unknown';

    try {
      const network = await wallet.provider.getNetwork();
      const chainId = Number(network.chainId);

      const networks = {
        1: 'mainnet',
        5: 'goerli',
        11155111: 'sepolia',
        137: 'polygon',
        80001: 'mumbai'
      };

      return networks[chainId] || 'unknown';
    } catch (error) {
      console.error('Failed to get network:', error);
      return 'unknown';
    }
  }

  // Submit consent batch to blockchain
  async submitConsentBatch(siteDomains, termsHashes) {
    if (!this.isReady()) {
      throw new Error('Wallet not connected or contract not initialized');
    }

    try {
      console.log('Submitting consent batch to blockchain...');

      // Estimate gas
      const gasEstimate = await this.contract.logConsentBatch.estimateGas(siteDomains, termsHashes);
      console.log('Estimated gas:', gasEstimate.toString());

      // Submit transaction
      const tx = await this.contract.logConsentBatch(siteDomains, termsHashes, {
        gasLimit: gasEstimate * BigInt(120) / BigInt(100) // Add 20% buffer
      });

      console.log('Transaction submitted:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed in block:', receipt.blockNumber);

      return {
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        confirmations: receipt.confirmations
      };
    } catch (error) {
      console.error('Failed to submit batch:', error);

      // Handle specific errors
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction rejected by user');
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient funds for transaction');
      } else {
        throw new Error(`Transaction failed: ${error.message}`);
      }
    }
  }

  // Submit single consent
  async submitConsent(siteDomain, termsHash) {
    if (!this.isReady()) {
      throw new Error('Wallet not connected or contract not initialized');
    }

    try {
      console.log('Submitting single consent to blockchain...');

      const tx = await this.contract.logConsent(siteDomain, termsHash);
      console.log('Transaction submitted:', tx.hash);

      const receipt = await tx.wait();
      console.log('Transaction confirmed in block:', receipt.blockNumber);

      return {
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        confirmations: receipt.confirmations
      };
    } catch (error) {
      console.error('Failed to submit consent:', error);

      // Handle specific errors
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction rejected by user');
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient funds for transaction');
      } else {
        throw new Error(`Transaction failed: ${error.message}`);
      }
    }
  }

  // Generate hash from terms content (SHA-256)
  async generateTermsHash(termsContent) {
    const wallet = this.getConnectedWallet();

    if (!wallet || !wallet.provider) {
      throw new Error('Wallet not connected - provider not available');
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(termsContent);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Convert to bytes32 for Solidity
      return '0x' + hashHex;
    } catch (error) {
      console.error('Failed to generate hash:', error);
      // Fallback to simple hash
      let hash = 0;
      for (let i = 0; i < termsContent.length; i++) {
        const char = termsContent.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return ethers.keccak256(ethers.toUtf8Bytes(termsContent + hash));
    }
  }

  // Query past consent events
  async queryConsentEvents(filter = {}) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const eventFilter = this.contract.filters.ConsentLogged(filter.user, filter.site);
      const events = await this.contract.queryFilter(eventFilter);

      return events.map(event => ({
        user: event.args.user,
        site: event.args.siteDomain,
        termsHash: event.args.termsHash,
        timestamp: new Date(Number(event.args.timestamp) * 1000),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      }));
    } catch (error) {
      console.error('Failed to query events:', error);
      throw error;
    }
  }

  // Get current gas price
  async getGasPrice() {
    const wallet = this.getConnectedWallet();

    if (!wallet || !wallet.provider) return null;

    try {
      const feeData = await wallet.provider.getFeeData();
      return feeData;
    } catch (error) {
      console.error('Failed to get gas price:', error);
      return null;
    }
  }

  // Get user's ETH balance
  async getBalance() {
    const wallet = this.getConnectedWallet();

    if (!wallet || !wallet.account || !wallet.provider) return null;

    try {
      const balance = await wallet.provider.getBalance(wallet.account);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Failed to get balance:', error);
      return null;
    }
  }

  // Update contract configuration
  async updateContractConfig(networkConfig) {
    try {
      if (networkConfig.address) {
        this.contractAddress = networkConfig.address;
      }
      if (networkConfig.abi) {
        this.contractABI = networkConfig.abi;
      }

      // Save to storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          contractAddress: this.contractAddress,
          contractABI: this.contractABI
        });
      }

      // Reinitialize contract
      await this.initializeContract();
      console.log('Contract configuration updated');
    } catch (error) {
      console.error('Failed to update contract config:', error);
      throw error;
    }
  }
}

// Create global instance
const myTermsEthers = new MyTermsEthers();

// Export for use in other modules
export { myTermsEthers };

// Make available globally for background script
if (typeof chrome !== 'undefined' && chrome.runtime) {
  if (typeof window !== 'undefined') {
    window.myTermsEthers = myTermsEthers;
  } else if (typeof self !== 'undefined') {
    self.myTermsEthers = myTermsEthers;
  }
}
