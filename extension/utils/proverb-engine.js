import { ZcashClient } from './zcash-client.js';

export class ProverbEngine {
    constructor(zcashClient) {
        this.zcashClient = zcashClient;
    }

    /**
     * Generate a Privacy Proverb from user consent preferences
     * Encodes preferences into a deterministic, hashable format
     * @param {Object} preferences - Consent preferences object
     * @returns {Object} PrivacyProverb
     */
    async generateProverb(preferences) {
        const encoder = new TextEncoder();
        const preferenceBits = this.encodePreferenceBits(preferences);

        const proverbData = {
            version: 1,
            type: 'consent-proverb',
            agreement: preferences.agreementType || 'SD-BY', // Default
            bits: preferenceBits,
            timestamp: Date.now()
        };

        const encoded = encoder.encode(JSON.stringify(proverbData));
        const hash = await this.computeHash(encoded);

        // Create memo field content (max 512 bytes for Zcash)
        const memoObj = {
            v: 1,
            t: 'proverb',
            a: proverbData.agreement,
            b: preferenceBits,
            ts: proverbData.timestamp
        };

        let memo = JSON.stringify(memoObj);
        // Pad to ensure privacy uniformity if needed, but for JSON it's legible

        return {
            encoded: encoded,
            hash: hash,
            memo: memo,
            timestamp: proverbData.timestamp
        };
    }

    encodePreferenceBits(prefs) {
        let bits = 0;
        if (prefs.trackingAllowed) bits |= 1;
        if (prefs.analyticsAllowed) bits |= 2;
        if (prefs.profilingAllowed) bits |= 4;
        if (prefs.sharingAllowed) bits |= 8;
        if (prefs.portabilityRequired) bits |= 16;
        return bits;
    }

    async computeHash(data) {
        const buffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(buffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Inscribe Proverb into Zcash Shielded Transaction
     * @param {Object} proverb - The generated proverb object
     * @param {string} selfAddress - Destination address (self-send)
     */
    async inscribeProverb(proverb, selfAddress) {
        const wallet = this.zcashClient.getWallet();
        if (!wallet) throw new Error('Wallet not initialized');

        // Send minimal value (e.g. 0.0001 ZEC) shielded transaction with proverb in memo
        // Note: Mock WebZjs 'send' returns a txid string
        const txid = await wallet.send(
            selfAddress,
            0.0001,
            proverb.memo
        );

        return txid;
    }
}
