const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'index.html');
const source = fs.readFileSync(sourcePath, 'utf8');
const pages = [
    'home.html',
    'overview.html',
    'floor.html',
    'zone.html',
    'rack.html',
    'editor.html',
    'authoring.html',
    'route.html',
    'settings.html',
    'dashboard.html',
    'models.html',
    'simulations.html'
];

for (const page of pages) {
    fs.writeFileSync(path.join(root, page), source, 'utf8');
}

console.log(`Synced ${pages.length} compatibility entry pages from index.html.`);
