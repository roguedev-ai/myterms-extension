# MyTerms Browser Extension - Development Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile Smart Contract
```bash
npx hardhat compile
```

### 3. Run Tests
```bash
npx hardhat test
```

### 4. Deploy to Sepolia (Optional)
```bash
# Set up .env file first (copy from .env.example)
npx hardhat run scripts/deploy.js --network sepolia
```

### 5. Load Extension in Browser
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

## Project Structure

```
myterms-extension/
├── contracts/              # Solidity smart contracts
│   └── MyTermsConsentLedger.sol
├── scripts/               # Deployment and utility scripts
│   ├── deploy.js         # Contract deployment
│   └── generate-icons.js # Icon generator
├── test/                 # Smart contract tests
│   └── MyTermsConsentLedger.test.js
├── extension/            # Browser extension files
│   ├── manifest.json     # Extension manifest
│   ├── background.js     # Service worker
│   ├── content.js        # Content script (banner detection)
│   ├── popup/           # Extension popup UI
│   ├── icons/           # Extension icons
│   └── utils/           # Utility modules
│       ├── ethers.js    # Blockchain interaction
│       ├── storage.js   # IndexedDB storage
│       └── wallet-manager.js  # Multi-wallet support
├── dashboard/           # Web dashboard
│   ├── index.html
│   ├── app.js
│   └── style.css
└── hardhat.config.js    # Hardhat configuration
```

## Development Workflow

### Making Changes to Extension

1. **Edit Files**: Make changes to extension files
2. **Reload Extension**: 
   - Go to `chrome://extensions/`
   - Click reload icon for MyTerms extension
3. **Test Changes**: Verify functionality works as expected

### Making Changes to Smart Contract

1. **Edit Contract**: Modify `contracts/MyTermsConsentLedger.sol`
2. **Run Tests**: `npm test`
3. **Compile**: `npx hardhat compile`
4. **Deploy**: `npx hardhat run scripts/deploy.js --network sepolia`
5. **Update Extension**: Update contract address in extension code

### Adding New Features

1. Update `task.md` with new feature requirements
2. Implement feature in appropriate files
3. Add tests for new functionality
4. Update documentation
5. Test thoroughly before committing

## Available Scripts

```bash
# Run smart contract tests
npm test

# Compile contracts
npm run compile

# Deploy to Sepolia
npm run deploy

# Generate extension icons
node scripts/generate-icons.js
```

## Configuration

### Environment Variables (.env)

```bash
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR-PROJECT-ID
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Hardhat Configuration

Edit `hardhat.config.js` to:
- Add new networks
- Configure compiler settings
- Add plugins

### Extension Configuration

Edit `extension/manifest.json` to:
- Update permissions
- Add new content scripts
- Modify extension metadata

## Testing

### Unit Tests (Smart Contract)
```bash
npm test
```

### Manual Testing (Extension)
See `TESTING.md` for comprehensive testing guide

### Integration Testing
1. Deploy contract to testnet
2. Load extension in browser
3. Test end-to-end flow:
   - Visit sites with cookie banners
   - Verify consent recording
   - Submit batch to blockchain
   - View in dashboard

## Debugging

### Extension Debugging

**Content Script:**
- Open DevTools on any webpage
- Check Console for MyTerms logs

**Background Script:**
- Go to `chrome://extensions/`
- Click "service worker" under MyTerms
- Opens dedicated DevTools

**Popup:**
- Right-click extension icon
- Select "Inspect popup"

### Smart Contract Debugging

**Hardhat Console:**
```bash
npx hardhat console --network sepolia
```

**Transaction Debugging:**
- Use Sepolia Etherscan
- Check transaction logs and events
- Verify gas usage

## Common Tasks

### Update Contract Address

After deploying a new contract:

1. Note the contract address from deployment
2. Update in `extension/utils/ethers.js`:
```javascript
const CONTRACT_ADDRESS = "0xYourNewContractAddress";
```
3. Reload extension

### Add New Cookie Banner Pattern

Edit `extension/content.js`:

```javascript
const bannerSelectors = [
  // Add your new selector
  '.your-new-banner-class',
  // ... existing selectors
];
```

### Modify Privacy Profile

Edit default profile in `extension/content.js`:

```javascript
this.myTermsProfile = {
  preferences: {
    analytics: false,    // Change to true to accept analytics
    marketing: false,    // Change to true to accept marketing
    necessary: true,     // Always true
    functional: false,   // Change as needed
    social: false        // Change as needed
  },
  // ...
};
```

## Deployment

### Testnet Deployment (Sepolia)

1. Get Sepolia ETH from faucet
2. Configure `.env` with your private key
3. Run deployment:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```
4. Note the contract address
5. Update extension with new address

### Production Deployment

**Smart Contract (Mainnet):**
⚠️ **WARNING**: Deploying to mainnet costs real ETH. Test thoroughly first!

```bash
npx hardhat run scripts/deploy.js --network mainnet
```

**Browser Extension:**
1. Test thoroughly on testnet
2. Update contract address to mainnet
3. Create production build
4. Submit to Chrome Web Store
5. Follow Chrome's review process

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Troubleshooting

### Extension won't load
- Check manifest.json syntax
- Verify all file paths exist
- Check browser console for errors

### Tests failing
- Ensure Hardhat is properly configured
- Check for syntax errors in test files
- Verify contract compiles successfully

### Deployment fails
- Check you have enough ETH for gas
- Verify RPC URL is correct
- Ensure private key is valid

## Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Solidity Documentation](https://docs.soliditylang.org/)

## License

MIT License - See LICENSE file for details
