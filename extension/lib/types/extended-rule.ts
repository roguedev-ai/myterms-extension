export interface ConsentChainRule {
    // Base Consent-O-Matic fields
    name: string;
    version?: string;
    detectors: Detector[];
    methods: Method[];

    // ConsentChain extensions
    consentChainExtensions: {
        policyExtraction: {
            vendorListSelector: string;
            purposeSelector: string;
            retentionSelector?: string;
            dataUsageMapping: Record<string, string[]>; // e.g., "analytics": ["Performance Cookies"]
            legitimateInterestSelector?: string;
        };
        consentSemantics: {
            acceptAllAction: string;
            rejectAllAction: string;
            customizeAction?: string;
            savePreferencesAction?: string;
        };
        blockchainMetadata: {
            iabTCFCompliant: boolean;
            gdprApplicable: boolean;
            ccpaApplicable: boolean;
            privacyPolicyURL?: string;
            legalBasisType: 'consent' | 'legitimate-interest' | 'mixed';
        };
    };
}

// Sub-types for reference
interface Detector {
    presentMatcher: Matcher;
    consentChainEnhancement?: {
        extractVendorCount?: string;
        detectIABTCF?: string;
    };
}

interface Matcher {
    type: 'css' | 'xpath' | 'presence';
    selector?: string;
    target?: string;
}

interface Method {
    name: string;
    action: any;
}
