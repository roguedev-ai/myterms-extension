export class PolicyExtractor {
    constructor(rule) {
        this.rule = rule;
        this.extractionConfig = rule.consentChainExtensions?.policyExtraction;
    }

    async extract(document) {
        if (!this.extractionConfig) {
            console.warn('No extraction config for', this.rule.name);
            return null;
        }

        const policy = {
            cmpProvider: this.rule.name,
            cmpVersion: this.rule.version,
            extractedAt: Date.now(),
            vendors: await this.extractVendors(document),
            purposes: await this.extractPurposes(document),
            // cookies: await this.extractCookies(document), // Deferred for V2.1
            legalBasis: this.rule.consentChainExtensions?.blockchainMetadata?.legalBasisType || 'unknown',
            iabTCF: await this.extractIABTCFData(document)
        };

        return policy;
    }

    async extractVendors(document) {
        const selector = this.extractionConfig.vendorListSelector;
        if (!selector) return [];

        const vendorElements = document.querySelectorAll(selector);
        const vendors = [];

        vendorElements.forEach(el => {
            vendors.push({
                name: el.textContent.trim(),
                id: el.getAttribute('data-vendor-id') || null,
                gvlId: el.getAttribute('data-gvl-id') || null,
                consented: el.querySelector('input[type="checkbox"]')?.checked || false
            });
        });

        return vendors;
    }

    async extractPurposes(document) {
        const selector = this.extractionConfig.purposeSelector;
        if (!selector) return [];

        const purposeElements = document.querySelectorAll(selector);
        const purposes = [];

        purposeElements.forEach(el => {
            const purposeName = el.textContent.trim();
            purposes.push({
                name: purposeName,
                category: this.mapToCategory(purposeName),
                consented: el.querySelector('input[type="checkbox"]')?.checked || false
            });
        });

        return purposes;
    }

    mapToCategory(purposeName) {
        const mapping = this.extractionConfig.dataUsageMapping || {};
        const lowerName = purposeName.toLowerCase();

        for (const [category, keywords] of Object.entries(mapping)) {
            if (keywords.some(kw => lowerName.includes(kw.toLowerCase()))) {
                return category;
            }
        }
        return 'other';
    }

    async extractIABTCFData(document) {
        if (!window.__tcfapi) return null;

        return new Promise((resolve) => {
            // Short timeout to prevent hanging if API is broken
            const timeout = setTimeout(() => resolve(null), 1000);

            try {
                window.__tcfapi('getTCData', 2, (tcData, success) => {
                    clearTimeout(timeout);
                    if (success) {
                        resolve({
                            tcfVersion: tcData.tcfPolicyVersion,
                            gdprApplies: tcData.gdprApplies,
                            purposes: tcData.purpose,
                            specialFeatures: tcData.specialFeatureOptins,
                            vendor: tcData.vendor,
                            publisher: tcData.publisher
                        });
                    } else {
                        resolve(null);
                    }
                });
            } catch (e) {
                clearTimeout(timeout);
                resolve(null);
            }
        });
    }

    // Deterministic hash for blockchain anchoring (SHA-256)
    static async generatePolicyHash(policy) {
        // Only hash the invariant parts ensuring reproduction
        const canonical = JSON.stringify({
            cmp: policy.cmpProvider,
            purposes: policy.purposes.map(p => ({ n: p.name, c: p.category })).sort((a, b) => a.n.localeCompare(b.n)),
            vendors: policy.vendors.length // Hash count for brevity, or full list if needed
        });

        const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
        const hashArray = Array.from(new Uint8Array(buffer));
        return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
