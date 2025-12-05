#!/usr/bin/env node
/**
 * Simple HTTP server to serve the MyTerms dashboard as a web page
 * This allows MetaMask and other wallets to inject window.ethereum
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const DASHBOARD_DIR = path.join(__dirname, 'extension', 'dashboard');

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Parse URL
    let reqUrl = req.url === '/' ? '/index.html' : req.url;

    // Remove query parameters
    reqUrl = reqUrl.split('?')[0];

    let filePath;

    // Handle routes for utils, libs, and extension files
    if (reqUrl.startsWith('/utils/') || reqUrl.startsWith('/libs/') || reqUrl.startsWith('/extension/') || reqUrl.startsWith('/icons/')) {
        // Remove leading slash to ensure path.join works correctly
        const relativePath = reqUrl.startsWith('/') ? reqUrl.slice(1) : reqUrl;
        // If it starts with extension/, we don't need to add 'extension' again if we are relative to root
        // But wait, __dirname is root. 
        // If req is /extension/utils/foo.js -> path.join(root, 'extension/utils/foo.js') which is wrong if we add 'extension' again.

        if (reqUrl.startsWith('/extension/')) {
            filePath = path.join(__dirname, relativePath);
        } else {
            filePath = path.join(__dirname, 'extension', relativePath);
        }
        console.log(`[DEBUG] Request: ${reqUrl} -> Resolved: ${filePath}`);
        if (!fs.existsSync(filePath)) {
            if (!filePath.endsWith('.map')) {
                console.error(`[ERROR] File not found: ${filePath}`);
            }
        }
    } else {
        // Dashboard files
        const relativePath = reqUrl.startsWith('/') ? reqUrl.slice(1) : reqUrl;
        filePath = path.join(DASHBOARD_DIR, relativePath);
    }

    console.log(`Request: ${req.url} -> ${filePath}`);

    // Get file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Read and serve file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            // Don't log expected 404s for map files or favicons to reduce noise
            if (!filePath.endsWith('.map') && !filePath.endsWith('favicon.ico')) {
                console.error(`[ERROR] Failed to serve file:`);
                console.error(`  URL: ${req.url}`);
                console.error(`  Target Path: ${filePath}`);
                console.error(`  Error Code: ${error.code}`);
            }

            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║  MyTerms Dashboard Server                              ║
╠════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}            ║
║                                                        ║
║  Open in your browser to access the dashboard         ║
║  with full MetaMask/wallet support.                    ║
║                                                        ║
║  Press Ctrl+C to stop the server                       ║
╚════════════════════════════════════════════════════════╝
  `);
});
