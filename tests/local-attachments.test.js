const assert = require('assert');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { once } = require('events');

(async () => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'plandy-attachments-'));
    process.env.PLANDY_ROOT = temporaryRoot;
    process.env.PLANDY_PORT = '0';
    const serverModule = require('../scripts/local-content-server.js');
    const server = await serverModule.start();
    if (!server.listening) await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/local-attachments`;
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', 'base64');

    const postJson = async (action, body) => {
        const response = await fetch(`${baseUrl}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        assert.ok(response.ok, `${action} request failed: ${response.status}`);
        return response.json();
    };
    const upload = async () => {
        const response = await fetch(`${baseUrl}/upload`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent('테스트.png') }, body: png });
        assert.ok(response.ok, `upload request failed: ${response.status}`);
        return response.json();
    };

    try {
        const first = await upload();
        const duplicate = await upload();
        assert.strictEqual(first.asset.id, duplicate.asset.id, 'Identical files must share one asset ID.');
        assert.strictEqual(duplicate.duplicated, true, 'The second upload must be reported as a duplicate.');
        assert.ok(fs.existsSync(path.join(temporaryRoot, first.asset.path)), 'Uploaded file was not saved in assets/content.');

        let scan = await postJson('scan', { referencedAssetIds: [] });
        assert.strictEqual(scan.summary.unused, 1, 'Unreferenced assets must be reported as unused.');
        const manifestPath = path.join(temporaryRoot, 'data', 'attachments.json');
        const protectedManifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
        protectedManifest.assets[first.asset.id].protected = true;
        await fsp.writeFile(manifestPath, `${JSON.stringify(protectedManifest, null, 2)}\n`, 'utf8');
        scan = await postJson('scan', { referencedAssetIds: [] });
        assert.strictEqual(scan.summary.used, 1, 'Protected static assets must be reported as used.');
        const staticProtectedMove = await postJson('trash', { ids: [first.asset.id], referencedAssetIds: [] });
        assert.deepStrictEqual(staticProtectedMove.protectedIds, [first.asset.id], 'Protected static assets must not move to trash.');
        delete protectedManifest.assets[first.asset.id].protected;
        await fsp.writeFile(manifestPath, `${JSON.stringify(protectedManifest, null, 2)}\n`, 'utf8');
        const protectedMove = await postJson('trash', { ids: [first.asset.id], referencedAssetIds: [first.asset.id] });
        assert.deepStrictEqual(protectedMove.protectedIds, [first.asset.id], 'Referenced assets must not move to trash.');

        const moved = await postJson('trash', { ids: [first.asset.id], referencedAssetIds: [] });
        assert.deepStrictEqual(moved.moved, [first.asset.id], 'Unused asset must move to trash.');
        const restored = await postJson('restore', { ids: [first.asset.id] });
        assert.deepStrictEqual(restored.restored, [first.asset.id], 'Trashed asset must be restorable.');

        await postJson('trash', { ids: [first.asset.id], referencedAssetIds: [] });
        const protectedDelete = await postJson('delete', { ids: [first.asset.id], referencedAssetIds: [first.asset.id] });
        assert.deepStrictEqual(protectedDelete.protectedIds, [first.asset.id], 'A newly referenced trash asset must not be permanently deleted.');
        const deleted = await postJson('delete', { ids: [first.asset.id], referencedAssetIds: [] });
        assert.deepStrictEqual(deleted.deleted, [first.asset.id], 'Unused trash asset must be permanently deleted.');

        scan = await postJson('scan', { referencedAssetIds: [first.asset.id] });
        assert.deepStrictEqual(scan.missingReferencedIds, [first.asset.id], 'Missing referenced assets must block publication checks.');
        console.log('Local attachment server tests passed.');
    } finally {
        await new Promise((resolve) => server.close(resolve));
        const resolvedTemporaryRoot = path.resolve(temporaryRoot);
        if (resolvedTemporaryRoot.startsWith(path.resolve(os.tmpdir()) + path.sep)) await fsp.rm(resolvedTemporaryRoot, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
