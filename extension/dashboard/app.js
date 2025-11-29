import { walletManager } from '../utils/wallet-manager.js';
import { myTermsEthers } from '../utils/ethers.js';
// Note: storage.js uses IndexedDB which is origin-specific. 
// If dashboard is run from file:// or a different origin than the extension, it won't see the extension's DB.
// For now, we assume it shares the origin or is just a visualization.
import { consentStorage } from '../utils/storage.js';

/**
 * DataService handles communication with the extension backend.
 * It supports two modes:
 * 1. Direct: When running within the extension context (chrome-extension://...)
 * 2. Bridge: When running on localhost, using window.postMessage to talk to content script
 */
class DataService {
    constructor() {
        this.isExtensionContext = !!(window.chrome && chrome.runtime && chrome.runtime.id);
        console.log(`DataService initialized. Mode: ${this.isExtensionContext ? 'Direct' : 'Bridge'}`);
    }

    async request(type, payload = {}) {
        if (this.isExtensionContext) {
            return this.requestDirect(type, payload);
        } else {
            return this.requestBridge(type, payload);
        }
    }

    async requestDirect(type, payload) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type, ...payload }, (response) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else resolve(response);
            });
        });
    }

    async requestBridge(type, payload) {
        const requestId = Math.random().toString(36).substring(7);

        return new Promise((resolve, reject) => {
            const handler = (event) => {
                if (event.source !== window) return;
                if (event.data.type === 'MYTERMS_WEB_RES' && event.data.requestId === requestId) {
                    window.removeEventListener('message', handler);
                    if (event.data.success) resolve(event.data.data);
                    else reject(new Error(event.data.error || 'Unknown bridge error'));
                }
            };

            window.addEventListener('message', handler);

            // Timeout after 10 seconds (increased for large datasets)
            setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('Bridge request timed out (10s). The dataset might be too large. Try clearing old consents or using the extension dashboard.'));
            }, 10000);

            // Send request to content script
            window.postMessage({
                type: 'MYTERMS_WEB_REQ',
                requestId,
                payload: { type, ...payload }
            }, '*');
        });
    }

    // Specific API methods
    async getConsentData() {
        // For direct mode, we can use storage directly for speed, or go through message passing
        // To keep it unified, we'll use message passing for both if possible, 
        // but the original code used direct storage access for 'loadData'.
        // Let's try to use the 'GET_CONSENT_DATA' message we saw in background.js
        try {
            const response = await this.request('GET_CONSENT_DATA');
            if (response.error) throw new Error(response.error);
            return response;
        } catch (e) {
            console.warn('Failed to get data via message, falling back to direct storage if available', e);
            if (this.isExtensionContext) {
                const consents = await consentStorage.getAllQueuedConsents();
                const batches = await consentStorage.getBatchStats();
                return { consents, batches };
            }
            throw e;
        }
    }

    async prepareBatch(force = false) {
        const response = await this.request('PREPARE_BATCH', { force });
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async finalizeBatch(result, batchData) {
        const response = await this.request('BATCH_COMPLETE', { result, batchData });
        if (!response.success) throw new Error(response.error);
        return response;
    }

    async getPreferences() {
        const response = await this.request('GET_PREFERENCES');
        if (response.error) throw new Error(response.error);
        return response.preferences;
    }

    async savePreferences(preferences) {
        const response = await this.request('SAVE_PREFERENCES', { preferences });
        if (!response.success) throw new Error(response.error);
        return response;
    }
}

class DashboardApp {
    constructor() {
        this.dataService = new DataService();
        this.init();
    }

    async init() {
        try {
            this.initElements();
            this.attachEventListeners();

            // Check if we're in extension context (chrome-extension://)
            const isExtensionContext = window.location.protocol === 'chrome-extension:';

            // Check user preferences with retries to handle bridge race conditions
            let blockchainEnabled = true; // Default to TRUE (Fail-Open) to prevent lockout

            try {
                // Simple retry helper
                const getPrefsWithRetry = async (retries = 3, delay = 1000) => {
                    for (let i = 0; i < retries; i++) {
                        try {
                            return await this.dataService.getPreferences();
                        } catch (err) {
                            if (i === retries - 1) throw err;
                            console.log(`Bridge not ready, retrying init (${i + 1}/${retries})...`);
                            await new Promise(r => setTimeout(r, delay));
                        }
                    }
                };

                const prefs = await getPrefsWithRetry();
                // Only disable if explicitly set to false in prefs
                if (prefs && typeof prefs.blockchainEnabled !== 'undefined') {
                    blockchainEnabled = prefs.blockchainEnabled;
                }
                console.log('Blockchain enabled in preferences:', blockchainEnabled);
            } catch (error) {
                console.warn('Could not load preferences after retries, defaulting to ENABLED to ensure access:', error);
                // We keep blockchainEnabled = true here so the UI shows up
            }

            // Only initialize wallet features if blockchain is explicitly enabled
            if (blockchainEnabled && !isExtensionContext) {
                console.log('Initializing wallet features...');
                this.checkWalletConnection();
            } else {
                console.log('Blockchain disabled or extension context - hiding wallet features');
                this.disableWalletFeatures();
            }

            // Initialize charts
            this.initCharts();

            // Load preferences into UI
            await this.loadPreferences();

            // Load initial data
            await this.loadData();

            // Explicitly hide overlay on success
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.classList.add('hidden');
            }
            // Mark app as initialized for fallback script
            window.myTermsAppInitialized = true;

        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            // Don't show error modal for import failures, just log them
            if (!error.message.includes('Failed to fetch')) {
                this.showError('Failed to initialize dashboard: ' + error.message);
            }
        } finally {
            // Always hide loading overlay
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.classList.add('hidden');
            }
        }

        // Check for URL actions (e.g. force batch) - only if blockchain enabled
        const isExtensionContext = window.location.protocol === 'chrome-extension:';
        if (!isExtensionContext) {
            this.checkUrlActions();
        }
    }

    disableWalletFeatures() {
        const isExtensionContext = window.location.protocol === 'chrome-extension:';

        // Replace wallet status area with info message
        const walletStatus = document.getElementById('walletStatus');
        if (walletStatus) {
            if (isExtensionContext) {
                // In extension: direct to popup for wallet features
                walletStatus.innerHTML = `
                    <div style="background: rgba(251, 191, 36, 0.2); padding: 10px; border-radius: 8px; text-align: center;">
                        <p style="margin: 0; font-size: 13px; color: #fbbf24;">
                            ℹ️ To connect wallet and submit batches, use the extension popup (click the extension icon)
                        </p>
                    </div>
                `;
            } else {
                // On localhost: blockchain is disabled, direct to preferences
                walletStatus.innerHTML = `
                    <div style="background: rgba(59, 130, 246, 0.2); padding: 12px; border-radius: 8px; text-align: center;">
                        <p style="margin: 0 0 8px 0; font-size: 14px; color: #3b82f6; font-weight: 600;">
                            🔒 Blockchain Features Disabled
                        </p>
                        <p style="margin: 0; font-size: 12px; color: #3b82f6;">
                            Enable blockchain in <a href="#" onclick="document.querySelector('[data-view=preferences]').click(); return false;" style="color: #3b82f6; text-decoration: underline; font-weight: bold;">Preferences</a> to connect wallet and submit batches
                        </p>
                    </div>
                `;
            }
        }

        // Hide force batch button if it exists
        const forceBatchBtn = document.getElementById('forceBatchButton');
        if (forceBatchBtn) {
            forceBatchBtn.style.display = 'none';
        }
    }

    async checkUrlActions() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');

        if (action === 'forceBatch') {
            // Remove param to prevent re-triggering on reload
            window.history.replaceState({}, document.title, window.location.pathname);

            // Wait a bit for UI to load
            setTimeout(() => this.handleForceBatchAction(), 500);
        }
    }

    async handleForceBatchAction() {
        try {
            console.log('Handling force batch action...');

            // Show loading overlay with custom message
            const overlay = document.getElementById('loadingOverlay');
            const spinner = overlay.querySelector('.spinner');
            const originalText = overlay.textContent; // This might be just whitespace if spinner is separate

            // Create a status message element if it doesn't exist
            let statusMsg = document.getElementById('batchStatusMsg');
            if (!statusMsg) {
                statusMsg = document.createElement('div');
                statusMsg.id = 'batchStatusMsg';
                statusMsg.style.marginTop = '20px';
                statusMsg.style.color = 'white';
                statusMsg.style.fontWeight = 'bold';
                overlay.appendChild(statusMsg);
            }

            overlay.classList.remove('hidden');
            statusMsg.textContent = 'Connecting wallet...';

            // 1. Connect Wallet
            await walletManager.connectWallet('metamask');

            // Check network
            const wallet = walletManager.getConnectedWallet();
            // Handle BigInt chainId from ethers v6
            const chainId = wallet?.network?.chainId ? Number(wallet.network.chainId) : 0;
            console.log('Detected Chain ID:', chainId, 'Wallet Network:', wallet?.network);

            if (chainId === 1) {
                throw new Error(`Please switch your wallet to Localhost (Chain ID: 31337) or Sepolia (Chain ID: 11155111). Detected Chain ID: ${chainId} (Mainnet).`);
            }

            statusMsg.textContent = 'Preparing batch data...';

            // 2. Prepare Batch (Force = true)
            const batchData = await this.dataService.prepareBatch(true);


            statusMsg.textContent = `Signing transaction for ${batchData.count} consents...`;

            // 3. Sign Transaction
            // Always reset ethers to ensure we pick up the correct network config (especially after a switch)
            await myTermsEthers.reset();

            const txResult = await myTermsEthers.submitConsentBatch(
                batchData.sites,
                batchData.hashes
            );

            statusMsg.textContent = 'Finalizing batch...';

            // Sanitize txResult for postMessage (remove functions/promises)
            const safeTxResult = {
                hash: txResult.hash,
                blockNumber: txResult.blockNumber,
                gasUsed: txResult.gasUsed.toString(),
                confirmations: 1 // Hardcode or extract value if available
            };

            // 4. Finalize
            await this.dataService.finalizeBatch(safeTxResult, batchData);

            statusMsg.textContent = 'Success! Batch submitted.';
            setTimeout(() => {
                overlay.classList.add('hidden');
                this.loadData(); // Refresh view
                alert('Batch submitted successfully! Transaction: ' + txResult.hash);
            }, 1500);



        } catch (error) {
            console.error('Force batch failed:', error);

            // Handle "No pending consents" gracefully
            if (error.message.includes('No pending consents')) {
                const overlay = document.getElementById('loadingOverlay');
                const statusMsg = document.getElementById('batchStatusMsg');
                if (statusMsg) statusMsg.textContent = 'No consents to batch.';

                setTimeout(() => {
                    overlay.classList.add('hidden');
                    alert('No pending consents found to batch. Visit some websites first!');
                }, 1500);
                return;
            }

            // Check if it's a network error
            if (error.message.includes('Please switch your wallet')) {
                console.log('Showing network switch modal...');
                const errorContainer = document.getElementById('errorMessage');
                if (errorContainer) {
                    errorContainer.innerHTML = `
                        <p>${error.message}</p>
                        <button id="autoSwitchBtn" class="connect-btn" style="margin-top: 15px; background: #4CAF50; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 5px; font-weight: bold; width: 100%;">
                            🔄 Switch to Localhost
                        </button>
                    `;

                    // Show modal
                    const modal = document.getElementById('errorModal');
                    if (modal) {
                        modal.classList.remove('hidden');

                        // Add click handler
                        setTimeout(() => {
                            const btn = document.getElementById('autoSwitchBtn');
                            if (btn) {
                                btn.addEventListener('click', async () => {
                                    modal.classList.add('hidden');
                                    await this.handleNetworkSwitch('localhost');
                                });
                            }
                        }, 100);
                    }
                }
            } else {
                this.showError(`Force batch failed: ${error.message}`);

                // Add Skip button for transaction errors
                const errorContainer = document.getElementById('errorMessage');
                if (errorContainer && (error.message.includes('rejected') || error.message.includes('funds'))) {
                    const skipBtn = document.createElement('button');
                    skipBtn.className = 'connect-btn';
                    skipBtn.style.marginTop = '10px';
                    skipBtn.style.background = '#f44336'; // Red
                    skipBtn.textContent = '⏩ Skip Blockchain (Test Only)';
                    skipBtn.onclick = async () => {
                        document.getElementById('errorModal').classList.add('hidden');
                        await this.skipBlockchainSubmission();
                    };
                    errorContainer.appendChild(skipBtn);
                }
            }
        } finally {
            // Hide loading overlay
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.classList.remove('active');
            }
        }
    }

    async skipBlockchainSubmission() {
        try {
            const overlay = document.getElementById('loadingOverlay');
            overlay.classList.remove('hidden');
            const statusMsg = document.getElementById('batchStatusMsg');
            statusMsg.textContent = 'Skipping blockchain... Finalizing batch locally.';

            // Mock transaction result
            const txResult = {
                hash: '0xSKIPPED_' + Date.now(),
                blockNumber: 0,
                gasUsed: '0',
                confirmations: 0
            };

            // Re-fetch batch data since we lost it in the scope
            const batchData = await this.dataService.prepareBatch();

            await this.dataService.finalizeBatch(txResult, batchData);

            statusMsg.textContent = 'Batch finalized (Skipped)!';
            setTimeout(() => {
                overlay.classList.add('hidden');
                this.loadData();
                alert('Batch finalized locally (Blockchain skipped).');
            }, 1000);
        } catch (err) {
            console.error('Skip failed:', err);
            alert('Skip failed: ' + err.message);
            overlay.classList.add('hidden');
        }
    }

    showError(message) {
        const modal = document.getElementById('errorModal');
        const errorMsg = document.getElementById('errorMessage');
        if (modal && errorMsg) {
            errorMsg.textContent = message;
            modal.classList.remove('hidden');
        } else {
            alert(message);
        }
    }

    initElements() {
        // Buttons
        this.connectBtn = document.getElementById('connectButton');
        this.forceBatchBtn = document.getElementById('forceBatchButton');
        this.refreshBtn = document.getElementById('refreshButton');
        this.retryBtn = document.getElementById('retryButton');
        this.loadMoreBtn = document.getElementById('loadMoreButton');
        this.savePreferencesBtn = document.getElementById('savePreferencesBtn');

        // Views
        this.views = {
            timeline: document.getElementById('timelineView'),
            sites: document.getElementById('sitesView'),
            analytics: document.getElementById('analyticsView'),
            preferences: document.getElementById('preferencesView')
        };

        this.viewBtns = document.querySelectorAll('.view-btn');

        // Stats
        this.stats = {
            total: document.getElementById('totalConsents'),
            sites: document.getElementById('sitesCount'),
            txs: document.getElementById('transactionsCount'),
            score: document.getElementById('privacyScore')
        };

        // Containers
        this.timelineContainer = document.getElementById('timelineContainer');
        this.timelineTimeline = document.getElementById('timelineTimeline');
        this.sitesGrid = document.getElementById('sitesGrid');
        this.noDataMsg = document.getElementById('noDataMessage');
        this.walletStatus = document.getElementById('walletStatus');
        this.saveStatus = document.getElementById('saveStatus');

        // Preferences
        this.prefs = {
            denyAll: document.getElementById('prefDenyAll'),
            analytics: document.getElementById('prefAnalytics'),
            marketing: document.getElementById('prefMarketing'),
            functional: document.getElementById('prefFunctional'),
            social: document.getElementById('prefSocial'),
            blockchainEnabled: document.getElementById('prefBlockchainEnabled')
        };
    }

    attachEventListeners() {
        // Wallet Connection
        this.connectBtn.addEventListener('click', () => this.connectWallet());
        this.forceBatchBtn.addEventListener('click', () => this.handleForceBatchAction());

        // Navigation
        this.viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });

        // Refresh
        this.refreshBtn.addEventListener('click', () => this.loadData());
        this.retryBtn.addEventListener('click', () => this.loadData());

        // Preferences
        this.savePreferencesBtn.addEventListener('click', () => this.savePreferences());

        // Network Switching
        const networkSelect = document.getElementById('networkSelect');
        if (networkSelect) {
            networkSelect.addEventListener('change', (e) => this.handleNetworkSwitch(e.target.value));
        }
    }

    async handleNetworkSwitch(network) {
        try {
            if (!window.ethereum) return;

            const networks = {
                'localhost': {
                    chainId: '0x7A69', // 31337
                    chainName: 'Localhost 8545',
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    rpcUrls: ['http://127.0.0.1:8545']
                },
                'sepolia': {
                    chainId: '0xAA36A7', // 11155111
                    chainName: 'Sepolia',
                    nativeCurrency: { name: 'Sepolia ETH', symbol: 'SEP', decimals: 18 },
                    rpcUrls: ['https://sepolia.infura.io/v3/']
                },
                'mainnet': {
                    chainId: '0x1'
                }
            };

            const target = networks[network];
            if (!target) return;

            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: target.chainId }],
                });
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask.
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [target],
                    });
                } else {
                    this.showError(`Failed to switch network: ${switchError.message}`);
                }
            }
        } finally {
            // Hide loading overlay
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.classList.remove('active');
            }
        }
    }

    async checkWalletConnection() {
        // Immediately show Connect Wallet button (will be replaced if wallet is already connected)
        this.updateWalletUI(null);

        // Wait for wallet manager to init
        setTimeout(async () => {
            const wallet = walletManager.getConnectedWallet();
            if (wallet) {
                this.updateWalletUI(wallet);
                // Reload data to include blockchain info
                this.loadData();
            }
        }, 1000);

        walletManager.onWalletChange((wallet) => {
            this.updateWalletUI(wallet);
            if (wallet) this.loadData(); // Reload with blockchain data
            else this.clearBlockchainData(); // Keep local data
        });
    }

    async loadPreferences() {
        try {
            const prefs = await this.dataService.getPreferences();
            if (prefs) {
                this.prefs.denyAll.checked = prefs.denyAll;
                this.prefs.analytics.checked = prefs.analytics;
                this.prefs.marketing.checked = prefs.marketing;
                this.prefs.functional.checked = prefs.functional;
                this.prefs.social.checked = prefs.social;
                this.prefs.blockchainEnabled.checked = prefs.blockchainEnabled || false;
            }
        } catch (error) {
            console.error('Failed to load preferences:', error);
        }
    }

    async savePreferences() {
        try {
            this.saveStatus.textContent = 'Saving...';
            this.saveStatus.className = 'save-status saving';

            const newPrefs = {
                denyAll: this.prefs.denyAll.checked,
                analytics: this.prefs.analytics.checked,
                marketing: this.prefs.marketing.checked,
                functional: this.prefs.functional.checked,
                social: this.prefs.social.checked,
                blockchainEnabled: this.prefs.blockchainEnabled.checked,
                necessary: true // Always true
            };

            await this.dataService.savePreferences(newPrefs);

            this.saveStatus.textContent = 'Saved!';
            this.saveStatus.className = 'save-status saved';
            setTimeout(() => {
                this.saveStatus.textContent = '';
                this.saveStatus.className = 'save-status';
            }, 2000);

        } catch (error) {
            console.error('Failed to save preferences:', error);
            this.saveStatus.textContent = 'Error saving';
            this.saveStatus.className = 'save-status error';
        }
    }

    // Wallet Connection
    async connectWallet() {
        try {
            // Check if MetaMask is installed
            if (typeof window.ethereum === 'undefined') {
                // If not found, it might be loading asynchronously. Wait a bit.
                await new Promise(resolve => setTimeout(resolve, 500));
                if (typeof window.ethereum === 'undefined') {
                    alert('MetaMask not found! Please install MetaMask extension.');
                    return;
                }
            }
            this.walletStatus.innerHTML = '<span>Connecting...</span>';
            await walletManager.connectWallet('metamask');
        } catch (error) {
            console.error('Failed to connect:', error);
            this.walletStatus.innerHTML = '<span class="error">Connection Failed</span>';
            alert('Failed to connect wallet: ' + error.message);
        }
    }

    updateWalletUI(wallet) {
        if (wallet && wallet.account) {
            // Wallet IS connected - show wallet info + Force Batch button
            const shortAddr = `${wallet.account.substring(0, 6)}...${wallet.account.substring(38)}`;
            this.walletStatus.className = 'wallet-status connected';
            this.walletStatus.innerHTML = `
                <button class="connect-btn" id="forceBatchButton" style="margin-right: 10px; background: rgba(255, 255, 255, 0.1);">
                    ⚡ Force Batch
                </button>
                <div class="wallet-info">
                    <span class="network-badge">${wallet.network?.name || 'Unknown'}</span>
                    <span class="address" title="${wallet.account}">${shortAddr}</span>
                </div>
            `;
            // Re-attach listener for force batch
            document.getElementById('forceBatchButton').addEventListener('click', () => this.handleForceBatchAction());

            if (this.connectBtn) this.connectBtn.style.display = 'none';
        } else {
            // Wallet NOT connected - only show Connect Wallet button
            this.walletStatus.className = 'wallet-status';
            this.walletStatus.innerHTML = `
                <button class="connect-btn" id="connectButton">
                    🔗 Connect Wallet
                </button>
            `;
            // Re-attach listener
            document.getElementById('connectButton').addEventListener('click', () => this.connectWallet());
            this.connectBtn = document.getElementById('connectButton');
        }
    }

    clearBlockchainData() {
        // Reset stats that depend on blockchain
        this.stats.txs.textContent = '--';
        // Reload local data to ensure we still show what we have
        this.loadData();
    }

    async loadData() {
        try {
            this.refreshBtn.classList.add('spinning');

            // Get data from service
            const data = await this.dataService.getConsentData();

            this.processData(data.consents, data.batches);

            this.refreshBtn.classList.remove('spinning');
        } catch (error) {
            console.error('Failed to load data:', error);
            this.refreshBtn.classList.remove('spinning');

            // Show helpful message based on context
            if (!this.dataService.isExtensionContext && error.message.includes('timed out')) {
                // Blockchain dashboard (localhost) with bridge timeout
                const extensionDashboardLink = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
                    ? `<a href="${chrome.runtime.getURL('dashboard/index.html')}" style="color: #4CAF50; text-decoration: underline;">
                        Or try the Extension Dashboard →
                       </a>`
                    : `<span>Or try opening the Extension Dashboard from chrome://extensions</span>`;

                this.noDataMsg.style.display = 'flex';
                this.noDataMsg.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <h3 style="color: #f44336;">⚠️ Connection Issue</h3>
                        <p>Unable to connect to the MyTerms extension.</p>
                        <p style="margin-top: 15px;"><strong>Quick fix:</strong></p>
                        <ol style="text-align: left; display: inline-block; margin: 10px auto;">
                            <li>Go to <code>chrome://extensions</code></li>
                            <li>Click reload on "MyTerms"</li>
                            <li>Refresh this page</li>
                        </ol>
                        <p style="margin-top: 15px;">
                            ${extensionDashboardLink}
                        </p>
                    </div>
                `;
            } else {
                // Generic error
                this.noDataMsg.style.display = 'flex';
                this.noDataMsg.textContent = 'Failed to load data. Is the extension installed?';
            }
        }
    }

    switchView(viewName) {
        // Update buttons
        this.viewBtns.forEach(btn => {
            if (btn.dataset.view === viewName) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Update sections
        Object.entries(this.views).forEach(([name, el]) => {
            if (name === viewName) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });
    }

    // ... (loadData and processData methods remain same)

    processData(consents, batches) {
        if (!consents || consents.length === 0) {
            this.noDataMsg.style.display = 'flex';
            this.timelineTimeline.innerHTML = '';
            return;
        }

        // Hide no data/error message completely
        if (this.noDataMsg) {
            this.noDataMsg.style.display = 'none';
            this.noDataMsg.style.visibility = 'hidden';
            this.noDataMsg.classList.add('hidden');
        }

        // Update Stats
        this.stats.total.textContent = consents.length;
        const uniqueSites = new Set(consents.map(c => c.siteDomain)).size;
        this.stats.sites.textContent = uniqueSites;
        this.stats.txs.textContent = batches ? batches.totalBatches : 0;

        // Calculate privacy score (mock logic)
        const declined = consents.filter(c => c.decisionType === 'decline').length;
        const score = Math.round((declined / consents.length) * 100) || 0;
        this.stats.score.textContent = `${score}%`;

        // Render Timeline
        this.renderTimeline(consents);
        this.renderTimelineChart(consents);

        // Render Sites
        this.renderSites(consents);

        // Update Charts
        this.updateCharts(consents);
    }

    renderTimelineChart(consents) {
        const ctx = document.getElementById('timelineChart').getContext('2d');

        // Destroy existing chart if it exists
        if (this.timelineChartInstance) {
            this.timelineChartInstance.destroy();
        }

        // Aggregate data by date
        const dateMap = {};
        const sortedConsents = [...consents].sort((a, b) => a.timestamp - b.timestamp);

        sortedConsents.forEach(c => {
            const date = new Date(c.timestamp).toLocaleDateString();
            if (!dateMap[date]) dateMap[date] = { accept: 0, decline: 0 };

            if (c.decisionType === 'accept') dateMap[date].accept++;
            else dateMap[date].decline++;
        });

        const labels = Object.keys(dateMap);
        const acceptData = labels.map(d => dateMap[d].accept);
        const declineData = labels.map(d => dateMap[d].decline);

        this.timelineChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Accepted',
                        data: acceptData,
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Declined',
                        data: declineData,
                        borderColor: '#F44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // ... (renderTimeline, renderSites, initCharts, updateCharts, clearData methods remain same)

    // Helper to keep existing methods intact while replacing the block
    renderTimeline(consents) {
        this.timelineTimeline.innerHTML = '';

        // Sort by timestamp desc
        const sorted = [...consents].sort((a, b) => b.timestamp - a.timestamp);

        // If we have data, make sure error message is hidden
        if (sorted.length > 0 && this.noDataMsg) {
            this.noDataMsg.style.display = 'none';
            this.noDataMsg.style.visibility = 'hidden';
        }

        sorted.forEach(consent => {
            const item = document.createElement('div');
            item.className = 'timeline-item';

            const date = new Date(consent.timestamp).toLocaleString();
            const isAccept = consent.decisionType === 'accept';

            item.innerHTML = `
                <div class="timeline-icon ${isAccept ? 'accept' : 'decline'}">
                    ${isAccept ? '✓' : '✕'}
                </div>
                <div class="timeline-content">
                    <div class="timeline-hash-hero">
                        <div class="hash-label">Terms Hash</div>
                        <div class="hash-value" title="${consent.termsHash}">${consent.termsHash}</div>
                    </div>
                    <div class="timeline-details">
                        <div class="timeline-detail-item">
                            <span class="detail-label">Website:</span>
                            <span class="site-name">${consent.siteDomain}</span>
                        </div>
                        <div class="timeline-detail-item">
                            <span class="detail-label">Decision:</span>
                            <span class="decision-badge ${isAccept ? 'accept' : 'decline'}">
                                ${isAccept ? '✓ Accepted' : '✕ Declined'}
                            </span>
                        </div>
                        <div class="timeline-detail-item">
                            <span class="detail-label">Date:</span>
                            <span class="date">${date}</span>
                        </div>
                    </div>
                </div>
            `;

            this.timelineTimeline.appendChild(item);
        });
    }

    renderSites(consents) {
        this.sitesGrid.innerHTML = '';

        const sites = {};
        consents.forEach(c => {
            if (!sites[c.siteDomain]) {
                sites[c.siteDomain] = { count: 0, accepted: 0, declined: 0, lastVisit: 0 };
            }
            sites[c.siteDomain].count++;
            if (c.decisionType === 'accept') sites[c.siteDomain].accepted++;
            else sites[c.siteDomain].declined++;
            if (c.timestamp > sites[c.siteDomain].lastVisit) sites[c.siteDomain].lastVisit = c.timestamp;
        });

        Object.entries(sites).forEach(([domain, data]) => {
            const card = document.createElement('div');
            card.className = 'site-card';
            card.innerHTML = `
                <h3>${domain}</h3>
                <div class="site-stats">
                    <div class="site-stat">
                        <span class="label">Visits</span>
                        <span class="value">${data.count}</span>
                    </div>
                    <div class="site-stat">
                        <span class="label">Rate</span>
                        <span class="value">${Math.round((data.declined / data.count) * 100)}% Declined</span>
                    </div>
                </div>
                <div class="last-visit">Last: ${new Date(data.lastVisit).toLocaleDateString()}</div>
            `;
            this.sitesGrid.appendChild(card);
        });
    }

    initCharts() {
        // Decisions Chart
        const ctx1 = document.getElementById('decisionsChart').getContext('2d');
        this.decisionsChart = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['Accepted', 'Declined'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#4CAF50', '#F44336']
                }]
            }
        });

        // Sites Chart
        const ctx2 = document.getElementById('sitesChart').getContext('2d');
        this.sitesChart = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Consents',
                    data: [],
                    backgroundColor: '#2196F3'
                }]
            }
        });
    }

    updateCharts(consents) {
        // Update Decisions Chart
        const accepted = consents.filter(c => c.decisionType === 'accept').length;
        const declined = consents.filter(c => c.decisionType === 'decline').length;

        this.decisionsChart.data.datasets[0].data = [accepted, declined];
        this.decisionsChart.update();

        // Update Sites Chart
        const sites = {};
        consents.forEach(c => {
            sites[c.siteDomain] = (sites[c.siteDomain] || 0) + 1;
        });

        const sortedSites = Object.entries(sites)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        this.sitesChart.data.labels = sortedSites.map(s => s[0]);
        this.sitesChart.data.datasets[0].data = sortedSites.map(s => s[1]);
        this.sitesChart.update();
    }

    clearData() {
        this.stats.total.textContent = '--';
        this.stats.sites.textContent = '--';
        this.stats.txs.textContent = '--';
        this.stats.score.textContent = '--';
        this.timelineTimeline.innerHTML = '';
        this.sitesGrid.innerHTML = '';
        this.noDataMsg.style.display = 'flex';
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    new DashboardApp();
});
