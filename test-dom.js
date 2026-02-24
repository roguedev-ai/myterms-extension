const fs = require('fs');
const html = fs.readFileSync('extension/dashboard/index.html', 'utf8');
if (html.includes('id="agreementsView"')) console.log("agreementsView found");
if (html.includes('id="prefBlockchainEnabled"')) console.log("prefBlockchainEnabled found");
