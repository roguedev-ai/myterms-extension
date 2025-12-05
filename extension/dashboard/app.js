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
    async getConsentData(limit = 50, offset = 0) {
        console.log(`DataService: getConsentData called (limit: ${limit}, offset: ${offset})`);
        // For direct mode, we can use storage directly for speed, or go through message passing
        // To keep it unified, we'll use message passing for both if possible, 
        // but the original code used direct storage access for 'loadData'.
        // Let's try to use the 'GET_CONSENT_DATA' message we saw in background.js
        try {
            const response = await this.request('GET_CONSENT_DATA', { limit, offset });
            console.log('DataService: Received response:', response);
            if (response.error) throw new Error(response.error);
            return response;
        } catch (e) {
            console.warn('Failed to get data via message, falling back to direct storage if available', e);
            if (this.isExtensionContext) {
                const consents = await consentStorage.getConsents(limit, offset);
                const batches = await consentStorage.getBatchStats();
                return { consents, batches };
            }
            throw e;
        }
    }

    async getAllSitesData() {
        try {
            const response = await this.request('GET_ALL_SITES_DATA');
            if (response.error) throw new Error(response.error);
            return response.sites || [];
        } catch (e) {
            console.warn('Failed to get sites data via message, falling back', e);
            if (this.isExtensionContext) {
                return await consentStorage.getAllSitesData();
            }
            return [];
        }
    }

    async getCookies(domain) {
        if (!domain) return { cookies: [] };
        try {
            const response = await this.request('GET_COOKIES', { domain });
            return response.cookies || [];
        } catch (e) {
            console.error('Failed to get cookies:', e);
            return [];
        }
    }

    async deleteCookie(url, name, storeId) {
        try {
            const response = await this.request('DELETE_COOKIE', { url, name, storeId });
            return response.success;
        } catch (e) {
            console.error('Failed to delete cookie:', e);
            return false;
        }
    }

    async request(type, payload = {}) {
        if (this.isExtensionContext) {
            // Use direct chrome.runtime.sendMessage
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ type, ...payload }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
        }

        // Use window.postMessage bridge
        return new Promise((resolve, reject) => {
            const requestId = Math.random().toString(36).substring(7);
            console.log(`DataService: Sending request ${requestId} (${type})`);

            const listener = (event) => {
                if (event.source !== window ||
                    event.data.type !== 'MYTERMS_WEB_RES' ||
                    event.data.requestId !== requestId) {
                    return;
                }

                console.log(`DataService: Received bridge response for ${requestId}`);
                window.removeEventListener('message', listener);

                if (event.data.success) {
                    resolve(event.data.data);
                } else {
                    reject(new Error(event.data.error));
                }
            };

            window.addEventListener('message', listener);

            // Send request
            window.postMessage({
                type: 'MYTERMS_WEB_REQ',
                requestId,
                payload: { type, ...payload }
            }, '*');

            // Timeout
            setTimeout(() => {
                window.removeEventListener('message', listener);
                console.error(`DataService: Request ${requestId} timed out`);
                reject(new Error('Request timed out'));
            }, 5000);
        });
    }

    async clearData() {
        const response = await this.request('CLEAR_CONSENTS');
        if (!response.success) throw new Error(response.error);
        return response;
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
        this.consents = []; // Initialize empty array
        this.init();
    }

    async init() {
        try {
            this.initElements();
            this.attachEventListeners();

            // Load preferences first to determine if we should connect
            await this.loadPreferences();

            // Check if we're in extension context (chrome-extension://)
            const isExtensionContext = window.location.protocol === 'chrome-extension:';

            if (isExtensionContext) {
                // Hide wallet-dependent features in extension context
                this.disableWalletFeatures();
            } else {
                // Always setup listeners so manual connection updates UI
                this.setupWalletListeners();

                // Only auto-connect if enabled in preferences
                if (this.prefs.blockchainEnabled.checked) {
                    this.checkWalletConnection();
                } else {
                    console.log('Blockchain features disabled by user preference.');
                    this.updateWalletUI(null);
                }
            }

            // Initialize charts
            this.initCharts();

            // Load initial data
            await this.loadData();
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.showError('Failed to initialize dashboard: ' + error.message);
        } finally {
            // Always hide loading overlay
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.classList.add('hidden');
            }
        }

        // Check for URL actions (e.g. force batch)
        const isExtensionContext = window.location.protocol === 'chrome-extension:';
        if (!isExtensionContext) {
            this.checkUrlActions();
        }
    }

    // ... (rest of methods) ...

    async loadData() {
        try {
            this.showLoading(true);

            // Fetch paginated consents for timeline
            const data = await this.dataService.getConsentData(this.limit, this.offset);

            // Safety check for data.consents
            const newConsents = data.consents || [];

            this.consents = this.offset === 0 ? newConsents : [...this.consents, ...newConsents];

            // Fetch aggregated sites data for charts and sites view
            const sitesData = await this.dataService.getAllSitesData();

            // Update UI
            // Actually getStats in background returns totals, so we should use that for stats
            const stats = await this.dataService.request('GET_STATS');
            if (!stats.error) {
                this.updateDashboardStats(stats);
            }

            this.renderTimeline(this.consents, this.offset > 0);
            this.renderSites(sitesData); // Use full sites data
            this.updateCharts(sitesData); // Use full sites data

            // Check for load more
            if (newConsents.length < this.limit) {
                this.loadMoreBtn.style.display = 'none';
            } else {
                this.loadMoreBtn.style.display = 'block';
            }

        } catch (error) {
            console.error('Failed to load data:', error);
            this.showError('Failed to load data: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    updateDashboardStats(stats) {
        if (this.stats.total) this.stats.total.textContent = stats.totalConsents || 0;
        if (this.stats.sites) this.stats.sites.textContent = stats.totalSites || 0;
        if (this.stats.txs) this.stats.txs.textContent = stats.totalBatches || 0;

        // Calculate privacy score
        const total = stats.totalConsents || 0;
        const declined = stats.totalDeclined || 0;
        const score = total === 0 ? 100 : Math.round((declined / total) * 100);

        if (this.stats.score) {
            this.stats.score.textContent = score;
            // Color code score
            this.stats.score.className = 'stat-value';
            if (score >= 80) this.stats.score.classList.add('good');
            else if (score >= 50) this.stats.score.classList.add('medium');
            else this.stats.score.classList.add('bad');
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

    processData(consents, batches, globalStats) {
        console.log('Dashboard: processData called with', consents ? consents.length : 0, 'consents');
        if (!consents || consents.length === 0) {
            this.noDataMsg.style.display = 'flex';
            this.timelineTimeline.innerHTML = '';
            // If no consents, but we have global stats, still update stats
            if (globalStats && !globalStats.error) {
                this.updateStatsFromGlobal(globalStats);
            } else {
                // Clear stats if no data and no global stats
                this.stats.consents.textContent = 0;
                this.stats.sites.textContent = 0;
                this.stats.score.textContent = 100; // 100% privacy if no consents
                this.stats.txs.textContent = 0;
            }
            return;
        }

        // Hide no data/error message completely
        if (this.noDataMsg) {
            this.noDataMsg.style.display = 'none';
            this.noDataMsg.style.visibility = 'hidden';
        }
        // Update Stats with GLOBAL stats if available, otherwise fallback to local calculation
        if (globalStats && !globalStats.error) {
            this.updateStatsFromGlobal(globalStats);
        } else {
            this.updateStatsFromLocal(consents || []);
        }

        // Render Timeline
        this.renderTimeline(consents);
        this.renderTimelineChart(consents);

        // Render Sites
        this.renderSites(consents);

        // Update Charts
        this.updateCharts(consents);
    }

    updateStatsFromGlobal(stats) {
        // Update Total Consents
        this.stats.total.textContent = stats.totalConsents || 0;

        // Update Sites Tracked
        this.stats.sites.textContent = stats.totalSites || 0;

        // Update Privacy Score (mock calculation based on accept/reject ratio)
        const total = stats.totalConsents || 0;
        const rejected = stats.totalDeclined || 0;
        const score = total === 0 ? 100 : Math.round((rejected / total) * 100);
        this.stats.score.textContent = `${score}%`;

        // Update Blockchain Txs
        this.stats.txs.textContent = stats.totalBatches || 0;
    }

    updateStatsFromLocal(consents) {
        // Fallback if GET_STATS fails
        if (!consents) return;

        this.stats.total.textContent = consents.length;
        const uniqueSites = new Set(consents.map(c => c.siteDomain)).size;
        this.stats.sites.textContent = uniqueSites;

        const declined = consents.filter(c => c.decisionType === 'decline').length;
        const score = consents.length === 0 ? 100 : Math.round((declined / consents.length) * 100);
        this.stats.score.textContent = `${score}%`;
    }

    async loadCookiesForEvent(domain, url, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<span class="loading-text">Loading cookies...</span>';

        try {
            const cookies = await this.dataService.getCookies(domain);

            if (cookies.length === 0) {
                container.innerHTML = '<span class="no-data">No cookies found for this domain.</span>';
                return;
            }

            let html = `<div class="cookie-list">
                <div class="cookie-header">
                    <span>Found ${cookies.length} cookies</span>
                    <button class="danger-btn small delete-all-cookies-btn" 
                        data-domain="${domain}" 
                        data-url="${url}" 
                        data-container="${containerId}">Delete All</button>
                </div>`;

            cookies.forEach(cookie => {
                html += `
                    <div class="cookie-item">
                        <div class="cookie-info">
                            <span class="cookie-name">${cookie.name}</span>
                            <span class="cookie-domain">${cookie.domain}</span>
                        </div>
                        <button class="icon-btn delete-cookie-btn" title="Delete" 
                            data-url="${url}" 
                            data-name="${cookie.name}" 
                            data-storeid="${cookie.storeId}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            });

            html += '</div>';
            container.innerHTML = html;

        } catch (error) {
            console.error('Error loading cookies:', error);
            container.innerHTML = '<span class="error-text">Failed to load cookies</span>';
        }
    }

    async deleteSingleCookie(url, name, storeId, btnElement) {
        if (!confirm(`Delete cookie "${name}"?`)) return;

        const success = await this.dataService.deleteCookie(url, name, storeId);
        if (success) {
            // Remove the row
            const row = btnElement.closest('.cookie-item');
            if (row) row.remove();
        } else {
            alert('Failed to delete cookie');
        }
    }

    async deleteAllCookies(domain, url, containerId) {
        if (!confirm(`Delete ALL cookies for ${domain}?`)) return;

        const cookies = await this.dataService.getCookies(domain);
        let deletedCount = 0;

        for (const cookie of cookies) {
            const success = await this.dataService.deleteCookie(url, cookie.name, cookie.storeId);
            if (success) deletedCount++;
        }

        alert(`Deleted ${deletedCount} cookies.`);
        this.loadCookiesForEvent(domain, url, containerId); // Reload
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
    renderTimeline(consents, append = false) {
        if (!append) {
            this.timelineTimeline.innerHTML = '';
        }

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
            item.innerHTML = `
                <div class="timeline-icon ${consent.decisionType}">
                    ${consent.decisionType === 'accept' ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>'}
                </div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="site-domain">${consent.siteDomain}</span>
                        <span class="time">${new Date(consent.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="timeline-details">
                        <div class="detail-row">
                            <span class="label">Decision:</span>
                            <span class="value ${consent.decisionType}">${(consent.decisionType || 'unknown').toUpperCase()}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Hash:</span>
                            <span class="value hash" title="${consent.termsHash}">${consent.termsHash.substring(0, 10)}...</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Status:</span>
                            <span class="value status ${status.toLowerCase()}">${status}</span>
                        </div>
                        <div class="cookie-section" id="cookies-${consent.timestamp}">
                            <button class="secondary-btn small view-cookies-btn" 
                                data-domain="${consent.siteDomain}" 
                                data-url="${consent.url}" 
                                data-container="cookies-${consent.timestamp}">
                                🍪 View Cookies
                            </button>
                        </div>
                    </div>
                </div>
            `;
            this.timelineTimeline.appendChild(item);
        });

        // Add event delegation for cookie buttons
        this.timelineTimeline.addEventListener('click', (e) => {
            // Handle View Cookies
            if (e.target.classList.contains('view-cookies-btn')) {
                const { domain, url, container } = e.target.dataset;
                this.loadCookiesForEvent(domain, url, container);
            }

            // Handle Delete All Cookies
            if (e.target.classList.contains('delete-all-cookies-btn')) {
                const { domain, url, container } = e.target.dataset;
                this.deleteAllCookies(domain, url, container);
            }

            // Handle Delete Single Cookie
            if (e.target.closest('.delete-cookie-btn')) {
                const btn = e.target.closest('.delete-cookie-btn');
                const { url, name, storeid } = btn.dataset;
                this.deleteSingleCookie(url, name, storeid, btn);
            }
        });
    }

    renderSites(sitesData) {
        this.sitesGrid.innerHTML = '';

        // Sort by visit count desc
        const sortedSites = [...sitesData].sort((a, b) => b.count - a.count);

        sortedSites.forEach(data => {
            const card = document.createElement('div');
            card.className = 'site-card';
            card.innerHTML = `
                <h3>${data.domain}</h3>
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

    updateCharts(sitesData) {
        // 1. Decisions Chart
        let accepted = 0;
        let declined = 0;

        sitesData.forEach(site => {
            accepted += site.accepted;
            declined += site.declined;
        });

        this.decisionsChart.data.datasets[0].data = [accepted, declined];
        this.decisionsChart.update();

        // 2. Sites Chart (Top 10)
        const topSites = [...sitesData].sort((a, b) => b.count - a.count).slice(0, 10);

        this.sitesChart.data.labels = topSites.map(s => s.domain);
        this.sitesChart.data.datasets[0].data = topSites.map(s => s.count);
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
