const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../js/warehouse-page.js'), 'utf8');
const published = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/site-content.json'), 'utf8'));

function element() {
    return {
        isConnected: true, children: [], listeners: {},
        replaceChildren(...children) { this.children = children; },
        appendChild(child) { this.children.push(child); },
        setAttribute() {},
        addEventListener(type, callback) { this.listeners[type] = callback; }
    };
}

(async () => {
    const menu = published.storage.menus.menus.find(item => item.viewType === 'warehouse3d');
    assert.equal(menu.id, 'custom-1788157191456');
    const data = JSON.stringify(published.storage.customCards);
    let authenticated = true;
    const mounts = [];
    const disposed = [];
    const window = {
        WMS_PUBLISHED_CONTENT: published,
        wmsPermissions: { isAuthenticated: () => authenticated },
        wmsCardPatchReady: Promise.resolve(),
        wmsWarehouse3D: {
            mount: async (host, options) => mounts.push({ host, options }),
            disposeWithin: panel => disposed.push(panel)
        }
    };
    vm.runInNewContext(source, {
        window, document: { createElement: element },
        localStorage: { getItem: () => data }
    });
    const api = window.wmsWarehousePage;
    assert.equal(api.getViewType({ id: menu.id, label: '이름을 바꾼 메뉴' }), 'warehouse3d', 'Legacy drafts must inherit type by stable ID.');
    assert.equal(api.getViewType({ id: 'unrelated', label: '3D 테스트' }), 'cards', 'A matching label must not convert an unrelated menu.');
    assert.equal(api.getViewType({ ...menu, viewType: 'cards' }), 'cards', 'Explicit screen choices must be preserved.');
    const panel = element();
    authenticated = false;
    await api.setActive(panel, true, menu);
    assert.equal(mounts.length, 0, 'Logged-out pages must not load a scene.');
    authenticated = true;
    await api.setActive(panel, true, menu);
    await api.setActive(panel, true, menu);
    assert.equal(mounts.length, 1, 'Repeated active-route notifications must not duplicate the scene.');
    assert.equal(mounts[0].options.googleSheet.documentId, '12G9JIftGIVStzWUxIVZrz0JZsJ858Mc90V7-fnfBiHM');
    await api.setActive(panel, false, menu);
    assert.equal(disposed.length, 1);
    assert.equal(panel.children.length, 0, 'Leaving the route must remove its scene DOM.');
    await api.setActive(panel, true, menu);
    assert.equal(mounts.length, 2, 'Returning to the route must create exactly one new scene.');
    api.dispose(panel);

    let finishPatches;
    window.wmsCardPatchReady = new Promise(resolve => { finishPatches = resolve; });
    const pending = api.setActive(panel, true, menu);
    await api.setActive(panel, false, menu);
    finishPatches();
    await pending;
    assert.equal(mounts.length, 2, 'A route abandoned while patches load must never start later.');

    const oldLoad = api.setActive(panel, true, menu);
    api.dispose(panel);
    const newLoad = api.setActive(panel, true, menu);
    await Promise.all([oldLoad, newLoad]);
    assert.equal(mounts.length, 3, 'Rapid leave/re-enter must discard the stale load.');
    assert.equal(JSON.stringify(published.storage.customCards), data, 'Loading pages must not mutate preserved card content.');

    api.dispose(panel);
    await api.setActive(panel, true, { id: 'missing' });
    assert.equal(mounts.length, 3, 'Missing configuration must not render an unrelated fallback warehouse.');
    assert.match(panel.children[0].textContent, /연결 정보/);
    assert.equal(panel.children[0].children[0].textContent, '다시 시도');
    console.log('Warehouse page lifecycle and data preservation checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
