export class RuleSyncService {
    constructor() {
        this.ruleSource = 'https://raw.githubusercontent.com/cavi-au/Consent-O-Matic/master/rules-list.json';
        this.localRulesKey = 'consentchain_rules';
        this.lastSyncKey = 'consentchain_last_sync';
    }

    async syncRules() {
        try {
            console.log('Starting rule sync...');

            // Fetch latest rules from Consent-O-Matic
            const response = await fetch(this.ruleSource);
            if (!response.ok) throw new Error('Network response was not ok');

            const baseRules = await response.json();

            // Enhance with ConsentChain extensions
            const enhancedRules = await this.enhanceRules(baseRules);

            // Store locally
            await chrome.storage.local.set({
                [this.localRulesKey]: enhancedRules,
                [this.lastSyncKey]: Date.now()
            });

            console.log(`Synced ${enhancedRules.length} CMP rules`);

            return {
                success: true,
                ruleCount: enhancedRules.length,
                syncedAt: Date.now()
            };

        } catch (error) {
            console.error('Rule sync failed:', error);

            // Fallback to bundled rules
            try {
                console.log('Attempting fallback to default-rules.json ...');
                const url = chrome.runtime.getURL('default-rules.json');
                const response = await fetch(url);
                const defaultRules = await response.json();

                // Enhance default rules too
                const enhancedRules = await this.enhanceRules(defaultRules);

                await chrome.storage.local.set({
                    [this.localRulesKey]: enhancedRules,
                    [this.lastSyncKey]: Date.now()
                });

                console.log(`Fallback success: Synced ${enhancedRules.length} default rules`);

                return {
                    success: true,
                    ruleCount: enhancedRules.length,
                    syncedAt: Date.now(),
                    isFallback: true
                };
            } catch (fallbackError) {
                console.error('Critical: Fallback rule load failed', fallbackError);
                return {
                    success: false,
                    error: error.message,
                    fallbackError: fallbackError.message
                };
            }
        }
    }

    async enhanceRules(baseRules) {
        // In a real implementation, we would use RuleEnhancer to insert our metadata
        // For V1 (MVP), we just pass them through or add default empty extensions
        // so the adapter doesn't crash.
        return baseRules.map(rule => ({
            ...rule,
            consentChainExtensions: rule.consentChainExtensions || {
                policyExtraction: {
                    // Heuristic: try to guess selector from first method?
                    // For now, leave empty to be safe
                    vendorListSelector: '',
                    purposeSelector: ''
                }
            }
        }));
    }

    async getLocalRules() {
        const result = await chrome.storage.local.get(this.localRulesKey);
        return result[this.localRulesKey] || [];
    }

    async shouldSync() {
        const result = await chrome.storage.local.get(this.lastSyncKey);
        const lastSync = result[this.lastSyncKey] || 0;
        const hoursSinceSync = (Date.now() - lastSync) / (1000 * 60 * 60);

        // Sync once per day
        return hoursSinceSync > 24;
    }

    async forceSync() {
        return await this.syncRules();
    }
}
