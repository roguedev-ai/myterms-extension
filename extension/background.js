// Background service worker for MyTerms extension
// Handles blockchain interactions and background processing

import { myTermsEthers } from './utils/ethers.js';
import { consentStorage } from './utils/storage.js';
import { DualChainManager } from './utils/dual-chain.js';

class ConsentManager {
  constructor() {
    this.lastBatchTime = null;
    this.batchInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.processing = false;
    this.dualChain = new DualChainManager();

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

  async checkAndProcessBatch(force = false) {
    if (this.processing) {
      console.log('Batch processing already in progress, skipping...');
      return;
    }

    try {
      // Check if enough time has passed since last batch
      const now = Date.now();
      const timeSinceLastBatch = this.lastBatchTime ? now - this.lastBatchTime : this.batchInterval;
      const shouldProcess = force || (timeSinceLastBatch >= this.batchInterval);

      if (!shouldProcess) {
        console.log(`Not yet time for batch. Time remaining: ${Math.round((this.batchInterval - timeSinceLastBatch) / (60 * 1000))} minutes`);
        return;
      }

      console.log(`Checking for consents ready for batch processing (force=${force})...`);

      // Check if we have consents ready
      // If force is true, we want all unbatched consents (threshold 0)
      // Otherwise, we only want consents older than 24h
      const threshold = force ? 0 : 24;
      const readyConsents = await consentStorage.getBatchReadyConsents(threshold);

      if (readyConsents.length > 0) {
        // We can't auto-process because we need user signature
        // So we notify the user to open the popup
        this.notifyBatchReady(readyConsents.length);
      } else if (force) {
        console.log('No consents ready for batching even with force=true');
      }

    } catch (error) {
      console.error('Error in batch check:', error);
    }
  }

  notifyBatchReady(count) {
    if (!chrome || !chrome.notifications) return;

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'MyTerms: Batch Ready',
      message: `${count} consents are ready to be secured on blockchain. Click to sign.`,
      requireInteraction: true
    });
  }

  async getStats() {
    try {
      const db = await consentStorage.waitForDB();
      const transaction = db.transaction(['consentQueue'], 'readonly');
      const store = transaction.objectStore('consentQueue');

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = (event) => {
          const consents = event.target.result;
          const totalConsents = consents.length;
          const uniqueSites = new Set(consents.map(c => c.siteDomain)).size;
          const totalDeclined = consents.filter(c => c.decisionType === 'decline').length;
          const totalBatched = consents.filter(c => c.batched).length;

          // Get batch stats for total batches
          consentStorage.getBatchStats().then(batchStats => {
            resolve({
              totalConsents,
              totalSites: uniqueSites,
              totalDeclined,
              totalBatched,
              totalBatches: batchStats ? batchStats.totalBatches : 0
            });
          }).catch(err => {
            // Fallback if batch stats fail
            resolve({
              totalConsents,
              totalSites: uniqueSites,
              totalDeclined,
              totalBatched,
              totalBatches: 0
            });
          });
        };

        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw error;
    }
  }



  async getAllSitesData() {
    try {
      return await consentStorage.getAllSitesData();
    } catch (error) {
      console.error('Failed to get all sites data:', error);
      throw error;
    }
  }

  async prepareConsentBatch(force = false) {
    this.processing = true;

    try {
      // Get consents that are ready for batching
      const threshold = force ? 0 : 24;
      const readyConsents = await consentStorage.getBatchReadyConsents(threshold);

      if (readyConsents.length === 0) {
        console.log('No consents ready for batch processing');
        throw new Error('No pending consents to batch');
      }

      console.log(`Preparing batch of ${readyConsents.length} consents...`);

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

      return {
        sites,
        hashes,
        consentIds: readyConsents.map(c => c.id),
        siteData: groupedConsents,
        count: readyConsents.length
      };

    } catch (error) {
      console.error('Failed to prepare consent batch:', error);
      this.processing = false;
      throw error;
    }
  }

  async finalizeBatch(txResult, batchData) {
    try {
      console.log('Finalizing batch with tx:', txResult.hash);

      // Mark consents as batched
      await consentStorage.markAsBatched(batchData.consentIds, {
        batchId: txResult.hash,
        txHash: txResult.hash,
        blockNumber: txResult.blockNumber
      });

      // Record batch information
      await consentStorage.recordBatch({
        txHash: txResult.hash,
        consentIds: batchData.consentIds,
        siteData: batchData.siteData,
        gasUsed: txResult.gasUsed,
        blockNumber: txResult.blockNumber
      });

      // Update last batch time
      this.lastBatchTime = Date.now();

      // Notify user of successful batch
      this.notifyUserOfBatch(txResult, batchData.count);

      console.log('Batch finalized successfully');

    } catch (error) {
      console.error('Failed to finalize batch:', error);
      this.notifyUserOfBatchFailure(`Batch finalization failed: ${error.message}`);
      throw error;
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

// Handle ALL messages from content script, popup, and dashboard
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // CONSENT_CAPTURED - from content script
  if (request.type === 'CONSENT_CAPTURED') {
    console.log('Received consent from content script:', request.consent.siteDomain);
    consentStorage.addToQueue(request.consent).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('Failed to add consent to queue:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // GET_ALL_SITES_DATA - from dashboard
  if (request.type === 'GET_ALL_SITES_DATA') {
    consentManager.getAllSitesData()
      .then(sites => sendResponse({ sites }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  // REGISTER_DUAL_CHAIN_CONSENT
  if (request.type === 'REGISTER_DUAL_CHAIN_CONSENT') {
    const { preferences, dataController, agreementId } = request.payload;
    console.log('Background: Processing Dual-Chain Registration...');

    // We used to just call dualChain.registerDualChainConsent, but since we are async
    // inside a non-async listener, we need to handle the promise chain correctly.
    consentManager.dualChain.registerDualChainConsent(preferences, dataController, agreementId)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => {
        console.error('Background: Dual-Chain Registration Failed', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep channel open
  }

  // GET_POPUP_DATA - from popup
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
    return true;
  }

  // GET_CONSENT_DATA - from dashboard
  if (request.type === 'GET_CONSENT_DATA') {
    const limit = request.limit || 50;
    const offset = request.offset || 0;
    console.log(`Background: Received GET_CONSENT_DATA request (limit: ${limit}, offset: ${offset})`);

    Promise.all([
      consentStorage.getConsents(limit, offset),
      consentStorage.getBatchStats()
    ])
      .then(([consents, batches]) => {
        console.log('Background: Sending response with', consents.length, 'consents');
        sendResponse({ consents, batches });
      })
      .catch(error => {
        console.error('Background: Error getting consent data:', error);
        sendResponse({ consents: [], batches: null, error: error.message });
      });
    return true;
  }

  // CLEAR_CONSENTS - from dashboard
  if (request.type === 'CLEAR_CONSENTS') {
    console.log('Background: Received CLEAR_CONSENTS request');
    consentStorage.clearAllConsents()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // PREPARE_BATCH - from dashboard
  if (request.type === 'PREPARE_BATCH') {
    consentManager.prepareConsentBatch(request.force)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // BATCH_COMPLETE - from dashboard
  if (request.type === 'BATCH_COMPLETE') {
    consentManager.finalizeBatch(request.result, request.batchData)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // GET_STATS - from dashboard
  if (request.type === 'GET_STATS') {
    consentManager.getStats()
      .then(stats => sendResponse(stats))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  // GET_ALL_AGREEMENTS - from dashboard
  if (request.type === 'GET_ALL_AGREEMENTS') {
    consentStorage.getAllAgreements()
      .then(agreements => sendResponse({ agreements }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  // GET_COOKIES - from dashboard
  if (request.type === 'GET_COOKIES') {
    const domain = request.domain;
    if (!domain) {
      sendResponse({ error: 'Domain required' });
      return true;
    }

    chrome.cookies.getAll({ domain }, (cookies) => {
      sendResponse({ cookies });
    });
    return true;
  }

  // DELETE_COOKIE - from dashboard
  if (request.type === 'DELETE_COOKIE') {
    const { url, name, storeId } = request;
    chrome.cookies.remove({ url, name, storeId }, (details) => {
      if (details) {
        sendResponse({ success: true, details });
      } else {
        sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'Failed to remove cookie' });
      }
    });
    return true;
  }

  // FORCE_BATCH - from popup/dashboard
  if (request.type === 'FORCE_BATCH') {
    consentManager.checkAndProcessBatch(true)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // GET_PREFERENCES - from dashboard
  if (request.type === 'GET_PREFERENCES') {
    chrome.storage.sync.get(['myTermsProfile'], (result) => {
      sendResponse({ preferences: result.myTermsProfile?.preferences || {} });
    });
    return true;
  }

  // SAVE_PREFERENCES - from dashboard
  if (request.type === 'SAVE_PREFERENCES') {
    chrome.storage.sync.get(['myTermsProfile'], (result) => {
      const profile = result.myTermsProfile || {};
      profile.preferences = request.preferences;
      chrome.storage.sync.set({ myTermsProfile: profile }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  // Unknown message type - don't keep channel open
  return false;
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open dashboard to sign batch
  // Use localhost to allow wallet injection
  const dashboardUrl = 'http://localhost:8080/dashboard/index.html?action=forceBatch';
  chrome.tabs.create({ url: dashboardUrl });
  chrome.notifications.clear(notificationId);
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
