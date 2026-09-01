const assert = require('assert');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { once } = require('events');

(async () => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'plandy-content-save-'));
    const assetId = 'a'.repeat(64);
    const assetPath = `assets/content/${assetId}.png`;
    await fsp.mkdir(path.join(temporaryRoot, 'assets', 'content'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'data'), { recursive: true });
    await fsp.writeFile(path.join(temporaryRoot, ...assetPath.split('/')), Buffer.from('asset'));
    await fsp.writeFile(path.join(temporaryRoot, 'data', 'attachments.json'), `${JSON.stringify({
        schemaVersion: 1,
        assets: { [assetId]: { id: assetId, path: assetPath, status: 'active' } }
    }, null, 2)}\n`, 'utf8');

    process.env.PLANDY_ROOT = temporaryRoot;
    process.env.PLANDY_PORT = '0';
    const serverModule = require('../scripts/local-content-server.js');
    const server = await serverModule.start();
    if (!server.listening) await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/local-content`;
    const contentDocument = {
        schemaVersion: 1,
        updatedAt: '2000-01-01T00:00:00.000Z',
        storage: {
            menus: { schemaVersion: 2, menus: [], deletedBuiltinIds: [] },
            customCards: { demo: [{ type: 'single', cards: [{ contentBlocks: [{ type: 'image', assetId, assetPath }] }] }] },
            overviewCards: [],
            routeCards: [],
            authoringCards: [],
            testCards: []
        }
    };

    const post = (value) => fetch(`${baseUrl}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value)
    });

    try {
        const statusResponse = await fetch(`${baseUrl}/status`);
        assert.ok(statusResponse.ok, 'Local content status endpoint must be available.');
        assert.strictEqual((await statusResponse.json()).available, true, 'Local content status must report availability.');

        const response = await post(contentDocument);
        assert.ok(response.ok, `Content save request failed: ${response.status}`);
        const result = await response.json();
        assert.strictEqual(result.saved, true, 'Content save must report completion.');
        assert.strictEqual(result.referencedAssetCount, 1, 'Referenced assets must be counted.');

        const savedJson = JSON.parse(await fsp.readFile(path.join(temporaryRoot, 'data', 'site-content.json'), 'utf8'));
        const savedScript = await fsp.readFile(path.join(temporaryRoot, 'data', 'site-content.js'), 'utf8');
        assert.notStrictEqual(savedJson.updatedAt, contentDocument.updatedAt, 'The server must assign the saved timestamp.');
        assert.deepStrictEqual(savedJson.storage, contentDocument.storage, 'Saved browser content must remain unchanged.');
        assert.strictEqual(savedScript, serverModule.serializePublishedContent(savedJson), 'The file-mode script must match the saved JSON.');

        const beforeRejectedSave = await fsp.readFile(path.join(temporaryRoot, 'data', 'site-content.json'), 'utf8');
        const missingAssetDocument = JSON.parse(JSON.stringify(contentDocument));
        missingAssetDocument.storage.customCards.demo[0].cards[0].contentBlocks[0] = {
            type: 'image',
            assetId: 'missing-asset',
            assetPath: 'assets/content/missing-asset.png'
        };
        const rejectedResponse = await post(missingAssetDocument);
        assert.strictEqual(rejectedResponse.status, 400, 'Missing attachments must block project content saving.');
        assert.strictEqual(await fsp.readFile(path.join(temporaryRoot, 'data', 'site-content.json'), 'utf8'), beforeRejectedSave, 'Rejected content must not overwrite the project JSON.');

        const invalidResponse = await post({ schemaVersion: 1, storage: { overviewCards: {} } });
        assert.strictEqual(invalidResponse.status, 400, 'Invalid storage shapes must be rejected.');
        console.log('Local project content save tests passed.');
    } finally {
        await new Promise((resolve) => server.close(resolve));
        const resolvedTemporaryRoot = path.resolve(temporaryRoot);
        if (resolvedTemporaryRoot.startsWith(path.resolve(os.tmpdir()) + path.sep)) await fsp.rm(resolvedTemporaryRoot, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
