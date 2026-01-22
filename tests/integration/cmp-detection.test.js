
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';


// Use fs to read JSON to avoid experimental import assertions warning/error
const testSites = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'cmp-test-sites.json'), 'utf8'));

// Simple bundle-like concatenation for injection
// In a real build, we'd use webpack/esbuild output.
// Here we just read the files and concat them for the browser scope,
// stripping imports/exports to make it run in a script tag.
const readLibFile = (relativePath) => {
    const fullPath = path.resolve(__dirname, '../../extension/lib', relativePath);
    let content = fs.readFileSync(fullPath, 'utf8');

    // Robustly strip ES Module syntax for browser injection
    // 1. Remove imports
    content = content.replace(/^import .* from .*$/gm, '');
    content = content.replace(/^import .*$/gm, '');

    // 2. Remove export keywords (export class -> class, export default -> '')
    content = content.replace(/export default /g, '');
    content = content.replace(/^export /gm, '');

    return content;
};

// We need to order dependencies correctly
const INJECTED_CODE = `
    // Mock TCF API if needed
    window.__tcfapi = window.__tcfapi || function() {};
    
    ${readLibFile('consent-o-matic/actions.js')}
    ${readLibFile('consent-o-matic/matcher.js')}
    ${readLibFile('consent-o-matic/detector.js')}
    ${readLibFile('policy-extractor/extractor.js')}
    ${readLibFile('adapters/consentOMatic-adapter.js')}
    
    // Convert TypeDefs/Exports to global
    window.ConsentOMaticAdapter = ConsentOMaticAdapter;
`;

// Helper to minimal "rules" for testing
// In reality, we'd sync the full rules, but for speed we might want to mock the rule for the specific site
// OR we load the real rules implementation.
// Let's rely on the real full rules if possible or a subset.
const RULES_PATH = 'https://raw.githubusercontent.com/cavi-au/Consent-O-Matic/master/rules.json';

describe('CMP Detection Integration Tests (Puppeteer)', () => {
    let browser;
    let rules;

    beforeAll(async () => {
        // Load local mock rules for stability
        try {
            const rulesPath = path.join(process.cwd(), 'tests', 'integration', 'rules-mock.json');
            rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
            console.log(`Loaded ${rules.length} mock rules.`);
        } catch (e) {
            console.error('Failed to load mock rules', e);
            rules = [];
        }

        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox']
        });
    }, 60000);

    afterAll(async () => {
        if (browser) await browser.close();
    });

    testSites.testSites.forEach(site => {
        if (!site.testCases || site.testCases.length === 0 || site.name.includes('(SKIP)')) return;

        test(`should detect ${site.expectedCMP} on ${site.url}`, async () => {
            const page = await browser.newPage();

            // Set User Agent to avoid bot detection
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await page.setBypassCSP(true);

            try {
                await page.goto(site.url, { waitUntil: 'networkidle0', timeout: 30000 });
            } catch (e) {
                console.warn(`Timeout loading ${site.url}, proceeding to check DOM anyway.`);
            }

            // Inject our library code
            await page.addScriptTag({ content: INJECTED_CODE });

            // Run detection in browser context
            const detection = await page.evaluate(async (rules) => {
                const adapter = new window.ConsentOMaticAdapter();
                // Pass the rules (serialized)
                await adapter.loadRules(rules);
                return await adapter.detectAndExtractCMP(document);
            }, rules);

            console.log(`Result for ${site.url}:`, detection);

            if (site.expectedCMP === 'None') {
                expect(detection).toBeNull();
            } else {
                expect(detection).not.toBeNull();
                expect(detection.cmpProvider).toContain(site.expectedCMP);
            }

            await page.close();
        }, 60000); // 1 min timeout per site
    });
});
