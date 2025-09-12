// Popup script for MyTerms extension
// Displays extension status and controls

class PopupManager {
  constructor() {
    this.walletStatus = document.getElementById('walletStatus');
    this.queuedCount = document.getElementById('queuedCount');
    this.batchCard = document.getElementById('batchCard');
    this.batchDate = document.getElementById('batchDate');
    this.txLink = document.getElementById('txLink');
    this.txHashLink = document.getElementById('txHashLink');
    this.totalBatches = document.getElementById('totalBatches');
    this.forceBatchBtn = document.getElementById('forceBatchBtn');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.errorMessage = document.getElementById('errorMessage');

    this.init();
  }

  async init() {
    console.log('Popup initializing...');

    // Set up event listeners
    this.setupEventListeners();

    // Load data from background script
    await this.loadPopupData();

    // Check wallet connection status periodically
    this.startStatusUpdates();
  }

  setupEventListeners() {
    // Force batch submit button
    this.forceBatchBtn.addEventListener('click', () => {
      this.handleForceBatch();
    });

    // Settings button
    this.settingsBtn.addEventListener('click', () => {
      this.openSettings();
    });

    // Transaction link click
    this.txHashLink.addEventListener('click', (e) => {
      this.handleTransactionLink(e);
    });
  }

  async loadPopupData() {
    try {
      this.showLoading();

      // Request data from background script
      const response = await this.sendMessage({ type: 'GET_POPUP_DATA' });

      if (response.error) {
        throw new Error(response.error);
      }

      this.updateUI(response);

    } catch (error) {
      console.error('Failed to load popup data:', error);
      this.showError('Failed to load extension data. Please try again.');
    } finally {
      this.hideLoading();
    }
  }

  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  updateUI(data) {
    const { queuedCount, latestBatch, stats } = data;

    // Update queued consents count
    this.queuedCount.textContent = queuedCount || 0;

    // Update latest batch information
    if (latestBatch) {
      this.updateBatchInfo(latestBatch);
      this.batchCard.style.display = 'block';
    } else {
      this.batchCard.style.display = 'none';
    }

    // Update total batches
    this.totalBatches.textContent = stats?.totalBatches || 0;

    // Clear any error messages
    this.hideError();

    console.log('UI updated with latest data:', data);
  }

  updateBatchInfo(batch) {
    // Update batch date
    const batchDate = new Date(batch.processedDate).toLocaleDateString();
    this.batchDate.textContent = `Processed ${batchDate}`;

    // Update transaction hash
    if (batch.transactionHash) {
      const shortHash = `${batch.transactionHash.substring(0, 8)}...${batch.transactionHash.substring(batch.transactionHash.length - 6)}`;
      this.txHashLink.textContent = shortHash;
      this.txHashLink.href = this.getTransactionExplorerUrl(batch.transactionHash);
      this.txLink.style.display = 'block';

      // Store full hash for later use
      this.txHashLink.dataset.fullHash = batch.transactionHash;
    }

    // Update batch count if available
    const consentCount = batch.consentIds?.length || 0;
    document.querySelector('#batchCard .stat-value').textContent = consentCount;
  }

  getTransactionExplorerUrl(txHash) {
    // This would be configurable for different networks
    // For now, use Sepolia as default
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }

  async handleForceBatch() {
    try {
      // Show loading state
      this.forceBatchBtn.disabled = true;
      this.forceBatchBtn.innerHTML = '<div class="loading"></div> Processing...';

      // Send force batch message to background
      const response = await this.sendMessage({ type: 'FORCE_BATCH_PROCESS' });

      if (response.success) {
        // Refresh data
        await this.loadPopupData();

        // Show success indicator
        this.showSuccess('Batch processing initiated successfully');
      } else {
        throw new Error(response.error || 'Failed to initiate batch processing');
      }

    } catch (error) {
      console.error('Failed to force batch:', error);
      this.showError('Failed to process batch. Please try again.');
    } finally {
      // Reset button state
      this.forceBatchBtn.disabled = false;
      this.forceBatchBtn.textContent = 'Force Batch Submit';
    }
  }

  async openSettings() {
    // Open extension options page (if implemented)
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      // Fallback: Open a settings page
      chrome.tabs.create({
        url: chrome.runtime.getURL('settings.html')
      });
    }
  }

  handleTransactionLink(event) {
    event.preventDefault();
    const fullHash = this.txHashLink.dataset.fullHash;
    const url = this.txHashLink.href;

    // Open in new tab
    chrome.tabs.create({ url });

    // Copy hash to clipboard for user convenience
    if (fullHash && navigator.clipboard) {
      navigator.clipboard.writeText(fullHash).then(() => {
        console.log('Transaction hash copied to clipboard');
      }).catch((err) => {
        console.error('Failed to copy hash to clipboard:', err);
      });
    }
  }

  startStatusUpdates() {
    // Update wallet status periodically
    this.updateWalletStatus();

    // Check status every 30 seconds
    setInterval(() => {
      this.updateWalletStatus();
    }, 30000);
  }

  async updateWalletStatus() {
    try {
      // Check if Ethereum provider is available
      if (typeof window !== 'undefined' && window.ethereum) {
        // Check if wallet is connected
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });

        if (accounts && accounts.length > 0) {
          // Check network
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const networkName = this.getNetworkName(parseInt(chainId, 16));

          this.showWalletStatus('connected', `Connected to ${networkName}`);
        } else {
          this.showWalletStatus('disconnected', 'Wallet not connected');
        }
      } else {
        this.showWalletStatus('disconnected', 'MetaMask not detected');
      }
    } catch (error) {
      console.error('Error updating wallet status:', error);
      this.showWalletStatus('disconnected', 'Connection error');
    }
  }

  getNetworkName(chainId) {
    const networks = {
      1: 'Mainnet',
      5: 'Goerli',
      11155111: 'Sepolia',
      137: 'Polygon',
      80001: 'Mumbai'
    };

    return networks[chainId] || 'Unknown Network';
  }

  showWalletStatus(status, message) {
    this.walletStatus.className = `status ${status}`;
    this.walletStatus.innerHTML = `<span>${message}</span>`;

    // Add loading indicator for processing status
    if (status === 'processing') {
      this.walletStatus.innerHTML = '<div class="loading"></div>' + this.walletStatus.innerHTML;
    }
  }

  showLoading() {
    this.showWalletStatus('processing', 'Loading extension data...');
  }

  hideLoading() {
    // This will be updated by the next status update
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove('hidden');
  }

  hideError() {
    this.errorMessage.classList.add('hidden');
  }

  showSuccess(message) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.style.cssText = `
      background: rgba(34, 197, 94, 0.2);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #e6f7e6;
      padding: 10px;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 15px;
      text-align: center;
    `;
    successDiv.textContent = message;

    // Insert after error message
    this.errorMessage.parentNode.insertBefore(successDiv, this.errorMessage);

    // Remove after 3 seconds
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.remove();
      }
    }, 3000);
  }

  // Utility method to create notification links in popup
  createNotificationLink(title, message, buttonText) {
    // This could be enhanced to create more interactive popup content
    console.log(`${title}: ${message}`);
  }
}

// Add some extra CSS styles for the popup (success message)
const extraStyles = document.createElement('style');
extraStyles.textContent = `
  .success {
    animation: fadeIn 0.3s ease-in;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn:disabled:hover {
    transform: none;
    background: rgba(255, 255, 255, 0.2);
  }
`;
document.head.appendChild(extraStyles);

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});

// Handle runtime errors
window.addEventListener('error', (event) => {
  console.error('Popup error:', event.error);
  // Could show user-friendly error message
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Popup unhandled rejection:', event.reason);
  // Could show user-friendly error message
});
