export class Matcher {
    static async evaluate(matcher, document) {
        switch (matcher.type) {
            case 'css':
                return document.querySelector(matcher.target || matcher.selector) !== null;
            case 'xpath':
                const result = document.evaluate(
                    matcher.target || matcher.selector,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                );
                return result.singleNodeValue !== null;
            case 'presence':
                // Check for global variable presence
                // Note: content scripts interact with DOM but variable access might be restricted
                // We might need to inject a script to check window vars if this fails
                // For now, check standard DOM window properties
                // return window[matcher.target] !== undefined; 
                // Security Note: Content scripts view of 'window' is isolated. 
                // We typically check DOM elements or use script injection for var checks.
                // Fallback to checking if a script tag usually associated exists?
                // Or try to access if it's attached to DOM.

                // Keep simple for V1
                return false;
            default:
                return false;
        }
    }
}
