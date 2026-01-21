import { Matcher } from './matcher.js';

export class CMPDetector {
    constructor(rules) {
        this.rules = rules;
        this.detectedCMPs = new Map();
    }

    async detectCMPs(document) {
        const detections = [];

        for (const rule of this.rules) {
            const isPresent = await this.evaluateDetectors(rule.detectors, document);
            if (isPresent) {
                detections.push({
                    cmpName: rule.name,
                    cmpRule: rule,
                    confidence: this.calculateConfidence(rule, document)
                });
            }
        }

        return detections.sort((a, b) => b.confidence - a.confidence);
    }

    async evaluateDetectors(detectors, document) {
        for (const detector of detectors) {
            if (detector.presentMatcher) {
                const matched = await Matcher.evaluate(
                    detector.presentMatcher,
                    document
                );
                if (matched) return true;
            }
        }
        return false;
    }

    calculateConfidence(rule, document) {
        let score = 0;
        // Implement confidence scoring based on multiple detectors
        if (rule.detectors.length > 1) score += 20;
        if (rule.methods && rule.methods.length > 0) score += 30;

        // Base score for finding it
        score += 50;

        return Math.min(score, 100);
    }
}
