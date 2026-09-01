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
    const projectContentApi = 'api/local-content';
    let projectStatusPromise;
    let projectSaveTimer;
    let projectSaveQueue = Promise.resolve();
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
        if (window.location.protocol === 'file:') return false;
        const response = await fetch(`${cardPatchUrl}?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return false;
        const documentValue = await response.json();
        if (!Array.isArray(documentValue?.patches)) return false;

        let changed = false;
        for (const patch of documentValue.patches) {
            if (!patch?.id || localStorage.getItem(`wms-card-patch-applied-v1:${patch.id}`)) continue;
            const images = Array.isArray(patch.images) ? patch.images : (patch.image ? [patch.image] : []);
            const tableSource = patch.table || documentValue.patches.find((candidate) => candidate?.id === patch.tableTemplateId)?.table;
            const explicitBlocks = Array.isArray(patch.card?.contentBlocks) ? patch.card.contentBlocks : null;
            if (!patch.card || (explicitBlocks === null && (images.length === 0 || !tableSource))) continue;
            // 자동 등록 대상만 만들거나 갱신한다. 다른 메뉴와 카드 행은 그대로 보존한다.
            const state = readStoredValue(storageKeys.customCards) || {};
            // 빈 브라우저는 게시 콘텐츠를 먼저 불러와야 하므로 아직 없는 메뉴에는 패치를 적용하지 않는다.
            if (!Array.isArray(state[patch.menuId])) continue;
            const rows = state[patch.menuId];
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
                contentBlocks: explicitBlocks || [
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

    async function requestProjectContent(path, options = {}) {
        const response = await fetch(`${projectContentApi}/${path}`, { cache: 'no-store', ...options });
        const value = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(value.error || '프로젝트 콘텐츠 저장에 실패했습니다.');
        return value;
    }

    async function getProjectSaveStatus() {
        if (!/^https?:$/.test(window.location.protocol)) return { available: false, localOnly: true };
        if (!projectStatusPromise) {
            projectStatusPromise = requestProjectContent('status').catch(() => ({ available: false, localOnly: true }));
        }
        return projectStatusPromise;
    }

    function setProjectSaveStatus(message, state = '') {
        const element = document.getElementById('contentProjectSaveStatus');
        if (!element) return;
        element.textContent = message;
        element.dataset.state = state;
    }

    async function saveProjectContent() {
        if (!isEditor()) throw new Error('Editor에서만 프로젝트 콘텐츠를 저장할 수 있습니다.');
        if (!(await getProjectSaveStatus()).available) throw new Error('프로젝트 자동 저장은 start-local-editor.cmd로 연 로컬 화면에서만 사용할 수 있습니다.');
        setProjectSaveStatus('프로젝트에 저장 중…', 'saving');
        const documentValue = createContentDocument();
        await window.wmsLocalAttachments?.validateAssetReferences(documentValue);
        const result = await requestProjectContent('save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(documentValue)
        });
        localStorage.setItem(appliedMarkerKey, String(result.updatedAt || documentValue.updatedAt));
        const time = new Date(result.updatedAt || Date.now()).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setProjectSaveStatus(`프로젝트 저장 완료 · ${time}`, 'saved');
        return result;
    }

    function queueProjectSave(showAlert = false) {
        const pending = projectSaveQueue.catch(() => {}).then(() => saveProjectContent());
        projectSaveQueue = pending;
        pending.catch((error) => {
            setProjectSaveStatus(error.message || '프로젝트 자동 저장에 실패했습니다.', 'error');
            if (showAlert) alert(error.message || '프로젝트 콘텐츠를 저장하지 못했습니다.');
        });
        return pending;
    }

    function scheduleProjectSave() {
        if (!isEditor()) return;
        clearTimeout(projectSaveTimer);
        setProjectSaveStatus('변경 사항 저장 대기…', 'saving');
        projectSaveTimer = setTimeout(() => queueProjectSave(false), 300);
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
        if (window.location.protocol === 'file:' && isContentDocument(window.WMS_PUBLISHED_CONTENT)) {
            return window.WMS_PUBLISHED_CONTENT;
        }
        const response = await fetch(`${contentUrl}?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('게시용 콘텐츠 파일을 찾을 수 없습니다.');
        const documentValue = await response.json();
        if (!isContentDocument(documentValue)) throw new Error('게시용 콘텐츠 파일 형식이 올바르지 않습니다.');
        return documentValue;
    }

    async function seedEmptyBrowserFromPublishedContent() {
        try {
            const isFileMode = window.location.protocol === 'file:';
            if (!isFileMode && (hasLocalContent() || localStorage.getItem(appliedMarkerKey))) return false;
            const documentValue = await fetchPublishedContent();
            const publishedVersion = String(documentValue.updatedAt || documentValue.schemaVersion || '1');
            if (isFileMode && hasLocalContent() && localStorage.getItem(appliedMarkerKey) === publishedVersion) return false;
            applyContentDocument(documentValue);
            localStorage.setItem(appliedMarkerKey, publishedVersion);
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
            const documentValue = createContentDocument();
            await window.wmsLocalAttachments?.validateAssetReferences(documentValue);
            const blob = new Blob([JSON.stringify(documentValue, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'site-content.json';
            link.click();
            URL.revokeObjectURL(url);
            alert('콘텐츠 JSON 파일을 내려받았습니다. data/site-content.json과 assets/content, data/attachments.json을 함께 Git에 커밋·푸시해야 첨부파일까지 게시됩니다.');
        } catch (error) {
            alert(error.message || '첨부파일 확인 중 콘텐츠 JSON을 내보내지 못했습니다.');
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
            await window.wmsLocalAttachments?.validateAssetReferences(documentValue);
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

    window.wmsContentSync = { createContentDocument, applyContentDocument, fetchPublishedContent, saveProjectContent, scheduleProjectSave };

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('contentExportBtn')?.addEventListener('click', downloadContent);
        document.getElementById('contentImportBtn')?.addEventListener('click', requestImport);
        document.getElementById('contentRestoreBtn')?.addEventListener('click', restorePublishedContent);
        const projectSaveButton = document.getElementById('contentProjectSaveBtn');
        projectSaveButton?.addEventListener('click', () => queueProjectSave(true));
        getProjectSaveStatus().then((value) => {
            if (projectSaveButton) projectSaveButton.disabled = !value.available;
            setProjectSaveStatus(value.available
                ? '카드·메뉴 등록 시 프로젝트에 자동 저장됩니다.'
                : '로컬 편집기로 실행하면 프로젝트 자동 저장을 사용할 수 있습니다.', value.available ? 'ready' : 'unavailable');
        });
        applyPendingCardPatches().catch(() => false).then(async (changed) => {
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
