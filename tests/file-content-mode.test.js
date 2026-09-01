const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

(async () => {
    const root = path.resolve(__dirname, '..');
    const publishedDocument = JSON.parse(fs.readFileSync(path.join(root, 'data', 'site-content.json'), 'utf8'));
    const publishedScript = fs.readFileSync(path.join(root, 'data', 'site-content.js'), 'utf8');
    const contentSync = fs.readFileSync(path.join(root, 'js', 'content-sync.js'), 'utf8');
    const listeners = {};
    const storedValues = new Map();
    let reloadCount = 0;
    const localStorage = {
        getItem(key) { return storedValues.has(key) ? storedValues.get(key) : null; },
        setItem(key, value) { storedValues.set(key, String(value)); },
        removeItem(key) { storedValues.delete(key); }
    };
    const window = {
        location: {
            protocol: 'file:',
            reload() { reloadCount += 1; }
        }
    };
    const document = {
        addEventListener(type, listener) { listeners[type] = listener; },
        getElementById() { return null; }
    };
    const context = {
        window,
        document,
        localStorage,
        console,
        Promise,
        setTimeout,
        clearTimeout,
        fetch() { return Promise.reject(new Error('file mode must not fetch published JSON')); }
    };
    vm.createContext(context);
    new vm.Script(publishedScript, { filename: 'data/site-content.js' }).runInContext(context);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(window.WMS_PUBLISHED_CONTENT)), publishedDocument, 'Embedded content must match site-content.json.');
    new vm.Script(contentSync, { filename: 'js/content-sync.js' }).runInContext(context);
    assert.strictEqual(typeof listeners.DOMContentLoaded, 'function', 'Content synchronization must register its startup handler.');

    listeners.DOMContentLoaded();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(reloadCount, 1, 'The first file-mode load must apply published content and reload once.');
    const storageKeys = {
        menus: 'wms-sidebar-menu-settings-v1',
        customCards: 'wms-custom-menu-cards-v1',
        overviewCards: 'wms-overview-cards-v1',
        routeCards: 'wms-route-cards-v1',
        authoringCards: 'wms-authoring-cards-v1',
        testCards: 'wms-test-menu-cards-v1'
    };
    Object.entries(storageKeys).forEach(([name, key]) => {
        assert.strictEqual(storedValues.get(key), JSON.stringify(publishedDocument.storage[name]), `${name} must match published content.`);
    });
    assert.strictEqual(storedValues.get('wms-published-content-applied-v1'), publishedDocument.updatedAt, 'The file-mode version marker must match the export timestamp.');
    console.log('File-mode published content checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
