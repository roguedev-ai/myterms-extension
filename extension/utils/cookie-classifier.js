/**
 * CookieClassifier
 * 
 * Classifies cookies into categories:
 * - Security (Essential, do not delete)
 * - Analytics (Tracking behavior)
 * - Marketing (Ad targeting)
 * - Functional (Session, preferences)
 * 
 * Includes "Cookie Monster" logic to identify candidates for deletion.
 */
class CookieClassifier {
    constructor() {
        this.categories = {
            SECURITY: 'Security',
            ANALYTICS: 'Analytics',
            MARKETING: 'Marketing',
            FUNCTIONAL: 'Functional',
            UNKNOWN: 'Unknown'
        };

        // Regex patterns for classification
        this.patterns = {
            [this.categories.SECURITY]: [
                /^__cf_bm$/,       // Cloudflare Bot Management
                /^_cfuvid$/,       // Cloudflare User Verification
                /^cf_clearance$/,  // Cloudflare
                /^__Secure-/,      // Standard Secure prefix
                /^__Host-/,        // Standard Host prefix
                /^XSRF-TOKEN$/i,   // CSRF Protection
                /^csrftoken$/i
            ],
            [this.categories.ANALYTICS]: [
                /^_ga/,            // Google Analytics
                /^_gid/,           // Google Analytics
                /^utm_/,           // UTM Parameters (source, medium, etc.)
                /^_uetsid$/,       // Microsoft/Bing Analytics
                /^_uetvid$/,       // Microsoft/Bing Analytics
                /^sliguid$/,       // Slice Analytics
                /^slireg$/,        // Slice Analytics
                /^slirequested$/,  // Slice Analytics
                /^_gd_/,           // GrowthDrive / Visitor tracking
                /^ubpv$/,          // Session tracking
                /^ubvs$/,          // Session tracking
                /^amplitude_/,     // Amplitude
                /^mixpanel/        // Mixpanel
            ],
            [this.categories.MARKETING]: [
                /^_fbp$/,          // Facebook Pixel
                /^_gcl/,           // Google Click Identifier (Ads)
                /^ads$/,
                /^personalization_/,
                /^fr$/,            // Facebook Request
                /^tr$/             // Facebook Tracking
            ],
            [this.categories.FUNCTIONAL]: [
                /^PHPSESSID$/,     // PHP Session
                /^JSESSIONID$/,    // Java Session
                /^sid$/,           // Generic Session
                /^connect\.sid$/,  // Express Session
                /^wordpress_/,     // WordPress
                /^wp-settings-/,   // WordPress
                /^lang/,           // Language preference
                /^consent/,        // Consent preferences
                /^cookie-/,
                /^myterms-/        // Our own extension cookies
            ]
        };
    }

    /**
     * Classify a single cookie
     * @param {Object} cookie - The cookie object from chrome.cookies API
     * @returns {string} Category name
     */
    classify(cookie) {
        const name = cookie.name;

        // Check against patterns
        for (const [category, regexes] of Object.entries(this.patterns)) {
            for (const regex of regexes) {
                if (regex.test(name)) {
                    return category;
                }
            }
        }

        return this.categories.UNKNOWN;
    }

    /**
     * Analyze a list of cookies
     * @param {Array} cookies - List of cookie objects
     * @returns {Object} Analysis result { stats, details, privacyScore }
     */
    analyze(cookies) {
        const stats = {
            [this.categories.SECURITY]: 0,
            [this.categories.ANALYTICS]: 0,
            [this.categories.MARKETING]: 0,
            [this.categories.FUNCTIONAL]: 0,
            [this.categories.UNKNOWN]: 0,
            total: cookies.length
        };

        const details = cookies.map(cookie => {
            const category = this.classify(cookie);
            stats[category]++;
            return {
                ...cookie,
                category
            };
        });

        // Calculate Privacy Score (100 = No trackers, 0 = All trackers)
        // Formula: Start at 100, deduct points for trackers.
        // 100 - ( (Analytics + Marketing) / Total ) * 100
        // Weighted: Marketing hurts more?

        let privacyScore = 100;
        const badCookies = stats[this.categories.ANALYTICS] + stats[this.categories.MARKETING];

        if (stats.total > 0) {
            const badRatio = badCookies / stats.total;
            privacyScore = Math.max(0, 100 - Math.round(badRatio * 100));
        }

        return {
            stats,
            cookies: details,
            privacyScore
        };
    }
}

// Export for use in Modules
export default CookieClassifier;
