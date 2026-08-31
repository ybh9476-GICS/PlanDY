(function () {
    const contentUrl = 'data/site-content.json';
    const cardPatchUrl = 'data/card-patches.json';
    const appliedMarkerKey = 'wms-published-content-applied-v1';
    const storageKeys = {
        menus: 'wms-sidebar-menu-settings-v1',
        customCards: 'wms-custom-menu-cards-v1',
        overviewCards: 'wms-overview-cards-v1',
        routeCards: 'wms-route-cards-v1',
        authoringCards: 'wms-authoring-cards-v1',
        testCards: 'wms-test-menu-cards-v1'
    };
    const assetSourceStorageKey = 'wms-content-asset-sources-v1';
    const imageDatabaseName = 'wms-card-images-v1';
    const imageStoreName = 'images';
    let imageDatabasePromise = null;
    let resolveCardPatchReady;
    let cardPatchReadySettled = false;
    window.wmsCardPatchReady = new Promise((resolve) => {
        resolveCardPatchReady = resolve;
    });

    function finishCardPatchReady() {
        if (cardPatchReadySettled) return;
        cardPatchReadySettled = true;
        resolveCardPatchReady();
    }

    function getImageDatabase() {
        if (imageDatabasePromise) return imageDatabasePromise;
        imageDatabasePromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(imageDatabaseName, 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(imageStoreName)) request.result.createObjectStore(imageStoreName, { keyPath: 'id' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return imageDatabasePromise;
    }

    async function saveStoredAsset(id, blob) {
        const database = await getImageDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(imageStoreName, 'readwrite');
            transaction.objectStore(imageStoreName).put({ id, blob });
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }

    async function loadStoredAsset(id) {
        const database = await getImageDatabase();
        return new Promise((resolve, reject) => {
            const request = database.transaction(imageStoreName, 'readonly').objectStore(imageStoreName).get(id);
            request.onsuccess = () => resolve(request.result?.blob || null);
            request.onerror = () => reject(request.error);
        });
    }

    function readAssetSources() {
        try {
            const value = JSON.parse(localStorage.getItem(assetSourceStorageKey) || '{}');
            return value && typeof value === 'object' ? value : {};
        } catch (_) {
            return {};
        }
    }

    function rememberAssetSource(imageId, imageUrl) {
        if (!imageId || !imageUrl) return;
        const sources = readAssetSources();
        sources[imageId] = imageUrl;
        localStorage.setItem(assetSourceStorageKey, JSON.stringify(sources));
    }

    async function savePatchedImage(imageId, imageUrl) {
        const response = await fetch(imageUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('카드 이미지를 불러올 수 없습니다.');
        const blob = await response.blob();
        await saveStoredAsset(imageId, blob);
        rememberAssetSource(imageId, imageUrl);
    }

    async function applyPendingCardPatches() {
        const response = await fetch(`${cardPatchUrl}?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return false;
        const documentValue = await response.json();
        if (!Array.isArray(documentValue?.patches)) return false;

        let changed = false;
        for (const patch of documentValue.patches) {
            if (!patch?.id || localStorage.getItem(`wms-card-patch-applied-v1:${patch.id}`)) continue;
            const images = Array.isArray(patch.images) ? patch.images : (patch.image ? [patch.image] : []);
            const tableSource = patch.table || documentValue.patches.find((candidate) => candidate?.id === patch.tableTemplateId)?.table;
            if (!patch.card || images.length === 0 || !tableSource) continue;
            // 자동 등록 대상만 만들거나 갱신한다. 다른 메뉴와 카드 행은 그대로 보존한다.
            const state = readStoredValue(storageKeys.customCards) || {};
            const rows = Array.isArray(state[patch.menuId]) ? state[patch.menuId] : (state[patch.menuId] = []);
            for (const generatedCard of patch.cleanupGeneratedCards || []) {
                for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
                    const rowCards = rows[rowIndex]?.cards;
                    if (!Array.isArray(rowCards)) continue;
                    for (let cardIndex = rowCards.length - 1; cardIndex >= 0; cardIndex -= 1) {
                        const candidate = rowCards[cardIndex];
                        if (candidate?.title !== generatedCard.title || candidate?.description !== generatedCard.description) continue;
                        rowCards.splice(cardIndex, 1);
                    }
                    if (rowCards.length === 0) rows.splice(rowIndex, 1);
                    else if (rowCards.length === 1) rows[rowIndex].type = 'single';
                }
            }
            for (const cleanupTarget of patch.cleanupTargets || []) {
                const cleanupRow = rows[cleanupTarget?.rowIndex];
                const cleanupCard = cleanupRow?.cards?.[cleanupTarget?.cardIndex];
                if (cleanupCard?.title !== cleanupTarget?.title) continue;
                cleanupRow.cards.splice(cleanupTarget.cardIndex, 1);
                if (cleanupRow.cards.length === 0) rows.splice(cleanupTarget.rowIndex, 1);
                else if (cleanupRow.cards.length === 1) cleanupRow.type = 'single';
            }
            let targetRowIndex = patch.rowIndex;
            let targetCardIndex = patch.cardIndex;
            if (Number.isInteger(patch.readingIndex) && patch.readingIndex >= 0) {
                let remaining = patch.readingIndex;
                for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
                    const cards = rows[rowIndex]?.cards;
                    if (!Array.isArray(cards)) continue;
                    if (remaining < cards.length) {
                        targetRowIndex = rowIndex;
                        targetCardIndex = remaining;
                        break;
                    }
                    remaining -= cards.length;
                }
            }
            while (rows.length <= targetRowIndex) rows.push({ type: 'single', columnWidths: null, cards: [] });
            const row = rows[targetRowIndex];
            if (!Array.isArray(row.cards)) row.cards = [];
            const card = row.cards[targetCardIndex] || {};
            for (const image of images) {
                if (!image?.id || !image?.url) continue;
                await savePatchedImage(image.id, image.url);
            }
            row.cards[targetCardIndex] = {
                ...card,
                ...patch.card,
                contentBlocks: [
                    ...(patch.showImageBlocks === false ? [] : images.map((image) => ({ type: 'image', imageId: image.id }))),
                    {
                        type: 'table',
                        table: {
                            ...tableSource,
                            ...(Array.isArray(patch.thumbnailImageIds) ? {
                                thumbnailColumn: Number(patch.thumbnailColumn),
                                thumbnailImageIds: patch.thumbnailImageIds
                            } : {})
                        }
                    }
                ]
            };
            localStorage.setItem(storageKeys.customCards, JSON.stringify(state));
            localStorage.setItem(`wms-card-patch-applied-v1:${patch.id}`, 'true');
            changed = true;
        }
        return changed;
    }

    const isEditor = () => window.wmsPermissions?.isEditor?.() === true;
    const isContentDocument = (value) => Boolean(value)
        && value.schemaVersion === 1
        && value.storage
        && typeof value.storage === 'object';

    function readStoredValue(key) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? undefined : JSON.parse(value);
        } catch (_) {
            return undefined;
        }
    }

    function collectReferencedAssetIds(value, result = new Set()) {
        if (!value || typeof value !== 'object') return result;
        if (Array.isArray(value)) {
            value.forEach((item) => collectReferencedAssetIds(item, result));
            return result;
        }
        Object.entries(value).forEach(([key, child]) => {
            if ((key === 'imageId' || key === 'pdfId') && typeof child === 'string' && child) {
                result.add(child);
                return;
            }
            if (key === 'thumbnailImageIds' && Array.isArray(child)) {
                child.forEach((id) => { if (typeof id === 'string' && id) result.add(id); });
                return;
            }
            collectReferencedAssetIds(child, result);
        });
        return result;
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    function getPortableAssets(documentValue) {
        if (!Array.isArray(documentValue?.assets)) return [];
        return documentValue.assets.filter((asset) => asset
            && typeof asset.id === 'string'
            && asset.id
            && (typeof asset.url === 'string' || typeof asset.dataUrl === 'string'));
    }

    async function inspectContentAssets(documentValue) {
        const referencedIds = [...collectReferencedAssetIds(documentValue.storage)];
        const packagedIds = new Set(getPortableAssets(documentValue).map((asset) => asset.id));
        const missingIds = [];
        for (const id of referencedIds) {
            if (packagedIds.has(id)) continue;
            if (!await loadStoredAsset(id)) missingIds.push(id);
        }
        return { referencedIds, missingIds };
    }

    async function restoreContentAssets(documentValue) {
        const fetchedBlobs = new Map();
        for (const asset of getPortableAssets(documentValue)) {
            if (await loadStoredAsset(asset.id)) {
                if (typeof asset.url === 'string') rememberAssetSource(asset.id, asset.url);
                continue;
            }
            let response;
            let sourceKey = '';
            if (typeof asset.dataUrl === 'string') {
                if (!/^data:(image\/|application\/pdf)/i.test(asset.dataUrl)) throw new Error(`지원하지 않는 파일 형식입니다: ${asset.id}`);
                response = await fetch(asset.dataUrl);
            } else {
                const resolvedUrl = new URL(asset.url, document.baseURI);
                if (!['http:', 'https:'].includes(resolvedUrl.protocol) || resolvedUrl.origin !== window.location.origin) {
                    throw new Error(`같은 사이트의 이미지 경로만 사용할 수 있습니다: ${asset.id}`);
                }
                sourceKey = resolvedUrl.href;
                if (!fetchedBlobs.has(sourceKey)) response = await fetch(sourceKey, { cache: 'no-store' });
            }
            if (response && !response.ok) throw new Error(`이미지 또는 문서 파일을 불러오지 못했습니다: ${asset.id}`);
            const blob = sourceKey && fetchedBlobs.has(sourceKey) ? fetchedBlobs.get(sourceKey) : await response.blob();
            if (sourceKey) fetchedBlobs.set(sourceKey, blob);
            await saveStoredAsset(asset.id, blob);
            if (typeof asset.url === 'string') rememberAssetSource(asset.id, asset.url);
        }
    }

    function createContentDocument() {
        const storage = {};
        Object.entries(storageKeys).forEach(([name, key]) => {
            storage[name] = readStoredValue(key);
        });
        return {
            schemaVersion: 1,
            updatedAt: new Date().toISOString(),
            storage
        };
    }

    async function createPortableContentDocument() {
        const documentValue = createContentDocument();
        const sources = readAssetSources();
        const assets = [];
        const missingAssetIds = [];
        for (const id of collectReferencedAssetIds(documentValue.storage)) {
            const blob = await loadStoredAsset(id);
            if (!blob) {
                missingAssetIds.push(id);
                continue;
            }
            const sourceUrl = typeof sources[id] === 'string' ? sources[id] : '';
            const asset = {
                id,
                kind: blob.type === 'application/pdf' ? 'pdf' : 'image',
                mimeType: blob.type || 'application/octet-stream'
            };
            if (sourceUrl) asset.url = sourceUrl;
            else asset.dataUrl = await blobToDataUrl(blob);
            assets.push(asset);
        }
        documentValue.assets = assets;
        if (missingAssetIds.length) documentValue.missingAssetIds = missingAssetIds;
        return documentValue;
    }

    function applyContentDocument(documentValue) {
        if (!isContentDocument(documentValue)) throw new Error('지원하지 않는 콘텐츠 JSON 형식입니다.');
        Object.entries(storageKeys).forEach(([name, key]) => {
            const value = documentValue.storage[name];
            if (value === undefined) localStorage.removeItem(key);
            else localStorage.setItem(key, JSON.stringify(value));
        });
    }

    async function applyPortableContentDocument(documentValue) {
        await restoreContentAssets(documentValue);
        applyContentDocument(documentValue);
    }

    function confirmMissingAssets(missingIds, actionLabel) {
        if (!missingIds.length) return true;
        return confirm(`이미지 또는 PDF ${missingIds.length}개가 이 JSON과 현재 브라우저 저장소에 없습니다. ${actionLabel}하면 해당 파일은 표시되지 않습니다. 계속할까요?`);
    }

    function hasLocalContent() {
        return Object.values(storageKeys).some((key) => localStorage.getItem(key) !== null);
    }

    async function fetchPublishedContent() {
        const response = await fetch(`${contentUrl}?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('게시용 콘텐츠 파일을 찾을 수 없습니다.');
        const documentValue = await response.json();
        if (!isContentDocument(documentValue)) throw new Error('게시용 콘텐츠 파일 형식이 올바르지 않습니다.');
        return documentValue;
    }

    async function seedEmptyBrowserFromPublishedContent() {
        try {
            const shouldSeedContent = !hasLocalContent() && !localStorage.getItem(appliedMarkerKey);
            const documentValue = await fetchPublishedContent();
            const inspection = await inspectContentAssets(documentValue);
            if (inspection.missingIds.length) console.warn('게시본에서 찾을 수 없는 이미지 또는 PDF가 있습니다.', inspection.missingIds);
            await restoreContentAssets(documentValue);
            if (!shouldSeedContent) return false;
            applyContentDocument(documentValue);
            localStorage.setItem(appliedMarkerKey, 'true');
            window.location.reload();
            return true;
        } catch (_) {
            // file:// 또는 네트워크 오류에서는 기존 화면의 기본 데이터를 그대로 사용합니다.
            return false;
        }
    }

    async function downloadContent() {
        if (!isEditor()) return;
        try {
            const documentValue = await createPortableContentDocument();
            if (!isEditor()) return;
            if (!confirmMissingAssets(documentValue.missingAssetIds || [], '내보내기')) return;
            const blob = new Blob([JSON.stringify(documentValue, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'site-content.json';
            link.click();
            URL.revokeObjectURL(url);
            alert('이미지와 PDF를 포함한 콘텐츠 JSON 파일을 내려받았습니다. 이 파일을 프로젝트의 data/site-content.json에 반영한 뒤 Git에 커밋하고 푸시하면 게시할 수 있습니다.');
        } catch (error) {
            alert(error.message || '콘텐츠 JSON을 내보내지 못했습니다.');
        }
    }

    function requestImport() {
        if (!isEditor()) return;
        document.getElementById('contentImportInput')?.click();
    }

    async function importContent(file) {
        if (!isEditor() || !file) return;
        try {
            const documentValue = JSON.parse(await file.text());
            if (!isContentDocument(documentValue)) throw new Error('지원하지 않는 콘텐츠 JSON 형식입니다.');
            const inspection = await inspectContentAssets(documentValue);
            if (!isEditor()) return;
            if (!confirmMissingAssets(inspection.missingIds, '가져오기')) return;
            if (!confirm('현재 이 브라우저에 저장된 메뉴와 카드 초안을 선택한 JSON으로 바꿉니다. 계속할까요?')) return;
            if (!isEditor()) return;
            await applyPortableContentDocument(documentValue);
            localStorage.setItem(appliedMarkerKey, 'true');
            window.location.reload();
        } catch (error) {
            alert(error.message || '콘텐츠 JSON을 가져오지 못했습니다.');
        }
    }

    async function restorePublishedContent() {
        if (!isEditor()) return;
        try {
            const documentValue = await fetchPublishedContent();
            const inspection = await inspectContentAssets(documentValue);
            if (!isEditor()) return;
            if (!confirmMissingAssets(inspection.missingIds, '게시본 불러오기')) return;
            if (!confirm('현재 이 브라우저의 메뉴와 카드 초안을 게시본으로 바꿉니다. 계속할까요?')) return;
            if (!isEditor()) return;
            await applyPortableContentDocument(documentValue);
            localStorage.setItem(appliedMarkerKey, 'true');
            window.location.reload();
        } catch (error) {
            alert(error.message || '게시본을 불러오지 못했습니다.');
        }
    }

    window.wmsContentSync = {
        createContentDocument,
        createPortableContentDocument,
        applyContentDocument,
        applyPortableContentDocument,
        fetchPublishedContent,
        inspectContentAssets
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('contentExportBtn')?.addEventListener('click', downloadContent);
        document.getElementById('contentImportBtn')?.addEventListener('click', requestImport);
        document.getElementById('contentRestoreBtn')?.addEventListener('click', restorePublishedContent);
        applyPendingCardPatches().then(async (changed) => {
            if (changed) {
                window.location.reload();
                return;
            }
            const seeded = await seedEmptyBrowserFromPublishedContent();
            if (!seeded) finishCardPatchReady();
        }).catch(() => finishCardPatchReady());
        document.getElementById('contentImportInput')?.addEventListener('change', (event) => {
            importContent(event.target.files?.[0]);
            event.target.value = '';
        });
    });

}());
