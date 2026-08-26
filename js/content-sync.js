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

    async function savePatchedImage(imageId, imageUrl) {
        const response = await fetch(imageUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('카드 이미지를 불러올 수 없습니다.');
        const blob = await response.blob();
        const database = await new Promise((resolve, reject) => {
            const request = indexedDB.open('wms-card-images-v1', 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains('images')) request.result.createObjectStore('images', { keyPath: 'id' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        await new Promise((resolve, reject) => {
            const transaction = database.transaction('images', 'readwrite');
            transaction.objectStore('images').put({ id: imageId, blob });
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }

    async function applyPendingCardPatches() {
        const response = await fetch(`${cardPatchUrl}?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return false;
        const documentValue = await response.json();
        if (!Array.isArray(documentValue?.patches)) return false;

        let changed = false;
        for (const patch of documentValue.patches) {
            if (!patch?.id || localStorage.getItem(`wms-card-patch-applied-v1:${patch.id}`)) continue;
            if (!patch.card || !patch.image) continue;
            // 자동 등록 대상만 만들거나 갱신한다. 다른 메뉴와 카드 행은 그대로 보존한다.
            const state = readStoredValue(storageKeys.customCards) || {};
            const rows = Array.isArray(state[patch.menuId]) ? state[patch.menuId] : (state[patch.menuId] = []);
            while (rows.length <= patch.rowIndex) rows.push({ type: 'single', columnWidths: null, cards: [] });
            const row = rows[patch.rowIndex];
            if (!Array.isArray(row.cards)) row.cards = [];
            const card = row.cards[patch.cardIndex] || {};
            await savePatchedImage(patch.image.id, patch.image.url);
            row.cards[patch.cardIndex] = {
                ...card,
                ...patch.card,
                contentBlocks: [
                    { type: 'image', imageId: patch.image.id },
                    { type: 'table', table: patch.table }
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

    function applyContentDocument(documentValue) {
        if (!isContentDocument(documentValue)) throw new Error('지원하지 않는 콘텐츠 JSON 형식입니다.');
        Object.entries(storageKeys).forEach(([name, key]) => {
            const value = documentValue.storage[name];
            if (value === undefined) localStorage.removeItem(key);
            else localStorage.setItem(key, JSON.stringify(value));
        });
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
            if (hasLocalContent() || localStorage.getItem(appliedMarkerKey)) return;
            const documentValue = await fetchPublishedContent();
            applyContentDocument(documentValue);
            localStorage.setItem(appliedMarkerKey, 'true');
            window.location.reload();
        } catch (_) {
            // file:// 또는 네트워크 오류에서는 기존 화면의 기본 데이터를 그대로 사용합니다.
        }
    }

    function downloadContent() {
        if (!isEditor()) return;
        const blob = new Blob([JSON.stringify(createContentDocument(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'site-content.json';
        link.click();
        URL.revokeObjectURL(url);
        alert('콘텐츠 JSON 파일을 내려받았습니다. 이 파일을 프로젝트의 data/site-content.json에 반영한 뒤 Git에 커밋하고 푸시하면 GitHub Pages에 게시할 수 있습니다.');
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
            if (!confirm('현재 이 브라우저에 저장된 메뉴와 카드 초안을 선택한 JSON으로 바꿉니다. 계속할까요?')) return;
            applyContentDocument(documentValue);
            localStorage.setItem(appliedMarkerKey, 'true');
            window.location.reload();
        } catch (error) {
            alert(error.message || '콘텐츠 JSON을 가져오지 못했습니다.');
        }
    }

    async function restorePublishedContent() {
        if (!isEditor()) return;
        if (!confirm('현재 이 브라우저의 메뉴와 카드 초안을 게시본으로 바꿉니다. 계속할까요?')) return;
        try {
            applyContentDocument(await fetchPublishedContent());
            localStorage.setItem(appliedMarkerKey, 'true');
            window.location.reload();
        } catch (error) {
            alert(error.message || '게시본을 불러오지 못했습니다.');
        }
    }

    window.wmsContentSync = { createContentDocument, applyContentDocument, fetchPublishedContent };

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('contentExportBtn')?.addEventListener('click', downloadContent);
        document.getElementById('contentImportBtn')?.addEventListener('click', requestImport);
        document.getElementById('contentRestoreBtn')?.addEventListener('click', restorePublishedContent);
        applyPendingCardPatches().then((changed) => {
            if (changed) window.location.reload();
        }).catch(() => {});
        document.getElementById('contentImportInput')?.addEventListener('change', (event) => {
            importContent(event.target.files?.[0]);
            event.target.value = '';
        });
    });

    seedEmptyBrowserFromPublishedContent();
}());
