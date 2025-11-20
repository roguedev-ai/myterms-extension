import { walletManager } from '../extension/utils/wallet-manager.js';
import { myTermsEthers } from '../extension/utils/ethers.js';
// Note: storage.js uses IndexedDB which is origin-specific. 
// If dashboard is run from file:// or a different origin than the extension, it won't see the extension's DB.
// For now, we assume it shares the origin or is just a visualization.
import { consentStorage } from '../extension/utils/storage.js';

class DashboardApp {
    constructor() {
        this.init();
    }

    async init() {
        this.initElements();
        this.attachEventListeners();
        this.checkWalletConnection();

        // Initialize charts
        this.initCharts();
    }

    initElements() {
        // Buttons
        this.connectBtn = document.getElementById('connectButton');
        this.refreshBtn = document.getElementById('refreshButton');
        this.retryBtn = document.getElementById('retryButton');
        this.loadMoreBtn = document.getElementById('loadMoreButton');

        // Views
        this.views = {
            timeline: document.getElementById('timelineView'),
            sites: document.getElementById('sitesView'),
            analytics: document.getElementById('analyticsView')
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
    }

    attachEventListeners() {
        // Wallet Connection
        this.connectBtn.addEventListener('click', () => this.connectWallet());

        // Navigation
        this.viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });

        // Refresh
        this.refreshBtn.addEventListener('click', () => this.loadData());
        this.retryBtn.addEventListener('click', () => this.loadData());
    }

    async checkWalletConnection() {
        // Load local data immediately (doesn't require wallet)
        this.loadData();

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

    async connectWallet() {
        try {
            await walletManager.connectWallet('metamask');
        } catch (error) {
            console.error('Failed to connect:', error);
            alert('Failed to connect wallet: ' + error.message);
        }
    }

    updateWalletUI(wallet) {
        if (wallet) {
            const addr = wallet.account;
            this.connectBtn.textContent = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
            this.connectBtn.classList.add('connected');
        } else {
            this.connectBtn.textContent = '🔗 Connect Wallet';
            this.connectBtn.classList.remove('connected');
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

    async loadData() {
        try {
            document.getElementById('loadingOverlay').classList.remove('hidden');

            // Fetch data from storage
            // Note: In a real scenario, we might query the blockchain if local storage isn't available
            // or if we want to verify. For now, we use local storage as the primary source.
            const consents = await consentStorage.getAllQueuedConsents();
            const batches = await consentStorage.getBatchStats();

            this.processData(consents, batches);

        } catch (error) {
            console.error('Error loading data:', error);
            // Don't show error modal for now, just log it
        } finally {
            document.getElementById('loadingOverlay').classList.add('hidden');
        }
    }

    processData(consents, batches) {
        if (!consents || consents.length === 0) {
            this.noDataMsg.style.display = 'flex';
            this.timelineTimeline.innerHTML = '';
            return;
        }

        this.noDataMsg.style.display = 'none';

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

        // Render Sites
        this.renderSites(consents);

        // Update Charts
        this.updateCharts(consents);
    }

    renderTimeline(consents) {
        this.timelineTimeline.innerHTML = '';

        // Sort by timestamp desc
        const sorted = [...consents].sort((a, b) => b.timestamp - a.timestamp);

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
                    <div class="timeline-header">
                        <span class="site-name">${consent.siteDomain}</span>
                        <span class="decision-badge ${isAccept ? 'accept' : 'decline'}">
                            ${isAccept ? 'Accepted' : 'Declined'}
                        </span>
                    </div>
                    <div class="timeline-meta">
                        <span class="date">${date}</span>
                        <span class="hash" title="${consent.termsHash}">Hash: ${consent.termsHash.substring(0, 10)}...</span>
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
