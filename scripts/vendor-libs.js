const fs = require('fs');
const path = require('path');

const LIBS_DIR = path.resolve(__dirname, '../extension/libs');
const NODE_MODULES = path.resolve(__dirname, '../node_modules');

// Ensure libs directory exists
if (!fs.existsSync(LIBS_DIR)) {
    fs.mkdirSync(LIBS_DIR, { recursive: true });
}

// List of dependencies to vendor
// We need to find the browser-compatible bundles
const dependencies = [
    {
        name: 'idb',
        src: path.join(NODE_MODULES, 'idb/build/index.js'),
        dest: path.join(LIBS_DIR, 'idb.js')
    }
];

// NOTE: Since we can't easily predict the exact path of the webzjs bundle without checking the package,
// we might need to adjust the paths after inspection.
// For now, let's try to find them.

function copyFile(src, dest) {
    try {
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`✅ Copied ${src} -> ${dest}`);
        } else {
            console.error(`❌ Source not found: ${src}`);
        }
    } catch (e) {
        console.error(`❌ Error copying ${src}:`, e.message);
    }
}

function copyDir(src, dest) {
    try {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

        if (fs.existsSync(src)) {
            fs.cpSync(src, dest, { recursive: true });
            console.log(`✅ Copied Directory ${src} -> ${dest}`);
        } else {
            console.error(`❌ Source directory not found: ${src}`);
        }
    } catch (e) {
        console.error(`❌ Error copying dir ${src}:`, e.message);
    }
}

dependencies.forEach(dep => {
    if (dep.isDir) {
        copyDir(dep.src, dep.dest);
    } else {
        copyFile(dep.src, dep.dest);
    }
});

console.log('Vendor script verification complete. Check for errors above.');
