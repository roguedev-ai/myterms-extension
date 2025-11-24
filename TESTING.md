# MyTerms Extension - Testing Guide

## Prerequisites

Before testing, ensure you have:
- ✅ Chrome or Edge browser (Manifest v3 compatible)
- ✅ MetaMask or another Web3 wallet installed
- ✅ Sepolia testnet ETH (for blockchain testing)
- ✅ Extension files compiled and ready

## Loading the Extension

### Step 1: Open Chrome Extensions Page
1. Open Chrome/Edge browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)

### Step 2: Load Unpacked Extension
1. Click "Load unpacked" button
2. Navigate to `/home/jaymes/projects/myterms-extension/extension`
3. Select the `extension` folder
4. The MyTerms icon should appear in your extensions toolbar

### Step 3: Verify Installation
- Check that the extension icon appears in the toolbar
- Click the icon to open the popup
- Verify the popup displays correctly

## Testing Checklist

### 🔍 Banner Detection Testing

**Test Sites:**
- cookiebot.com (has cookie banner)
- github.com (has cookie notice)
- medium.com (has cookie consent)
- Any site with GDPR cookie banners

**Steps:**
1. Open browser console (F12)
2. Navigate to a test site
3. Check console for "Banner detected" messages
4. Verify banner is automatically handled

**Expected Results:**
- Console shows banner detection logs
- Banner is automatically accepted/declined based on profile
- Consent is recorded locally

### 💾 Storage Testing

**Steps:**
1. Open Chrome DevTools (F12)
2. Go to Application → IndexedDB → MyTermsDB
3. Check `consents` object store
4. Verify consent records are being saved

**Expected Results:**
- Each consent has: siteDomain, termsHash, timestamp, preferences
- Records accumulate as you browse

### 🔗 Wallet Integration Testing

**Steps:**
1. Click extension icon to open popup
2. Check wallet connection status
3. If not connected, the background script should attempt connection
4. Verify account address displays correctly

**Expected Results:**
- Wallet connects automatically or shows connect button
- Account address displayed in popup
- Network information shown

### 📦 Batch Submission Testing

**Note:** Batch submission happens automatically after 24 hours or can be triggered manually.

**Manual Testing:**
1. Accumulate several consents (visit multiple sites)
2. Open popup and click "Force Batch Submit"
3. Approve the transaction in MetaMask
4. Wait for transaction confirmation

**Expected Results:**
- Transaction sent to Sepolia testnet
- Transaction hash displayed in popup
- Consents marked as "batched" in storage
- Notification shown on success

### 📊 Dashboard Testing

**Steps:**
1. Open `dashboard/index.html` in browser
2. Connect wallet
3. Verify consent history displays
4. Test different views (Timeline, Sites, Analytics)
5. Check that charts render correctly

**Expected Results:**
- Wallet connects successfully
- Consent history loads from IndexedDB
- Timeline shows all consents chronologically
- Sites view groups consents by domain
- Analytics charts display data

## Common Issues & Solutions

### Issue: Extension doesn't load
**Solution:** 
- Check manifest.json for syntax errors
- Ensure all file paths are correct
- Check browser console for errors

### Issue: Banner detection not working
**Solution:**
- Check that content script is injecting properly
- Verify site has a cookie banner
- Check console for detection logs
- Banner detection uses heuristics, may not catch all banners

### Issue: Wallet won't connect
**Solution:**
- Ensure MetaMask is installed and unlocked
- Check that you're on Sepolia testnet
- Clear browser cache and reload extension

### Issue: Batch submission fails
**Solution:**
- Ensure you have Sepolia ETH for gas
- Check network connection
- Verify contract is deployed on Sepolia
- Check console for error messages

### Issue: Dashboard shows no data
**Solution:**
- Dashboard uses IndexedDB which is origin-specific
- If running from file://, it won't see extension's data
- Serve dashboard from a local web server or same origin

## Performance Testing

### Memory Usage
1. Open Chrome Task Manager (Shift+Esc)
2. Find "Extension: MyTerms"
3. Monitor memory usage over time
4. Should stay under 50MB for normal usage

### CPU Usage
- Background script should be idle when not processing
- Content script should have minimal impact on page load
- Check for any infinite loops or excessive DOM queries

## Security Testing

### Content Security Policy
- Verify no inline scripts in popup/dashboard
- Check that only allowed resources load
- Test with strict CSP settings

### Data Privacy
- Verify consent data stays local until batch submission
- Check that no data leaks to third parties
- Ensure termsHash is properly generated

## Debugging Tips

### Enable Verbose Logging
Add to background.js or content.js:
```javascript
console.log('[MyTerms Debug]', ...);
```

### Inspect Service Worker
1. Go to `chrome://extensions/`
2. Find MyTerms extension
3. Click "service worker" link
4. Opens DevTools for background script

### Monitor Network Requests
1. Open DevTools Network tab
2. Filter by "WS" or "Fetch/XHR"
3. Check for blockchain RPC calls
4. Verify no unexpected requests

## Test Results Template

```
## Test Session: [Date]

### Environment
- Browser: Chrome/Edge [version]
- Wallet: MetaMask [version]
- Network: Sepolia

### Banner Detection
- Sites tested: [list]
- Banners detected: [count]
- Auto-handled: [count]
- Issues: [none/describe]

### Storage
- Consents recorded: [count]
- Storage size: [MB]
- Issues: [none/describe]

### Batch Submission
- Consents batched: [count]
- Gas used: [amount]
- Transaction hash: [hash]
- Issues: [none/describe]

### Overall Assessment
- Status: ✅ Pass / ❌ Fail
- Notes: [any observations]
```

## Next Steps After Testing

1. Document any bugs found
2. Test on different websites
3. Verify gas optimization (batch vs individual)
4. Test edge cases (network failures, wallet disconnection)
5. Prepare for production deployment
