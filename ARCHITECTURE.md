# MyTerms Extension - Updated Architecture

## 📊 Overview

MyTerms now has a dual-dashboard architecture that provides flexibility for users with or without blockchain features.

## 🏗️ Architecture

### **1. Extension Dashboard** (chrome-extension://...)
**Purpose**: Local data viewing and export (works offline)

**Features**:
- ✅ View all consent data
- ✅ Analytics & statistics
- ✅ Timeline view
- ✅ Export to JSON/CSV (coming soon)
- ❌ NO wallet/blockchain features

**Access**: Popup → "📊 Open Dashboard" button

---

### **2. Blockchain Dashboard** (http://localhost:8080)
**Purpose**: Full blockchain integration with wallet support

**Features**:
- ✅ Everything from Extension Dashboard
- ✅ Connect wallets (MetaMask, WalletConnect, etc.)
- ✅ Submit batches to blockchain
- ✅ Force batch functionality
- ✅ Network switching

**Access**: 
1. Enable in preferences: Extension Dashboard → Preferences → "Enable Blockchain Features"
2. Popup → "⛓️ Blockchain Dashboard" button (only visible if enabled)
3. Or directly at `http://localhost:8080`

**Requirements**:
- Server must be running: `npm run dashboard`
- Wallet installed (MetaMask, etc.)

---

### **3. Popup**
**Purpose**: Quick stats view

**Shows**:
- Queued consents count
- Total batches
- Last batch info
- Quick access buttons

**Buttons**:
- **"📊 Open Dashboard"**: Always visible → Opens Extension Dashboard
- **"⛓️ Blockchain Dashboard"**: Only visible if blockchain enabled → Opens localhost:8080

---

## ⚙️ Settings

### Blockchain Toggle

Users can enable/disable blockchain features in:
1. Extension Dashboard → Preferences → Blockchain Settings
2. Toggle "Enable Blockchain Features"
3. Save Preferences

When **enabled**:
- Blockchain Dashboard button appears in popup
- Can connect wallets and submit to blockchain

When **disabled**:
- Extension works completely offline
- All data stored locally only
- Blockchain features hidden

---

## 🚀 How to Use

### For Regular Users (No Blockchain)
1. Install extension
2. Browse websites - consents are automatically recorded
3. View data in Extension Dashboard
4. Export data if needed

### For Blockchain Users
1. Install extension
2. Enable blockchain in preferences
3. Start dashboard server: `npm run dashboard`
4. Open blockchain dashboard from popup
5. Connect wallet
6. Submit batches to blockchain

---

## 📁 File Changes

### Modified Files:
- `extension/popup/index.html` - Updated buttons
- `extension/popup/popup.js` - Added blockchain settings check
- `extension/dashboard/index.html` - Added blockchain toggle
- `extension/dashboard/app.js` - Added blockchain preference handling
- `extension/background.js` - Enhanced logging
- `extension/content.js` - Enhanced bridge logging

### New Files:
- `serve-dashboard.js` - Node.js server for localhost dashboard
- `DASHBOARD_README.md` - Dashboard documentation

---

## 🔧 Development

### Start Dashboard Server:
```bash
npm run dashboard
```

### Reload Extension:
1. Go to `chrome://extensions`
2. Click refresh on "MyTerms Consent Manager"

### View Logs:
- **Extension Dashboard**: F12 on chrome-extension:// page
- **Blockchain Dashboard**: F12 on http://localhost:8080
- **Background Script**: chrome://extensions → "service worker" link
- **Popup**: Right-click extension icon → "Inspect popup"

---

## 🎯 Future Enhancements

1. **Export Feature**: Add JSON/CSV export to Extension Dashboard
2. **Hosted Dashboard**: Deploy blockchain dashboard to a domain
3. **Auto-start Server**: Background service to auto-start localhost server
4. **Mobile Support**: React Native or WebView integration

---

## 📝 Notes

- The bridge communication allows localhost dashboard to access extension data
- All blockchain transactions require user approval (MetaMask popup)
- Local data persists in IndexedDB even without blockchain
- Users can switch between modes at any time
