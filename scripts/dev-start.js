#!/usr/bin/env node
/**
 * MyTerms Dev Environment Starter
 *
 * Starts the full local dev stack in the correct order:
 *   1. Hardhat local blockchain node (port 8545)
 *   2. Deploy MyTermsConsentLedger contract
 *   3. Fund the configured test wallet
 *   4. Dashboard HTTP server (port 8080)
 *
 * Usage:
 *   npm run dev                        # Start everything
 *   npm run dev -- --fund 0xYourAddr   # Also fund a specific wallet
 */

const { spawn, execSync } = require('child_process');
const path = require('path');

const HARDHAT_PORT = 8545;
const DASHBOARD_PORT = 8080;
const HARDHAT_RPC = `http://127.0.0.1:${HARDHAT_PORT}`;

// Optional: wallet to fund from CLI arg --fund 0x...
const fundArg = process.argv.indexOf('--fund');
const walletToFund = fundArg !== -1 ? process.argv[fundArg + 1] : null;

let hardhatProc = null;
let dashboardProc = null;

function log(tag, msg) {
    const ts = new Date().toTimeString().slice(0, 8);
    console.log(`[${ts}] [${tag}] ${msg}`);
}

function waitForPort(port, retries = 30, interval = 1000) {
    return new Promise((resolve, reject) => {
        const net = require('net');
        let attempts = 0;
        const check = () => {
            const socket = new net.Socket();
            socket.setTimeout(500);
            socket.on('connect', () => { socket.destroy(); resolve(); });
            socket.on('error', () => {
                socket.destroy();
                if (++attempts >= retries) {
                    reject(new Error(`Port ${port} never opened after ${retries} attempts`));
                } else {
                    setTimeout(check, interval);
                }
            });
            socket.on('timeout', () => {
                socket.destroy();
                if (++attempts >= retries) {
                    reject(new Error(`Port ${port} timed out after ${retries} attempts`));
                } else {
                    setTimeout(check, interval);
                }
            });
            socket.connect(port, '127.0.0.1');
        };
        check();
    });
}

function startHardhat() {
    return new Promise((resolve, reject) => {
        log('CHAIN', 'Starting Hardhat node...');
        hardhatProc = spawn('npx', ['hardhat', 'node'], {
            cwd: path.resolve(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe']
        });

        hardhatProc.stdout.on('data', (data) => {
            const line = data.toString().trim();
            if (line.includes('Started HTTP')) {
                log('CHAIN', line);
            }
        });

        hardhatProc.stderr.on('data', (data) => {
            log('CHAIN', data.toString().trim());
        });

        hardhatProc.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                log('CHAIN', `Hardhat exited with code ${code}`);
            }
        });

        // Wait until port 8545 is open
        waitForPort(HARDHAT_PORT)
            .then(() => { log('CHAIN', `Node ready on port ${HARDHAT_PORT}`); resolve(); })
            .catch(reject);
    });
}

function deployContract() {
    return new Promise((resolve, reject) => {
        log('DEPLOY', 'Deploying MyTermsConsentLedger...');
        try {
            const output = execSync(
                'npx hardhat run scripts/deploy.js --network localhost',
                { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
            );
            const addressMatch = output.match(/deployed to: (0x[a-fA-F0-9]{40})/);
            if (addressMatch) {
                log('DEPLOY', `Contract deployed at ${addressMatch[1]}`);
            }
            resolve();
        } catch (err) {
            reject(new Error('Deploy failed: ' + err.message));
        }
    });
}

function fundWallet(address) {
    return new Promise((resolve, reject) => {
        log('FUND', `Funding wallet ${address} with 10 ETH...`);
        try {
            execSync(
                `RECIPIENT=${address} npx hardhat run scripts/fund-wallet.js --network localhost`,
                { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', stdio: 'pipe' }
            );
            log('FUND', 'Wallet funded successfully');
            resolve();
        } catch (err) {
            // Non-fatal — wallet may already be funded
            log('FUND', 'Fund skipped or already funded: ' + err.message.split('\n')[0]);
            resolve();
        }
    });
}

function startDashboard() {
    return new Promise((resolve) => {
        log('DASH', `Starting dashboard server on port ${DASHBOARD_PORT}...`);
        dashboardProc = spawn('node', ['serve-dashboard.js'], {
            cwd: path.resolve(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe']
        });

        dashboardProc.stdout.on('data', (data) => {
            log('DASH', data.toString().trim());
        });

        dashboardProc.stderr.on('data', (data) => {
            log('DASH', data.toString().trim());
        });

        waitForPort(DASHBOARD_PORT)
            .then(() => { log('DASH', `Dashboard ready at http://localhost:${DASHBOARD_PORT}`); resolve(); })
            .catch(() => resolve()); // Dashboard failing shouldn't block the chain
    });
}

function printReadyBanner() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  MyTerms Dev Environment — READY                         ║
╠══════════════════════════════════════════════════════════╣
║  Blockchain RPC  :  http://localhost:8545                ║
║  Dashboard UI    :  http://localhost:8080                ║
║  Contract        :  0x5FbDB2315678afecb367f032d93F642f6  ║
║                     4180aa3 (Hardhat slot 0)             ║
╠══════════════════════════════════════════════════════════╣
║  MetaMask setup:                                         ║
║  1. Network -> Localhost 8545 (chain ID 31337)           ║
║  2. Import test account private key if needed:           ║
║     0xac0974bec39a17e36ba4a6b4d238ff944bacb478...        ║
║  3. Open http://localhost:8080 in the same browser       ║
╠══════════════════════════════════════════════════════════╣
║  Press Ctrl+C to stop all services                       ║
╚══════════════════════════════════════════════════════════╝
`);
}

async function main() {
    console.log('\n  MyTerms Dev Starter\n');

    try {
        await startHardhat();
        await deployContract();

        if (walletToFund) {
            await fundWallet(walletToFund);
        }

        await startDashboard();
        printReadyBanner();
    } catch (err) {
        console.error('\n[ERROR] Dev start failed:', err.message);
        cleanup();
        process.exit(1);
    }
}

function cleanup() {
    if (hardhatProc) { hardhatProc.kill(); }
    if (dashboardProc) { dashboardProc.kill(); }
}

process.on('SIGINT', () => {
    console.log('\n\nShutting down dev environment...');
    cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
});

main();
