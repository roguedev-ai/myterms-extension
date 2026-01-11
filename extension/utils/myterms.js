/**
 * IEEE P7012 MyTerms Agreement Templates and Parser
 */

export const AGREEMENT_TEMPLATES = {
    'SD-BY': {
        '@context': 'https://w3id.org/dpv/standards/p7012',
        '@type': 'SD-BY',
        version: 1,
        trackingModifier: 'TrackingDisallowed',
        profilingModifier: 'ProfilingDisallowed',
        dataSharingModifier: 'DataSharingDisallowed',
        portabilityModifier: 'PortabilityNotRequired',
        interpretationModifier: 'ProhibitiveInterpretation',
        conflictResolution: ['ResolvePreferringProhibition', 'ResolveOnlyWithinContext']
    },
    'SD-BY-A': {
        '@context': 'https://w3id.org/dpv/standards/p7012',
        '@type': 'SD-BY-A', // Analytics Allowed
        version: 1,
        trackingModifier: 'TrackingDisallowed',
        profilingModifier: 'ProfilingDisallowed',
        dataSharingModifier: 'DataSharingDisallowed',
        portabilityModifier: 'PortabilityNotRequired',
        interpretationModifier: 'ProhibitiveInterpretation',
        conflictResolution: ['ResolvePreferringProhibition', 'ResolveOnlyWithinContext']
    },
    // ... Implement other templates as needed
    'PDC-AI': {
        '@context': 'https://w3id.org/dpv/standards/p7012',
        '@type': 'PDC-AI', // Personal Data Contributor for AI
        version: 1,
        trackingModifier: 'TrackingAllowed',
        profilingModifier: 'ProfilingAllowed', // Usually required for AI training
        dataSharingModifier: 'DataSharingAllowed',
        portabilityModifier: 'PortabilityRequired',
        interpretationModifier: 'PermissiveInterpretation',
        conflictResolution: ['ResolvePreferringPermission']
    }
};

export class MyTermsParser {

    static getTemplate(type) {
        return AGREEMENT_TEMPLATES[type] || null;
    }

    /**
     * Map internal preferences to the closest MyTerms Agreement Type
     */
    static preferencesToAgreementType(prefs) {
        if (prefs.trackingAllowed && prefs.profilingAllowed) {
            return 'PDC-AI'; // Example mapping
        }
        if (prefs.analyticsAllowed) {
            return 'SD-BY-A';
        }
        return 'SD-BY'; // Base restrictive
    }

    /**
     * Generate JSON-LD for blockchain storage
     */
    static toJsonLd(agreementType) {
        const template = this.getTemplate(agreementType);
        if (!template) throw new Error(`Unknown Agreement Type: ${agreementType}`);

        return {
            '@context': template['@context'],
            '@type': `p7012:${agreementType}`,
            'dpv:hasPurpose': 'p7012:ServiceDelivery',
            'p7012:hasPrivacyInterpretationModifier': `p7012:${template.interpretationModifier}`,
            'p7012:TrackingModifier': `p7012:${template.trackingModifier}`,
            'p7012:hasProfilingModifier': `p7012:${template.profilingModifier}`,
            'p7012:hasDataSharingModifier': `p7012:${template.dataSharingModifier}`,
            'p7012:hasPortabilityModifier': `p7012:${template.portabilityModifier}`
        };
    }
}
