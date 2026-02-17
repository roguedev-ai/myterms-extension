# Contributing to ConsentChain

We welcome contributions to the ConsentChain project!

## Development Status

The project is currently in **Alpha Release** (`v2.0-alpha.1`).
-   **Stable Branch**: `alpha` (Feature Frozen, Bug Fixes Only).
-   **Development Branch**: `main` (New Features).

## Getting Started

1.  Fork the repository.
2.  Clone your fork: `git clone https://github.com/your-username/myterms-extension.git`
3.  Install dependencies: `npm install`
4.  Switch to the appropriate branch.

## Pull Request Process

1.  Create a feature branch: `git checkout -b feature/my-feature`
2.  Commit your changes.
3.  Push to your fork and submit a PR to `main` (for features) or `alpha` (for critical bug fixes).

## How to Add a New CMP Rule

ConsentChain uses the **Consent-O-Matic** rule format with some enhanced metadata.

### 1. Identify the CMP
If you find a site where the banner isn't detected:
1.  Open Developer Tools.
2.  Inspect the banner element.
3.  Note unique IDs or Classes (e.g., `#onetrust-banner-sdk`).

### 2. Create the Rule JSON
Add a new entry to `extension/lib/rules/custom-rules.json` (create if missing) or submit a PR to update the main list.

**Template:**
```json
{
  "name": "MyNewCMP",
  "detectors": [
    {
      "presentMatcher": {
        "type": "css",
        "selector": "#unique-banner-id"
      }
    }
  ],
  "methods": [
    {
      "name": "ACCEPT_ALL",
      "action": {
        "type": "click",
        "selector": "#accept-btn"
      }
    },
    {
      "name": "REJECT_ALL",
      "action": {
        "type": "click",
        "selector": "#reject-btn"
      }
    }
  ]
}
```

### 3. Test Your Rule
1.  Add the rule to `tests/integration/rules-mock.json`.
2.  Add a test case to `tests/cmp-test-sites.json`.
3.  Run `npm test`.

---

## Development Workflow

1.  **Fork** the repository.
2.  **Create a Branch**: `git checkout -b feature/my-new-feature`.
3.  **Code**: Follow the style of existing modules (ES6 Classes).
4.  **Test**: Ensure `npm test` passes.
5.  **Submit PR**: Describe your changes clearly.

## Reporting Bugs
Please use the GitHub Issues tab to report:
*   Sites where the banner is not detected.
*   Crashes or performance issues.
*   Incorrect policy extraction.
