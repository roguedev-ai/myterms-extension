// Background service worker for MyTerms extension
// Handles blockchain interactions and background processing

import { myTermsEthers } from './utils/ethers.js';
import { consentStorage } from './utils/storage.js';

class ConsentManager {
  constructor() {
    this.lastBatchTime = null;
    this.batchInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.processing = false;

    this.init();
  }

  async init() {
    console.log('ConsentManager initializing...');

    // Start background processes
    this.startBackgroundProcesses();

    // Initial batch process check
    setTimeout(() => {
      this.checkAndProcessBatch();
    }, 5000);
  }

  startBackgroundProcesses() {
    console.log('Starting background processes...');

    // Check for batch processing every 15 minutes
    setInterval(() => {
      this.checkAndProcessBatch();
    }, 15 * 60 * 1000); // 15 minutes

    // Cleanup old data daily
    setInterval(() => {
      this.performMaintenance();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  async checkAndProcessBatch() {
    if (this.processing) {
      console.log('Batch processing already in progress, skipping...');
      return;
    }

    try {
      // Check if enough time has passed since last batch
      const now = Date.now();
      const timeSinceLastBatch = this.lastBatchTime ? now - this.lastBatchTime : this.batchInterval;
      const shouldProcess = timeSinceLastBatch >= this.batchInterval;

      if (!shouldProcess) {
        console.log(`Not yet time for batch. Time remaining: ${Math.round((this.batchInterval - timeSinceLastBatch) / (60 * 1000))} minutes`);
        return;
      }

      console.log('Checking for consents ready for batch processing...');
      await this.processConsentBatch();

    } catch (error) {
      console.error('Error in batch check:', error);
    }
  }

  async processConsentBatch() {
    this.processing = true;

    try {
      // Get consents that are ready for batching (older than 24 hours)
      const readyConsents = await consentStorage.getBatchReadyConsents(24);

      if (readyConsents.length === 0) {
        console.log('No consents ready for batch processing');
        return;
      }

      console.log(`Processing batch of ${readyConsents.length} consents...`);

      // Check if wallet is ready
      if (!myTermsEthers.isReady()) {
        console.log('Wallet not ready, cannot process batch');
        return;
      }

      // Group consents by site
      const groupedConsents = this.groupConsentsBySite(readyConsents);

      // Prepare data for blockchain submission
      const sites = Object.keys(groupedConsents);
      const hashes = [];

      for (const site of sites) {
        const siteConsents = groupedConsents[site];
        // Create batch hash from all consents for this site
        const batchData = siteConsents.map(c => c.termsHash).join('');
        const batchHash = await myTermsEthers.generateTermsHash(batchData);
        hashes.push(batchHash);
      }

      console.log(`Submitting batch: ${sites.length} sites, ${readyConsents.length} total consents`);

      // Submit to blockchain
      const txResult = await myTermsEthers.submitConsentBatch(sites, hashes);

      // Mark consents as batched
      const consentIds = readyConsents.map(c => c.id);
      await consentStorage.markAsBatched(consentIds, {
        batchId: txResult.hash,
        txHash: txResult.hash,
        blockNumber: txResult.blockNumber
      });

      // Record batch information
      await consentStorage.recordBatch({
        txHash: txResult.hash,
        consentIds: consentIds,
        siteData: groupedConsents,
        gasUsed: txResult.gasUsed,
        blockNumber: txResult.blockNumber
      });

      // Update last batch time
      this.lastBatchTime = Date.now();

      // Notify user of successful batch
      this.notifyUserOfBatch(txResult, readyConsents.length);

      console.log('Batch processed successfully:', txResult.hash);

    } catch (error) {
      console.error('Failed to process consent batch:', error);

      // Notify user of failure
      if (error.message.includes('rejected')) {
        this.notifyUserOfBatchFailure('Transaction rejected by user');
      } else if (error.message.includes('Insufficient funds')) {
        this.notifyUserOfBatchFailure('Insufficient funds for transaction');
      } else {
        this.notifyUserOfBatchFailure('Batch processing failed');
      }

    } finally {
      this.processing = false;
    }
  }

  groupConsentsBySite(consents) {
    const grouped = {};

    consents.forEach(consent => {
      if (!grouped[consent.siteDomain]) {
        grouped[consent.siteDomain] = [];
      }
      grouped[consent.siteDomain].push(consent);
    });

    return grouped;
  }

  async performMaintenance() {
    try {
      console.log('Performing maintenance tasks...');

      // Clear old processed consents
      const clearedCount = await consentStorage.clearProcessedConsents(30);

      if (clearedCount > 0) {
        console.log(`Cleared ${clearedCount} old processed consents`);
      }

    } catch (error) {
      console.error('Maintenance task failed:', error);
    }
  }

  notifyUserOfBatch(txResult, consentCount) {
    if (!chrome || !chrome.notifications) {
      console.log('Notifications not available');
      return;
    }

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'MyTerms Batch Submitted',
      message: `Successfully logged ${consentCount} consents to blockchain. Transaction: ${txResult.hash.substring(0, 10)}...`,
      buttons: [{
        title: 'View Transaction'
      }],
      requireInteraction: false
    });
  }

  notifyUserOfBatchFailure(reason) {
    if (!chrome || !chrome.notifications) {
      console.log('Notifications not available');
      return;
    }

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'MyTerms Batch Failed',
      message: `Batch submission failed: ${reason}`,
      requireInteraction: true
    });
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CONSENT_CAPTURED') {
    console.log('Received consent from content script:', request.consent.siteDomain);

    // Add to storage
    consentStorage.addToQueue(request.consent).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('Failed to add consent to queue:', error);
      sendResponse({ success: false, error: error.message });
    });

    return true; // Keep message channel open for async response
  }
});

// Handle popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_POPUP_DATA') {
    Promise.all([
      consentStorage.getAllQueuedConsents(),
      consentStorage.getLatestBatchInfo(),
      consentStorage.getBatchStats()
    ]).then(([queuedConsents, latestBatch, stats]) => {
      sendResponse({
        queuedCount: queuedConsents.length,
        latestBatch: latestBatch,
        stats: stats
      });
    }).catch((error) => {
      console.error('Failed to get popup data:', error);
      sendResponse({
        queuedCount: 0,
        latestBatch: null,
        stats: null,
        error: error.message
      });
    });

    return true; // Keep message channel open for async response
  }
});

// Export for testing
const consentManager = new ConsentManager();

// For background script usage
if (typeof chrome !== 'undefined' && chrome.runtime) {
  if (typeof window !== 'undefined') {
    window.consentManager = consentManager;
  } else if (typeof self !== 'undefined') {
    self.consentManager = consentManager;
  }
}
