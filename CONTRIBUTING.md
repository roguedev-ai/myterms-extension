# Contributing to ConsentChain

We welcome contributions from the community! Whether you're a developer adding support for a new CMP or a privacy advocate improving our documentation, your help is appreciated.

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
