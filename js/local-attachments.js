(function () {
    const apiBase = 'api/local-attachments';
    const storageKeys = [
        'wms-custom-menu-cards-v1', 'wms-overview-cards-v1', 'wms-route-cards-v1',
        'wms-authoring-cards-v1', 'wms-test-menu-cards-v1'
    ];
    const legacyMigrationMarker = 'wms-local-attachment-migration-v1';
    let statusPromise;

    const isEditor = () => window.wmsPermissions?.isEditor?.() === true;
    async function request(path, options = {}) {
        const response = await fetch(`${apiBase}/${path}`, { cache: 'no-store', ...options });
        const value = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(value.error || '로컬 첨부파일 처리에 실패했습니다.');
        return value;
    }
    function status() {
        if (!statusPromise) statusPromise = request('status').catch(() => ({ available: false, localOnly: true }));
        return statusPromise;
    }
    async function upload(file) {
        if (!isEditor()) throw new Error('Editor에서만 첨부파일을 등록할 수 있습니다.');
        if (!(await status()).available) throw new Error('첨부파일 등록은 로컬 편집 환경에서만 사용할 수 있습니다.');
        return (await request('upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name || '첨부파일') },
            body: file
        })).asset;
    }
    async function loadBlob(assetPath) {
        const response = await fetch(assetPath, { cache: 'no-store' });
        if (!response.ok) throw new Error('첨부파일을 찾을 수 없습니다.');
        return response.blob();
    }
    function collectIds(value, result = new Set()) {
        if (!value) return result;
        if (Array.isArray(value)) { value.forEach((item) => collectIds(item, result)); return result; }
        if (typeof value !== 'object') return result;
        Object.entries(value).forEach(([key, child]) => {
            if (key === 'assetId' && typeof child === 'string' && child) result.add(child);
            else collectIds(child, result);
        });
        return result;
    }
    function collectPaths(value, result = new Set()) {
        if (!value) return result;
        if (Array.isArray(value)) { value.forEach((item) => collectPaths(item, result)); return result; }
        if (typeof value !== 'object') return result;
        Object.entries(value).forEach(([key, child]) => {
            if (key === 'assetPath' && typeof child === 'string' && child) result.add(child);
            else collectPaths(child, result);
        });
        return result;
    }
    function getReferencedAssetIds() {
        const result = new Set();
        storageKeys.forEach((key) => {
            try { collectIds(JSON.parse(localStorage.getItem(key) || 'null'), result); } catch (_) {}
        });
        return [...result];
    }
    async function configureFileInput(input, message) {
        const available = (await status()).available;
        input.disabled = !available;
        if (!available && message) message.textContent = '첨부파일 등록은 로컬 편집 환경에서만 사용할 수 있습니다.';
        return available;
    }
    async function validateAssetReferences(documentValue) {
        const ids = [...collectIds(documentValue)];
        const paths = [...collectPaths(documentValue)];
        if ((await status()).available) {
            const value = await request('scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ referencedAssetIds: ids }) });
            if (value.missingReferencedIds?.length) throw new Error(`연결된 첨부파일 ${value.missingReferencedIds.length}개를 프로젝트에서 찾을 수 없습니다. 첨부파일 관리에서 확인해 주세요.`);
            return value;
        }
        const missingPaths = [];
        for (const assetPath of paths) {
            try { if (!(await fetch(assetPath, { method: 'HEAD', cache: 'no-store' })).ok) missingPaths.push(assetPath); }
            catch (_) { missingPaths.push(assetPath); }
        }
        if (missingPaths.length) throw new Error(`연결된 첨부파일 ${missingPaths.length}개를 게시 사이트에서 찾을 수 없습니다.`);
        return { missingReferencedIds: [], missingPaths };
    }
    function assetFields(asset) {
        return {
            assetId: asset.assetId || asset.id,
            assetPath: asset.assetPath || asset.path,
            originalName: asset.originalName || '',
            mimeType: asset.mimeType || '',
            size: Number(asset.size) || 0
        };
    }
    function migrateCard(card, legacyMap) {
        if (!card || !Array.isArray(card.contentBlocks)) return 0;
        let changed = 0;
        card.contentBlocks = card.contentBlocks.map((block) => {
            if (!block || typeof block !== 'object') return block;
            if (block.type === 'image' && block.imageId && !block.assetPath) {
                const mapped = legacyMap.byLegacyId?.[block.imageId] || legacyMap.byCardTitle?.[card.title];
                if (mapped) {
                    const { imageId, ...rest } = block;
                    changed += 1;
                    return { ...rest, ...assetFields(mapped) };
                }
            }
            if (block.type === 'table' && block.table?.thumbnailImageIds) {
                const ids = block.table.thumbnailImageIds;
                const assets = ids.map((id) => id ? legacyMap.byLegacyId?.[id] || null : null);
                if (assets.some(Boolean)) {
                    const allMapped = ids.every((id, index) => !id || assets[index]);
                    block = { ...block, table: { ...block.table, thumbnailAssets: assets.map((asset) => asset ? assetFields(asset) : null) } };
                    if (allMapped) delete block.table.thumbnailImageIds;
                    changed += assets.filter(Boolean).length;
                }
            }
            return block;
        });
        return changed;
    }
    function migrateRows(rows, legacyMap) {
        let changed = 0;
        for (const row of Array.isArray(rows) ? rows : []) for (const card of Array.isArray(row?.cards) ? row.cards : []) changed += migrateCard(card, legacyMap);
        return changed;
    }
    async function migrateKnownLegacyReferences(force = false) {
        if (!isEditor() || !(await status()).available) return { changed: 0, skipped: true };
        const response = await fetch(`data/legacy-asset-map.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return { changed: 0, skipped: true };
        const legacyMap = await response.json();
        if (!force && localStorage.getItem(legacyMigrationMarker) === String(legacyMap.version)) return { changed: 0, skipped: true };
        let changed = 0;
        let menuSettings = null;
        try { menuSettings = JSON.parse(localStorage.getItem('wms-sidebar-menu-settings-v1') || 'null'); } catch (_) {}
        const activeCustomIds = new Set((menuSettings?.menus || []).filter((menu) => menu?.visible !== false).map((menu) => menu.id));
        const deletedBuiltins = new Set(menuSettings?.deletedBuiltinIds || []);
        try {
            const customCards = JSON.parse(localStorage.getItem('wms-custom-menu-cards-v1') || 'null');
            if (customCards && typeof customCards === 'object') {
                for (const [menuId, rows] of Object.entries(customCards)) if (activeCustomIds.has(menuId)) changed += migrateRows(rows, legacyMap);
                if (changed) localStorage.setItem('wms-custom-menu-cards-v1', JSON.stringify(customCards));
            }
        } catch (_) {}
        const builtinStores = [
            ['overview', 'wms-overview-cards-v1'], ['route', 'wms-route-cards-v1'],
            ['authoring', 'wms-authoring-cards-v1'], ['test', 'wms-test-menu-cards-v1']
        ];
        for (const [menuId, key] of builtinStores) {
            if (deletedBuiltins.has(menuId)) continue;
            try {
                const rows = JSON.parse(localStorage.getItem(key) || 'null');
                const storeChanges = migrateRows(rows, legacyMap);
                if (storeChanges) localStorage.setItem(key, JSON.stringify(rows));
                changed += storeChanges;
            } catch (_) {}
        }
        localStorage.setItem(legacyMigrationMarker, String(legacyMap.version));
        return { changed, skipped: false };
    }
    function formatBytes(value) {
        const bytes = Number(value) || 0;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    }
    async function postAction(action, ids) {
        if (!isEditor()) return;
        return request(action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, referencedAssetIds: getReferencedAssetIds() }) });
    }
    function createManager() {
        document.querySelector('.attachment-manager-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.className = 'attachment-manager-overlay';
        overlay.innerHTML = `<section class="attachment-manager-dialog" role="dialog" aria-modal="true" aria-labelledby="attachmentManagerTitle">
            <header><div><h2 id="attachmentManagerTitle">첨부파일 관리</h2><p>카드에서 사용하지 않는 파일을 확인한 뒤 휴지통으로 이동합니다.</p></div><button type="button" data-action="close" aria-label="닫기">×</button></header>
            <div class="attachment-manager-summary">검사 중입니다.</div>
            <div class="attachment-manager-tools"><select aria-label="상태 필터"><option value="all">전체</option><option value="unused">미사용</option><option value="used">사용 중</option><option value="trash">휴지통</option></select><button type="button" data-action="migrate">기존 이미지 연결</button><button type="button" data-action="refresh">다시 검사</button><button type="button" data-action="trash-unused">미사용 최대 100개 휴지통 이동</button></div>
            <div class="attachment-manager-list"></div>
            <footer><button type="button" data-action="close">확인</button></footer>
        </section>`;
        document.body.appendChild(overlay);
        const list = overlay.querySelector('.attachment-manager-list');
        const summary = overlay.querySelector('.attachment-manager-summary');
        const filter = overlay.querySelector('select');
        let scanValue = { assets: [], summary: {} };
        const close = () => overlay.remove();
        const render = () => {
            const value = scanValue.summary;
            const missingText = scanValue.missingReferencedIds?.length ? ` · 누락 ${scanValue.missingReferencedIds.length}개` : '';
            summary.textContent = `전체 ${value.total || 0}개 · 사용 중 ${value.used || 0}개 · 미사용 ${value.unused || 0}개 · 휴지통 ${value.trash || 0}개${missingText}`;
            const assets = scanValue.assets.filter((asset) => filter.value === 'all'
                || (filter.value === 'trash' ? asset.status === 'trash' : filter.value === 'used' ? asset.status !== 'trash' && asset.referenced : asset.status !== 'trash' && !asset.referenced));
            assets.sort((a, b) => Number(b.size) - Number(a.size));
            list.replaceChildren();
            if (!assets.length) { const empty = document.createElement('p'); empty.textContent = '표시할 첨부파일이 없습니다.'; list.appendChild(empty); return; }
            assets.slice(0, 100).forEach((asset) => {
                const row = document.createElement('article'); row.className = 'attachment-manager-row';
                const info = document.createElement('div');
                const name = document.createElement('strong'); name.textContent = asset.originalName || asset.id;
                const meta = document.createElement('span'); meta.textContent = `${asset.mimeType} · ${formatBytes(asset.size)} · ${asset.status === 'trash' ? '휴지통' : asset.referenced ? '사용 중' : '미사용'}`;
                info.append(name, meta); row.appendChild(info);
                const actions = document.createElement('div');
                if (asset.status === 'trash') {
                    const restoreButton = document.createElement('button'); restoreButton.type='button'; restoreButton.textContent='복구'; restoreButton.addEventListener('click', async()=>{ await postAction('restore',[asset.id]); await refresh(); });
                    const deleteButton = document.createElement('button'); deleteButton.type='button'; deleteButton.textContent='영구 삭제'; deleteButton.className='danger'; deleteButton.addEventListener('click', async()=>{ if (prompt('영구 삭제하려면 “영구 삭제”를 입력하세요.') !== '영구 삭제') return; await postAction('delete',[asset.id]); await refresh(); });
                    actions.append(restoreButton, deleteButton);
                } else if (!asset.referenced) {
                    const trashButton = document.createElement('button'); trashButton.type='button'; trashButton.textContent='휴지통'; trashButton.addEventListener('click', async()=>{ await postAction('trash',[asset.id]); await refresh(); }); actions.appendChild(trashButton);
                }
                row.appendChild(actions); list.appendChild(row);
            });
        };
        const refresh = async () => {
            try { scanValue = await request('scan', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ referencedAssetIds:getReferencedAssetIds() }) }); render(); }
            catch (error) { summary.textContent = error.message; list.replaceChildren(); }
        };
        overlay.querySelectorAll('[data-action="close"]').forEach((button) => button.addEventListener('click', close));
        overlay.querySelector('[data-action="refresh"]').addEventListener('click', refresh);
        overlay.querySelector('[data-action="migrate"]').addEventListener('click', async () => {
            const result = await migrateKnownLegacyReferences(true);
            if (result.changed) { alert(`기존 이미지 참조 ${result.changed}개를 새 경로로 연결했습니다.`); window.location.reload(); }
            else alert('연결할 기존 이미지 참조가 없습니다.');
        });
        overlay.querySelector('[data-action="trash-unused"]').addEventListener('click', async () => {
            const ids = scanValue.assets.filter((asset) => asset.status !== 'trash' && !asset.referenced).slice(0,100).map((asset)=>asset.id);
            if (!ids.length) return alert('미사용 첨부파일이 없습니다.');
            if (!confirm(`미사용 첨부파일 ${ids.length}개를 휴지통으로 이동할까요?`)) return;
            await postAction('trash', ids); await refresh();
        });
        filter.addEventListener('change', render);
        overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
        refresh();
    }
    document.addEventListener('DOMContentLoaded', async () => {
        const button = document.getElementById('attachmentManagerBtn');
        if (!button) return;
        const available = (await status()).available;
        button.disabled = !available;
        button.title = available ? '로컬 첨부파일 검사 및 정리' : '첨부파일 관리는 로컬 편집 환경에서만 사용할 수 있습니다.';
        button.addEventListener('click', async () => { if (isEditor() && available) { await migrateKnownLegacyReferences(); createManager(); } });
        if (available && isEditor()) {
            const result = await migrateKnownLegacyReferences();
            if (result.changed) window.location.reload();
        }
    });
    window.wmsLocalAttachments = Object.freeze({ status, upload, loadBlob, configureFileInput, getReferencedAssetIds, validateAssetReferences, migrateKnownLegacyReferences });
}());
