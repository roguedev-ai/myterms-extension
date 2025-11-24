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
    console.log(`${req.method} ${req.url}`);

    // Parse URL
    let filePath = req.url === '/' ? '/index.html' : req.url;

    // Handle routes for utils and libs
    if (filePath.startsWith('/utils/') || filePath.startsWith('/libs/')) {
        filePath = path.join(__dirname, 'extension', filePath);
    } else {
        filePath = path.join(DASHBOARD_DIR, filePath);
    }

    // Get file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Read and serve file
    fs.readFile(filePath, (error, content) => {
        if (error) {
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
