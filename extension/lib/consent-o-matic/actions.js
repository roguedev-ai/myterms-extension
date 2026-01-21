export class ActionExecutor {
    async execute(action, context) {
        switch (action.type) {
            case 'click':
                return await this.executeClick(action, context);
            case 'list':
                return await this.executeList(action, context);
            case 'consent':
                return await this.executeConsent(action, context);
            case 'hide':
                return await this.executeHide(action, context);
            default:
                console.warn('Unknown action type:', action.type);
                return false;
        }
    }

    async executeClick(action, context) {
        const element = context.document.querySelector(action.selector);
        if (element) {
            // Visual indicator for debugging
            const originalBorder = element.style.border;
            element.style.border = '2px solid red';
            setTimeout(() => element.style.border = originalBorder, 500);

            element.click();
            return true;
        }
        return false;
    }

    async executeList(action, context) {
        // Handle list actions (iterate selectors)
        for (const subAction of action.actions) {
            await this.execute(subAction, context);
        }
        return true;
    }

    async executeConsent(action, context) {
        // Implement IAB TCF consent setting if available
        if (window.__tcfapi) {
            return new Promise((resolve) => {
                window.__tcfapi('setConsentUiCallback', 2, (success) => {
                    resolve(success);
                }, action.consents);
            });
        }
        return false;
    }

    async executeHide(action, context) {
        // Support array of selectors or single selector
        const selectors = Array.isArray(action.selector) ? action.selector : [action.selector];
        let hidden = false;

        for (const selector of selectors) {
            const elements = context.document.querySelectorAll(selector);
            elements.forEach(el => {
                el.style.display = 'none';
                hidden = true;
            });
        }
        return hidden;
    }
}
