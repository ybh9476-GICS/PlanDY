const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'data', 'site-content.json');
const targetPath = path.join(root, 'data', 'site-content.js');
const documentValue = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const serialized = JSON.stringify(documentValue, null, 2)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

fs.writeFileSync(
    targetPath,
    `(function () {\n    window.WMS_PUBLISHED_CONTENT = ${serialized};\n}());\n`,
    'utf8'
);

console.log('Synced data/site-content.js from data/site-content.json.');
