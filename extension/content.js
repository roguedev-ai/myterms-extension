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
    console.log('Enhanced Banner Detector initializing...');

    // Load user's MyTerms profile
    await this.loadMyTermsProfile();

    // Start multiple detection methods
    this.observeDOMMutations();
    this.observeVisibilityChanges();
    this.searchForBanners();

    // Periodic checks for dynamic content
    setInterval(() => this.periodicBannerCheck(), 5000);

    // Listen for extension messages
    this.setupMessageListener();

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

    // Wait for the banner to fully render
    setTimeout(async () => {
      try {
        if (this.myTermsProfile?.autoHandle) {
          await this.applyMyTermsPreferences(bannerElement);
        }

        // Always record the consent/choice
        await this.recordBannerContent(bannerElement);
      } catch (error) {
        console.error('Error handling banner:', error);
      }
    }, 1000);
  }

  async applyMyTermsPreferences(bannerElement) {
    try {
      const shouldAccept = this.shouldAcceptBasedOnProfile();

      if (shouldAccept) {
        const accepted = await this.clickAccept(bannerElement);
        if (accepted) {
          await this.recordConsent(bannerElement, true);
        }
      } else {
        const declined = await this.clickDecline(bannerElement);
        if (declined) {
          await this.recordConsent(bannerElement, false);
        }
      }
    } catch (error) {
      console.error('Failed to apply preferences:', error);
    }
  }

  shouldAcceptBasedOnProfile() {
    // Privacy-first logic: only accept if no tracking cookies are involved
    const prefs = this.myTermsProfile?.preferences || {};

    // If "Deny by Default" is enabled, always return false (decline)
    if (prefs.denyAll) {
      return false;
    }

    return prefs.marketing === false && prefs.analytics === false && prefs.functional !== false;
  }

  async clickAccept(bannerElement) {
    const acceptSelectors = [
      // User-defined patterns
      ...this.myTermsProfile?.rules?.acceptPattern?.split(',').map(s => s.trim()).filter(Boolean) || [],

      // Common selectors
      '[data-testid*="accept"]', '[aria-label*="accept"]', 'button[data-action="accept"]',
      '.accept-all', '#accept-all', '.accept-all-cookies', '#accept-cookies',
      'button:contains("Accept")', 'button:contains("Agree")', 'button:contains("Ok")',
      '[data-cy*="accept"]', '.cookie-accept', '.accept-cookies',

      // Framework specific
      '.fc-primary-button', '.cc-accept-all', '.cmp-accept-all',

      // Attribute-based
      'button[type="submit"][data-consent="accept"]'
    ];

    return await this.clickButton(bannerElement, acceptSelectors, 'accept');
  }

  async clickDecline(bannerElement) {
    const declineSelectors = [
      // User-defined patterns
      ...this.myTermsProfile?.rules?.declinePattern?.split(',').map(s => s.trim()).filter(Boolean) || [],

      // Common selectors
      '[data-testid*="decline"]', '[aria-label*="decline"]', 'button[data-action="decline"]',
      '.decline', '#decline-cookies', '.decline-all', '.reject-all',
      'button:contains("Decline")', 'button:contains("Reject")', 'button:contains("Deny")',
      '[data-cy*="decline"]', '.cookie-decline', '.reject-cookies',

      // "Manage" or "Configure" often leads to decline options or is the only alternative to Accept
      'button:contains("Manage")', 'button:contains("Configure")', 'button:contains("Settings")',
      'button:contains("Preferences")', '.cookie-settings', '.manage-cookies',
      '[aria-label*="manage"]', '[aria-label*="settings"]',

      // "Continue without accepting" patterns (often links or small buttons)
      'button:contains("Continue without accepting")', 'a:contains("Continue without accepting")',
      'button:contains("Continue without agreeing")', 'a:contains("Continue without agreeing")',
      'button:contains("Use necessary cookies only")', 'a:contains("Use necessary cookies only")',
      'button:contains("Necessary only")', 'a:contains("Necessary only")',
      'button:contains("Only necessary")', 'a:contains("Only necessary")',
      'button:contains("Reject all")', 'a:contains("Reject all")',
      '[aria-label*="continue without"]', '[aria-label*="necessary only"]',

      // Close buttons that might act as "ignore/decline"
      'button[aria-label="Close"]', '.close-banner', '.dismiss-banner',

      // Framework specific
      '.fc-secondary-button', '.cc-deny-all', '.cmp-reject-all',
      '.osano-cm-denyAll', '#onetrust-reject-all-handler',
      '.osano-cm-save-preferences', // Sometimes save prefs is the way to "reject" non-essential
    ];

    return await this.clickButton(bannerElement, declineSelectors, 'decline');
  }

  async clickButton(bannerElement, selectors, actionType) {
    for (const selector of selectors) {
      try {
        let button;

        // Try within the banner element first
        button = bannerElement.querySelector(selector);
        if (!button) {
          // Try globally but make sure it's related to the banner
          button = document.querySelector(selector);
        }

        if (button && this.isButtonVisible(button)) {
          // Simulate hover to ensure button is interactive
          button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 100));

          button.click();
          console.log(`Clicked ${actionType} button:`, selector);

          // Confirm the banner is handled
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check if banner is still visible
          if (!this.isElementVisible(bannerElement)) {
            return true;
          }
        }
      } catch (error) {
        console.debug(`Failed to click ${actionType} with selector ${selector}:`, error.message);
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

    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0;
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
