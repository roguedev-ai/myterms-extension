#!/usr/bin/env node

/**
 * Contract Verification Helper
 * Helps verify the deployed contract on Etherscan
 */

const fs = require('fs');
const path = require('path');

const network = process.argv[2] || 'sepolia';
const deploymentPath = path.join(__dirname, '..', 'deployments', `${network}.json`);

if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ No deployment found for network: ${network}`);
    console.log(`\nAvailable deployments:`);
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (fs.existsSync(deploymentsDir)) {
        const files = fs.readdirSync(deploymentsDir);
        files.forEach(file => console.log(`  - ${file.replace('.json', '')}`));
    } else {
        console.log('  (none)');
    }
    process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

console.log(`\n🔍 Contract Verification Info for ${network}`);
console.log('='.repeat(50));
console.log(`Contract Address: ${deployment.contractAddress}`);
console.log(`Deployer: ${deployment.deployer}`);
console.log(`Block Number: ${deployment.blockNumber}`);
console.log(`Deployment Time: ${deployment.deploymentTime}`);
console.log('='.repeat(50));
console.log('\n📝 To verify on Etherscan, run:');
console.log(`\nnpx hardhat verify --network ${network} ${deployment.contractAddress}\n`);

// Generate explorer link
const explorerUrls = {
    sepolia: 'https://sepolia.etherscan.io',
    mainnet: 'https://etherscan.io',
    goerli: 'https://goerli.etherscan.io'
};

const explorerUrl = explorerUrls[network] || 'https://etherscan.io';
console.log(`🔗 View on Explorer:`);
console.log(`${explorerUrl}/address/${deployment.contractAddress}\n`);
