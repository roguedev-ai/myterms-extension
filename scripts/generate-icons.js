#!/usr/bin/env node

/**
 * Icon Generator for MyTerms Extension
 * Generates PNG icons in different sizes from an SVG template
 * 
 * Usage: node generate-icons.js
 * 
 * Note: Requires installing dependencies:
 * npm install sharp
 */

const fs = require('fs');
const path = require('path');

// SVG template for the MyTerms icon
const svgTemplate = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Shield background -->
  <path d="M 64 10 L 100 25 L 100 65 Q 100 95 64 118 Q 28 95 28 65 L 28 25 Z" 
        fill="url(#grad1)" stroke="#4a3a7a" stroke-width="2"/>
  
  <!-- Checkmark -->
  <path d="M 50 64 L 58 72 L 78 48" 
        fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  
  <!-- Lock symbol (small) -->
  <rect x="54" y="82" width="20" height="16" rx="2" fill="white" opacity="0.9"/>
  <path d="M 58 82 L 58 76 Q 58 70 64 70 Q 70 70 70 76 L 70 82" 
        fill="none" stroke="white" stroke-width="3" opacity="0.9"/>
</svg>
`;

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'extension', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Icon sizes to generate
const sizes = [16, 32, 64, 128];

console.log('Generating MyTerms extension icons...\n');

// Generate SVG files for each size
sizes.forEach(size => {
    const svgContent = svgTemplate(size);
    const svgPath = path.join(iconsDir, `icon${size}.svg`);

    fs.writeFileSync(svgPath, svgContent);
    console.log(`✓ Generated ${size}x${size} SVG icon: ${svgPath}`);
});

console.log('\n✓ All icons generated successfully!');
console.log('\nNote: SVG icons work great in modern browsers.');
console.log('If you need PNG icons, install sharp and uncomment the PNG generation code below.\n');

// Uncomment this section if you want to generate PNG icons
// Requires: npm install sharp
/*
const sharp = require('sharp');

async function generatePNGIcons() {
  for (const size of sizes) {
    const svgContent = svgTemplate(size);
    const pngPath = path.join(iconsDir, `icon${size}.png`);
    
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(pngPath);
    
    console.log(`✓ Generated ${size}x${size} PNG icon: ${pngPath}`);
  }
}

generatePNGIcons().catch(console.error);
*/
