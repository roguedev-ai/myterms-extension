import { CMPDetector } from '../consent-o-matic/detector.js';
import { ActionExecutor } from '../consent-o-matic/actions.js';
import { PolicyExtractor } from '../policy-extractor/extractor.js';

export class ConsentOMaticAdapter {
    constructor() {
        this.detector = null;
        this.actionExecutor = new ActionExecutor();
        this.rules = [];
    }

    /**
     * Load and parse Consent-O-Matic rules
     * Extended with ConsentChain metadata extraction (For Phase 2)
     */
    async loadRules(rules) {
        this.rules = rules;
        this.detector = new CMPDetector(this.rules);
    }

    /**
     * Detect CMP using Consent-O-Matic detection logic
     */
    async detectAndExtractCMP(document) {
        if (!this.detector) {
            console.warn('ConsentOMaticAdapter: Rules not loaded');
            return null;
        }

        const detections = await this.detector.detectCMPs(document);

        if (detections.length === 0) return null;

        // Use highest confidence match
        const cmpMatch = detections[0];

        // Initialize Extractor with the matched rule
        const extractor = new PolicyExtractor(cmpMatch.cmpRule);
        const policyData = await extractor.extract(document);

        return {
            cmpProvider: cmpMatch.cmpName,
            cmpVersion: cmpMatch.cmpRule.version || 'unknown',
            detectionMethod: 'consent-o-matic',
            policyData: policyData,
            consentOptions: cmpMatch.cmpRule.methods
        };
    }

    /**
     * Execute CMP interaction using Consent-O-Matic action model
     */
    async executeConsentDecision(cmpData, decision) {
        console.log(`Executing ${decision.action} on ${cmpData.cmpProvider}`);

        // Find method matching the decision (e.g., 'HIDE_CMP', 'ACCEPT_ALL', 'REJECT_ALL')
        // Consent-O-Matic rules map methods to actions.
        // We need to map our decision ('accept', 'reject', 'minimize') to their method names.

        // Mapping Heuristic:
        // reject -> 'REJECT_ALL', 'MINIMIZE', 'SAVE_PREFERENCES'
        // accept -> 'ACCEPT_ALL'

        const methodMap = {
            'reject': ['REJECT_ALL', 'MINIMIZE', 'SAVE_PREFERENCES', 'HIDE_CMP'],
            'accept': ['ACCEPT_ALL', 'HIDE_CMP']
        };

        const targetMethods = methodMap[decision.action] || [];
        let executed = false;

        for (const methodName of targetMethods) {
            const method = cmpData.consentOptions.find(m => m.name === methodName);
            if (method) {
                console.log(`Found method ${methodName}, executing...`);
                const result = await this.actionExecutor.execute(method.action, { document });
                if (result) {
                    executed = true;
                    break; // Stop after first successful action
                }
            }
        }

        return {
            success: executed,
            provider: cmpData.cmpProvider,
            actionTaken: decision.action
        };
    }
}
