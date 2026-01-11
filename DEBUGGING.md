# Debugging Consent Automation

If the auto-rejection isn't working on a specific site, follow these steps to help us diagnose the issue.

## 1. Enable Debug Mode
The extension runs in "Debug Mode" by default in development versions (look for `v1.3` in logs).

## 2. Inspect the Console
1. Right-click anywhere on the web page.
2. Select **Inspect** or **Inspect Element**.
3. Go to the **Console** tab.
4. Filter logs by typing `MyTerms` in the filter box.

## 3. Understand the Logs

### Success Path
- `[MyTerms] Profile decision: DECLINE...` -> Extension decided to reject cookies.
- `[MyTerms] Found button via selector...` -> It identified a button.
- `[MyTerms] Clicking decline button...` -> It attempted to click it.

### Failure Paths
- **No Logs?** -> The extension might not be loading. Reload the page.
- **`Banner score: X`** -> If score is < 6, the banner wasn't confident enough to trigger.
- **`Failed to find/click decline button`** -> It made the decision to decline but couldn't find the button.

## 4. Reporting Issues
If you see the "Clicked" message but nothing happened on the screen:
1. The site might require a specific "event sequence" (e.g., mouseup/down).
2. The button might be inside a "Shadow DOM" (which hides it from standard scripts).
3. The button might be visual only (a `div` instead of a `button`).

**Please share a screenshot of your Console logs when reporting an issue!**
