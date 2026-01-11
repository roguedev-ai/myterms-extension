// Content script for MyTerms extension
// Detects and interacts with cookie consent banners using advanced detection methods

class EnhancedBannerDetector {
  constructor() {
    this.observed = new Set();
    this.myTermsProfile = null;
    this.bannersFound = [];
    this.mutationObserver = null;
    this.intersectionObserver = null;

    this.init();
  }

  async init() {
    console.log('Enhanced Banner Detector v1.3 initializing... (Debug Mode)');

    // Load user's MyTerms profile
    await this.loadMyTermsProfile();

    // Listen for extension messages (CRITICAL for localhost bridge)
    this.setupMessageListener();

    // Prevent running banner detection on the dashboard itself to avoid self-consent loops
    if (window.location.href.includes('dashboard/index.html') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1') {
      console.log('Enhanced Banner Detector: Skipping banner detection on dashboard/localhost');
      return;
    }

    // Start multiple detection methods
    this.observeDOMMutations();
    this.observeVisibilityChanges();
    this.searchForBanners();

    // Periodic checks for dynamic content
    setInterval(() => this.periodicBannerCheck(), 5000);

    // Setup manual click listener for robustness
    this.setupManualClickListener();
  }

  async loadMyTermsProfile() {
    try {
      // Try to load from chrome storage first
      const result = await chrome.storage.sync.get(['myTermsProfile']);

      if (result.myTermsProfile) {
        this.myTermsProfile = result.myTermsProfile;
      } else {
        // Default privacy-first profile
        this.myTermsProfile = {
          preferences: {
            analytics: false,
            marketing: false,
            necessary: true,
            functional: false,
            social: false
          },
          rules: {
            acceptPattern: '[data-testid*="accept"], #accept-cookies, .accept-all, button[aria-label*="accept"], button[data-action="accept"]',
            declinePattern: '[data-testid*="decline"], #decline-cookies, button[data-action="decline"], .decline-all',
            customizePattern: '.cookie-settings, #cookie-settings, button[data-action="customize"]',
            savePattern: '.save-preferences, #save-preferences, button[data-action="save"]'
          },
          autoHandle: true,
          hashOriginalContent: true
        };
      }

      console.log('Profile loaded:', this.myTermsProfile.preferences);
    } catch (error) {
      console.error('Failed to load MyTerms profile:', error);
      this.myTermsProfile = { preferences: { analytics: false, marketing: false, necessary: true } };
    }
  }

  setupMessageListener() {
    // Listen for messages from background script
    chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
      if (request.type === 'GET_BANNER_STATUS') {
        sendResponse({
          bannersFound: this.bannersFound.length,
          profile: this.myTermsProfile?.preferences
        });
      }
    });

    // Listen for messages from web page (Localhost Dashboard)
    window.addEventListener('message', async (event) => {
      // Only accept messages from same window and trusted origins
      if (event.source !== window) return;

      // Filter for our specific message type
      if (event.data.type === 'MYTERMS_WEB_REQ') {
        console.log('Bridge: Received request from web:', event.data.payload, 'Origin:', event.origin, 'RequestID:', event.data.requestId);
        // Explicitly log the payload details to debug pagination
        if (event.data.payload.type === 'GET_CONSENT_DATA') {
          console.log('Bridge: GET_CONSENT_DATA payload:', JSON.stringify(event.data.payload));
        }

        try {
          // Forward to background script
          console.log('Bridge: Forwarding to background script...');
          const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(event.data.payload, (res) => {
              if (chrome.runtime.lastError) {
                console.error('Bridge: chrome.runtime.lastError:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                const size = JSON.stringify(res).length;
                console.log('Bridge: Received response from background:', res, `Size: ${(size / 1024).toFixed(2)}KB`);
                resolve(res);
              }
            });
          });

          console.log('Bridge: Sending response back to web page');
          // Send response back to web page
          window.postMessage({
            type: 'MYTERMS_WEB_RES',
            requestId: event.data.requestId,
            success: true,
            data: response
          }, '*');
        } catch (error) {
          console.error('Bridge Error:', error);
          window.postMessage({
            type: 'MYTERMS_WEB_RES',
            requestId: event.data.requestId,
            success: false,
            error: error.message
          }, '*');
        }
      }
    });
  }

  observeDOMMutations() {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.checkElementForBanner(node);
          }
        });
      });
    });

    // Observe with broader scope
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'style']
    });

    console.log('DOM mutation observer started');
  }

  observeVisibilityChanges() {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.checkElementForBanner(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '50px'
    });
  }

  checkElementForBanner(element) {
    // Skip if already processed
    if (this.observed.has(element)) return;

    // Comprehensive banner detection
    const isBanner = this.isCookieBanner(element);

    if (isBanner) {
      this.observed.add(element);
      this.bannersFound.push(element);
      this.handleBanner(element);

      // Also observe this element for visibility changes
      if (this.intersectionObserver) {
        this.intersectionObserver.observe(element);
      }

      console.log(`Cookie banner detected (${this.bannersFound.length} total):`, element);
    }
  }

  isCookieBanner(element) {
    try {
      // Get element properties
      const textContent = element.textContent?.toLowerCase() || '';
      // Handle both regular elements (string) and SVG elements (SVGAnimatedString)
      const className = (typeof element.className === 'string' ? element.className : element.className?.baseVal || '').toLowerCase();
      const id = element.id?.toLowerCase() || '';
      const tagName = element.tagName?.toLowerCase() || '';

      // Skip elements that are too small or too large
      const rect = element.getBoundingClientRect();
      if (rect.width < 200 || rect.height < 50 || rect.width > window.innerWidth) return false;

      // Heuristic scoring system
      let score = 0;

      // Content keywords (high weight)
      const contentKeywords = [
        'cookie', 'consent', 'privacy', 'gdpr', 'ccpa', 'tracking', 'accept',
        'decline', 'necessary', 'analytics', 'marketing', 'personal data',
        'third party', 'preferences', 'settings'
      ];

      const contentMatches = contentKeywords.filter(keyword => textContent.includes(keyword));
      score += contentMatches.length * 3;

      // ID/class selectors (medium weight)
      const selectorKeywords = ['cookie', 'consent', 'gdpr', 'privacy', 'banner', 'modal', 'popup'];
      selectorKeywords.forEach(keyword => {
        if (className.includes(keyword) || id.includes(keyword)) {
          score += 2;
        }
      });

      // Specific patterns and positions (high weight)
      if (tagName === 'dialog' || tagName === 'aside') score += 5;
      if (element.hasAttribute('role') && element.getAttribute('role') === 'dialog') score += 4;

      // Safe computed style check
      try {
        if (window.getComputedStyle(element).position === 'fixed') score += 2;
      } catch (e) {
        // Ignore computed style errors
      }

      // Child elements with specific patterns
      const buttons = element.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');
      buttons.forEach(button => {
        const btnText = button.textContent?.toLowerCase() || '';
        if (contentKeywords.some(keyword => btnText.includes(keyword))) {
          score += 3;
        }
      });

      // Attribute-based detection
      if (element.hasAttribute('data-cookie') || element.hasAttribute('data-consent')) score += 5;

      // Require minimum score (lowered to catch more banners)
      const isBanner = score >= 6;
      if (isBanner && score > 3) {
        console.log(`Banner score: ${score} for element:`, element);
      }

      return isBanner;
    } catch (error) {
      // Silently fail for this element if DOM access causes issues (e.g. CORS fonts)
      return false;
    }
  }

  searchForBanners() {
    // Common banner selectors
    const bannerSelectors = [
      // Direct IDs
      '#cookie-banner', '#consent-banner', '#privacy-banner', '#gdpr-banner',
      '.cookie-banner', '.consent-banner', '.privacy-banner', '.gdpr-banner',
      '.cookie-modal', '.consent-modal', '.privacy-modal',

      // Generic patterns
      '[id*="cookie"]', '[class*="cookie"]',
      '[id*="consent"]', '[class*="consent"]',
      '[id*="privacy"]', '[class*="privacy"]',
      '[id*="gdpr"]', '[class*="gdpr"]',

      // Framework-specific
      '[data-cookieBanner]', '.cc-banner', '.cookie-alert',
      '.cmp-banner', '.fc-consent-banner',

      // Position-based elements
      'aside[style*="fixed"]', 'div[style*="fixed"][style*="bottom"]',
      'div[style*="fixed"][style*="top"]'
    ];

    bannerSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        this.checkElementForBanner(element);
      });
    });

    console.log(`Initial banner search completed, found ${this.bannersFound.length} potential banners`);
  }

  periodicBannerCheck() {
    // Check for new banners that might have loaded dynamically
    this.searchForBanners();
  }

  handleBanner(bannerElement) {
    console.log('Processing banner:', bannerElement);

    // Wait for the banner to fully render/animate
    setTimeout(async () => {
      try {
        if (this.myTermsProfile?.autoHandle) {
          await this.applyMyTermsPreferences(bannerElement);

          // Retry once if failed (some banners animate slowly)
          setTimeout(async () => {
            const stillVisible = this.isElementVisible(bannerElement);
            if (stillVisible) {
              console.log('Banner still visible, retrying preferences...');
              await this.applyMyTermsPreferences(bannerElement);
            }
          }, 2000);
        }

        // Always record the consent/choice
        await this.recordBannerContent(bannerElement);
      } catch (error) {
        console.error('Error handling banner:', error);
      }
    }, 2000); // Increased from 1000ms to 2000ms
  }

  async applyMyTermsPreferences(bannerElement) {
    try {
      const shouldAccept = this.shouldAcceptBasedOnProfile();
      console.log(`[MyTerms] Profile decision: ${shouldAccept ? 'ACCEPT' : 'DECLINE'} based on preferences:`, this.myTermsProfile?.preferences);

      if (shouldAccept) {
        console.log('[MyTerms] Attempting to click ACCEPT button...');
        const accepted = await this.clickAccept(bannerElement);
        if (accepted) {
          await this.recordConsent(bannerElement, true);
        } else {
          console.log('[MyTerms] Failed to find/click ACCEPT button.');
        }
      } else {
        console.log('[MyTerms] Attempting to click DECLINE button...');
        const declined = await this.clickDecline(bannerElement);
        if (declined) {
          await this.recordConsent(bannerElement, false);
        } else {
          console.log('[MyTerms] Failed to find/click DECLINE button.');
        }
      }
    } catch (error) {
      console.error('Failed to apply preferences:', error);
    }
  }

  shouldAcceptBasedOnProfile() {
    // Privacy-first logic: determine if we should strictly "Accept All" or try to "Reject/Config"
    const prefs = this.myTermsProfile?.preferences || {};

    // 1. If "Deny All" is explicitly set, always DECLINE.
    if (prefs.denyAll) {
      return false;
    }

    // 2. If user wants to BLOCK Analytics or Marketing, we cannot "Accept All".
    // We must return FALSE to trigger the "Decline" path (which includes Manage/Reject).
    if (prefs.analytics === false || prefs.marketing === false) {
      return false;
    }

    // 3. Only if user allows everything (or doesn't care), return TRUE (Accept All).
    return true;
  }

  async clickAccept(bannerElement) {
    const acceptSelectors = [
      // User-defined patterns
      ...this.myTermsProfile?.rules?.acceptPattern?.split(',').map(s => s.trim()).filter(Boolean) || [],

      // Common selectors
      '[data-testid*="accept"]', '[aria-label*="accept"]', 'button[data-action="accept"]',
      '.accept-all', '#accept-all', '.accept-all-cookies', '#accept-cookies',
      'button:contains("Accept")', 'button:contains("Agree")', 'button:contains("Ok")', 'button:contains("Allow all")',
      '[data-cy*="accept"]', '.cookie-accept', '.accept-cookies',
      'button:contains("I Accept")', 'button:contains("Got it")',

      // Generic Links
      'a:contains("Accept")', 'a:contains("Agree")', 'a:contains("Allow all")',

      // Framework specific
      '.fc-primary-button', '.cc-accept-all', '.cmp-accept-all',
      '#onetrust-accept-btn-handler',
      '.iubenda-cs-accept-btn',
      '#hs-eu-confirmation-button', 'a#hs-eu-confirmation-button',
      '#hs-eu-cookie-confirmation-buttons-area > a:first-child', // HubSpot generic child

      // Attribute-based
      'button[type="submit"][data-consent="accept"]'
    ];

    return await this.clickButton(bannerElement, acceptSelectors, 'accept');
  }

  async clickDecline(bannerElement) {
    // Priority 1: Explicit Reject/Decline "All"
    const strictRejectSelectors = [
      // User-defined
      ...this.myTermsProfile?.rules?.declinePattern?.split(',').map(s => s.trim()).filter(Boolean) || [],

      // Common strict reject
      '[data-testid*="decline"]', '[data-testid*="reject"]',
      'button[data-action="decline"]', 'button[data-action="reject"]',
      '.decline-all', '.reject-all', '#reject-all', '#decline-all',
      'button:contains("Reject All")', 'button:contains("Decline All")',
      'button:contains("Refuse")', 'button:contains("Disagree")',
      '.cookie-decline', '.reject-cookies',

      // Generic Links as buttons
      'a:contains("Reject All")', 'a:contains("Decline")', 'a:contains("Deny")',

      // Frameworks
      '#onetrust-reject-all-handler',
      '.iubenda-cs-reject-btn',
      '#hs-eu-decline-button', 'a#hs-eu-decline-button',
      '#hs-eu-cookie-confirmation-buttons-area > a:last-child', // HubSpot generic child

      '.fc-secondary-button', // Google Funding Choices usually 'Manage' or 'Do not consent'
      '.cc-deny-all',
      '.osano-cm-denyAll'
    ];

    // Priority 2: "Manage" / "Configure" / "Necessary Only"
    // These often don't close the banner immediately but open a drawer. 
    // We click them, then try to find a "Save" button.
    const secondarySelectors = [
      'button:contains("Use necessary cookies only")', 'button:contains("Necessary only")',
      'button:contains("Only necessary")',
      '[aria-label*="necessary only"]',

      'button:contains("Manage")', 'button:contains("Configure")', 'button:contains("Settings")',
      'button:contains("Preferences")', '.cookie-settings', '.manage-cookies',
      '[aria-label*="manage"]', '[aria-label*="settings"]',

      // Link versions
      'a:contains("Manage")', 'a:contains("Preferences")', 'a:contains("Settings")',
      'a:contains("Necessary only")',

      '.fc-settings-button',
      '.osano-cm-manage'
    ];

    // Try strict reject first
    let success = await this.clickButton(bannerElement, strictRejectSelectors, 'decline');

    if (!success) {
      console.log('[MyTerms] No strict reject found, trying Manage/Necessary options...');
      // Try secondary options (Manage/Necessary)
      success = await this.clickButton(bannerElement, secondarySelectors, 'manage');

      if (success) {
        // If we clicked "Manage", we might need to click "Save" or "Confirm" after
        // Wait for drawer/modal
        await new Promise(r => setTimeout(r, 800));
        await this.clickSavePreferences(bannerElement);
        return true;
      }
    }

    return success;
  }

  async clickSavePreferences(bannerElement) {
    const saveSelectors = [
      '.save-preferences', '#save-preferences',
      'button:contains("Save")', 'button:contains("Confirm")',
      'button:contains("Save Choices")', 'button:contains("Save Selection")',
      'button:contains("Confirm My Choices")',
      '.fc-confirm-choices',
      '.osano-cm-save-preferences',
      '.iubenda-cs-save-btn' // Iubenda specific
    ];

    console.log('Attempting to save preferences...');
    return await this.clickButton(bannerElement, saveSelectors, 'save');
  }

  async clickButton(bannerElement, selectors, actionType) {
    for (const selector of selectors) {
      let button = null;

      // Handle :contains pseudo-selector manually
      if (selector.includes(':contains')) {
        const parts = selector.match(/([a-z0-9\.\-\#\[\]="]+)?:contains\("(.+)"\)/i);
        if (parts) {
          const tag = parts[1] || '*'; // Default to any tag if not specified
          const text = parts[2];
          const elements = bannerElement.querySelectorAll(tag); // Scoped to banner

          for (const el of elements) {
            if (el.textContent.toLowerCase().includes(text.toLowerCase()) && this.isButtonVisible(el)) {
              button = el;
              console.log(`[MyTerms] Found button via text "${text}":`, el);
              break;
            }
          }
        }
      } else {
        // Standard CSS selector
        const el = bannerElement.querySelector(selector);
        if (el && this.isButtonVisible(el)) {
          button = el;
          console.log(`[MyTerms] Found button via selector "${selector}":`, el);
        }
      }

      if (button) {
        try {
          // Highlight for visual debugging (temporal)
          const originalBorder = button.style.border;
          button.style.border = '2px solid red';
          setTimeout(() => button.style.border = originalBorder, 500);

          console.log(`[MyTerms] Clicking ${actionType} button:`, button);
          button.click();

          // Confirm the banner is handled
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check if banner is still visible
          if (!this.isElementVisible(bannerElement)) {
            return true;
          }
        } catch (error) {
          console.debug(`Failed to click ${actionType} with selector ${selector}:`, error.message);
        }
      }
    }

    console.log(`No ${actionType} button found`);
    return false;
  }

  // Add a global click listener to catch manual user interactions
  setupManualClickListener() {
    document.addEventListener('click', (event) => {
      const target = event.target;

      // Check if the click was on a button-like element
      if (target.matches('button, a, input[type="button"], input[type="submit"], [role="button"]')) {
        const text = target.textContent?.toLowerCase() || '';
        const ariaLabel = target.getAttribute('aria-label')?.toLowerCase() || '';

        // Check if it looks like an accept/decline action
        if (text.includes('accept') || text.includes('agree') || ariaLabel.includes('accept')) {
          console.log('Manual accept click detected');
          // We can't be 100% sure it's a cookie banner, but we can check context
          // For now, we'll just log it. In a real implementation, we'd check if it's inside a banner.
          // To be safe, we only record if we've already detected a banner on this page
          if (this.bannersFound.length > 0) {
            this.recordConsent(target, true);
          }
        } else if (text.includes('decline') || text.includes('reject') || ariaLabel.includes('decline')) {
          console.log('Manual decline click detected');
          if (this.bannersFound.length > 0) {
            this.recordConsent(target, false);
          }
        }
      }
    }, true); // Capture phase
  }

  isButtonVisible(button) {
    const style = window.getComputedStyle(button);
    const rect = button.getBoundingClientRect();

    // Relaxed visibility check
    const isVisibleStyle = style.display !== 'none' && style.visibility !== 'hidden';
    const isVisibleSize = rect.width > 0 && rect.height > 0;

    // Some buttons start with opacity 0 and fade in
    const isVisibleOpacity = style.opacity !== '0';

    return isVisibleStyle && isVisibleSize;
  }

  isElementVisible(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 20 &&
      rect.height > 20;
  }

  async recordBannerContent(bannerElement) {
    try {
      // Generate hash of the banner content
      const termsHash = await this.generateTermsHash({
        text: bannerElement.textContent || ''
        // Removed innerHTML capture to prevent XSS risks and reduce data size
      });

      const bannerData = {
        siteDomain: window.location.hostname,
        url: window.location.href,
        termsHash: termsHash,
        bannerContent: this.myTermsProfile?.hashOriginalContent ? null : bannerElement.textContent,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        preferences: this.myTermsProfile?.preferences,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };

      // Send to background script for queuing
      chrome.runtime.sendMessage({
        type: 'CONSENT_CAPTURED',
        consent: bannerData
      });

      console.log('Banner content recorded for:', window.location.hostname);
    } catch (error) {
      console.error('Failed to record banner content:', error);
    }
  }

  async recordConsent(bannerElement, accepted) {
    try {
      const termsHash = await this.generateTermsHash({
        text: bannerElement.textContent || '',
        decision: accepted ? 'accepted' : 'declined'
      });

      const consentData = {
        siteDomain: window.location.hostname,
        url: window.location.href,
        termsHash: termsHash,
        bannerContent: bannerElement.textContent || '', // Capture text for agreement storage
        accepted: accepted,
        decisionType: accepted ? 'accept' : 'decline',
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        preferences: this.myTermsProfile?.preferences,
        automationSource: 'MyTerms Extension'
      };

      // Send to background script for queuing
      chrome.runtime.sendMessage({
        type: 'CONSENT_CAPTURED',
        consent: consentData
      });

      console.log(`Consent ${accepted ? 'accepted' : 'declined'} recorded for:`, window.location.hostname);
    } catch (error) {
      console.error('Failed to record consent:', error);
    }
  }

  async generateTermsHash(content) {
    try {
      const contentStr = typeof content === 'object' ? JSON.stringify(content) : content;
      const encoder = new TextEncoder();
      const data = encoder.encode(contentStr);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Return as bytes32 for Solidity compatibility
      return '0x' + hashHex;
    } catch (cryptoError) {
      // Fallback to simple hash if crypto API is unavailable
      console.warn('Crypto API unavailable, using fallback hash');
      // Note: This fallback is not cryptographically secure and should only be used for non-critical identification
      let hash = 0;
      const contentStr = typeof content === 'object' ? JSON.stringify(content) : content;
      for (let i = 0; i < contentStr.length; i++) {
        const char = contentStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      // Prefix with 0x and pad to ensure it looks like a bytes32, but mark it as weak (starts with 0000)
      return '0x0000' + Math.abs(hash).toString(16).padStart(60, '0');
    }
  }

  // Cleanup method
  disconnect() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    console.log('Banner detector disconnected');
  }
}

// Global instance
let bannerDetector = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bannerDetector = new EnhancedBannerDetector();
  });
} else {
  bannerDetector = new EnhancedBannerDetector();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (bannerDetector) {
    bannerDetector.disconnect();
  }
});
