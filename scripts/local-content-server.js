const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.env.PLANDY_ROOT || path.resolve(__dirname, '..'));
const contentDir = path.join(root, 'assets', 'content');
const trashDir = path.join(root, '.local-attachment-trash');
const manifestPath = path.join(root, 'data', 'attachments.json');
const siteContentPath = path.join(root, 'data', 'site-content.json');
const siteContentScriptPath = path.join(root, 'data', 'site-content.js');
const host = '127.0.0.1';
const port = Number(process.env.PLANDY_PORT || 4173);
const maxBytes = 50 * 1024 * 1024;
let mutationQueue = Promise.resolve();

const mimeMap = {
    'image/png': { ext: '.png', max: 20 * 1024 * 1024 },
    'image/jpeg': { ext: '.jpg', max: 20 * 1024 * 1024 },
    'image/webp': { ext: '.webp', max: 20 * 1024 * 1024 },
    'image/gif': { ext: '.gif', max: 20 * 1024 * 1024 },
    'application/pdf': { ext: '.pdf', max: 50 * 1024 * 1024 }
};

function detectMime(buffer) {
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
    if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return 'image/gif';
    if (buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
    return '';
}

async function ensureStorage() {
    await fsp.mkdir(contentDir, { recursive: true });
    await fsp.mkdir(trashDir, { recursive: true });
    await fsp.mkdir(path.dirname(manifestPath), { recursive: true });
    if (!fs.existsSync(manifestPath)) await writeJsonAtomic(manifestPath, { schemaVersion: 1, assets: {} });
}

async function readManifest() {
    await ensureStorage();
    try {
        const value = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
        return value?.assets && typeof value.assets === 'object' ? value : { schemaVersion: 1, assets: {} };
    } catch (_) {
        return { schemaVersion: 1, assets: {} };
    }
}

async function writeJsonAtomic(filePath, value) {
    const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await fsp.rename(temporary, filePath);
}

async function writeTextAtomic(filePath, value) {
    const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(temporary, value, 'utf8');
    await fsp.rename(temporary, filePath);
}

function serializePublishedContent(documentValue) {
    const serialized = JSON.stringify(documentValue, null, 2)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    return `(function () {\n    window.WMS_PUBLISHED_CONTENT = ${serialized};\n}());\n`;
}

function isContentDocument(value) {
    if (!value || value.schemaVersion !== 1 || !value.storage || typeof value.storage !== 'object' || Array.isArray(value.storage)) return false;
    const { menus, customCards, overviewCards, routeCards, authoringCards, testCards } = value.storage;
    return (menus === undefined || (menus && typeof menus === 'object' && !Array.isArray(menus)))
        && (customCards === undefined || (customCards && typeof customCards === 'object' && !Array.isArray(customCards)))
        && [overviewCards, routeCards, authoringCards, testCards].every((rows) => rows === undefined || Array.isArray(rows));
}

function enqueueMutation(task) {
    const result = mutationQueue.then(task, task);
    mutationQueue = result.catch(() => {});
    return result;
}

function json(response, status, value) {
    const body = Buffer.from(JSON.stringify(value));
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
    response.end(body);
}

async function readBody(request, limit = maxBytes) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > limit) throw Object.assign(new Error('파일 크기 제한을 초과했습니다.'), { status: 413 });
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

function safeName(value) {
    try { return decodeURIComponent(String(value || '첨부파일')).replace(/[\\/\0-\x1f]/g, '_').slice(0, 180) || '첨부파일'; }
    catch (_) { return '첨부파일'; }
}

async function upload(request, response) {
    const buffer = await readBody(request);
    const mimeType = detectMime(buffer);
    const rule = mimeMap[mimeType];
    if (!rule) return json(response, 415, { error: 'PNG, JPG, WEBP, GIF, PDF 파일만 등록할 수 있습니다.' });
    if (buffer.length > rule.max) return json(response, 413, { error: mimeType === 'application/pdf' ? 'PDF는 50MB 이하만 등록할 수 있습니다.' : '이미지는 20MB 이하만 등록할 수 있습니다.' });
    const id = crypto.createHash('sha256').update(buffer).digest('hex');
    const relativePath = `assets/content/${id}${rule.ext}`;
    const filePath = path.join(root, ...relativePath.split('/'));
    await ensureStorage();
    let duplicated = fs.existsSync(filePath);
    if (!duplicated) {
        const temporary = `${filePath}.${process.pid}.tmp`;
        await fsp.writeFile(temporary, buffer, { flag: 'wx' });
        try { await fsp.rename(temporary, filePath); }
        catch (error) { await fsp.rm(temporary, { force: true }); if (error.code !== 'EEXIST') throw error; duplicated = true; }
    }
    const manifest = await readManifest();
    const originalName = safeName(request.headers['x-file-name']);
    const previous = manifest.assets[id] || {};
    manifest.assets[id] = {
        id, path: relativePath, originalName: previous.originalName || originalName,
        aliases: [...new Set([...(previous.aliases || []), originalName])],
        mimeType, size: buffer.length, status: 'active', createdAt: previous.createdAt || new Date().toISOString()
    };
    if (previous.trashPath) await fsp.rm(path.join(root, ...previous.trashPath.split('/')), { force: true });
    await writeJsonAtomic(manifestPath, manifest);
    json(response, 200, { asset: manifest.assets[id], duplicated });
}

function collectReferences(value, result = new Set()) {
    if (!value) return result;
    if (Array.isArray(value)) { value.forEach((item) => collectReferences(item, result)); return result; }
    if (typeof value !== 'object') return result;
    for (const [key, child] of Object.entries(value)) {
        if (key === 'assetId' && typeof child === 'string') result.add(child);
        else collectReferences(child, result);
    }
    return result;
}

function collectAssetPaths(value, result = new Set()) {
    if (!value) return result;
    if (Array.isArray(value)) { value.forEach((item) => collectAssetPaths(item, result)); return result; }
    if (typeof value !== 'object') return result;
    for (const [key, child] of Object.entries(value)) {
        if (key === 'assetPath' && typeof child === 'string') result.add(child);
        else collectAssetPaths(child, result);
    }
    return result;
}

async function saveSiteContent(documentValue) {
    if (!isContentDocument(documentValue)) throw Object.assign(new Error('지원하지 않는 콘텐츠 JSON 형식입니다.'), { status: 400 });
    const manifest = await readManifest();
    const missingAssets = [];
    for (const id of collectReferences(documentValue)) {
        const asset = manifest.assets[id];
        if (!asset || !asset.path || asset.status === 'trash' || !fs.existsSync(path.join(root, ...asset.path.split('/')))) missingAssets.push(id);
    }
    for (const assetPath of collectAssetPaths(documentValue)) {
        if (!assetPath.startsWith('assets/content/')) continue;
        const absolutePath = path.resolve(root, ...assetPath.split('/'));
        if (!absolutePath.startsWith(`${contentDir}${path.sep}`) || !fs.existsSync(absolutePath)) missingAssets.push(assetPath);
    }
    if (missingAssets.length) throw Object.assign(new Error(`연결된 첨부파일 ${new Set(missingAssets).size}개를 프로젝트에서 찾을 수 없습니다.`), { status: 400 });
    const nextDocument = { ...documentValue, updatedAt: new Date().toISOString() };
    await fsp.mkdir(path.dirname(siteContentPath), { recursive: true });
    await writeJsonAtomic(siteContentPath, nextDocument);
    await writeTextAtomic(siteContentScriptPath, serializePublishedContent(nextDocument));
    return { saved: true, updatedAt: nextDocument.updatedAt, referencedAssetCount: collectReferences(nextDocument).size };
}

async function getProjectReferences() {
    const result = new Set();
    for (const relative of ['data/site-content.json', 'data/card-patches.json']) {
        try { collectReferences(JSON.parse(await fsp.readFile(path.join(root, relative), 'utf8')), result); } catch (_) {}
    }
    return result;
}

async function scan(body) {
    const manifest = await readManifest();
    const references = await getProjectReferences();
    for (const id of body.referencedAssetIds || []) if (typeof id === 'string') references.add(id);
    const assets = Object.values(manifest.assets).map((asset) => ({ ...asset, referenced: Boolean(asset.protected) || references.has(asset.id) }));
    const missingReferencedIds = [];
    for (const id of references) {
        const asset = manifest.assets[id];
        if (!asset || !asset.path || asset.status === 'trash' || !fs.existsSync(path.join(root, ...asset.path.split('/')))) missingReferencedIds.push(id);
    }
    return { assets, missingReferencedIds, summary: {
        total: assets.length,
        used: assets.filter((asset) => asset.status !== 'trash' && asset.referenced).length,
        unused: assets.filter((asset) => asset.status !== 'trash' && !asset.referenced).length,
        trash: assets.filter((asset) => asset.status === 'trash').length
    }};
}

async function moveToTrash(ids, referencedAssetIds) {
    const manifest = await readManifest();
    const references = await getProjectReferences();
    for (const id of referencedAssetIds || []) references.add(id);
    const moved = [], protectedIds = [];
    for (const id of ids.slice(0, 100)) {
        const asset = manifest.assets[id];
        if (!asset || asset.status === 'trash') continue;
        if (asset.protected || references.has(id)) { protectedIds.push(id); continue; }
        const source = path.join(root, ...asset.path.split('/'));
        const target = path.join(trashDir, path.basename(asset.path));
        if (fs.existsSync(source)) await fsp.rename(source, target);
        asset.status = 'trash'; asset.trashedAt = new Date().toISOString(); asset.trashPath = path.relative(root, target).replace(/\\/g, '/');
        moved.push(id);
    }
    await writeJsonAtomic(manifestPath, manifest);
    return { moved, protectedIds };
}

async function restore(ids) {
    const manifest = await readManifest();
    const restored = [];
    for (const id of ids.slice(0, 100)) {
        const asset = manifest.assets[id];
        if (!asset || asset.status !== 'trash') continue;
        const source = path.join(root, ...(asset.trashPath || '').split('/'));
        const target = path.join(root, ...asset.path.split('/'));
        if (fs.existsSync(source) && !fs.existsSync(target)) await fsp.rename(source, target);
        asset.status = 'active'; delete asset.trashedAt; delete asset.trashPath; restored.push(id);
    }
    await writeJsonAtomic(manifestPath, manifest);
    return { restored };
}

async function permanentlyDelete(ids, referencedAssetIds) {
    const manifest = await readManifest();
    const references = await getProjectReferences();
    for (const id of referencedAssetIds || []) references.add(id);
    const deleted = [], protectedIds = [];
    for (const id of ids.slice(0, 100)) {
        const asset = manifest.assets[id];
        if (!asset || asset.status !== 'trash') continue;
        if (asset.protected || references.has(id)) { protectedIds.push(id); continue; }
        if (asset.trashPath) await fsp.rm(path.join(root, ...asset.trashPath.split('/')), { force: true });
        delete manifest.assets[id]; deleted.push(id);
    }
    await writeJsonAtomic(manifestPath, manifest);
    return { deleted, protectedIds };
}

const contentTypes = { '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.pdf':'application/pdf','.svg':'image/svg+xml' };
async function serveStatic(request, response) {
    const pathname = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    if (relative.split(/[\\/]/).some((segment) => segment.startsWith('.') || segment === 'node_modules')) return json(response, 403, { error: '허용되지 않는 경로입니다.' });
    const filePath = path.resolve(root, relative);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) return json(response, 403, { error: '허용되지 않는 경로입니다.' });
    try {
        const stat = await fsp.stat(filePath);
        const target = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
        const data = await fsp.readFile(target);
        response.writeHead(200, { 'Content-Type': contentTypes[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : data);
    } catch (_) { json(response, 404, { error: '파일을 찾을 수 없습니다.' }); }
}

async function handle(request, response) {
    try {
        const pathname = new URL(request.url, `http://${host}`).pathname;
        if (pathname === '/api/local-content/status' && request.method === 'GET') return json(response, 200, { available: true, localOnly: true });
        if (pathname === '/api/local-content/save' && request.method === 'POST') {
            const documentValue = JSON.parse((await readBody(request, 10 * 1024 * 1024)).toString() || '{}');
            return json(response, 200, await enqueueMutation(() => saveSiteContent(documentValue)));
        }
        if (pathname === '/api/local-attachments/status' && request.method === 'GET') return json(response, 200, { available: true, localOnly: true, maxImageBytes: 20*1024*1024, maxPdfBytes: 50*1024*1024 });
        if (pathname === '/api/local-attachments/upload' && request.method === 'POST') return enqueueMutation(() => upload(request, response));
        if (pathname.startsWith('/api/local-attachments/') && request.method === 'POST') {
            const body = JSON.parse((await readBody(request, 1024 * 1024)).toString() || '{}');
            if (pathname.endsWith('/scan')) return json(response, 200, await scan(body));
            if (pathname.endsWith('/trash')) return json(response, 200, await enqueueMutation(() => moveToTrash(body.ids || [], body.referencedAssetIds || [])));
            if (pathname.endsWith('/restore')) return json(response, 200, await enqueueMutation(() => restore(body.ids || [])));
            if (pathname.endsWith('/delete')) return json(response, 200, await enqueueMutation(() => permanentlyDelete(body.ids || [], body.referencedAssetIds || [])));
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: '지원하지 않는 요청입니다.' });
        return serveStatic(request, response);
    } catch (error) { json(response, error.status || 500, { error: error.message || '로컬 저장 처리에 실패했습니다.' }); }
}

async function start() {
    await ensureStorage();
    const server = http.createServer((request, response) => handle(request, response));
    server.listen(port, host, () => console.log(`PlanDY local editor: http://${host}:${port}/`));
    return server;
}

if (require.main === module) start().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { detectMime, collectReferences, collectAssetPaths, isContentDocument, serializePublishedContent, saveSiteContent, start, root, contentDir, trashDir, manifestPath, siteContentPath, siteContentScriptPath };
