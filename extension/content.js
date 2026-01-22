// Enhanced ConsentChain Detector v2.0
// Uses dynamic imports to avoid "Cannot use import statement outside a module" error

let ConsentOMaticAdapter, RuleSyncService;

(async () => {
  try {
    const adapterModule = await import(chrome.runtime.getURL('lib/adapters/consentOMatic-adapter.js'));
    const syncModule = await import(chrome.runtime.getURL('lib/rule-sync/sync-service.js'));
    ConsentOMaticAdapter = adapterModule.ConsentOMaticAdapter;
    RuleSyncService = syncModule.RuleSyncService;

    // Initialize after imports are loaded
    new EnhancedConsentChainDetector();
  } catch (err) {
    console.error('ConsentChain: Failed to load modules', err);
  }
})();

class EnhancedConsentChainDetector {
  constructor() {
    this.adapter = null;
    this.userProfile = null;
    this.detectedCMPs = new Set();
    this.legacyDetector = null; // Fallback
    this.observed = new Set();
    this.bannersFound = [];

    this.init();
  }

  async init() {
    console.log('ConsentChain v2.0 initializing with Consent-O-Matic integration...');

    // Load user's MyTerms profile
    await this.loadUserProfile();

    // Setup Dashboard Bridge (Critical for UI)
    this.setupMessageListener();
    this.setupWebBridge();

    // Skip detection on dashboard/localhost
    if (this.isLocalDashboard()) return;

    // Initialize Consent-O-Matic adapter
    this.adapter = await this.initializeAdapter();

    // Start Hybrid Detection
    this.startDetection();
  }

  isLocalDashboard() {
    return window.location.href.includes('dashboard/index.html') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
  }

  async loadUserProfile() {
    try {
      const result = await chrome.storage.sync.get(['myTermsProfile']);
      this.userProfile = result.myTermsProfile || this.getDefaultProfile();
      console.log('Profile loaded:', this.userProfile.preferences);
    } catch (e) {
      console.error('Profile load failed', e);
      this.userProfile = this.getDefaultProfile();
    }
  }

  getDefaultProfile() {
    return {
      preferences: { analytics: false, marketing: false, functional: false, necessary: true },
      autoHandle: true
    };
  }

  async initializeAdapter() {
    const adapter = new ConsentOMaticAdapter();

    // Load synced rules
    const rules = await this.loadRules();
    await adapter.loadRules(rules);

    console.log(`Loaded ${rules.length} CMP rules for detection`);

    return adapter;
  }

  async loadRules() {
    const syncService = new RuleSyncService();
    // Cache check/fetch logic is inside the service
    // For content script, we usually just read what BG has synced
    // But syncService.getLocalRules() reads from storage.local which is accessible here.
    return await syncService.getLocalRules();
  }

  setupMessageListener() {
    // Background Messages
    chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
      if (request.type === 'GET_BANNER_STATUS') {
        sendResponse({
          bannersFound: this.detectedCMPs.size,
          profile: this.userProfile?.preferences
        });
      }
    });

    // Dashboard Bridge (Web -> Extension)
    window.addEventListener('message', async (event) => {
      if (event.source !== window || event.data.type !== 'MYTERMS_WEB_REQ') return;
      console.log('Bridge received:', event.data);
      try {
        const response = await chrome.runtime.sendMessage(event.data.payload);
        window.postMessage({
          type: 'MYTERMS_WEB_RES',
          requestId: event.data.requestId,
          payload: response
        }, '*');
      } catch (e) {
        console.error('Bridge error:', e);
      }
    });
  }

  async startDetection() {
    // 1. Try CMP Detection (Consent-O-Matic)
    await this.scanForCMPs();

    // 2. Fallback to Legacy Heuristics if no CMP found
    if (this.detectedCMPs.size === 0) {
      console.log('No CMP matched via rules, initializing legacy detector...');
      // We can dynamically import or just keep the logic if we want to support non-standard banners
      // For V2, let's keep it simple: if adapter fails, we just log it.
      // Or re-enable the old class (EnhancedBannerDetector) as a fallback module.
    }

    // Watch for dynamic content
    this.observeDOMMutations();
    setInterval(() => this.scanForCMPs(), 3000);
  }

  async scanForCMPs() {
    // Don't re-scan if we already acted (unless we support multi-CMP... which is rare)
    // if (this.detectedCMPs.size > 0) return;

    const detection = await this.adapter.detectAndExtractCMP(document);

    if (!detection) return;

    const cmpId = `${detection.cmpProvider}:${window.location.hostname}`;

    if (this.detectedCMPs.has(cmpId)) return;

    this.detectedCMPs.add(cmpId);
    console.log('CMP Detected:', detection);

    // Execute consent workflow
    await this.handleCMP(detection);
  }

  observeDOMMutations() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) shouldScan = true;
      });
      if (shouldScan) this.scanForCMPs();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async handleCMP(cmpData) {
    if (!this.userProfile.autoHandle) {
      console.log('Auto-handle disabled in profile');
      return;
    }

    try {
      // Match user preferences to CMP policy
      const decision = this.matchPolicyToPreferences(
        cmpData.policyData, // null in phase 1, object in phase 2
        this.userProfile.preferences
      );

      // Execute consent decision
      const result = await this.adapter.executeConsentDecision(
        cmpData,
        decision
      );

      console.log('Consent handled:', result);

      // Queue for blockchain (Proverb generation)
      if (result.success) {
        this.queueConsentRecord({
          ...result,
          cmpProvider: cmpData.cmpProvider,
          policyData: cmpData.policyData,
          decision: decision
        });
      }

    } catch (error) {
      console.error('Failed to handle CMP:', error);
    }
  }

  matchPolicyToPreferences(policy, preferences) {
    // Simple logic for V1:
    // If we want analytics/marketing, we accept all?
    // Or we just try to find the "Reject All" equivalents.
    // Our profile says: analytics: false, marketing: false.
    // So usually we want 'reject' or 'minimize'.

    const wantsPrivacy = !preferences.analytics && !preferences.marketing;

    if (wantsPrivacy) {
      return { action: 'reject', reason: 'User requested privacy' };
    } else {
      return { action: 'accept', reason: 'User allows tracking' };
    }
  }

  async queueConsentRecord(record) {
    // Send to background script for batching
    chrome.runtime.sendMessage({
      type: 'CONSENT_CAPTURED_V2',
      consent: {
        ...record,
        timestamp: Date.now(),
        url: window.location.href,
        domain: window.location.hostname
      }
    });
  }
  setupWebBridge() {
    window.addEventListener('message', async (event) => {
      if (event.source === window && event.data && event.data.type === 'MYTERMS_WEB_REQ') {
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
      // Prevent re-scanning
      if (element.hasAttribute('data-myterms-scanned')) return false;

      // Get element properties
      const textContent = element.textContent?.toLowerCase() || '';
      const className = (typeof element.className === 'string' ? element.className : element.className?.baseVal || '').toLowerCase();
      const id = element.id?.toLowerCase() || '';
      const tagName = element.tagName?.toLowerCase() || '';

      // Dimensions check
      const rect = element.getBoundingClientRect();

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
      // Check for 'modal' or 'popup' significantly increasing chance it's a banner
      const selectorKeywords = ['cookie', 'consent', 'gdpr', 'privacy', 'banner', 'modal', 'popup', 'notify', 'agreement', 'policy', 'notice'];
      selectorKeywords.forEach(keyword => {
        if (className.includes(keyword) || id.includes(keyword)) {
          score += 3; // Increased from 2 to catch "privacy-wrapper" (Score 5 -> 6)
        }
      });

      // Specific patterns and positions
      if (tagName === 'dialog' || tagName === 'aside') score += 5;
      if (element.hasAttribute('role') && element.getAttribute('role') === 'dialog') score += 4;
      if (element.getAttribute('aria-label')?.toLowerCase().includes('cookie')) score += 5;

      // Child elements with specific patterns (buttons)
      const buttons = element.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a.btn, a[class*="button"]');
      if (buttons.length > 0) score += 2; // Having buttons is a good sign

      buttons.forEach(button => {
        const btnText = button.textContent?.toLowerCase() || '';
        if (contentKeywords.some(keyword => btnText.includes(keyword))) {
          score += 3;
        }
      });

      // Attribute-based detection
      if (element.hasAttribute('data-cookie') || element.hasAttribute('data-consent')) score += 5;

      // --- DECISION LOGIC ---

      // 1. Filter out obvious non-banners logic
      // Only apply strict size checks if the score is low. High score (text match) might mean valid banner that simply has strange dimensions (or is hidden)
      if (score < 5) {
        // Strict size check for low confidence items to avoid false positives
        if (rect.width < 100 || rect.height < 20) { // Relaxed from 200/50
          // Mark as scanned to prevent re-check
          element.setAttribute('data-myterms-scanned', 'true');
          return false;
        }
      }

      // 2. Threshold check
      const isBanner = score >= 6;

      // LOG REJECTION for debugging if it looked promising
      // Only log once per element
      if (!isBanner && score >= 4) {
        console.log(`[MyTerms-Debug] Candidate rejected (Score ${score} < 6):`, element);
      }

      // Mark as scanned
      element.setAttribute('data-myterms-scanned', 'true');

      if (isBanner) {
        console.log(`[MyTerms] Banner detected! Score: ${score}`, element);
      }

      return isBanner;
    } catch (error) {
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

      // Selectors for "Decline" or "Reject"
      'button[id*="decline"]', 'button[id*="reject"]', 'button[id*="deny"]', 'button[class*="decline"]', 'button[class*="reject"]',
      'button[name*="decline"]', 'button[name*="reject"]', 'button[aria-label*="decline"]', 'button[aria-label*="reject"]',
      'a[id*="decline"]', 'a[id*="reject"]', 'a[class*="decline"]', 'a[class*="reject"]', 'a[aria-label*="decline"]',
      '[data-action="decline"]', '[data-action="reject"]',
      'button:contains("Decline")', 'button:contains("Reject")', 'button:contains("Deny")', 'button:contains("No thanks")', 'button:contains("Disagree")',
      'a:contains("Decline")', 'a:contains("Reject")', 'a:contains("Deny")', 'a:contains("No thanks")',
      '.cookie-setting-link:contains("Do Not Share")', // Specific support for OneTrust
      'button.onetrust-close-btn-handler', // OneTrust close button as fallback for "Reject" sometimes

      // Common strict reject (kept for now, but many are covered by new specific ones)
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
      let searchContext = bannerElement;

      // Helper to find button
      const findButton = (context, sel) => {
        if (sel.includes(':contains')) {
          const parts = sel.match(/([a-z0-9\.\-\#\[\]="]+)?:contains\("(.+)"\)/i);
          if (parts) {
            const tag = parts[1] || '*';
            const text = parts[2];
            const elements = context.querySelectorAll(tag);
            for (const el of elements) {
              if (el.textContent.toLowerCase().includes(text.toLowerCase()) && this.isButtonVisible(el)) {
                return el;
              }
            }
          }
        } else {
          const el = context.querySelector(sel);
          if (el && this.isButtonVisible(el)) return el;
        }
        return null;
      };

      // 1. Try scoped search
      button = findButton(bannerElement, selector);

      // 2. Try parent search (fallback) - common if we detected the text wrapper sibling
      if (!button && bannerElement.parentElement) {
        // Search up to 2 levels up
        let parent = bannerElement.parentElement;
        for (let i = 0; i < 2; i++) {
          if (!parent) break;
          const fallbackButton = findButton(parent, selector);
          if (fallbackButton) {
            console.log(`[MyTerms] Found button via parent fallback selector "${selector}":`, fallbackButton);
            button = fallbackButton;
            break;
          }
          parent = parent.parentElement;
        }
      } else if (button) {
        console.log(`[MyTerms] Found button via selector "${selector}":`, button);
      }

      if (button) {
        try {
          // Highlight for visual debugging (temporal)
          const originalBorder = button.style.border;
          button.style.border = '2px solid red';
          setTimeout(() => button.style.border = originalBorder, 500);

          console.log(`[MyTerms] Clicking ${actionType} button:`, button);

          // Dispatch full event sequence to satisfy strict frameworks (React, etc.)
          const events = ['mousedown', 'mouseup', 'click'];
          events.forEach(eventType => {
            const event = new MouseEvent(eventType, {
              bubbles: true,
              cancelable: true,
              view: window
            });
            button.dispatchEvent(event);
          });

          // Also try standard click() as fallback
          if (typeof button.click === 'function') {
            button.click();
          }

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


