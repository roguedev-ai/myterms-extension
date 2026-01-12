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

    /**
     * Website/Verifier: Publish an Agreement Policy to the chain
     * This allows the policy to be referenced by its hash in user Proverbs.
     * @param {Object} agreementJson - The MyTerms agreement JSON-LD
     * @param {string} publishAddress - The address to publish to (public registry or self)
     */
    async publishAgreement(agreementJson, publishAddress) {
        const encoder = new TextEncoder();
        const data = JSON.stringify(agreementJson);
        const encoded = encoder.encode(data);
        const hash = await this.computeHash(encoded);

        // Memo format: "P7012:POLICY:<hash>"
        const memo = `P7012:POLICY:${hash}`;

        // Simulate publishing tx
        const wallet = this.zcashClient.getWallet();
        // If wallet is User's, this mimics a self-publish. 
        // In real world, website uses their own wallet.
        if (wallet) {
            const txid = await wallet.send(publishAddress, 0.0001, memo);
            return { txid, hash };
        }

        // Return hash anyway for reference
        return { hash };
    }

    /**
     * Website/Verifier: Verify a User's Proverb Transaction
     * @param {string} txid - The transaction ID to verify
     * @param {string} expectedPolicyHash - The hash of the policy the user claims to accept
     */
    async verifyProverb(txid, expectedPolicyHash) {
        // Mock retrieval - in production this would query zcash-cli or block explorer
        console.log(`Verifying Proverb Tx: ${txid}`);

        // Simulate decoding memo from chain
        // In a real implementation, we'd fetch the tx, decrypt memo, parse JSON

        // Mock successful verification for demo purposes
        return {
            valid: true,
            timestamp: Date.now(),
            agreement: expectedPolicyHash,
            verified: true
        };
    }
}
