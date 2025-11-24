// IndexedDB Queue Storage for MyTerms Browser Extension
// Handles storing consent data locally with daily batch processing

const DB_NAME = 'MyTermsExtensionDB';
const DB_VERSION = 1;
const CONSENT_STORE = 'consentQueue';
const BATCH_STORE = 'processedBatches';

class ConsentStorage {
  constructor() {
    this.db = null;
    this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create consent queue store
        if (!db.objectStoreNames.contains(CONSENT_STORE)) {
          const consentStore = db.createObjectStore(CONSENT_STORE, {
            keyPath: 'id',
            autoIncrement: true
          });

          // Create indexes for efficient querying
          consentStore.createIndex('siteDomain', 'siteDomain', { unique: false });
          consentStore.createIndex('timestamp', 'timestamp', { unique: false });
          consentStore.createIndex('lastBatch', 'lastBatch', { unique: false });
        }

        // Create processed batches store
        if (!db.objectStoreNames.contains(BATCH_STORE)) {
          const batchStore = db.createObjectStore(BATCH_STORE, {
            keyPath: 'batchId',
            autoIncrement: true
          });

          batchStore.createIndex('date', 'processedDate', { unique: false });
          batchStore.createIndex('txHash', 'transactionHash', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB initialization failed:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async waitForDB() {
    if (this.db) return this.db;

    let attempts = 0;
    while (!this.db && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return this.db;
  }

  // Add consent to queue
  async addToQueue(consentData) {
    try {
      const db = await this.waitForDB();
      const transaction = db.transaction([CONSENT_STORE], 'readwrite');
      const store = transaction.objectStore(CONSENT_STORE);

      // Add timestamp and mark as not batched yet
      const consent = {
        ...consentData,
        timestamp: Date.now(),
        batched: false,
        batchId: null
      };

      const request = store.add(consent);

      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          console.log('Consent added to queue:', consent.siteDomain);
          resolve(event.target.result);
        };

        request.onerror = (event) => {
          console.error('Failed to add consent to queue:', event.target.error);
          reject(event.target.error);
        };

        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error adding to queue:', error);
      throw error;
    }
  }

  // Get all queued consents that haven't been batched yet
  async getUnbatchedQueue() {
    try {
      const db = await this.waitForDB();
      const transaction = db.transaction([CONSENT_STORE], 'readonly');
      const store = transaction.objectStore(CONSENT_STORE);

      return new Promise((resolve, reject) => {
        const request = store.openCursor();
        const results = [];

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const item = cursor.value;
            if (!item.batched) {
              results.push(item);
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = (event) => reject(event.target.error);
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error getting unbatched queue:', error);
      throw error;
    }
  }

  // Get all consents in queue (for popup display)
  async getAllQueuedConsents() {
    try {
      const db = await this.waitForDB();
      const transaction = db.transaction([CONSENT_STORE], 'readonly');
      const store = transaction.objectStore(CONSENT_STORE);

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };

        request.onerror = (event) => reject(event.target.error);
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error getting all queued consents:', error);
      throw error;
    }
  }

  // Get consents that are ready for batching (older than threshold)
  async getBatchReadyConsents(hoursThreshold = 24) {
    try {
      const db = await this.waitForDB();
      const transaction = db.transaction([CONSENT_STORE], 'readonly');
      const store = transaction.objectStore(CONSENT_STORE);

      const thresholdTime = Date.now() - (hoursThreshold * 60 * 60 * 1000);

      return new Promise((resolve, reject) => {
        const request = store.openCursor();
        const results = [];

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const item = cursor.value;
            if (!item.batched && item.timestamp < thresholdTime) {
              results.push(item);
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = (event) => reject(event.target.error);
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error getting batch ready consents:', error);
      throw error;
    }
  }

  // Mark consents as batched
  async markAsBatched(consentIds, batchInfo) {
    try {
      const db = await this.waitForDB();
      const transaction = db.transaction([CONSENT_STORE], 'readwrite');
      const store = transaction.objectStore(CONSENT_STORE);

      for (const id of consentIds) {
        const request = store.get(id);

        request.onsuccess = () => {
          const consent = request.result;
          if (consent) {
            consent.batched = true;
            consent.batchedAt = Date.now();
            consent.batchId = batchInfo.batchId;

            const updateRequest = store.put(consent);
            updateRequest.onerror = (event) => {
              console.error('Error updating consent:', event.target.error);
            };
          }
        };

        request.onerror = (event) => {
          console.error('Error getting consent for update:', event.target.error);
        };
      }

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error marking consents as batched:', error);
      throw error;
    }
  }

  // Clear processed consents (cleanup)
  async clearProcessedConsents(daysOld = 30) {
    try {
      const db = await this.waitForDB();
      const transaction = db.transaction([CONSENT_STORE], 'readwrite');
      const store = transaction.objectStore(CONSENT_STORE);

      const thresholdTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

      return new Promise((resolve, reject) => {
        const request = store.openCursor();
        let deletedCount = 0;

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const item = cursor.value;
            if (item.batched && item.batchedAt && item.batchedAt < thresholdTime) {
              cursor.delete();
              deletedCount++;
            }
            cursor.continue();
          } else {
            console.log(`Cleared ${deletedCount} old processed consents`);
            resolve(deletedCount);
          }
        };

        request.onerror = (event) => reject(event.target.error);
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error clearing processed consents:', error);
      throw error;
    }
  }

  // Record processed batch
  async recordBatch(batchData) {
    try {
      const db = await this.waitForDB();
      const transaction = db.transaction([BATCH_STORE], 'readwrite');
      const store = transaction.objectStore(BATCH_STORE);

      const batch = {
        batchId: `batch_${Date.now()}_${Math.random()}`,
        processedDate: Date.now(),
        transactionHash: batchData.txHash,
        consentIds: batchData.consentIds,
        siteData: batchData.siteData,
        gasUsed: batchData.gasUsed,
        blockNumber: batchData.blockNumber
      };

      const request = store.add(batch);

      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          console.log('Batch recorded:', batch.batchId);
          resolve(batch);
        };

        request.onerror = (event) => reject(event.target.error);
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error recording batch:', error);
      throw error;
    }
  }

  // Get latest batch information (for popup)
  async getLatestBatchInfo() {
    try {
      const db = await this.waitForDB();
      const transaction = db.transaction([BATCH_STORE], 'readonly');
      const store = transaction.objectStore(BATCH_STORE);

      return new Promise((resolve, reject) => {
        const request = store.openCursor(null, 'prev'); // Get latest first

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            resolve(cursor.value);
          } else {
            resolve(null); // No batches found
          }
        };

        request.onerror = (event) => reject(event.target.error);
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error getting latest batch info:', error);
      throw error;
    }
  }

  // Get batch statistics
  async getBatchStats() {
    try {
      const db = await this.waitForDB();

      return Promise.all([
        // Get all batches
        new Promise((resolve, reject) => {
          const transaction = db.transaction([BATCH_STORE], 'readonly');
          const store = transaction.objectStore(BATCH_STORE);
          const request = store.getAll();

          request.onsuccess = () => resolve(request.result);
          request.onerror = (event) => reject(event.target.error);
        }),
        // Get total consent count
        new Promise((resolve, reject) => {
          const transaction = db.transaction([CONSENT_STORE], 'readonly');
          const store = transaction.objectStore(CONSENT_STORE);
          const request = store.count();

          request.onsuccess = () => resolve(request.result);
          request.onerror = (event) => reject(event.target.error);
        })
      ]).then(([batches, totalConsents]) => {
        const totalBatches = batches.length;
        const totalGasUsed = batches.reduce((sum, batch) => sum + (batch.gasUsed || 0), 0);

        return {
          totalBatches,
          totalConsents,
          totalGasUsed,
          averageGasPerBatch: totalBatches > 0 ? totalGasUsed / totalBatches : 0
        };
      });
    } catch (error) {
      console.error('Error getting batch stats:', error);
      throw error;
    }
  }

  // Export data for backup
  async exportData() {
    try {
      const db = await this.waitForDB();

      const [consentData, batchData] = await Promise.all([
        new Promise((resolve, reject) => {
          const transaction = db.transaction([CONSENT_STORE], 'readonly');
          const store = transaction.objectStore(CONSENT_STORE);
          const request = store.getAll();

          request.onsuccess = () => resolve(request.result);
          request.onerror = (event) => reject(event.target.error);
          transaction.onerror = (event) => reject(event.target.error);
        }),
        new Promise((resolve, reject) => {
          const transaction = db.transaction([BATCH_STORE], 'readonly');
          const store = transaction.objectStore(BATCH_STORE);
          const request = store.getAll();

          request.onsuccess = () => resolve(request.result);
          request.onerror = (event) => reject(event.target.error);
          transaction.onerror = (event) => reject(event.target.error);
        })
      ]);

      return {
        exportDate: Date.now(),
        consentData,
        batchData
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }
}

// Global instance
const consentStorage = new ConsentStorage();

// Export for use in background and popup scripts
export { consentStorage };

// For background script usage
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Make available globally in background script
  if (typeof window !== 'undefined') {
    window.consentStorage = consentStorage;
  } else if (typeof self !== 'undefined') {
    self.consentStorage = consentStorage;
  }
}
