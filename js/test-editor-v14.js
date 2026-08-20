// Shared card editor. Each menu receives an isolated instance and data store.
(function () {
    const imageDatabaseName = 'wms-card-images-v1';
    const imageStoreName = 'images';
    let imageDatabasePromise = null;
    let pdfJsPromise = null;

    function getPdfJs() {
        if (!pdfJsPromise) {
            pdfJsPromise = import('../assets/vendor/pdfjs/pdf.min.js').then((pdfjs) => {
                pdfjs.GlobalWorkerOptions.workerSrc = new URL('../assets/vendor/pdfjs/pdf.worker.min.js', document.baseURI).href;
                return pdfjs;
            });
        }
        return pdfJsPromise;
    }

    function parseGoogleDriveDocumentUrl(value) {
        try {
            const url = new URL(String(value || '').trim());
            const host = url.hostname.toLowerCase();
            if (!['docs.google.com', 'drive.google.com'].includes(host)) return null;
            const paths = [
                ['document', 'Docs'],
                ['spreadsheets', 'Sheets'],
                ['presentation', 'Slides']
            ];
            for (const [path, label] of paths) {
                const match = new RegExp(`^/${path}/d/([^/?#]+)`).exec(url.pathname);
                if (match) return { documentType: path, documentLabel: label, documentId: match[1], url: url.href };
            }
            const fileMatch = /^\/file\/d\/([^/?#]+)/.exec(url.pathname);
            const documentId = fileMatch?.[1] || url.searchParams.get('id');
            return documentId ? { documentType: 'file', documentLabel: 'Drive 파일', documentId, url: url.href } : null;
        } catch (_) {
            return null;
        }
    }

    function getGoogleDrivePreviewUrl(block) {
        if (block.documentType === 'file') return `https://drive.google.com/file/d/${encodeURIComponent(block.documentId)}/preview`;
        return `https://docs.google.com/${block.documentType}/d/${encodeURIComponent(block.documentId)}/preview`;
    }

    function getGoogleDriveThumbnailUrl(block) {
        return `https://drive.google.com/thumbnail?id=${encodeURIComponent(block.documentId)}&sz=w1000`;
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

    async function saveImageBlob(id, blob) {
        const database = await getImageDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(imageStoreName, 'readwrite');
            transaction.objectStore(imageStoreName).put({ id, blob });
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }

    async function loadImageBlob(id) {
        const database = await getImageDatabase();
        return new Promise((resolve, reject) => {
            const request = database.transaction(imageStoreName, 'readonly').objectStore(imageStoreName).get(id);
            request.onsuccess = () => resolve(request.result?.blob || null);
            request.onerror = () => reject(request.error);
        });
    }

    async function removeImageBlob(id) {
        if (!id) return;
        const database = await getImageDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(imageStoreName, 'readwrite');
            transaction.objectStore(imageStoreName).delete(id);
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }

    function createImageId() {
        return crypto.randomUUID ? crypto.randomUUID() : `card-image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    async function migrateLegacyCardImages(rows) {
        let migrated = false;
        for (const row of rows) {
            for (const card of row.cards || []) {
                if (!card.image || card.imageId || !card.image.startsWith('data:image/')) continue;
                const response = await fetch(card.image);
                const imageId = createImageId();
                await saveImageBlob(imageId, await response.blob());
                card.imageId = imageId;
                delete card.image;
                migrated = true;
            }
        }
        return migrated;
    }

    function migrateLegacyCardsToStructuredContent(rows) {
        let migrated = false;
        rows.forEach((row) => {
            (row.cards || []).forEach((card) => {
                const savedBlocks = Array.isArray(card.contentBlocks) ? card.contentBlocks : [];
                if (savedBlocks.length) return;
                const blocks = [];
                const addBodyBlock = (body, html, bodyType, table) => {
                    if (bodyType === 'table' && table) blocks.push({ type: 'table', table });
                    else if (body || html) blocks.push({ type: bodyType === 'text2' ? 'text2' : 'text', text: body || '', html: html || '' });
                };
                addBodyBlock(card.body, card.bodyHtml, card.bodyType, card.table);
                addBodyBlock(card.body2, card.body2Html, card.body2Type, card.table2);
                if (card.imageId) blocks.push({ type: 'image', imageId: card.imageId });
                if (!blocks.length && Array.isArray(card.contentBlocks)) return;
                card.contentBlocks = blocks;
                card.body = '';
                card.bodyHtml = '';
                card.body2 = '';
                card.body2Html = '';
                card.table = null;
                card.table2 = null;
                card.imageId = '';
                card.image = '';
                migrated = true;
            });
        });
        return migrated;
    }

    function initializeSharedCardEditor({ cardList: testCardList, addButton: testAddCardBtn, initialRows = [], onChange = () => {}, structuredContent = false, supportsTripleCards = false }) {
        if (!testCardList || !testAddCardBtn || testCardList.dataset.cardEditorInitialized) return;
        testCardList.dataset.cardEditorInitialized = 'true';
        const isEditorMode = () => window.wmsPermissions?.isEditor() === true;
        supportsTripleCards = Boolean(supportsTripleCards);
        let restoring = false;
        const cardClipboardStorageKey = 'wms-test-card-clipboard-v1';
        const cardClipboardLifetime = 24 * 60 * 60 * 1000;
        const copyPlainValue = (value) => JSON.parse(JSON.stringify(value));
        const normalizeContentBlocks = (blocks) => Array.isArray(blocks)
            ? blocks.map((block) => block?.type === 'plainText'
                ? { type: 'text', text: String(block.text || ''), html: typeof block.html === 'string' ? block.html : '' }
                : block)
            : [];
        const getClipboardImageIds = (clipboard) => Array.isArray(clipboard?.contentBlocks)
            ? clipboard.contentBlocks.filter((block) => block.type === 'image' && block.imageId).map((block) => block.imageId)
            : [];
        const isValidCardClipboard = (clipboard) => Boolean(
            clipboard &&
            clipboard.version === 1 &&
            typeof clipboard.title === 'string' &&
            typeof clipboard.description === 'string' &&
            Array.isArray(clipboard.contentBlocks) &&
            clipboard.contentBlocks.every((block) => ['text', 'text2', 'table', 'image', 'pdf', 'googleDrive'].includes(block?.type)) &&
            Number(clipboard.expiresAt) > Date.now()
        );
        let cardClipboard = null;
        if (testCardList.id === 'testCardList') {
            try {
                const storedClipboard = JSON.parse(localStorage.getItem(cardClipboardStorageKey) || 'null');
                if (isValidCardClipboard(storedClipboard)) {
                    cardClipboard = storedClipboard;
                } else if (storedClipboard) {
                    localStorage.removeItem(cardClipboardStorageKey);
                    getClipboardImageIds(storedClipboard).forEach((imageId) => removeImageBlob(imageId).catch(() => {}));
                }
            } catch (error) {
                localStorage.removeItem(cardClipboardStorageKey);
            }
        }

        const cardHasStoredContent = (card) => {
            let contentBlocks = [];
            try {
                contentBlocks = card.dataset.contentBlocks ? JSON.parse(card.dataset.contentBlocks) : [];
            } catch (error) {
                contentBlocks = [];
            }
            return Boolean(
                card.dataset.title?.trim() ||
                card.dataset.description?.trim() ||
                contentBlocks.length ||
                card.dataset.body?.trim() ||
                card.dataset.body2?.trim() ||
                card.dataset.table ||
                card.dataset.table2 ||
                card.dataset.imageId ||
                card.dataset.imageUrl ||
                card.dataset.legacyImage
            );
        };
        const hasUnsupportedCardContent = (card) => {
            try {
                const contentBlocks = card.dataset.contentBlocks ? JSON.parse(card.dataset.contentBlocks) : [];
                return Array.isArray(contentBlocks) && contentBlocks.some((block) => !['text', 'text2', 'table', 'image', 'pdf', 'googleDrive'].includes(block?.type));
            } catch (error) {
                return true;
            }
        };
        const isCardEditLocked = (card) => card.dataset.editLocked === 'true' || hasUnsupportedCardContent(card);

        function showStorageWarning(error) {
            document.querySelector('.test-card-storage-warning')?.remove();
            const warning = document.createElement('div');
            const isQuotaError = error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014;
            warning.className = 'test-card-storage-warning';
            warning.setAttribute('role', 'status');
            warning.textContent = isQuotaError
                ? '브라우저 저장 공간이 부족합니다. 이미지 또는 기존 카드를 정리한 뒤 다시 시도해 주세요.'
                : '변경 내용은 현재 화면에 반영되었지만 브라우저에 저장하지 못했습니다. 새로고침하면 내용이 사라질 수 있습니다.';
            document.body.appendChild(warning);
            window.setTimeout(() => warning.remove(), 6000);
        }

        function showCardNotice(message, isError = false) {
            document.querySelector('.test-card-storage-warning')?.remove();
            const notice = document.createElement('div');
            notice.className = `test-card-storage-warning${isError ? ' is-error' : ' is-success'}`;
            notice.setAttribute('role', 'status');
            notice.textContent = message;
            document.body.appendChild(notice);
            window.setTimeout(() => notice.remove(), 3500);
        }

        const notifyChange = () => {
            if (restoring) return;
            const rows = Array.from(testCardList.children).map((row) => ({
                type: row.classList.contains('test-card-row-left-right') ? 'left-right' : (row.classList.contains('test-card-row-triple') ? 'triple' : (row.classList.contains('test-card-row') ? 'double' : 'single')),
                columnWidths: row.dataset.columnWidths ? JSON.parse(row.dataset.columnWidths) : null,
                cards: getGroupCardsInReadingOrder(row).map((card) => ({
                    title: card.dataset.title || '', description: card.dataset.description || '',
                    body: card.dataset.body || '', bodyHtml: card.dataset.bodyHtml || '',
                    bodyType: card.dataset.bodyType || 'text', table: card.dataset.table ? JSON.parse(card.dataset.table) : null,
                    body2Type: card.dataset.body2Type || 'text', table2: card.dataset.table2 ? JSON.parse(card.dataset.table2) : null,
                    body2: card.dataset.body2 || '', body2Html: card.dataset.body2Html || '',
                    imageId: card.dataset.imageId || '', image: card.dataset.legacyImage || '',
                    editLocked: card.dataset.editLocked === 'true',
                    contentBlocks: card.dataset.contentBlocks ? JSON.parse(card.dataset.contentBlocks) : []
                }))
            }));
            try {
                onChange(rows);
            } catch (error) {
                showStorageWarning(error);
            }
        };

        function getGroupCardsInReadingOrder(group) {
            if (group.classList.contains('test-created-card')) return [group];
            if (group.classList.contains('test-card-row-left-right')) {
                const primary = group.querySelector(':scope > .test-card-left-right-primary');
                const sideCards = Array.from(group.querySelectorAll(':scope > .test-card-left-right-side > .test-created-card'));
                return [primary, ...sideCards].filter(Boolean);
            }
            return Array.from(group.querySelectorAll(':scope > .test-created-card'));
        }

        function getCardsInReadingOrder() {
            return Array.from(testCardList.children).flatMap((group) => getGroupCardsInReadingOrder(group));
        }

        function setupResizableRow(row, savedWidths = null) {
            if (!row?.classList.contains('test-card-row')) return;
            row._testCardResizeObserver?.disconnect();
            row._testCardResizeObserver = null;
            if (row._testCardHandleFrame) cancelAnimationFrame(row._testCardHandleFrame);
            row._testCardHandleFrame = null;
            row.querySelectorAll('.test-card-column-resize-handle').forEach((handle) => handle.remove());
            const cardCount = row.querySelectorAll(':scope > .test-created-card').length;
            if (cardCount < 2 || cardCount > 3) {
                delete row.dataset.columnWidths;
                row.style.removeProperty('grid-template-columns');
                return;
            }
            const defaultWidths = Array(cardCount).fill(100 / cardCount);
            let widths = Array.isArray(savedWidths) && savedWidths.length === cardCount && savedWidths.every((width) => Number(width) > 0)
                ? savedWidths.map(Number)
                : defaultWidths;
            const normalizeWidths = () => {
                const total = widths.reduce((sum, width) => sum + width, 0) || 100;
                widths = widths.map((width) => (width / total) * 100);
                row.dataset.columnWidths = JSON.stringify(widths.map((width) => Number(width.toFixed(4))));
                row.style.gridTemplateColumns = widths.map((width) => `minmax(0, ${width}fr)`).join(' ');
            };
            const positionHandles = () => {
                const cards = Array.from(row.querySelectorAll(':scope > .test-created-card'));
                const rowBounds = row.getBoundingClientRect();
                row.querySelectorAll('.test-card-column-resize-handle').forEach((handle, index) => {
                    const leftCardBounds = cards[index].getBoundingClientRect();
                    const rightCardBounds = cards[index + 1].getBoundingClientRect();
                    handle.style.left = `${((leftCardBounds.right + rightCardBounds.left) / 2) - rowBounds.left}px`;
                });
            };
            const scheduleHandlePosition = () => {
                if (row._testCardHandleFrame) cancelAnimationFrame(row._testCardHandleFrame);
                row._testCardHandleFrame = requestAnimationFrame(() => {
                    row._testCardHandleFrame = null;
                    positionHandles();
                });
            };
            normalizeWidths();
            for (let boundary = 0; boundary < cardCount - 1; boundary += 1) {
                const handle = document.createElement('span');
                handle.className = 'test-card-column-resize-handle permission-editor-only';
                handle.setAttribute('role', 'separator');
                handle.setAttribute('aria-orientation', 'vertical');
                handle.setAttribute('aria-label', `${boundary + 1}번째와 ${boundary + 2}번째 카드 너비 조절`);
                handle.addEventListener('pointerdown', (event) => {
                    if (!isEditorMode() || window.matchMedia('(max-width: 640px)').matches) return;
                    event.preventDefault();
                    const rowBounds = row.getBoundingClientRect();
                    const cards = Array.from(row.querySelectorAll(':scope > .test-created-card'));
                    const gap = Math.max(0, cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().right);
                    const availableWidth = rowBounds.width - (gap * (cardCount - 1));
                    const pixelWidths = cards.map((card) => card.getBoundingClientRect().width);
                    const startX = event.clientX;
                    const minimumWidth = Math.min(180, availableWidth / cardCount * 0.55);
                    handle.setPointerCapture?.(event.pointerId);
                    row.classList.add('is-resizing-columns');
                    const move = (moveEvent) => {
                        const delta = moveEvent.clientX - startX;
                        const leftIndex = boundary;
                        const rightIndex = boundary + 1;
                        const nextLeft = Math.min(Math.max(pixelWidths[leftIndex] + delta, minimumWidth), pixelWidths[leftIndex] + pixelWidths[rightIndex] - minimumWidth);
                        const nextRight = pixelWidths[leftIndex] + pixelWidths[rightIndex] - nextLeft;
                        const nextPixels = [...pixelWidths];
                        nextPixels[leftIndex] = nextLeft;
                        nextPixels[rightIndex] = nextRight;
                        widths = nextPixels.map((width) => (width / availableWidth) * 100);
                        normalizeWidths();
                        scheduleHandlePosition();
                    };
                    const finish = () => {
                        row.classList.remove('is-resizing-columns');
                        window.removeEventListener('pointermove', move);
                        window.removeEventListener('pointerup', finish);
                        window.removeEventListener('pointercancel', finish);
                        notifyChange();
                    };
                    window.addEventListener('pointermove', move);
                    window.addEventListener('pointerup', finish);
                    window.addEventListener('pointercancel', finish);
                });
                row.appendChild(handle);
            }
            row._testCardResizeObserver = new ResizeObserver(scheduleHandlePosition);
            row._testCardResizeObserver.observe(row);
            scheduleHandlePosition();
        }

        function swapCardData(firstCard, secondCard) {
            if (!firstCard || !secondCard || firstCard === secondCard) return;
            const firstData = { ...firstCard.dataset };
            const secondData = { ...secondCard.dataset };
            const keys = new Set([...Object.keys(firstData), ...Object.keys(secondData)]);
            keys.forEach((key) => {
                delete firstCard.dataset[key];
                delete secondCard.dataset[key];
            });
            Object.entries(secondData).forEach(([key, value]) => { firstCard.dataset[key] = value; });
            Object.entries(firstData).forEach(([key, value]) => { secondCard.dataset[key] = value; });
            renderTestCard(firstCard);
            renderTestCard(secondCard);
        }

        function updateCardMoveButtons() {
            const cards = getCardsInReadingOrder();
            cards.forEach((card, index) => {
                card.querySelector('.test-card-move-up-btn').disabled = index === 0;
                card.querySelector('.test-card-move-down-btn').disabled = index === cards.length - 1;
            });
            if (activeReorderSession) updateFixedReorderButtons();
        }

        let activeReorderSession = null;

        function updateFixedReorderButtons() {
            if (!activeReorderSession) return;
            const cards = getCardsInReadingOrder();
            const index = cards.indexOf(activeReorderSession.card);
            activeReorderSession.upButton.disabled = index <= 0;
            activeReorderSession.downButton.disabled = index < 0 || index >= cards.length - 1;
        }

        function closeFixedCardReorder() {
            if (!activeReorderSession) return;
            document.removeEventListener('pointerdown', activeReorderSession.closeOnOutsidePointerDown, true);
            document.removeEventListener('keydown', activeReorderSession.closeOnEscape);
            activeReorderSession.toolbar.remove();
            activeReorderSession = null;
        }

        function positionFixedReorderToolbar(toolbar, anchorButton, pointerX, pointerY) {
            toolbar.style.left = '0px';
            toolbar.style.top = '0px';
            toolbar.style.visibility = 'hidden';
            const buttonRect = anchorButton.getBoundingClientRect();
            const toolbarRect = toolbar.getBoundingClientRect();
            const rawLeft = pointerX - (buttonRect.left + buttonRect.width / 2);
            const rawTop = pointerY - (buttonRect.top + buttonRect.height / 2);
            const margin = 8;
            toolbar.style.left = Math.max(margin, Math.min(rawLeft, window.innerWidth - toolbarRect.width - margin)) + 'px';
            toolbar.style.top = Math.max(margin, Math.min(rawTop, window.innerHeight - toolbarRect.height - margin)) + 'px';
            toolbar.style.visibility = 'visible';
        }

        function openFixedCardReorder(card, direction, event, trigger) {
            closeFixedCardReorder();
            const toolbar = document.createElement('div');
            toolbar.className = 'test-card-reorder-toolbar';
            toolbar.setAttribute('role', 'toolbar');
            toolbar.setAttribute('aria-label', '카드 순서 연속 변경');
            toolbar.innerHTML = '<button type="button" class="test-reorder-fixed-up" aria-label="선택한 카드를 한 단계 위로 이동">↑</button><button type="button" class="test-reorder-fixed-down" aria-label="선택한 카드를 한 단계 아래로 이동">↓</button><button type="button" class="test-reorder-fixed-close">종료</button>';
            document.body.appendChild(toolbar);
            const upButton = toolbar.querySelector('.test-reorder-fixed-up');
            const downButton = toolbar.querySelector('.test-reorder-fixed-down');
            const closeButton = toolbar.querySelector('.test-reorder-fixed-close');
            const anchorButton = direction === 'up' ? upButton : downButton;
            const triggerRect = trigger.getBoundingClientRect();
            const pointerX = event.clientX || triggerRect.left + triggerRect.width / 2;
            const pointerY = event.clientY || triggerRect.top + triggerRect.height / 2;
            const closeOnOutsidePointerDown = (pointerEvent) => {
                if (!toolbar.contains(pointerEvent.target)) closeFixedCardReorder();
            };
            const closeOnEscape = (keyEvent) => {
                if (keyEvent.key !== 'Escape') return;
                keyEvent.preventDefault();
                closeFixedCardReorder();
            };
            activeReorderSession = { card, toolbar, upButton, downButton, closeOnOutsidePointerDown, closeOnEscape };
            const continueMove = (moveDirection, button) => {
                const destinationCard = moveCardOneStep(activeReorderSession.card, moveDirection, { focusDestination: false });
                if (destinationCard) activeReorderSession.card = destinationCard;
                updateFixedReorderButtons();
                button.focus({ preventScroll: true });
            };
            upButton.addEventListener('click', () => continueMove('up', upButton));
            downButton.addEventListener('click', () => continueMove('down', downButton));
            closeButton.addEventListener('click', closeFixedCardReorder);
            document.addEventListener('pointerdown', closeOnOutsidePointerDown, true);
            document.addEventListener('keydown', closeOnEscape);
            updateFixedReorderButtons();
            positionFixedReorderToolbar(toolbar, anchorButton, pointerX, pointerY);
            anchorButton.focus({ preventScroll: true });
        }

        function focusMovedCard(card, direction, focusDestination = true) {
            card.classList.remove('test-card-just-moved');
            requestAnimationFrame(() => {
                card.classList.add('test-card-just-moved');
                card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                if (focusDestination) {
                    const preferredButton = card.querySelector(direction === 'up' ? '.test-card-move-up-btn' : '.test-card-move-down-btn');
                    const fallbackButton = card.querySelector(direction === 'up' ? '.test-card-move-down-btn' : '.test-card-move-up-btn');
                    (preferredButton.disabled ? fallbackButton : preferredButton).focus({ preventScroll: true });
                }
                window.setTimeout(() => card.classList.remove('test-card-just-moved'), 1100);
            });
        }

        function moveCardOneStep(card, direction, { focusDestination = true } = {}) {
            if (!isEditorMode()) return null;
            if (document.querySelector('.test-card-edit-overlay, .test-original-image-overlay')) return null;
            const cards = getCardsInReadingOrder();
            const currentIndex = cards.indexOf(card);
            const destinationIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
            const destinationCard = cards[destinationIndex];
            if (!destinationCard) return null;
            swapCardData(card, destinationCard);
            notifyChange();
            updateCardMoveButtons();
            focusMovedCard(destinationCard, direction, focusDestination);
            return destinationCard;
        }

        let selectedCardType = null;

        function openTestCardTypeModal() {
            if (!isEditorMode()) return;
            const tripleOption = supportsTripleCards ? `
                            <button type="button" class="test-card-type-option" data-card-type="triple">
                                <span class="test-card-type-preview triple"><i></i><i></i><i></i></span>
                                <span>3열 카드</span>
                                <small>본문 폭 3개</small>
                            </button>` : '';
            const modal = document.createElement('div');
            modal.className = 'test-card-type-overlay';
            modal.innerHTML = `
                <div class="test-card-type-modal" role="dialog" aria-modal="true" aria-labelledby="testCardTypeTitle">
                    <div class="test-card-type-header">
                        <h4 id="testCardTypeTitle">카드 타입 선택</h4>
                        <button type="button" class="test-card-type-close" aria-label="닫기">&times;</button>
                    </div>
                    <div class="test-card-type-body">
                        <div class="test-card-type-options">
                            <button type="button" class="test-card-type-option" data-card-type="single">
                                <span class="test-card-type-preview single"><i></i></span>
                                <span>1열 카드</span>
                                <small>본문 전체 폭 1개</small>
                            </button>
                            <button type="button" class="test-card-type-option" data-card-type="double">
                                <span class="test-card-type-preview double"><i></i><i></i></span>
                                <span>2열 카드</span>
                                <small>본문 폭 2개</small>
                            </button>
                            ${tripleOption}
                        </div>
                        <button type="button" class="test-card-type-register" disabled>등록</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            const options = modal.querySelectorAll('.test-card-type-option');
            const registerButton = modal.querySelector('.test-card-type-register');
            const close = () => modal.remove();
            modal.querySelector('.test-card-type-close').addEventListener('click', close);
            modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
            options.forEach((option) => {
                option.addEventListener('click', () => {
                    options.forEach((item) => item.classList.remove('selected'));
                    option.classList.add('selected');
                    selectedCardType = option.dataset.cardType;
                    registerButton.disabled = false;
                });
            });
            registerButton.addEventListener('click', () => {
                if (!selectedCardType) return;
                addTestCard(selectedCardType);
                close();
            });
        }

        function addTestCard(type, initialCards = [], columnWidths = null) {
            const createCard = (initialCard = {}) => {
                const contentBlocks = normalizeContentBlocks(initialCard.contentBlocks);
                const card = document.createElement('div');
                card.className = 'test-created-card';
                card.dataset.title = initialCard.title || '';
                card.dataset.description = initialCard.description || '';
                card.dataset.body = initialCard.body || '';
                card.dataset.bodyHtml = initialCard.bodyHtml || '';
                card.dataset.body2 = initialCard.body2 || '';
                card.dataset.body2Html = initialCard.body2Html || '';
                card.dataset.bodyType = initialCard.bodyType || 'text';
                card.dataset.table = initialCard.table ? JSON.stringify(initialCard.table) : '';
                card.dataset.body2Type = initialCard.body2Type || 'text';
                card.dataset.table2 = initialCard.table2 ? JSON.stringify(initialCard.table2) : '';
                card.dataset.bodyTypeLocked = initialCard.bodyTypeLocked ? 'true' : '';
                card.dataset.imageId = initialCard.imageId || '';
                card.dataset.imageUrl = initialCard.imageId ? '' : (initialCard.image || '');
                card.dataset.legacyImage = initialCard.imageId ? '' : (initialCard.image || '');
                card.dataset.editLocked = initialCard.editLocked ? 'true' : '';
                card.dataset.contentBlocks = contentBlocks.length ? JSON.stringify(contentBlocks) : '';
                card.innerHTML = '<div class="test-card-content"><div class="test-card-title"></div><div class="test-card-description"></div><div class="test-card-image-slot"></div><div class="test-card-body-columns"><div class="test-card-body-text"></div><div class="test-card-body-divider" aria-hidden="true"></div><div class="test-card-body-text test-card-body-text-secondary"></div></div></div><span class="test-card-empty">빈 카드</span><button type="button" class="test-card-edit-btn permission-editor-only">Edit</button>';
                card.querySelector('.test-card-description').insertAdjacentHTML('afterend', '<div class="test-card-content-blocks"></div>');
                card.insertAdjacentHTML('beforeend', '<button type="button" class="test-card-move-btn test-card-move-up-btn permission-editor-only" aria-label="카드를 한 단계 위로 이동" title="위로 이동">↑</button><button type="button" class="test-card-move-btn test-card-move-down-btn permission-editor-only" aria-label="카드를 한 단계 아래로 이동" title="아래로 이동">↓</button>');
                card.querySelector('.test-card-edit-btn').addEventListener('click', (event) => {
                    if (!isEditorMode() || isCardEditLocked(card)) return;
                    event.stopPropagation();
                    closeFixedCardReorder();
                    openTestCardEditModal(card);
                });
                card.querySelector('.test-card-move-up-btn').addEventListener('click', (event) => {
                    if (!isEditorMode()) return;
                    event.stopPropagation();
                    const destinationCard = moveCardOneStep(card, 'up', { focusDestination: false });
                    if (destinationCard) openFixedCardReorder(destinationCard, 'up', event, event.currentTarget);
                });
                card.querySelector('.test-card-move-down-btn').addEventListener('click', (event) => {
                    if (!isEditorMode()) return;
                    event.stopPropagation();
                    const destinationCard = moveCardOneStep(card, 'down', { focusDestination: false });
                    if (destinationCard) openFixedCardReorder(destinationCard, 'down', event, event.currentTarget);
                });
                renderTestCard(card);
                if (card.dataset.imageId) loadStoredCardImage(card);
                return card;
            };
            const card = createCard(initialCards[0]);
            if (type === 'single') {
                card.classList.add('test-created-card-single');
                testCardList.appendChild(card);
            } else if (type === 'triple') {
                const row = document.createElement('div');
                row.className = 'test-card-row test-card-row-triple';
                row.append(card, createCard(initialCards[1]), createCard(initialCards[2]));
                testCardList.appendChild(row);
                setupResizableRow(row, columnWidths);
            } else if (type === 'left-right') {
                const row = document.createElement('div');
                row.className = 'test-card-row-left-right';
                card.classList.add('test-card-left-right-primary');
                const side = document.createElement('div');
                side.className = 'test-card-left-right-side';
                side.appendChild(createCard(initialCards[1]));
                side.appendChild(createCard(initialCards[2]));
                row.appendChild(card);
                row.appendChild(side);
                testCardList.appendChild(row);
            } else {
                let last = testCardList.lastElementChild;
                if (!last || !last.classList.contains('test-card-row') || last.children.length >= 2) {
                    last = document.createElement('div');
                    last.className = 'test-card-row';
                    testCardList.appendChild(last);
                }
                // 2열 타입은 하나의 등록 단위로 빈 카드 2개를 생성한다.
                last.appendChild(card);
                last.appendChild(createCard(initialCards[1]));
                setupResizableRow(last, columnWidths);
            }
            updateCardMoveButtons();
            notifyChange();
        }

        function renderTestCard(card) {
            const title = card.querySelector('.test-card-title');
            const description = card.querySelector('.test-card-description');
            const body = card.querySelector('.test-card-body-text');
            const body2 = card.querySelector('.test-card-body-text-secondary');
            const bodyColumns = card.querySelector('.test-card-body-columns');
            const bodyDivider = card.querySelector('.test-card-body-divider');
            const imageSlot = card.querySelector('.test-card-image-slot');
            const contentBlocksContainer = card.querySelector('.test-card-content-blocks');
            const empty = card.querySelector('.test-card-empty');
            const contentBlocks = card.dataset.contentBlocks ? JSON.parse(card.dataset.contentBlocks) : null;
            const editButton = card.querySelector('.test-card-edit-btn');
            const editLocked = isCardEditLocked(card);
            card.classList.toggle('test-card-has-title', Boolean(card.dataset.title));
            card.classList.toggle('test-card-has-description', Boolean(card.dataset.description));
            if (editButton) {
                editButton.disabled = editLocked;
                editButton.title = editLocked ? '카드 수정 팝업에서 지원하지 않는 콘텐츠가 있어 수정할 수 없습니다.' : '';
                editButton.setAttribute('aria-disabled', String(editLocked));
            }
            if (Array.isArray(contentBlocks)) {
                contentBlocksContainer.replaceChildren();
                renderTestText(title, card.dataset.title || '');
                renderTestText(description, card.dataset.description || '');
                contentBlocks.forEach((block) => {
                    const blockElement = document.createElement('section');
                    blockElement.className = `test-card-content-block test-card-content-block-${block.type}`;
                    if (block.type === 'image' && block.imageId) {
                        const imageFrame = document.createElement('div');
                        imageFrame.className = 'test-card-image-frame';
                        const image = document.createElement('img');
                        image.alt = '등록 이미지';
                        imageFrame.appendChild(image);
                        const originalButton = document.createElement('button');
                        originalButton.type = 'button';
                        originalButton.className = 'test-original-view-btn';
                        originalButton.textContent = '원본보기';
                        originalButton.addEventListener('click', () => image.src && openOriginalImage(image.src));
                        imageFrame.appendChild(originalButton);
                        blockElement.appendChild(imageFrame);
                        loadImageBlob(block.imageId).then((blob) => { if (blob) image.src = URL.createObjectURL(blob); }).catch(showStorageWarning);
                    } else if (block.type === 'pdf' && block.pdfId) {
                        const pdfFrame = document.createElement('div');
                        pdfFrame.className = 'test-card-pdf-frame';
                        const preview = document.createElement('canvas');
                        preview.className = 'test-card-pdf-preview';
                        preview.setAttribute('aria-label', `${block.fileName || '등록 PDF'} 첫 페이지 미리보기`);
                        const originalButton = document.createElement('button');
                        originalButton.type = 'button';
                        originalButton.className = 'test-original-view-btn';
                        originalButton.textContent = '원본보기';
                        pdfFrame.append(preview, originalButton);
                        blockElement.appendChild(pdfFrame);
                        loadImageBlob(block.pdfId).then((blob) => {
                            if (!blob) return;
                            renderPdfPage(preview, blob, 1).catch(showStorageWarning);
                            originalButton.addEventListener('click', () => openOriginalPdf(blob, block.fileName));
                        }).catch(showStorageWarning);
                    } else if (block.type === 'googleDrive' && block.documentId && block.documentType) {
                        const driveFrame = document.createElement('div');
                        driveFrame.className = 'test-card-google-drive-frame';
                        const thumbnail = document.createElement('img');
                        thumbnail.src = getGoogleDriveThumbnailUrl(block);
                        thumbnail.alt = `${block.documentLabel || 'Google Drive 문서'} 썸네일`;
                        const fallback = document.createElement('div');
                        fallback.className = 'test-google-drive-fallback';
                        fallback.textContent = `${block.documentLabel || 'Google Drive 문서'} · ${block.title || '공유 문서'}`;
                        fallback.hidden = true;
                        thumbnail.addEventListener('error', () => { thumbnail.hidden = true; fallback.hidden = false; });
                        const originalButton = document.createElement('button');
                        originalButton.type = 'button';
                        originalButton.className = 'test-original-view-btn';
                        originalButton.textContent = '원본보기';
                        originalButton.addEventListener('click', () => openGoogleDriveDocument(block));
                        driveFrame.append(thumbnail, fallback, originalButton);
                        blockElement.appendChild(driveFrame);
                    } else if (block.type === 'table') {
                        renderTestTable(blockElement, block.table);
                    } else if (block.type === 'text' || block.type === 'text2') {
                        renderTestListBody(blockElement, block.html, block.text || '', block.type);
                    } else if (block.type === 'diagram') {
                        const diagram = document.createElement('div');
                        diagram.className = 'mermaid test-card-diagram';
                        diagram.textContent = String(block.source || '');
                        blockElement.appendChild(diagram);
                        if (window.mermaid?.run) {
                            window.mermaid.run({ nodes: [diagram] }).catch(() => {
                                diagram.classList.remove('mermaid');
                                diagram.classList.add('test-card-diagram-fallback');
                            });
                        } else {
                            diagram.classList.remove('mermaid');
                            diagram.classList.add('test-card-diagram-fallback');
                        }
                    }
                    contentBlocksContainer.appendChild(blockElement);
                });
                const hasContent = Boolean(card.dataset.title || card.dataset.description || contentBlocks.length);
                title.style.display = card.dataset.title ? 'block' : 'none';
                description.style.display = card.dataset.description ? 'block' : 'none';
                imageSlot.style.display = 'none';
                bodyColumns.style.display = 'none';
                empty.style.display = hasContent ? 'none' : 'inline';
                card.classList.toggle('test-card-is-empty', !hasContent);
                return;
            }
            const bodyValue = card.dataset.body || '';
            const body2Value = card.dataset.body2 || '';
            const tableData = card.dataset.table ? JSON.parse(card.dataset.table) : null;
            const tableData2 = card.dataset.table2 ? JSON.parse(card.dataset.table2) : null;
            renderTestText(title, card.dataset.title || '');
            renderTestText(description, card.dataset.description || '');
            renderTestListBody(body, card.dataset.bodyHtml, bodyValue);
            renderTestListBody(body2, card.dataset.body2Html, body2Value);
            title.style.display = card.dataset.title ? 'block' : 'none';
            description.style.display = card.dataset.description ? 'block' : 'none';
            const isTable = card.dataset.bodyType === 'table';
            const isTable2 = card.dataset.body2Type === 'table';
            body.style.display = isTable || bodyValue ? 'block' : 'none';
            body2.style.display = isTable2 || body2Value ? 'block' : 'none';
            const hasTwoBodies = Boolean((bodyValue || isTable) && (body2Value || isTable2));
            bodyDivider.style.display = hasTwoBodies ? 'block' : 'none';
            bodyColumns.classList.toggle('two-column', hasTwoBodies);
            bodyColumns.style.display = isTable || isTable2 || hasTwoBodies ? 'grid' : ((bodyValue || body2Value) ? 'block' : 'none');
            if (isTable) renderTestTable(body, tableData);
            if (isTable2) renderTestTable(body2, tableData2);
            const imageSource = card.dataset.imageUrl || card.dataset.legacyImage || '';
            card.dataset.image = imageSource;
            card.classList.toggle('test-card-has-image', Boolean(imageSource));
            imageSlot.style.display = imageSource ? 'block' : 'none';
            const hasContent = card.dataset.title || card.dataset.description || bodyValue || body2Value || isTable || isTable2 || card.dataset.imageId || imageSource;
            empty.style.display = hasContent ? 'none' : 'inline';
            card.classList.toggle('test-card-is-empty', !hasContent);
            if (card.dataset.image) {
                imageSlot.innerHTML = '<div class="test-card-image-frame"><img src="' + card.dataset.image + '" alt="등록 이미지"><button type="button" class="test-original-view-btn">원본보기</button></div>';
                imageSlot.querySelector('.test-original-view-btn').addEventListener('click', (event) => {
                    event.stopPropagation();
                    openOriginalImage(card.dataset.image);
                });
            } else {
                imageSlot.innerHTML = '';
            }
        }

        function loadStoredCardImage(card) {
            loadImageBlob(card.dataset.imageId).then((blob) => {
                if (!blob) return;
                const previousUrl = card.dataset.imageUrl;
                if (previousUrl.startsWith('blob:')) URL.revokeObjectURL(previousUrl);
                card.dataset.imageUrl = URL.createObjectURL(blob);
                card.dataset.legacyImage = '';
                renderTestCard(card);
            }).catch(showStorageWarning);
        }

        function renderTestTable(container, tableData) {
            const data = tableData || { title: '', hasHeader: true, hasFirstColumnHeader: false, rows: [['', '', ''], ['', '', ''], ['', '', '']] };
            let wrapper = container.querySelector(':scope > .test-card-table-wrap');
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.className = 'test-card-table-wrap';
                container.appendChild(wrapper);
            }
            const table = document.createElement('table');
            table.className = 'test-card-table';
            if (data.title) {
                const caption = document.createElement('caption');
                caption.className = 'test-card-table-caption';
                const captionContent = document.createElement('span');
                captionContent.className = 'test-card-table-caption-content';
                const icon = document.createElement('span');
                icon.className = 'test-card-table-caption-icon';
                icon.setAttribute('aria-hidden', 'true');
                icon.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.25"></rect><path d="M2 6h12M6 2.5v11M10 2.5v11"></path></svg>';
                const captionText = document.createElement('span');
                captionText.className = 'test-card-table-caption-text';
                captionText.textContent = data.title;
                captionContent.append(icon, captionText);
                caption.appendChild(captionContent);
                table.appendChild(caption);
            }
            const rows = Array.isArray(data.rows) ? data.rows : [];
            const columns = rows[0]?.length || 0;
            const minimumTableCellWidth = 36;
            const storedWidths = Array.isArray(data.columnWidths) && data.columnWidths.length === columns ? data.columnWidths : Array(columns).fill(columns ? 100 / columns : 100);
            const storedWidthTotal = storedWidths.reduce((sum, width) => sum + Math.max(0, Number(width) || 0), 0);
            const widths = storedWidths.map((width) => ((Math.max(0, Number(width) || 0) / (storedWidthTotal || 100)) * 100));
            table.style.width = '100%';
            table.style.minWidth = (columns * minimumTableCellWidth) + 'px';
            const colgroup = document.createElement('colgroup');
            widths.forEach((width) => { const col = document.createElement('col'); col.style.width = width + '%'; colgroup.appendChild(col); });
            table.appendChild(colgroup);
            rows.forEach((row, rowIndex) => {
                const tr = document.createElement('tr');
                if (data.rowHeights?.[rowIndex]) tr.style.height = data.rowHeights[rowIndex] + 'px';
                (row || []).forEach((value, columnIndex) => {
                    const isFirstRowHeader = Boolean(data.hasHeader) && rowIndex === 0;
                    const isFirstColumnHeader = Boolean(data.hasFirstColumnHeader) && columnIndex === 0;
                    const cellName = isFirstRowHeader || isFirstColumnHeader ? 'th' : 'td';
                    const cell = document.createElement(cellName);
                    if (cellName === 'th') cell.scope = isFirstRowHeader ? 'col' : 'row';
                    cell.textContent = value || '';
                    tr.appendChild(cell);
                });
                table.appendChild(tr);
            });
            wrapper.replaceChildren(table);
            container.classList.remove('two-column');
        }

        function renderTestText(container, value) {
            container.replaceChildren();
            const urlPattern = /(https?:\/\/[^\s<]+)/g;
            let cursor = 0;
            let match;
            while ((match = urlPattern.exec(value)) !== null) {
                if (match.index > cursor) container.appendChild(document.createTextNode(value.slice(cursor, match.index)));
                const rawUrl = match[0];
                const trailing = rawUrl.match(/[),.;!?]+$/)?.[0] || '';
                const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;
                const link = document.createElement('a');
                link.href = url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = url;
                container.appendChild(link);
                if (trailing) container.appendChild(document.createTextNode(trailing));
                cursor = match.index + rawUrl.length;
            }
            if (cursor < value.length) container.appendChild(document.createTextNode(value.slice(cursor)));
        }

        // 서식이 적용된 본문 HTML은 유지하면서, 각 텍스트 노드의 URL만 링크로 변환한다.
        // 기존 번호·글머리 기호·줄바꿈 구조와 인라인 서식을 건드리지 않는다.
        function renderTestBody(container, html) {
            container.innerHTML = html;
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
            const textNodes = [];
            let node;
            while ((node = walker.nextNode())) {
                if (!node.parentElement.closest('a')) textNodes.push(node);
            }
            textNodes.forEach((textNode) => {
                if (!/(https?:\/\/[^\s<]+)/.test(textNode.nodeValue)) return;
                const replacement = document.createElement('span');
                renderTestText(replacement, textNode.nodeValue);
                textNode.parentNode.replaceChild(replacement, textNode);
                while (replacement.firstChild) replacement.parentNode.insertBefore(replacement.firstChild, replacement);
                replacement.remove();
            });
        }

        // 입력 데이터는 그대로 유지하고, 카드 표시에서만 목록 줄을 기호/본문 영역으로 나눈다.
        // 따라서 좁은 카드에서도 자동 줄바꿈이 번호 또는 글머리 기호 아래로 내려가지 않는다.
        function renderTestListBody(container, html, text, bodyType = 'text') {
            const source = document.createElement('span');
            if (html) renderTestBody(source, html);
            else renderTestText(source, text || '');

            const lines = [[]];
            const appendText = (value, ancestors) => {
                String(value).split('\n').forEach((part, index, parts) => {
                    if (part) lines.at(-1).push({ text: part, ancestors });
                    if (index < parts.length - 1) lines.push([]);
                });
            };
            const collect = (node, ancestors = []) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    appendText(node.nodeValue, ancestors);
                    return;
                }
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                if (node.tagName === 'BR') {
                    lines.push([]);
                    return;
                }
                Array.from(node.childNodes).forEach((child) => collect(child, [...ancestors, node]));
            };
            Array.from(source.childNodes).forEach((node) => collect(node));

            const appendSegments = (target, segments, trimCount = 0) => {
                let remaining = trimCount;
                segments.forEach((segment) => {
                    let value = segment.text;
                    if (remaining) {
                        const remove = Math.min(remaining, value.length);
                        value = value.slice(remove);
                        remaining -= remove;
                    }
                    if (!value) return;
                    let insertionPoint = target;
                    segment.ancestors.forEach((ancestor) => {
                        const clone = ancestor.cloneNode(false);
                        insertionPoint.appendChild(clone);
                        insertionPoint = clone;
                    });
                    insertionPoint.appendChild(document.createTextNode(value));
                });
            };

            container.replaceChildren();
            lines.forEach((segments) => {
                const plainText = segments.map((segment) => segment.text).join('');
                const numberMarker = bodyType === 'text2' ? '(?:\\d+|[a-z]+|[ivxlcdm]+)\\.' : '\\d+\\.';
                const bulletMarker = bodyType === 'text2' ? '[•◦▪-]' : '[•◦-]';
                const listMatch = new RegExp(`^(\\s*)(${numberMarker}|${bulletMarker})\\s+`, bodyType === 'text2' ? 'i' : '').exec(plainText);
                const line = document.createElement('div');
                line.className = 'test-card-body-line';
                if (!listMatch) {
                    appendSegments(line, segments);
                    container.appendChild(line);
                    return;
                }

                const indentation = listMatch[1];
                const indentationLevel = (indentation.match(/\t/g)?.length || 0) + Math.floor(indentation.replace(/\t/g, '').length / 4);
                line.classList.add('test-card-body-list-line');
                line.style.setProperty('--test-list-indent', `${indentationLevel * 1.5}rem`);
                const marker = document.createElement('span');
                marker.className = 'test-card-body-marker';
                marker.textContent = listMatch[2];
                const content = document.createElement('span');
                content.className = 'test-card-body-line-content';
                appendSegments(content, segments, listMatch[0].length);
                line.append(marker, content);
                container.appendChild(line);
            });
        }

        async function renderPdfPage(canvas, blob, pageNumber = 1, maxWidth = 1400) {
            const pdfjs = await getPdfJs();
            const data = await blob.arrayBuffer();
            const documentProxy = await pdfjs.getDocument({ data }).promise;
            const page = await documentProxy.getPage(Math.min(Math.max(1, pageNumber), documentProxy.numPages));
            const baseViewport = page.getViewport({ scale: 1 });
            const scale = Math.min(maxWidth / baseViewport.width, 2);
            const viewport = page.getViewport({ scale });
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', `PDF ${pageNumber}페이지`);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            return documentProxy.numPages;
        }

        function openOriginalImage(src) {
            const overlay = document.createElement('div');
            overlay.className = 'test-original-image-overlay';
            overlay.innerHTML = '<div class="test-original-image-dialog"><button type="button" class="test-original-image-close" aria-label="닫기">&times;</button><img src="' + src + '" alt="원본 이미지"></div>';
            document.body.appendChild(overlay);
            const close = () => overlay.remove();
            overlay.querySelector('.test-original-image-close').addEventListener('click', close);
            overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
        }

        function openOriginalPdf(blob, fileName = '원본 PDF') {
            const overlay = document.createElement('div');
            overlay.className = 'test-original-image-overlay test-original-pdf-overlay';
            const dialog = document.createElement('div');
            dialog.className = 'test-original-image-dialog test-original-pdf-dialog';
            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'test-original-image-close';
            closeButton.setAttribute('aria-label', '닫기');
            closeButton.innerHTML = '&times;';
            const toolbar = document.createElement('div');
            toolbar.className = 'test-pdf-viewer-toolbar';
            const pageLabel = document.createElement('span');
            pageLabel.textContent = `${fileName} · PDF 불러오는 중`;
            toolbar.appendChild(pageLabel);
            const viewer = document.createElement('div');
            viewer.className = 'test-original-pdf-scroll';
            viewer.setAttribute('aria-label', `${fileName} 원본 PDF 스크롤 뷰어`);
            dialog.append(closeButton, toolbar, viewer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            (async () => {
                try {
                    const pdfjs = await getPdfJs();
                    const data = await blob.arrayBuffer();
                    const documentProxy = await pdfjs.getDocument({ data }).promise;
                    pageLabel.textContent = `${fileName} · ${documentProxy.numPages}페이지`;
                    for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
                        const page = await documentProxy.getPage(pageNumber);
                        const canvas = document.createElement('canvas');
                        canvas.className = 'test-original-pdf-canvas';
                        const baseViewport = page.getViewport({ scale: 1 });
                        const scale = Math.min(Math.max(viewer.clientWidth - 36, 320) / baseViewport.width, 2);
                        const viewport = page.getViewport({ scale });
                        canvas.width = Math.ceil(viewport.width);
                        canvas.height = Math.ceil(viewport.height);
                        canvas.setAttribute('role', 'img');
                        canvas.setAttribute('aria-label', `PDF ${pageNumber}페이지`);
                        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                        viewer.appendChild(canvas);
                    }
                } catch (error) {
                    pageLabel.textContent = 'PDF를 표시할 수 없습니다.';
                }
            })();
            const close = () => overlay.remove();
            closeButton.addEventListener('click', close);
            overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
        }

        function openGoogleDriveDocument(block) {
            const overlay = document.createElement('div');
            overlay.className = 'test-original-image-overlay test-google-drive-overlay';
            const dialog = document.createElement('div');
            dialog.className = 'test-original-image-dialog test-google-drive-dialog';
            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'test-original-image-close';
            closeButton.setAttribute('aria-label', '닫기');
            closeButton.innerHTML = '&times;';
            const toolbar = document.createElement('div');
            toolbar.className = 'test-google-drive-toolbar';
            const label = document.createElement('span');
            label.textContent = `${block.documentLabel || 'Google Drive 문서'} · ${block.title || '공유 문서'}`;
            const openLink = document.createElement('a');
            openLink.href = block.url;
            openLink.target = '_blank';
            openLink.rel = 'noopener noreferrer';
            openLink.textContent = '새 탭에서 열기';
            toolbar.append(label, openLink);
            const viewer = document.createElement('iframe');
            viewer.className = 'test-google-drive-viewer';
            viewer.src = getGoogleDrivePreviewUrl(block);
            viewer.title = `${block.documentLabel || 'Google Drive 문서'} 원본 보기`;
            viewer.setAttribute('allowfullscreen', 'true');
            dialog.append(closeButton, toolbar, viewer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            const close = () => overlay.remove();
            closeButton.addEventListener('click', close);
            overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
        }

        function openTestCardEditModal(card) {
            if (!isEditorMode() || isCardEditLocked(card)) return;
            const rect = card.getBoundingClientRect();
            const modal = document.createElement('div');
            modal.className = 'test-card-edit-overlay';
            modal.innerHTML = `
                <div class="test-card-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="testCardEditTitle">
                    <div class="test-card-edit-header">
                        <h4 id="testCardEditTitle">카드 수정</h4>
                        <div class="test-card-edit-header-actions">
                            <button type="button" class="test-card-edit-paste" hidden>붙여넣기</button>
                            <button type="button" class="test-card-edit-close" aria-label="닫기">&times;</button>
                        </div>
                    </div>
                    <div class="test-card-edit-body">
                        <div class="test-edit-field test-edit-header-field" contenteditable="true" data-placeholder="제목을 입력하세요."></div>
                        <div class="test-edit-field test-edit-description-field" contenteditable="true" data-placeholder="간단한 설명을 입력하세요."></div>
                        <div class="test-edit-image-slot">
                            <input class="test-edit-image-input" type="file" accept="image/*" hidden>
                            <div class="test-edit-image-instructions">이미지를 드래그앤드롭하거나 <button type="button" class="test-upload-trigger">파일을 업로드</button><br>클립보드 이미지는 Ctrl + V로 붙여넣으세요.</div>
                        </div>
                        <div class="test-edit-body-field" contenteditable="true" data-placeholder="본문을 입력하세요."></div>
                        <div class="test-card-edit-actions">
                            <button type="button" class="test-card-edit-copy">카드복사</button>
                            <button type="button" class="test-card-edit-save">등록</button>
                            <button type="button" class="test-card-edit-delete">삭제</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            // 기존 선택으로 표시되어 있던 전역 업데이트 버튼도 편집 중에는 숨긴다.
            floatingUpdateBtn.style.display = 'none';
            const dialog = modal.querySelector('.test-card-edit-dialog');
            const maxWidth = window.innerWidth - 32;
            const maxHeight = window.innerHeight - 32;
            dialog.style.width = Math.min(rect.width, maxWidth) + 'px';
            // 편집 구성요소가 모두 보이도록 화면 높이에서 여백을 뺀 최대 높이를 사용한다.
            // 작은 브라우저에서는 .test-card-edit-body가 내부 스크롤을 제공한다.
            dialog.style.height = maxHeight + 'px';
            const headerField = modal.querySelector('.test-edit-header-field');
            const descriptionField = modal.querySelector('.test-edit-description-field');
            const primaryBodyField = modal.querySelector('.test-edit-body-field');
            const supportsTableBody = structuredContent;
            if (!supportsTableBody) {
                modal.querySelector('.test-card-edit-copy').hidden = true;
                modal.querySelector('.test-card-edit-paste').hidden = true;
            }
            const bodyTypeIsLocked = Boolean(card.dataset.contentBlocks && JSON.parse(card.dataset.contentBlocks).length) || card.dataset.bodyTypeLocked === 'true';
            const primarySlot = {
                field: primaryBodyField,
                type: card.dataset.bodyType || 'text',
                tableData: card.dataset.table ? JSON.parse(card.dataset.table) : { title: '', hasHeader: true, hasFirstColumnHeader: false, rows: [['', '', ''], ['', '', ''], ['', '', '']] }
            };
            let bodyField = primaryBodyField;
            let secondaryBodyField = null;
            let secondarySlot = null;
            const bodySlots = [primarySlot];
            // 테스트 메뉴는 본문을 고정 슬롯으로 제한하지 않는다. 미리 만든 슬롯은 추가할 때만 화면에 연결한다.
            if (supportsTableBody) {
                for (let index = 1; index < 20; index += 1) {
                    const field = document.createElement('div');
                    field.className = 'test-edit-body-field test-edit-body-secondary-field';
                    field.contentEditable = 'true';
                    field.dataset.placeholder = '본문을 입력하세요.';
                    bodySlots.push({
                        field,
                        type: 'text',
                        tableData: { title: '', hasHeader: true, hasFirstColumnHeader: false, rows: [['', '', ''], ['', '', ''], ['', '', '']] }
                    });
                }
            } else if (card.classList.contains('test-created-card-single')) {
                secondaryBodyField = document.createElement('div');
                secondaryBodyField.className = 'test-edit-body-field test-edit-body-secondary-field';
                secondaryBodyField.contentEditable = 'true';
                secondaryBodyField.dataset.placeholder = '두 번째 본문을 입력하세요.';
                primaryBodyField.parentElement.insertBefore(secondaryBodyField, primaryBodyField.nextSibling);
                secondarySlot = {
                    field: secondaryBodyField,
                    type: card.dataset.body2Type || 'text',
                    tableData: card.dataset.table2 ? JSON.parse(card.dataset.table2) : { title: '', hasHeader: true, hasFirstColumnHeader: false, rows: [['', '', ''], ['', '', ''], ['', '', '']] }
                };
                bodySlots.push(secondarySlot);
            }
            const tableSlots = bodySlots.map((slot) => slot.tableData);
            let activeTableSlot = 1;
            let tableData = primarySlot.tableData;
            let tableEditor = null;
            let resizeCleanup = null;
            const activateTableSlot = (slot) => {
                activeTableSlot = bodySlots.indexOf(slot) + 1;
                tableData = slot.tableData;
                tableEditor = slot.tableEditor;
            };
            const imageSlot = modal.querySelector('.test-edit-image-slot');
            const imageInput = modal.querySelector('.test-edit-image-input');
            let pendingImage = card.dataset.image || '';
            let pendingImageBlob = null;
            let editTouched = false;
            let bulletPicker = null;
            let bulletCommandStart = null;
            let bulletCommandEnd = null;
            let formatToolbar = null;
            let bodyCompositionActive = false;
            let pendingCompositionEnter = null;
            let compositionEnterSequence = 0;
            const isEnterKeyEvent = (event) => (
                event.key === 'Enter' ||
                event.code === 'Enter' ||
                event.code === 'NumpadEnter' ||
                event.keyCode === 13 ||
                event.which === 13
            );
            const getBodyValue = () => bodyField.textContent.replace(/\r/g, '');
            const findBodyPosition = (targetOffset) => {
                if (!bodyField.firstChild) bodyField.appendChild(document.createTextNode(''));
                const walker = document.createTreeWalker(bodyField, NodeFilter.SHOW_TEXT);
                let node;
                let offset = 0;
                let lastNode = null;
                while ((node = walker.nextNode())) {
                    const nextOffset = offset + node.nodeValue.length;
                    if (targetOffset <= nextOffset) return { node, offset: Math.max(0, targetOffset - offset) };
                    offset = nextOffset;
                    lastNode = node;
                }
                return { node: lastNode || bodyField.firstChild, offset: (lastNode || bodyField.firstChild).nodeValue.length };
            };
            const getBodySelection = () => {
                const selection = window.getSelection();
                if (!selection || !selection.rangeCount) {
                    const length = getBodyValue().length;
                    return { start: length, end: length };
                }
                const range = selection.getRangeAt(0);
                const beforeStart = document.createRange();
                beforeStart.selectNodeContents(bodyField);
                beforeStart.setEnd(range.startContainer, range.startOffset);
                const beforeEnd = document.createRange();
                beforeEnd.selectNodeContents(bodyField);
                beforeEnd.setEnd(range.endContainer, range.endOffset);
                return { start: beforeStart.toString().length, end: beforeEnd.toString().length };
            };
            const countBodyLineBreaks = (value) => (String(value).match(/\n/g) || []).length;
            const getBodyLineBreakState = () => {
                const text = getBodyValue();
                const visualText = bodyField.innerText.replace(/\r/g, '');
                const selection = getBodySelection();
                return {
                    textBreakCount: countBodyLineBreaks(text),
                    visualBreakCount: countBodyLineBreaks(visualText),
                    caretLine: countBodyLineBreaks(text.slice(0, Math.min(selection.end, text.length)))
                };
            };
            const setBodySelection = (start, end) => {
                const startPoint = findBodyPosition(start);
                const endPoint = findBodyPosition(end);
                const range = document.createRange();
                range.setStart(startPoint.node, startPoint.offset);
                range.setEnd(endPoint.node, endPoint.offset);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            };
            const replaceBodyRange = (start, end, text) => {
                setBodySelection(start, end);
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                bodyField.normalize();
                bodyField.querySelectorAll('span, strong').forEach((element) => { if (!element.textContent) element.remove(); });
                const caret = start + text.length;
                setBodySelection(caret, caret);
            };
            const bodyLineBreakFillerSelector = 'br[data-test-line-break-filler]';
            const removeBodyLineBreakFillers = (fillers = Array.from(bodyField.querySelectorAll(bodyLineBreakFillerSelector))) => {
                if (!fillers.length) return;
                const selection = window.getSelection();
                const selectionIsInside = Boolean(
                    selection &&
                    selection.rangeCount &&
                    bodyField.contains(selection.anchorNode) &&
                    bodyField.contains(selection.focusNode)
                );
                const savedSelection = selectionIsInside ? getBodySelection() : null;
                fillers.forEach((filler) => filler.remove());
                if (savedSelection) setBodySelection(savedSelection.start, savedSelection.end);
            };
            const getTextBeforeBodyLineBreakFiller = (filler) => {
                const walker = document.createTreeWalker(bodyField, NodeFilter.SHOW_ALL);
                let text = '';
                let node;
                while ((node = walker.nextNode())) {
                    if (node === filler) break;
                    if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue;
                    else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR' && !node.matches(bodyLineBreakFillerSelector)) text += '\n';
                }
                return text;
            };
            const removeStaleBodyLineBreakFillers = () => {
                const staleFillers = Array.from(bodyField.querySelectorAll(bodyLineBreakFillerSelector)).filter((filler) => {
                    return !getTextBeforeBodyLineBreakFiller(filler).endsWith('\n');
                });
                removeBodyLineBreakFillers(staleFillers);
            };
            const getStoredBodyHtml = (field) => {
                const clone = field.cloneNode(true);
                clone.querySelectorAll(bodyLineBreakFillerSelector).forEach((filler) => filler.remove());
                return clone.innerHTML;
            };
            const insertPlainBodyLineBreak = (start, end) => {
                const hasTrailingContent = end < getBodyValue().length;
                setBodySelection(start, end);
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const lineBreak = document.createTextNode('\n');
                const fragment = document.createDocumentFragment();
                fragment.appendChild(lineBreak);
                // A trailing newline needs a BR so Chrome can display and retain its caret line.
                // Existing content after the caret already renders that line; adding a BR there
                // would make one Enter look like two visual line breaks.
                if (!hasTrailingContent) {
                    const filler = document.createElement('br');
                    filler.dataset.testLineBreakFiller = 'true';
                    fragment.appendChild(filler);
                }
                range.insertNode(fragment);
                bodyField.normalize();
                setBodySelection(start + 1, start + 1);
            };
            headerField.textContent = card.dataset.title || '';
            descriptionField.textContent = card.dataset.description || '';
            primaryBodyField.innerHTML = card.dataset.bodyHtml || '';
            if (!primaryBodyField.innerHTML) primaryBodyField.textContent = card.dataset.body || '';
            if (secondaryBodyField) {
                secondaryBodyField.innerHTML = card.dataset.body2Html || '';
                if (!secondaryBodyField.innerHTML) secondaryBodyField.textContent = card.dataset.body2 || '';
            }
            const storedContentBlocks = supportsTableBody && card.dataset.contentBlocks
                ? normalizeContentBlocks(JSON.parse(card.dataset.contentBlocks))
                : null;
            if (Array.isArray(storedContentBlocks)) {
                let bodyIndex = 0;
                storedContentBlocks.forEach((block, blockOrder) => {
                    if (block.type !== 'text' && block.type !== 'text2' && block.type !== 'table') return;
                    const slot = bodySlots[bodyIndex++];
                    if (!slot) return;
                    slot.type = block.type;
                    slot.tableData = block.type === 'table' ? (block.table || slot.tableData) : slot.tableData;
                    slot.typeLocked = true;
                    slot.field.innerHTML = (block.type === 'text' || block.type === 'text2') ? (block.html || '') : '';
                    if ((block.type === 'text' || block.type === 'text2') && !slot.field.innerHTML) slot.field.textContent = block.text || '';
                    slot.active = true;
                    slot.blockOrder = blockOrder;
                });
            }
            const initialValues = {
                title: headerField.textContent.trim(),
                description: descriptionField.textContent.trim(),
                body: primaryBodyField.textContent.replace(/\r/g, ''),
                body2: secondaryBodyField ? secondaryBodyField.textContent.replace(/\r/g, '') : '',
                bodyTypes: bodySlots.map((slot) => slot.type),
                tables: bodySlots.map((slot, index) => slot.type === 'table' ? (index === 0 ? card.dataset.table || '' : card.dataset.table2 || '') : ''),
                image: pendingImage
            };
            const tableCellMinimumWidth = 36;
            const tableRowMinimumHeight = 36;
            const normalizeTable = () => {
                tableData.title = typeof tableData.title === 'string' ? tableData.title.slice(0, 80) : '';
                tableData.hasFirstColumnHeader = Boolean(tableData.hasFirstColumnHeader);
                const rows = Math.max(1, Math.min(12, tableData.rows.length || 3));
                const columns = Math.max(1, Math.min(12, Math.max(0, ...tableData.rows.map((row) => row.length), 1)));
                tableData.rows = Array.from({ length: rows }, (_, rowIndex) => Array.from({ length: columns }, (_, columnIndex) => tableData.rows[rowIndex]?.[columnIndex] || ''));
                const storedWidths = Array.isArray(tableData.columnWidths) ? tableData.columnWidths : [];
                const safeWidths = storedWidths.slice(0, columns).map((width) => Math.max(0, Number(width) || 0));
                const widthTotal = safeWidths.reduce((sum, width) => sum + width, 0);
                tableData.columnWidths = Array.from({ length: columns }, (_, index) => widthTotal > 0 ? (safeWidths[index] / widthTotal) * 100 : 100 / columns);
                const storedHeights = Array.isArray(tableData.rowHeights) ? tableData.rowHeights : [];
                tableData.rowHeights = Array.from({ length: rows }, (_, index) => Math.max(tableRowMinimumHeight, Number(storedHeights[index]) || tableRowMinimumHeight));
            };
            const applyTableWidths = (table) => {
                const total = tableData.columnWidths.reduce((sum, width) => sum + Math.max(0, Number(width) || 0), 0) || 100;
                table.style.width = '100%';
                table.style.minWidth = (tableData.columnWidths.length * tableCellMinimumWidth) + 'px';
                table.querySelectorAll('col').forEach((col, index) => { col.style.width = ((tableData.columnWidths[index] / total) * 100) + '%'; });
            };
            const setTableColumnCount = (nextColumns) => {
                const currentColumns = tableData.rows[0]?.length || 1;
                const targetColumns = Math.max(1, Math.min(12, nextColumns));
                if (targetColumns === currentColumns) return;

                if (targetColumns > currentColumns) {
                    const existingWidths = tableData.columnWidths.slice(0, currentColumns);
                    const existingTotal = existingWidths.reduce((sum, width) => sum + (Number(width) || 0), 0) || 100;
                    const addedColumnWidth = 100 / targetColumns;
                    const retainedWidth = 100 - (addedColumnWidth * (targetColumns - currentColumns));
                    tableData.columnWidths = existingWidths.map((width) => ((Number(width) || 0) / existingTotal) * retainedWidth)
                        .concat(Array(targetColumns - currentColumns).fill(addedColumnWidth));
                } else {
                    const remainingWidths = tableData.columnWidths.slice(0, targetColumns);
                    const remainingTotal = remainingWidths.reduce((sum, width) => sum + (Number(width) || 0), 0) || 100;
                    tableData.columnWidths = remainingWidths.map((width) => ((Number(width) || 0) / remainingTotal) * 100);
                }

                tableData.rows.forEach((row) => {
                    if (row.length > targetColumns) row.length = targetColumns;
                    while (row.length < targetColumns) row.push('');
                });
            };
            const resizeTableRowForContent = (rowIndex) => {
                const row = tableEditor.querySelectorAll('.test-table-editor tr')[rowIndex];
                if (!row) return;
                const inputs = Array.from(row.querySelectorAll('textarea[data-row]'));
                const contentHeight = inputs.reduce((maximum, input) => {
                    input.style.height = 'auto';
                    const requiredHeight = Math.max(tableRowMinimumHeight, input.scrollHeight);
                    input.style.height = requiredHeight + 'px';
                    return Math.max(maximum, requiredHeight);
                }, tableRowMinimumHeight);
                row.style.height = Math.max(tableData.rowHeights[rowIndex] || tableRowMinimumHeight, contentHeight) + 'px';
            };
            const beginColumnResize = (event, columnIndex) => {
                event.preventDefault();
                const table = tableEditor.querySelector('.test-table-editor');
                const columnCount = tableData.columnWidths.length;
                if (columnCount < 2) return;
                const adjacentIndex = columnIndex === columnCount - 1 ? columnIndex - 1 : columnIndex + 1;
                const startX = event.clientX;
                const editorWidth = table.getBoundingClientRect().width;
                const startWidth = tableData.columnWidths[columnIndex] * editorWidth / 100;
                const adjacentStartWidth = tableData.columnWidths[adjacentIndex] * editorWidth / 100;
                const pairWidth = startWidth + adjacentStartWidth;
                const direction = columnIndex === columnCount - 1 ? -1 : 1;
                const onMove = (moveEvent) => {
                    const nextWidth = Math.max(tableCellMinimumWidth, Math.min(startWidth + ((moveEvent.clientX - startX) * direction), pairWidth - tableCellMinimumWidth));
                    tableData.columnWidths[columnIndex] = nextWidth / editorWidth * 100;
                    tableData.columnWidths[adjacentIndex] = (pairWidth - nextWidth) / editorWidth * 100;
                    applyTableWidths(table);
                    editTouched = true;
                };
                const onUp = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); resizeCleanup = null; };
                resizeCleanup?.();
                resizeCleanup = onUp;
                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp);
            };
            const beginRowResize = (event, rowIndex) => {
                event.preventDefault();
                const row = tableEditor.querySelectorAll('.test-table-editor tr')[rowIndex];
                const startY = event.clientY;
                const startHeight = row.getBoundingClientRect().height;
                const onMove = (moveEvent) => { tableData.rowHeights[rowIndex] = Math.max(tableRowMinimumHeight, startHeight + moveEvent.clientY - startY); resizeTableRowForContent(rowIndex); editTouched = true; };
                const onUp = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); resizeCleanup = null; };
                resizeCleanup?.();
                resizeCleanup = onUp;
                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp);
            };
            const renderTableEditor = () => {
                if (!tableEditor) return;
                normalizeTable();
                const rows = tableData.rows.length;
                const columns = tableData.rows[0].length;
                const titleValue = tableData.title.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
                tableEditor.innerHTML = `<label class="test-table-title-field">테이블 제목<input class="test-table-title-input" type="text" maxlength="80" placeholder="테이블 제목을 입력하세요." value="${titleValue}"></label><div class="test-table-controls"><label>행 <input class="test-table-row-count" type="number" min="1" max="12" value="${rows}"></label><label>열 <input class="test-table-column-count" type="number" min="1" max="12" value="${columns}"></label><label class="test-table-header-toggle"><input class="test-table-header-input" type="checkbox" ${tableData.hasHeader ? 'checked' : ''}> 첫 행 헤더</label><label class="test-table-header-toggle"><input class="test-table-first-column-header-input" type="checkbox" ${tableData.hasFirstColumnHeader ? 'checked' : ''}> 첫 열 헤더</label><button type="button" class="test-table-reset">테이블 재생성</button></div><div class="test-table-actions"><button type="button" data-table-action="add-row">행 추가</button><button type="button" data-table-action="remove-row">행 삭제</button><button type="button" data-table-action="add-column">열 추가</button><button type="button" data-table-action="remove-column">열 삭제</button></div><div class="test-table-editor-wrap"><table class="test-table-editor"><tbody>${tableData.rows.map((row, rowIndex) => `<tr>${row.map((value, columnIndex) => `<td class="${(tableData.hasHeader && rowIndex === 0) || (tableData.hasFirstColumnHeader && columnIndex === 0) ? 'test-table-header-cell' : ''}"><input type="text" data-row="${rowIndex}" data-column="${columnIndex}" value="${String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
                tableEditor.querySelectorAll('.test-table-editor input[data-row]').forEach((input) => {
                    const textArea = document.createElement('textarea');
                    textArea.rows = 1;
                    textArea.dataset.row = input.dataset.row;
                    textArea.dataset.column = input.dataset.column;
                    textArea.value = input.value;
                    input.replaceWith(textArea);
                });
                const editorTable = tableEditor.querySelector('.test-table-editor');
                const editorColgroup = document.createElement('colgroup');
                tableData.columnWidths.forEach(() => { const col = document.createElement('col'); editorColgroup.appendChild(col); });
                editorTable.insertBefore(editorColgroup, editorTable.firstChild);
                applyTableWidths(editorTable);
                editorTable.querySelectorAll('tr').forEach((row, rowIndex) => {
                    row.style.height = tableData.rowHeights[rowIndex] + 'px';
                    Array.from(row.children).forEach((cell, columnIndex) => {
                        const columnHandle = document.createElement('span');
                        columnHandle.className = 'test-table-column-resize-handle';
                        if (columnIndex === columns - 1) columnHandle.classList.add('is-last-column');
                        columnHandle.addEventListener('pointerdown', (event) => beginColumnResize(event, columnIndex));
                        cell.appendChild(columnHandle);

                        const rowHandle = document.createElement('span');
                        rowHandle.className = 'test-table-row-resize-handle';
                        rowHandle.addEventListener('pointerdown', (event) => beginRowResize(event, rowIndex));
                        cell.appendChild(rowHandle);
                    });
                    resizeTableRowForContent(rowIndex);
                });
                const rowCountInput = tableEditor.querySelector('.test-table-row-count');
                const columnCountInput = tableEditor.querySelector('.test-table-column-count');
                rowCountInput.addEventListener('change', (event) => {
                    const nextRows = Math.max(1, Math.min(12, Number(event.target.value) || 1));
                    while (tableData.rows.length < nextRows) tableData.rows.push(Array(columns).fill(''));
                    tableData.rows.length = nextRows;
                    editTouched = true;
                    renderTableEditor();
                });
                columnCountInput.addEventListener('change', (event) => {
                    const nextColumns = Math.max(1, Math.min(12, Number(event.target.value) || 1));
                    setTableColumnCount(nextColumns);
                    editTouched = true;
                    renderTableEditor();
                });
                [rowCountInput, columnCountInput].forEach((input) => input.addEventListener('keydown', (event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    input.dispatchEvent(new Event('change'));
                }));
                tableEditor.querySelector('.test-table-title-input').addEventListener('input', (event) => { tableData.title = event.target.value.slice(0, 80); editTouched = true; });
                tableEditor.querySelector('.test-table-header-input').addEventListener('change', (event) => { tableData.hasHeader = event.target.checked; editTouched = true; renderTableEditor(); });
                tableEditor.querySelector('.test-table-first-column-header-input').addEventListener('change', (event) => { tableData.hasFirstColumnHeader = event.target.checked; editTouched = true; renderTableEditor(); });
                tableEditor.querySelector('.test-table-reset').addEventListener('click', () => { tableData = { title: tableData.title, hasHeader: true, hasFirstColumnHeader: false, rows: Array.from({ length: rows }, () => Array(columns).fill('')) }; tableSlots[activeTableSlot - 1] = tableData; bodySlots[activeTableSlot - 1].tableData = tableData; editTouched = true; renderTableEditor(); });
                tableEditor.querySelectorAll('[data-table-action]').forEach((button) => button.addEventListener('click', () => {
                    const action = button.dataset.tableAction;
                    if (action === 'add-row' && tableData.rows.length < 12) tableData.rows.push(Array(columns).fill(''));
                    if (action === 'remove-row' && tableData.rows.length > 1) tableData.rows.pop();
                    if (action === 'add-column' && columns < 12) setTableColumnCount(columns + 1);
                    if (action === 'remove-column' && columns > 1) setTableColumnCount(columns - 1);
                    editTouched = true;
                    renderTableEditor();
                }));
                tableEditor.querySelectorAll('.test-table-editor textarea').forEach((input) => input.addEventListener('input', () => { tableData.rows[Number(input.dataset.row)][Number(input.dataset.column)] = input.value; resizeTableRowForContent(Number(input.dataset.row)); editTouched = true; }));
            };
            const renderBodyType = () => {
                if (!supportsTableBody) return;
                bodySlots.forEach((slot) => {
                    slot.field.style.display = (slot.type === 'text' || slot.type === 'text2') ? '' : 'none';
                    slot.tableEditor.style.display = slot.type === 'table' ? 'block' : 'none';
                    slot.typeSection.querySelectorAll('[data-body-type]').forEach((button) => button.classList.toggle('selected', button.dataset.bodyType === slot.type));
                    if (slot.type === 'table') {
                        activateTableSlot(slot);
                        renderTableEditor();
                        slot.tableData = tableData;
                        tableSlots[activeTableSlot - 1] = tableData;
                    }
                });
            };
            let contentArea = null;
            let contentImageBlocks = [];
            let contentPdfBlocks = [];
            let contentGoogleDriveBlocks = [];
            if (supportsTableBody) {
                const contentControls = document.createElement('div');
                contentControls.className = 'test-content-block-controls';
                contentControls.innerHTML = '<button type="button" class="test-add-image-block">+ 이미지 추가</button><button type="button" class="test-add-pdf-block">+ PDF 추가</button><button type="button" class="test-add-google-drive-block">+ Google Drive 문서 추가</button><button type="button" class="test-add-body-block">+ 본문 추가</button>';
                contentArea = document.createElement('div');
                contentArea.className = 'test-edit-content-blocks';
                descriptionField.insertAdjacentElement('afterend', contentControls);
                contentControls.insertAdjacentElement('afterend', contentArea);
                imageSlot.style.display = 'none';
                bodySlots.forEach((slot, index) => {
                    const panel = document.createElement('section');
                    panel.className = 'test-body-editor-panel';
                    const title = document.createElement('div');
                    title.className = 'test-body-editor-panel-title';
                    title.textContent = bodySlots.length > 1 ? `본문 ${index + 1}` : '본문';
                    const typeSection = document.createElement('section');
                    typeSection.className = 'test-body-type-section';
                    typeSection.innerHTML = `<div class="test-body-type-options"><button type="button" data-body-type="text" hidden>텍스트</button><button type="button" data-body-type="text2">Text</button><button type="button" data-body-type="table">Table</button></div><p>최초 등록 후 본문 타입은 변경할 수 없습니다.</p>`;
                    const slotTableEditor = document.createElement('section');
                    slotTableEditor.className = 'test-table-editor-section';
                    contentArea.appendChild(panel);
                    panel.append(title, typeSection, slot.field, slotTableEditor);
                    slot.panel = panel;
                    slot.active = Boolean(slot.active);
                    panel.hidden = !slot.active;
                    slot.typeSection = typeSection;
                    slot.tableEditor = slotTableEditor;
                    ['pointerdown', 'click', 'input', 'change', 'keydown'].forEach((eventName) => {
                        slotTableEditor.addEventListener(eventName, () => activateTableSlot(slot), true);
                    });
                    typeSection.querySelectorAll('[data-body-type]').forEach((button) => {
                        button.addEventListener('click', () => {
                            if ((supportsTableBody ? slot.typeLocked : bodyTypeIsLocked) && button.dataset.bodyType !== slot.type) return;
                            slot.type = button.dataset.bodyType;
                            editTouched = true;
                            renderBodyType();
                        });
                    });
                });
                const refreshBodyLabels = () => {
                    Array.from(contentArea.querySelectorAll('.test-body-editor-panel:not([hidden])')).forEach((panel, index) => {
                        panel.querySelector('.test-body-editor-panel-title').textContent = `본문 ${index + 1}`;
                    });
                };
                const imageBlocks = contentImageBlocks;
                const createImageBlock = (savedBlock = null) => {
                    const state = {
                        type: 'image',
                        imageId: savedBlock?.imageId || '',
                        file: null,
                        preview: '',
                        clipboardSource: Boolean(savedBlock?.clipboardSource)
                    };
                    const panel = document.createElement('section');
                    panel.className = 'test-edit-image-block';
                    const render = () => {
                        panel.replaceChildren();
                        const actions = document.createElement('div');
                        actions.className = 'test-content-block-actions';
                        actions.innerHTML = '<button type="button" data-image-action="up">위로</button><button type="button" data-image-action="down">아래로</button><button type="button" data-image-action="remove">삭제</button>';
                        if (state.preview) {
                            const image = document.createElement('img');
                            image.src = state.preview;
                            image.alt = '등록 이미지';
                            panel.appendChild(image);
                            const original = document.createElement('button');
                            original.type = 'button'; original.className = 'test-edit-original-btn'; original.textContent = '원본보기';
                            original.addEventListener('click', () => openOriginalImage(state.preview));
                            panel.appendChild(original);
                        } else {
                            const input = document.createElement('input');
                            input.type = 'file'; input.accept = 'image/*';
                            input.addEventListener('change', () => setFile(input.files[0]));
                            const instruction = document.createElement('p');
                            instruction.textContent = '이미지를 선택하거나 이 영역에 끌어 놓으세요.';
                            panel.append(input, instruction);
                        }
                        panel.appendChild(actions);
                    };
                    const setFile = (file) => {
                        if (!file || !file.type.startsWith('image/')) return;
                        if (state.preview.startsWith('blob:')) URL.revokeObjectURL(state.preview);
                        state.file = file;
                        state.preview = URL.createObjectURL(file);
                        editTouched = true;
                        render();
                    };
                    state.setFile = setFile;
                    panel.addEventListener('dragover', (event) => { event.preventDefault(); panel.classList.add('dragging'); });
                    panel.addEventListener('dragleave', () => panel.classList.remove('dragging'));
                    panel.addEventListener('drop', (event) => { event.preventDefault(); panel.classList.remove('dragging'); setFile(event.dataTransfer.files[0]); });
                    panel.addEventListener('click', (event) => {
                        const action = event.target.dataset.imageAction;
                        if (!action) return;
                        if (action === 'remove') {
                            panel.remove();
                            imageBlocks.splice(imageBlocks.indexOf(state), 1);
                        } else if (action === 'up' && panel.previousElementSibling) contentArea.insertBefore(panel, panel.previousElementSibling);
                        else if (action === 'down' && panel.nextElementSibling) contentArea.insertBefore(panel.nextElementSibling, panel);
                        editTouched = true;
                    });
                    imageBlocks.push(state);
                    if (state.imageId) loadImageBlob(state.imageId).then((blob) => { if (blob) { state.preview = URL.createObjectURL(blob); render(); } }).catch(showStorageWarning);
                    render();
                    state.panel = panel;
                    return { state, panel };
                };
                const createPdfBlock = (savedBlock = null) => {
                    const state = { type: 'pdf', pdfId: savedBlock?.pdfId || '', fileName: savedBlock?.fileName || '', file: null, preview: '' };
                    const panel = document.createElement('section');
                    panel.className = 'test-edit-pdf-block';
                    const render = () => {
                        panel.replaceChildren();
                        if (state.preview) {
                            const preview = document.createElement('canvas');
                            preview.className = 'test-card-pdf-preview';
                            preview.setAttribute('aria-label', `${state.fileName || '등록 PDF'} 첫 페이지 미리보기`);
                            const original = document.createElement('button');
                            original.type = 'button'; original.className = 'test-edit-original-btn'; original.textContent = '원본보기';
                            original.addEventListener('click', () => state.blob && openOriginalPdf(state.blob, state.fileName));
                            panel.append(preview, original);
                            if (state.blob) renderPdfPage(preview, state.blob, 1).catch(showStorageWarning);
                        } else {
                            const input = document.createElement('input');
                            input.type = 'file'; input.accept = 'application/pdf,.pdf';
                            input.addEventListener('change', () => setFile(input.files[0]));
                            const instruction = document.createElement('p');
                            instruction.textContent = 'PDF 파일을 선택하거나 이 영역에 놓으세요. 카드에는 첫 페이지가 표시됩니다.';
                            panel.append(input, instruction);
                        }
                        const actions = document.createElement('div');
                        actions.className = 'test-content-block-actions';
                        actions.innerHTML = '<button type="button" data-pdf-action="up">위로</button><button type="button" data-pdf-action="down">아래로</button><button type="button" data-pdf-action="remove">삭제</button>';
                        panel.appendChild(actions);
                    };
                    const setFile = (file) => {
                        if (!file || (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name))) return;
                        if (state.preview.startsWith('blob:')) URL.revokeObjectURL(state.preview);
                        state.file = file;
                        state.blob = file;
                        state.fileName = file.name;
                        state.preview = URL.createObjectURL(file);
                        editTouched = true;
                        render();
                    };
                    panel.addEventListener('dragover', (event) => { event.preventDefault(); panel.classList.add('dragging'); });
                    panel.addEventListener('dragleave', () => panel.classList.remove('dragging'));
                    panel.addEventListener('drop', (event) => { event.preventDefault(); panel.classList.remove('dragging'); setFile(event.dataTransfer.files[0]); });
                    panel.addEventListener('click', (event) => {
                        const action = event.target.dataset.pdfAction;
                        if (!action) return;
                        if (action === 'remove') { panel.remove(); contentPdfBlocks.splice(contentPdfBlocks.indexOf(state), 1); }
                        else if (action === 'up' && panel.previousElementSibling) contentArea.insertBefore(panel, panel.previousElementSibling);
                        else if (action === 'down' && panel.nextElementSibling) contentArea.insertBefore(panel.nextElementSibling, panel);
                        editTouched = true;
                    });
                    contentPdfBlocks.push(state);
                    if (state.pdfId) loadImageBlob(state.pdfId).then((blob) => { if (blob) { state.blob = blob; state.preview = URL.createObjectURL(blob); render(); } }).catch(showStorageWarning);
                    render();
                    state.panel = panel;
                    return { state, panel };
                };
                const createGoogleDriveBlock = (savedBlock = null) => {
                    const state = { type: 'googleDrive', ...savedBlock, url: savedBlock?.url || '' };
                    const panel = document.createElement('section');
                    panel.className = 'test-edit-google-drive-block';
                    const render = () => {
                        panel.replaceChildren();
                        const urlInput = document.createElement('input');
                        urlInput.type = 'url';
                        urlInput.className = 'test-google-drive-url-input';
                        urlInput.placeholder = 'Google Docs, Sheets, Slides 공유 링크를 붙여넣으세요.';
                        urlInput.value = state.url;
                        const status = document.createElement('p');
                        status.className = 'test-google-drive-status';
                        const parsed = parseGoogleDriveDocumentUrl(state.url);
                        if (parsed) {
                            Object.assign(state, parsed);
                            status.textContent = `${parsed.documentLabel} 링크가 등록됩니다. 공유 권한은 ‘링크가 있는 모든 사용자’여야 합니다.`;
                        } else {
                            status.textContent = 'Google Docs, Sheets, Slides의 공유 링크만 사용할 수 있습니다.';
                        }
                        urlInput.addEventListener('input', () => { state.url = urlInput.value.trim(); editTouched = true; });
                        urlInput.addEventListener('change', () => render());
                        const actions = document.createElement('div');
                        actions.className = 'test-content-block-actions';
                        actions.innerHTML = '<button type="button" data-google-drive-action="up">위로</button><button type="button" data-google-drive-action="down">아래로</button><button type="button" data-google-drive-action="remove">삭제</button>';
                        panel.append(urlInput, status, actions);
                    };
                    panel.addEventListener('click', (event) => {
                        const action = event.target.dataset.googleDriveAction;
                        if (!action) return;
                        if (action === 'remove') { panel.remove(); contentGoogleDriveBlocks.splice(contentGoogleDriveBlocks.indexOf(state), 1); }
                        else if (action === 'up' && panel.previousElementSibling) contentArea.insertBefore(panel, panel.previousElementSibling);
                        else if (action === 'down' && panel.nextElementSibling) contentArea.insertBefore(panel.nextElementSibling, panel);
                        editTouched = true;
                    });
                    contentGoogleDriveBlocks.push(state);
                    render();
                    state.panel = panel;
                    return { state, panel };
                };
                (Array.isArray(storedContentBlocks) ? storedContentBlocks : []).forEach((block, blockOrder) => {
                    if (block.type === 'image') {
                        const imageBlock = createImageBlock(block);
                        imageBlock.state.blockOrder = blockOrder;
                        contentArea.appendChild(imageBlock.panel);
                    } else if (block.type === 'pdf') {
                        const pdfBlock = createPdfBlock(block);
                        pdfBlock.state.blockOrder = blockOrder;
                        contentArea.appendChild(pdfBlock.panel);
                    } else if (block.type === 'googleDrive') {
                        const googleDriveBlock = createGoogleDriveBlock(block);
                        googleDriveBlock.state.blockOrder = blockOrder;
                        contentArea.appendChild(googleDriveBlock.panel);
                    }
                });
                if (Array.isArray(storedContentBlocks)) {
                    const orderedBlocks = [
                        ...bodySlots.filter((slot) => slot.active).map((slot) => ({ order: slot.blockOrder, panel: slot.panel })),
                        ...contentImageBlocks.map((state) => ({ order: state.blockOrder, panel: state.panel })),
                        ...contentPdfBlocks.map((state) => ({ order: state.blockOrder, panel: state.panel })),
                        ...contentGoogleDriveBlocks.map((state) => ({ order: state.blockOrder, panel: state.panel }))
                    ].sort((first, second) => first.order - second.order);
                    orderedBlocks.forEach(({ panel }) => contentArea.appendChild(panel));
                }
                contentControls.querySelector('.test-add-image-block').addEventListener('click', () => {
                    const imageBlock = createImageBlock();
                    contentArea.appendChild(imageBlock.panel);
                    editTouched = true;
                });
                contentControls.querySelector('.test-add-pdf-block').addEventListener('click', () => {
                    const pdfBlock = createPdfBlock();
                    contentArea.appendChild(pdfBlock.panel);
                    editTouched = true;
                });
                contentControls.querySelector('.test-add-google-drive-block').addEventListener('click', () => {
                    const googleDriveBlock = createGoogleDriveBlock();
                    contentArea.appendChild(googleDriveBlock.panel);
                    editTouched = true;
                });
                modal.addEventListener('paste', (event) => {
                    const item = Array.from(event.clipboardData?.items || []).find((entry) => entry.type.startsWith('image/'));
                    if (!item) return;
                    const imageBlock = createImageBlock();
                    contentArea.appendChild(imageBlock.panel);
                    const file = item.getAsFile();
                    if (file) {
                        imageBlock.state.setFile(file);
                    }
                    event.preventDefault();
                });
                const addBodyButton = contentControls.querySelector('.test-add-body-block');
                addBodyButton.addEventListener('click', () => {
                    const slot = bodySlots.find((item) => !item.active);
                    if (!slot) {
                        addBodyButton.disabled = true;
                        return;
                    }
                    slot.active = true;
                    slot.panel.hidden = false;
                    contentArea.appendChild(slot.panel);
                    refreshBodyLabels();
                    slot.field.focus();
                    editTouched = true;
                });
                bodySlots.forEach((slot) => {
                    const blockActions = document.createElement('div');
                    blockActions.className = 'test-content-block-actions';
                    blockActions.innerHTML = '<button type="button" data-block-action="up">위로</button><button type="button" data-block-action="down">아래로</button><button type="button" data-block-action="remove">삭제</button>';
                    slot.panel.appendChild(blockActions);
                    blockActions.addEventListener('click', (event) => {
                        const action = event.target.dataset.blockAction;
                        if (!action) return;
                        if (action === 'remove') {
                            slot.active = false;
                            slot.field.replaceChildren();
                            slot.panel.hidden = true;
                            addBodyButton.disabled = false;
                        } else if (action === 'up' && slot.panel.previousElementSibling) {
                            contentArea.insertBefore(slot.panel, slot.panel.previousElementSibling);
                        } else if (action === 'down' && slot.panel.nextElementSibling) {
                            contentArea.insertBefore(slot.panel.nextElementSibling, slot.panel);
                        }
                        refreshBodyLabels();
                        editTouched = true;
                    });
                });
                const copyButton = modal.querySelector('.test-card-edit-copy');
                const pasteButton = modal.querySelector('.test-card-edit-paste');
                const editorHasDraft = () => Boolean(
                    headerField.textContent.trim() ||
                    descriptionField.textContent.trim() ||
                    bodySlots.some((slot) => slot.active) ||
                    contentImageBlocks.some((state) => state.panel?.isConnected) ||
                    contentPdfBlocks.some((state) => state.panel?.isConnected) ||
                    contentGoogleDriveBlocks.some((state) => state.panel?.isConnected)
                );
                const editorHasCopyableContent = () => Boolean(
                    headerField.textContent.trim() ||
                    descriptionField.textContent.trim() ||
                    bodySlots.some((slot) => slot.active) ||
                    contentImageBlocks.some((state) => state.panel?.isConnected && (state.file || state.imageId)) ||
                    contentPdfBlocks.some((state) => state.panel?.isConnected && (state.file || state.pdfId)) ||
                    contentGoogleDriveBlocks.some((state) => state.panel?.isConnected && parseGoogleDriveDocumentUrl(state.url))
                );
                const refreshClipboardActions = () => {
                    copyButton.disabled = !editorHasCopyableContent();
                    pasteButton.hidden = !(
                        isValidCardClipboard(cardClipboard) &&
                        !cardHasStoredContent(card) &&
                        !editorHasDraft()
                    );
                };
                const storeClipboardSnapshot = async () => {
                    const newClipboardImageIds = [];
                    const clipboardBlocks = [];
                    try {
                        for (const element of Array.from(contentArea.children)) {
                            const slot = bodySlots.find((item) => item.panel === element);
                            if (slot?.active) {
                                clipboardBlocks.push(slot.type === 'table'
                                    ? { type: 'table', table: copyPlainValue(slot.tableData) }
                                    : { type: slot.type, text: slot.field.textContent.replace(/\r/g, ''), html: getStoredBodyHtml(slot.field) });
                                continue;
                            }
                            const imageState = contentImageBlocks.find((item) => item.panel === element);
                            if (imageState) {
                                if (!imageState.file && !imageState.imageId) continue;
                                const imageBlob = imageState.file || await loadImageBlob(imageState.imageId);
                                if (!imageBlob) throw new Error('복사할 이미지 데이터를 찾을 수 없습니다.');
                                const imageId = `clipboard-${createImageId()}`;
                                await saveImageBlob(imageId, imageBlob);
                                newClipboardImageIds.push(imageId);
                                clipboardBlocks.push({ type: 'image', imageId });
                                continue;
                            }
                            const googleDriveState = contentGoogleDriveBlocks.find((item) => item.panel === element);
                            const googleDriveDocument = googleDriveState && parseGoogleDriveDocumentUrl(googleDriveState.url);
                            if (googleDriveDocument) clipboardBlocks.push({ type: 'googleDrive', ...googleDriveDocument, title: googleDriveState.title || '' });
                        }
                        const now = Date.now();
                        const nextClipboard = {
                            version: 1,
                            copiedAt: now,
                            expiresAt: now + cardClipboardLifetime,
                            title: headerField.textContent.trim(),
                            description: descriptionField.textContent.trim(),
                            contentBlocks: clipboardBlocks
                        };
                        localStorage.setItem(cardClipboardStorageKey, JSON.stringify(nextClipboard));
                        const previousClipboard = cardClipboard;
                        cardClipboard = nextClipboard;
                        getClipboardImageIds(previousClipboard).forEach((imageId) => removeImageBlob(imageId).catch(showStorageWarning));
                        showCardNotice('카드 내용을 복사했습니다. 빈 카드에서 붙여넣을 수 있습니다.');
                    } catch (error) {
                        newClipboardImageIds.forEach((imageId) => removeImageBlob(imageId).catch(() => {}));
                        showCardNotice(error?.message || '카드 복사에 실패했습니다.', true);
                        throw error;
                    }
                };
                copyButton.addEventListener('click', async () => {
                    if (!editorHasCopyableContent() || copyButton.disabled) return;
                    copyButton.disabled = true;
                    const originalLabel = copyButton.textContent;
                    copyButton.textContent = '복사 중…';
                    try {
                        await storeClipboardSnapshot();
                        copyButton.textContent = '복사됨';
                    } catch (error) {
                        copyButton.textContent = originalLabel;
                    }
                    window.setTimeout(() => {
                        if (!copyButton.isConnected) return;
                        copyButton.textContent = originalLabel;
                        refreshClipboardActions();
                    }, 1200);
                });
                pasteButton.addEventListener('click', () => {
                    if (!isValidCardClipboard(cardClipboard) || cardHasStoredContent(card) || editorHasDraft()) {
                        refreshClipboardActions();
                        return;
                    }
                    headerField.textContent = cardClipboard.title;
                    descriptionField.textContent = cardClipboard.description;
                    cardClipboard.contentBlocks.forEach((block) => {
                        if (block.type === 'text' || block.type === 'text2' || block.type === 'table') {
                            const slot = bodySlots.find((item) => !item.active);
                            if (!slot) return;
                            slot.active = true;
                            slot.type = block.type;
                            slot.typeLocked = false;
                            slot.field.replaceChildren();
                            if (block.type === 'text' || block.type === 'text2') {
                                slot.field.innerHTML = block.html || '';
                                if (!slot.field.innerHTML) slot.field.textContent = block.text || '';
                            } else {
                                slot.tableData = copyPlainValue(block.table || { title: '', hasHeader: true, hasFirstColumnHeader: false, rows: [['']] });
                                tableSlots[bodySlots.indexOf(slot)] = slot.tableData;
                            }
                            slot.panel.hidden = false;
                            contentArea.appendChild(slot.panel);
                            return;
                        }
                        if (block.type === 'image' && block.imageId) {
                            const imageBlock = createImageBlock({ imageId: block.imageId, clipboardSource: true });
                            contentArea.appendChild(imageBlock.panel);
                        } else if (block.type === 'googleDrive') {
                            const googleDriveBlock = createGoogleDriveBlock(block);
                            contentArea.appendChild(googleDriveBlock.panel);
                        }
                    });
                    addBodyButton.disabled = !bodySlots.some((slot) => !slot.active);
                    renderBodyType();
                    refreshBodyLabels();
                    resizeField(descriptionField);
                    bodySlots.filter((slot) => slot.active && (slot.type === 'text' || slot.type === 'text2')).forEach((slot) => resizeField(slot.field));
                    editTouched = true;
                    refreshClipboardActions();
                    showCardNotice('복사한 내용을 불러왔습니다. 등록을 눌러 저장하세요.');
                });
                ['input', 'change'].forEach((eventName) => modal.addEventListener(eventName, refreshClipboardActions, true));
                modal.addEventListener('click', () => window.setTimeout(refreshClipboardActions, 0), true);
                refreshClipboardActions();
                renderBodyType();
            }
            const resizeField = (field) => { field.style.height = 'auto'; field.style.height = field.scrollHeight + 'px'; };
            headerField.addEventListener('input', () => { editTouched = true; });
            descriptionField.addEventListener('input', () => { editTouched = true; resizeField(descriptionField); });
            const closeBulletPicker = () => {
                if (bulletPicker) {
                    bulletPicker.remove();
                    bulletPicker = null;
                }
            };
            const closeFormatToolbar = () => {
                if (formatToolbar) {
                    formatToolbar.remove();
                    formatToolbar = null;
                }
            };
            const closeFormatToolbarOnOutsidePointerDown = (event) => {
                if (formatToolbar && !formatToolbar.contains(event.target)) closeFormatToolbar();
            };
            const closeFormatToolbarOnSelectionChange = () => {
                window.setTimeout(() => {
                    if (!formatToolbar) return;
                    const selection = window.getSelection();
                    if (!selection || !selection.rangeCount || selection.isCollapsed) {
                        closeFormatToolbar();
                        return;
                    }
                    const range = selection.getRangeAt(0);
                    if (!bodyField?.contains(range.commonAncestorContainer)) closeFormatToolbar();
                }, 0);
            };
            const closeFormatToolbarForContextChange = () => closeFormatToolbar();
            document.addEventListener('pointerdown', closeFormatToolbarOnOutsidePointerDown, true);
            document.addEventListener('selectionchange', closeFormatToolbarOnSelectionChange);
            window.addEventListener('wms-role-change', closeFormatToolbarForContextChange);
            window.addEventListener('wms-auth-change', closeFormatToolbarForContextChange);
            window.addEventListener('hashchange', closeFormatToolbarForContextChange);
            const activateBodyField = (field) => {
                if (bodyField === field) return;
                closeBulletPicker();
                closeFormatToolbar();
                bulletCommandStart = null;
                bulletCommandEnd = null;
                bodyField = field;
            };
            const isText2BodyField = () => bodySlots.some((slot) => slot.field === bodyField && slot.type === 'text2');
            const getText2IndentLevel = (indentation) => (
                (indentation.match(/\t/g)?.length || 0) + Math.floor(indentation.replace(/\t/g, '').length / 4)
            );
            const toText2Alphabetic = (value) => {
                let number = Math.max(1, value);
                let result = '';
                while (number > 0) {
                    number -= 1;
                    result = String.fromCharCode(97 + (number % 26)) + result;
                    number = Math.floor(number / 26);
                }
                return result;
            };
            const toText2Roman = (value) => {
                const symbols = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
                let number = Math.max(1, value);
                let result = '';
                symbols.forEach(([amount, symbol]) => {
                    while (number >= amount) {
                        result += symbol;
                        number -= amount;
                    }
                });
                return result;
            };
            const getText2NumberMarker = (level, sequence) => {
                if (level === 0) return `${sequence}.`;
                if (level === 1) return `${toText2Alphabetic(sequence)}.`;
                return `${toText2Roman(sequence)}.`;
            };
            const getText2NumberedLine = (line) => /^(\s*)((?:\d+|[a-z]+|[ivxlcdm]+)\.)\s(.*)$/i.exec(line);
            const getText2BulletMarker = (level) => ['•', '◦', '-'][Math.min(2, Math.max(0, level))];
            const getText2BulletLine = (line) => /^(\s*)([•◦▪-])\s(.*)$/.exec(line);
            const getText2NumberSequence = (value, lineStart, level) => {
                const precedingLines = value.slice(0, lineStart).split('\n');
                let sequence = 0;
                for (let index = precedingLines.length - 1; index >= 0; index -= 1) {
                    const candidate = precedingLines[index];
                    const candidateIndentation = (candidate.match(/^\s*/) || [''])[0];
                    const candidateLevel = getText2IndentLevel(candidateIndentation);
                    if (candidateLevel < level) break;
                    if (candidateLevel > level) continue;
                    if (!getText2NumberedLine(candidate)) break;
                    sequence += 1;
                }
                return sequence;
            };
            const renumberText2NumberedLines = (selectionStart, selectionEnd = selectionStart) => {
                const value = getBodyValue();
                const edits = [];
                const counters = new Map();
                const parentIds = [];
                let lineStart = 0;
                value.split('\n').forEach((line, lineIndex) => {
                    const indentation = (line.match(/^\s*/) || [''])[0];
                    const level = getText2IndentLevel(indentation);
                    const numbered = getText2NumberedLine(line);
                    if (!numbered || level > 2) {
                        if (level === 0) counters.delete('root');
                        else if (parentIds[level - 1]) counters.delete(parentIds[level - 1]);
                        parentIds.length = Math.min(parentIds.length, level);
                        lineStart += line.length + 1;
                        return;
                    }
                    const parentId = level === 0 ? 'root' : (parentIds[level - 1] || `orphan-${level}`);
                    const sequence = (counters.get(parentId) || 0) + 1;
                    counters.set(parentId, sequence);
                    const marker = getText2NumberMarker(level, sequence);
                    const markerStart = lineStart + numbered[1].length;
                    const markerEnd = markerStart + numbered[2].length;
                    if (numbered[2] !== marker) edits.push({ start: markerStart, end: markerEnd, value: marker });
                    parentIds[level] = `line-${lineIndex}`;
                    parentIds.length = level + 1;
                    lineStart += line.length + 1;
                });
                if (!edits.length) return { start: selectionStart, end: selectionEnd };
                const adjustOffset = (offset) => edits.reduce((adjusted, edit) => (
                    edit.start < offset ? adjusted + edit.value.length - (edit.end - edit.start) : adjusted
                ), offset);
                [...edits].sort((first, second) => second.start - first.start).forEach((edit) => replaceBodyRange(edit.start, edit.end, edit.value));
                const nextSelection = { start: adjustOffset(selectionStart), end: adjustOffset(selectionEnd) };
                setBodySelection(nextSelection.start, nextSelection.end);
                return nextSelection;
            };
            const insertText2NumberedLineBreak = () => {
                const value = getBodyValue();
                const selection = getBodySelection();
                const lineStart = value.lastIndexOf('\n', selection.start - 1) + 1;
                const currentLine = value.slice(lineStart, selection.start);
                const numbered = getText2NumberedLine(currentLine);
                if (!numbered) return false;
                const level = getText2IndentLevel(numbered[1]);
                if (level > 2) return false;
                const sequence = getText2NumberSequence(value, lineStart, level);
                const nextLine = `\n${numbered[1]}${getText2NumberMarker(level, sequence + 1)} `;
                replaceBodyRange(selection.start, selection.end, nextLine);
                const caret = selection.start + nextLine.length;
                renumberText2NumberedLines(caret);
                return true;
            };
            const insertText2BulletLineBreak = () => {
                const value = getBodyValue();
                const selection = getBodySelection();
                const lineStart = value.lastIndexOf('\n', selection.start - 1) + 1;
                const currentLine = value.slice(lineStart, selection.start);
                const bullet = getText2BulletLine(currentLine);
                if (!bullet) return false;
                const level = getText2IndentLevel(bullet[1]);
                if (level > 2) return false;
                const nextLine = `\n${bullet[1]}${getText2BulletMarker(level)} `;
                replaceBodyRange(selection.start, selection.end, nextLine);
                return true;
            };
            const handleText2NumberIndent = (value, start, end, lineStart, lineEnd, shiftKey) => {
                const selected = value.slice(lineStart, lineEnd);
                const selectedLines = selected.split('\n');
                if (!selectedLines.some((line) => getText2NumberedLine(line))) return false;
                if (start === end) {
                    const line = selectedLines[0];
                    const numbered = getText2NumberedLine(line);
                    if (!numbered) return false;
                    const level = getText2IndentLevel(numbered[1]);
                    if (!shiftKey && level >= 2) return true;
                    if (!shiftKey) {
                        replaceBodyRange(lineStart, lineStart, '    ');
                        renumberText2NumberedLines(start + 4);
                        return true;
                    }
                    if (level > 0) {
                        const removeLength = line.startsWith('\t') ? 1 : 4;
                        replaceBodyRange(lineStart, lineStart + removeLength, '');
                        renumberText2NumberedLines(Math.max(lineStart, start - removeLength));
                        return true;
                    }
                    const prefixLength = numbered[1].length + numbered[2].length + 1;
                    replaceBodyRange(lineStart, lineStart + prefixLength, '');
                    renumberText2NumberedLines(Math.max(lineStart, start - prefixLength));
                    return true;
                }
                const changed = selectedLines.map((line) => {
                    const numbered = getText2NumberedLine(line);
                    if (!shiftKey) {
                        if (numbered && getText2IndentLevel(numbered[1]) >= 2) return line;
                        return `    ${line}`;
                    }
                    if (/^(    |\t)/.test(line)) return line.replace(/^(    |\t)/, '');
                    if (numbered) return line.slice(numbered[1].length + numbered[2].length + 1);
                    return line.replace(/^([•◦-])\s/, '');
                }).join('\n');
                replaceBodyRange(lineStart, lineEnd, changed);
                renumberText2NumberedLines(lineStart + changed.length);
                return true;
            };
            const handleText2BulletIndent = (value, start, end, lineStart, lineEnd, shiftKey) => {
                const selectedLines = value.slice(lineStart, lineEnd).split('\n');
                if (!selectedLines.some((line) => getText2BulletLine(line))) return false;
                const edits = [];
                let currentLineStart = lineStart;
                selectedLines.forEach((line) => {
                    const bullet = getText2BulletLine(line);
                    if (!shiftKey) {
                        if (bullet && getText2IndentLevel(bullet[1]) >= 2) {
                            currentLineStart += line.length + 1;
                            return;
                        }
                        edits.push({ start: currentLineStart, end: currentLineStart, value: '    ' });
                        if (bullet) {
                            const markerStart = currentLineStart + bullet[1].length;
                            edits.push({
                                start: markerStart,
                                end: markerStart + bullet[2].length,
                                value: getText2BulletMarker(getText2IndentLevel(bullet[1]) + 1)
                            });
                        }
                    } else if (/^(    |\t)/.test(line)) {
                        const remove = /^(    |\t)/.exec(line)[0];
                        if (bullet) {
                            const markerStart = currentLineStart + bullet[1].length;
                            edits.push({
                                start: markerStart,
                                end: markerStart + bullet[2].length,
                                value: getText2BulletMarker(getText2IndentLevel(bullet[1]) - 1)
                            });
                        }
                        edits.push({ start: currentLineStart, end: currentLineStart + remove.length, value: '' });
                    } else if (bullet) {
                        edits.push({
                            start: currentLineStart + bullet[1].length,
                            end: currentLineStart + bullet[1].length + bullet[2].length + 1,
                            value: ''
                        });
                    }
                    currentLineStart += line.length + 1;
                });
                if (!edits.length) return true;
                const adjustOffset = (offset) => edits.reduce((adjusted, edit) => (
                    edit.start < offset ? adjusted + edit.value.length - (edit.end - edit.start) : adjusted
                ), offset);
                [...edits].sort((first, second) => (
                    second.start - first.start || (second.end - second.start) - (first.end - first.start)
                )).forEach((edit) => replaceBodyRange(edit.start, edit.end, edit.value));
                setBodySelection(adjustOffset(start), adjustOffset(end));
                return true;
            };
            const closePopupOnEscape = (event) => {
                if (event.key !== 'Escape' || (!bulletPicker && !formatToolbar)) return;
                event.preventDefault();
                event.stopPropagation();
                closeBulletPicker();
                closeFormatToolbar();
                bulletCommandStart = null;
                bulletCommandEnd = null;
                bodyField.focus();
            };
            document.addEventListener('keydown', closePopupOnEscape);
            const applyBodyFormat = (type, value) => {
                const selection = window.getSelection();
                if (!selection || !selection.rangeCount || selection.isCollapsed) return;
                const range = selection.getRangeAt(0);
                const wrapper = document.createElement('span');
                if (type === 'weight') wrapper.style.fontWeight = value;
                if (type === 'color') wrapper.style.color = value;
                wrapper.appendChild(range.extractContents());
                range.insertNode(wrapper);
                const formattedRange = document.createRange();
                formattedRange.selectNodeContents(wrapper);
                selection.removeAllRanges();
                selection.addRange(formattedRange);
                editTouched = true;
            };
            const showFormatToolbar = (x, y) => {
                const selection = window.getSelection();
                if (!selection || !selection.rangeCount || selection.isCollapsed) return;
                const range = selection.getRangeAt(0);
                if (!bodyField.contains(range.commonAncestorContainer)) return;
                closeFormatToolbar();
                formatToolbar = document.createElement('div');
                formatToolbar.className = 'test-format-toolbar';
                formatToolbar.innerHTML = '<button type="button" data-weight="700">Bold</button><button type="button" data-weight="400">Regular</button><span class="test-format-divider"></span><div class="test-format-colors"></div><button type="button" class="test-format-toolbar-close" aria-label="서식 도구 닫기" title="닫기">&times;</button>';
                const colors = [
                    ['#000000', '검은색'], ['#999999', '회색'], ['#ff0000', '빨간색'],
                    ['#ff9900', '주황색'], ['#0000ff', '파란색'], ['#ff00ff', '분홍색']
                ];
                const colorContainer = formatToolbar.querySelector('.test-format-colors');
                colors.forEach(([color, label]) => {
                    const swatch = document.createElement('button');
                    swatch.type = 'button';
                    swatch.className = 'test-format-color';
                    swatch.dataset.color = color;
                    swatch.title = label;
                    swatch.style.backgroundColor = color;
                    colorContainer.appendChild(swatch);
                });
                formatToolbar.querySelectorAll('button').forEach((button) => {
                    button.addEventListener('mousedown', (event) => event.preventDefault());
                });
                formatToolbar.querySelector('.test-format-toolbar-close').addEventListener('click', () => {
                    closeFormatToolbar();
                    bodyField.focus();
                });
                formatToolbar.querySelectorAll('button[data-weight], button[data-color]').forEach((button) => {
                    button.addEventListener('click', () => {
                        if (button.dataset.weight) applyBodyFormat('weight', button.dataset.weight);
                        if (button.dataset.color) applyBodyFormat('color', button.dataset.color);
                        bodyField.focus();
                    });
                });
                document.body.appendChild(formatToolbar);
                const toolbarWidth = formatToolbar.offsetWidth;
                formatToolbar.style.left = Math.max(8, Math.min(x, window.innerWidth - toolbarWidth - 8)) + 'px';
                formatToolbar.style.top = Math.max(8, Math.min(y, window.innerHeight - 58)) + 'px';
            };
            const showBulletPicker = () => {
                closeBulletPicker();
                bulletPicker = document.createElement('div');
                bulletPicker.className = 'test-bullet-picker';
                bulletPicker.innerHTML = isText2BodyField()
                    ? '<button type="button" data-bullet="number">1</button><button type="button" data-bullet="•">•</button>'
                    : '<button type="button" data-bullet="number">1</button><button type="button" data-bullet="•">•</button><button type="button" data-bullet="◦">◦</button><button type="button" data-bullet="-">-</button>';
                const fieldRect = bodyField.getBoundingClientRect();
                bulletPicker.style.left = Math.min(fieldRect.left, window.innerWidth - 190) + 'px';
                bulletPicker.style.top = Math.min(fieldRect.top + 34, window.innerHeight - 70) + 'px';
                document.body.appendChild(bulletPicker);
                const bulletButtons = Array.from(bulletPicker.querySelectorAll('button'));
                let bulletIndex = 0;
                const focusBullet = (index) => {
                    bulletIndex = (index + bulletButtons.length) % bulletButtons.length;
                    bulletButtons.forEach((item, itemIndex) => item.classList.toggle('selected', itemIndex === bulletIndex));
                    bulletButtons[bulletIndex].focus();
                };
                bulletButtons.forEach((button, buttonIndex) => {
                    button.addEventListener('click', () => {
                        const selection = getBodySelection();
                        const cursor = selection.end;
                        let replaceStart = bulletCommandStart === null ? cursor - 1 : bulletCommandStart;
                        const replaceEnd = bulletCommandEnd === null ? cursor : bulletCommandEnd;
                        const fieldValue = getBodyValue();
                        const lineStart = fieldValue.lastIndexOf('\n', replaceStart - 1) + 1;
                        const isInitialText2Bullet = isText2BodyField() &&
                            button.dataset.bullet !== 'number' &&
                            fieldValue.slice(0, replaceStart).trim() === '';
                        if (isInitialText2Bullet) replaceStart = lineStart;
                        const indentation = (fieldValue.slice(lineStart, replaceStart).match(/^\s*/) || [''])[0];
                        const level = getText2IndentLevel(indentation);
                        const sequence = getText2NumberSequence(fieldValue, lineStart, level) + 1;
                        const bulletText = button.dataset.bullet === 'number'
                            ? (isText2BodyField() ? `${getText2NumberMarker(level, sequence)} ` : '1. ')
                            : (isText2BodyField() ? `${isInitialText2Bullet ? '•' : getText2BulletMarker(level)} ` : button.dataset.bullet + ' ');
                        replaceBodyRange(replaceStart, replaceEnd, bulletText);
                        bodyField.focus();
                        editTouched = true;
                        bulletCommandStart = null;
                        bulletCommandEnd = null;
                        closeBulletPicker();
                    });
                    button.addEventListener('keydown', (event) => {
                        if (event.key === 'ArrowRight') {
                            event.preventDefault();
                            focusBullet(buttonIndex + 1);
                        } else if (event.key === 'ArrowLeft') {
                            event.preventDefault();
                            focusBullet(buttonIndex - 1);
                        } else if (event.key === 'Enter') {
                            event.preventDefault();
                            button.click();
                        }
                    });
                });
                focusBullet(0);
            };
            const bodyInputHandler = () => {
                editTouched = true;
                resizeField(bodyField);
                const value = getBodyValue();
                const selection = getBodySelection();
                const cursor = selection.end;
                const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
                const lineBeforeCursor = value.slice(lineStart, cursor);
                const text2NumberMarker = isText2BodyField() ? '(?:\\d+|[a-z]+|[ivxlcdm]+)' : '\\d+';
                const text2BulletMarker = isText2BodyField() ? '[•◦▪-]' : '[•◦-]';
                const prefixedSlash = new RegExp(
                    `^(\\s*)(?:${text2NumberMarker}\\.|${text2BulletMarker})\\s*\\/$`,
                    isText2BodyField() ? 'i' : ''
                ).exec(lineBeforeCursor);
                if (prefixedSlash) {
                    bulletCommandStart = lineStart + prefixedSlash[1].length;
                    bulletCommandEnd = cursor;
                    showBulletPicker();
                } else if (lineBeforeCursor.trim() === '/') {
                    bulletCommandStart = cursor - 1;
                    bulletCommandEnd = cursor;
                    showBulletPicker();
                } else {
                    bulletCommandStart = null;
                    bulletCommandEnd = null;
                    closeBulletPicker();
                }
            };
            const insertBodyLineBreak = () => {
                if (isText2BodyField() && insertText2NumberedLineBreak()) {
                    bodyInputHandler();
                    return;
                }
                if (isText2BodyField() && insertText2BulletLineBreak()) {
                    bodyInputHandler();
                    return;
                }
                const value = getBodyValue();
                const selection = getBodySelection();
                const start = selection.start;
                const end = selection.end;
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const currentLine = value.slice(lineStart, start);
                const numbered = /^(\s*)(\d+)\.\s*/.exec(currentLine);
                const bullet = /^(\s*)([•◦-])\s/.exec(currentLine);
                let nextLine = '\n';
                if (numbered) nextLine += numbered[1] + (Number(numbered[2]) + 1) + '. ';
                else if (bullet) nextLine += bullet[1] + bullet[2] + ' ';
                if (numbered || bullet) {
                    replaceBodyRange(start, end, nextLine);
                    if (numbered) {
                        const insertedCaret = start + nextLine.length;
                        const updatedValue = getBodyValue();
                        const followingLineBreak = updatedValue.indexOf('\n', insertedCaret);
                        if (followingLineBreak !== -1) {
                            const targetIndent = numbered[1];
                            let expectedNumber = Number(numbered[2]) + 2;
                            let followingLineStart = followingLineBreak + 1;
                            const renumberEdits = [];
                            while (followingLineStart < updatedValue.length) {
                                const nextBreak = updatedValue.indexOf('\n', followingLineStart);
                                const followingLineEnd = nextBreak === -1 ? updatedValue.length : nextBreak;
                                const followingLine = updatedValue.slice(followingLineStart, followingLineEnd);
                                const followingNumbered = /^(\s*)(\d+)\.\s/.exec(followingLine);
                                const followingIndent = (followingLine.match(/^\s*/) || [''])[0];
                                if (!followingNumbered) {
                                    if (followingIndent.length > targetIndent.length) {
                                        if (nextBreak === -1) break;
                                        followingLineStart = nextBreak + 1;
                                        continue;
                                    }
                                    break;
                                }
                                if (followingNumbered[1].length < targetIndent.length) break;
                                if (followingNumbered[1] === targetIndent) {
                                    const numberStart = followingLineStart + followingNumbered[1].length;
                                    renumberEdits.push({
                                        start: numberStart,
                                        end: numberStart + followingNumbered[2].length,
                                        value: String(expectedNumber)
                                    });
                                    expectedNumber += 1;
                                }
                                if (nextBreak === -1) break;
                                followingLineStart = nextBreak + 1;
                            }
                            renumberEdits.reverse().forEach((edit) => replaceBodyRange(edit.start, edit.end, edit.value));
                            setBodySelection(insertedCaret, insertedCaret);
                        }
                    }
                } else insertPlainBodyLineBreak(start, end);
                bodyInputHandler();
            };
            const renumberFollowingTopLevelItems = (value, startOffset) => {
                const previousNumberedLine = value.slice(0, startOffset).split('\n').reverse().find((line) => /^(\d+)\.\s/.test(line));
                let nextNumber = previousNumberedLine ? Number(/^(\d+)\.\s/.exec(previousNumberedLine)[1]) + 1 : 1;
                let lineStart = startOffset;
                const renumberEdits = [];
                while (lineStart < value.length) {
                    const nextBreak = value.indexOf('\n', lineStart);
                    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
                    const line = value.slice(lineStart, lineEnd);
                    const numbered = /^(\s*)(\d+)\.\s/.exec(line);
                    const indent = (line.match(/^\s*/) || [''])[0];
                    if (!numbered) {
                        if (indent.length > 0) {
                            if (nextBreak === -1) break;
                            lineStart = nextBreak + 1;
                            continue;
                        }
                        break;
                    }
                    if (numbered[1].length > 0) {
                        if (nextBreak === -1) break;
                        lineStart = nextBreak + 1;
                        continue;
                    }
                    const numberStart = lineStart + numbered[1].length;
                    renumberEdits.push({
                        start: numberStart,
                        end: numberStart + numbered[2].length,
                        value: String(nextNumber)
                    });
                    nextNumber += 1;
                    if (nextBreak === -1) break;
                    lineStart = nextBreak + 1;
                }
                renumberEdits.reverse().forEach((edit) => replaceBodyRange(edit.start, edit.end, edit.value));
            };
            const attachBodyEditor = (field) => {
                field.addEventListener('focus', () => activateBodyField(field));
                field.addEventListener('compositionstart', () => {
                    activateBodyField(field);
                    bodyCompositionActive = true;
                });
                field.addEventListener('compositionend', () => {
                    bodyCompositionActive = false;
                    removeStaleBodyLineBreakFillers();
                    if (!pendingCompositionEnter || pendingCompositionEnter.field !== field) return;
                    const pendingEnter = pendingCompositionEnter;
                    pendingCompositionEnter = null;
                    window.setTimeout(() => {
                        if (!field.isConnected || pendingEnter.sequence !== compositionEnterSequence) return;
                        activateBodyField(field);
                        const currentState = getBodyLineBreakState();
                        const browserInsertedLineBreak = (
                            currentState.textBreakCount > pendingEnter.state.textBreakCount ||
                            currentState.visualBreakCount > pendingEnter.state.visualBreakCount ||
                            currentState.caretLine > pendingEnter.state.caretLine
                        );
                        if (!browserInsertedLineBreak) insertBodyLineBreak();
                    }, 0);
                });
                field.addEventListener('input', () => {
                    activateBodyField(field);
                    if (!bodyCompositionActive) removeStaleBodyLineBreakFillers();
                    bodyInputHandler();
                });
                field.addEventListener('mouseup', (event) => {
                    activateBodyField(field);
                    setTimeout(() => showFormatToolbar(event.clientX, event.clientY), 0);
                });
                field.addEventListener('paste', (event) => {
                    activateBodyField(field);
                const text = event.clipboardData?.getData('text/plain');
                if (text !== undefined) {
                    event.preventDefault();
                    const selection = getBodySelection();
                    replaceBodyRange(selection.start, selection.end, text);
                    bodyInputHandler();
                }
                });
                field.addEventListener('keydown', (event) => {
                activateBodyField(field);
                const isEnterKey = isEnterKeyEvent(event);
                const isCompositionKey = event.isComposing || bodyCompositionActive || event.keyCode === 229 || event.which === 229;
                // Keep the visual empty-line filler while text or IME composition is being inserted.
                // Removing it before composition moves Chrome's insertion point back to the previous line.
                if (!isCompositionKey && (isEnterKey || event.key === 'Tab')) removeBodyLineBreakFillers();
                // 한글 IME의 Enter는 먼저 조합을 확정시킨 뒤 compositionend에서 같은 Enter의 줄바꿈을 보완한다.
                if (isEnterKey && isCompositionKey) {
                    compositionEnterSequence += 1;
                    pendingCompositionEnter = {
                        field,
                        sequence: compositionEnterSequence,
                        state: getBodyLineBreakState()
                    };
                    return;
                }
                if (event.isComposing || bodyCompositionActive || event.keyCode === 229 || event.which === 229) {
                    return;
                }
                const value = getBodyValue();
                const selection = getBodySelection();
                const start = selection.start;
                const end = selection.end;
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const lineEndIndex = value.indexOf('\n', end);
                const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
                if (isEnterKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    insertBodyLineBreak();
                } else if (event.key === 'Tab') {
                    event.preventDefault();
                    if (isText2BodyField() && handleText2NumberIndent(value, start, end, lineStart, lineEnd, event.shiftKey)) {
                        bodyInputHandler();
                        return;
                    }
                    if (isText2BodyField() && handleText2BulletIndent(value, start, end, lineStart, lineEnd, event.shiftKey)) {
                        bodyInputHandler();
                        return;
                    }
                    const hasSelection = start !== end;
                    if (!hasSelection) {
                        if (event.shiftKey) {
                            const currentLinePrefix = value.slice(lineStart, lineStart + 4);
                            const removeCount = currentLinePrefix.startsWith('\t') ? 1 : (currentLinePrefix.startsWith('    ') ? 4 : 0);
                            if (removeCount) {
                                let dedentedLine = value.slice(lineStart, lineEnd).slice(removeCount);
                                const targetIndent = (dedentedLine.match(/^\s*/) || [''])[0].length;
                                const previousLines = value.slice(0, lineStart).split('\n').reverse();
                                const previousAtLevel = previousLines.find((line) => {
                                    const listItem = /^(\s*)(?:(\d+)\.|([•◦-]))\s/.exec(line);
                                    return listItem && listItem[1].length === targetIndent;
                                });
                                const currentListItem = /^(\s*)(?:(\d+)\.|([•◦-]))\s/.exec(dedentedLine);
                                const previousListItem = previousAtLevel && /^(\s*)(?:(\d+)\.|([•◦-]))\s/.exec(previousAtLevel);
                                if (currentListItem && previousListItem) {
                                    const nextPrefix = previousListItem[2]
                                        ? (Number(previousListItem[2]) + 1) + '. '
                                        : previousListItem[3] + ' ';
                                    dedentedLine = dedentedLine.replace(/^(\s*)(?:(\d+)|[•◦-])\.?(\s)/, '$1' + nextPrefix);
                                }
                                replaceBodyRange(lineStart, lineEnd, dedentedLine);
                            } else {
                                const topLevelListItem = /^(\d+\.|[•◦-])\s/.exec(value.slice(lineStart, lineEnd));
                                if (topLevelListItem) {
                                    const removedPrefixLength = topLevelListItem[0].length;
                                    const originalLine = value.slice(lineStart, lineEnd);
                                    replaceBodyRange(lineStart, lineStart + removedPrefixLength, '');
                                    if (/^\d+\.$/.test(topLevelListItem[1])) {
                                        const updatedValue = getBodyValue();
                                        const followingStart = lineStart + originalLine.length - removedPrefixLength + 1;
                                        renumberFollowingTopLevelItems(updatedValue, followingStart);
                                    }
                                    const nextCaret = Math.max(lineStart, start - removedPrefixLength);
                                    setBodySelection(nextCaret, nextCaret);
                                }
                            }
                        } else {
                            const currentLine = value.slice(lineStart, lineEnd);
                            const numberedLine = /^(\s*)(\d+)\.\s(.*)$/.exec(currentLine);
                            if (numberedLine) {
                                const resetLine = '    ' + numberedLine[1] + '1. ' + numberedLine[3];
                                replaceBodyRange(lineStart, lineEnd, resetLine);
                            } else {
                                replaceBodyRange(lineStart, lineStart, '    ');
                                setBodySelection(start + 4, start + 4);
                            }
                        }
                        bodyInputHandler();
                        return;
                    }
                    const selected = value.slice(lineStart, lineEnd);
                    const lines = selected.split('\n');
                    const indent = event.shiftKey ? -1 : 1;
                    const removedTopLevelNumber = event.shiftKey && lines.some((line) => /^\d+\.\s/.test(line));
                    const changed = lines.map((line) => {
                        if (indent > 0) {
                            const numberedLine = /^(\s*)(\d+)\.\s(.*)$/.exec(line);
                            return numberedLine ? '    ' + numberedLine[1] + '1. ' + numberedLine[3] : '    ' + line;
                        }
                        const removeIndent = /^(    |\t)/.exec(line);
                        if (removeIndent) return line.slice(removeIndent[0].length);
                        return line.replace(/^(\d+\.|[•◦-])\s/, '');
                    }).join('\n');
                    replaceBodyRange(lineStart, lineEnd, changed);
                    if (removedTopLevelNumber) {
                        const updatedValue = getBodyValue();
                        const followingStart = lineStart + changed.length + 1;
                        renumberFollowingTopLevelItems(updatedValue, followingStart);
                    }
                    setBodySelection(lineStart + changed.length, lineStart + changed.length);
                    bodyInputHandler();
                }
                });
            };
            bodySlots.forEach((slot) => {
                attachBodyEditor(slot.field);
            });
            resizeField(descriptionField);
            resizeField(primaryBodyField);
            bodySlots.forEach((slot) => resizeField(slot.field));
            const renderEditImage = () => {
                if (!pendingImage) {
                    imageSlot.innerHTML = '<input class="test-edit-image-input" type="file" accept="image/*" hidden><div class="test-edit-image-instructions">이미지를 드래그앤드롭하거나 <button type="button" class="test-upload-trigger">파일을 업로드</button><br>클립보드 이미지는 Ctrl + V로 붙여넣으세요.</div>';
                    imageSlot.querySelector('.test-upload-trigger').addEventListener('click', () => imageSlot.querySelector('.test-edit-image-input').click());
                    imageSlot.querySelector('.test-edit-image-input').addEventListener('change', (event) => readImageFile(event.target.files[0]));
                } else {
                    imageSlot.innerHTML = '<img src="' + pendingImage + '" alt="등록 이미지"><button type="button" class="test-edit-original-btn">원본보기</button><button type="button" class="test-edit-image-remove">이미지 삭제</button>';
                    imageSlot.querySelector('.test-edit-original-btn').addEventListener('click', () => openOriginalImage(pendingImage));
                    imageSlot.querySelector('.test-edit-image-remove').addEventListener('click', () => {
                        editTouched = true;
                        pendingImageBlob = null;
                        pendingImage = '';
                        renderEditImage();
                    });
                }
            };
            const readImageFile = (file) => {
                if (!file || !file.type.startsWith('image/')) return;
                if (pendingImage.startsWith('blob:')) URL.revokeObjectURL(pendingImage);
                pendingImageBlob = file;
                pendingImage = URL.createObjectURL(file);
                editTouched = true;
                renderEditImage();
            };
            const commitPendingImage = async () => {
                const previousImageId = card.dataset.imageId || '';
                if (pendingImageBlob) {
                    const imageId = createImageId();
                    await saveImageBlob(imageId, pendingImageBlob);
                    card.dataset.imageId = imageId;
                    card.dataset.imageUrl = pendingImage;
                    card.dataset.legacyImage = '';
                    if (previousImageId) removeImageBlob(previousImageId).catch(showStorageWarning);
                    return;
                }
                if (!pendingImage && previousImageId) {
                    card.dataset.imageId = '';
                    card.dataset.imageUrl = '';
                    card.dataset.legacyImage = '';
                    removeImageBlob(previousImageId).catch(showStorageWarning);
                }
            };
            imageSlot.addEventListener('dragover', (event) => { event.preventDefault(); imageSlot.classList.add('dragging'); });
            imageSlot.addEventListener('dragleave', () => imageSlot.classList.remove('dragging'));
            imageSlot.addEventListener('drop', (event) => { event.preventDefault(); imageSlot.classList.remove('dragging'); readImageFile(event.dataTransfer.files[0]); });
            modal.addEventListener('paste', (event) => {
                if (supportsTableBody) return;
                const item = Array.from(event.clipboardData?.items || []).find((entry) => entry.type.startsWith('image/'));
                if (item) { event.preventDefault(); readImageFile(item.getAsFile()); }
            });
            renderEditImage();
            // 편집 팝업이 열려 있는 동안에는 바깥쪽 드래그/마우스 이벤트가
            // 전역 업데이트 등록 버튼으로 전달되지 않도록 차단한다.
            // 삭제 확인창과 원본 이미지 보기 창은 팝업에서 연속으로 사용하는
            // 보조 대화창이므로 상호작용을 허용한다.
            const isEditInteractionTarget = (target) => {
                if (!(target instanceof Element)) return false;
                return dialog.contains(target) ||
                    Boolean(target.closest('.test-bullet-picker')) ||
                    Boolean(target.closest('.test-format-toolbar')) ||
                    Boolean(target.closest('.test-card-delete-confirm-overlay')) ||
                    Boolean(target.closest('.test-card-delete-confirm')) ||
                    Boolean(target.closest('.test-original-image-overlay')) ||
                    Boolean(target.closest('.test-original-image-dialog'));
            };
            const blockOutsideInteraction = (event) => {
                if (!isEditInteractionTarget(event.target)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            };
            ['mousedown', 'mouseup', 'mousemove', 'click'].forEach((eventName) => {
                document.addEventListener(eventName, blockOutsideInteraction, true);
            });
            const close = () => {
                ['mousedown', 'mouseup', 'mousemove', 'click'].forEach((eventName) => {
                    document.removeEventListener(eventName, blockOutsideInteraction, true);
                });
                document.removeEventListener('keydown', closePopupOnEscape);
                document.removeEventListener('pointerdown', closeFormatToolbarOnOutsidePointerDown, true);
                document.removeEventListener('selectionchange', closeFormatToolbarOnSelectionChange);
                window.removeEventListener('wms-role-change', closeFormatToolbarForContextChange);
                window.removeEventListener('wms-auth-change', closeFormatToolbarForContextChange);
                window.removeEventListener('hashchange', closeFormatToolbarForContextChange);
                closeBulletPicker();
                closeFormatToolbar();
                resizeCleanup?.();
                modal.remove();
            };
            modal.querySelector('.test-card-edit-close').addEventListener('click', close);
            modal.querySelector('.test-card-edit-save').addEventListener('click', async (event) => {
                const saveButton = event.currentTarget;
                if (saveButton.disabled) return;
                saveButton.disabled = true;
                try {
                    if (!supportsTableBody) await commitPendingImage();
                } catch (error) {
                    showStorageWarning(error);
                }
                card.dataset.title = headerField.textContent.trim();
                card.dataset.description = descriptionField.textContent.trim();
                if (supportsTableBody) {
                    const previousBlocks = card.dataset.contentBlocks ? JSON.parse(card.dataset.contentBlocks) : [];
                    const oldAssetIds = previousBlocks.flatMap((block) => block.type === 'image' ? [block.imageId] : (block.type === 'pdf' ? [block.pdfId] : [])).filter(Boolean);
                    const blocks = [];
                    const newImageIds = [];
                    const committedImageStates = [];
                    try {
                        for (const element of Array.from(contentArea.children)) {
                            const slot = bodySlots.find((item) => item.panel === element);
                            if (slot?.active) {
                                blocks.push(slot.type === 'table'
                                    ? { type: 'table', table: slot.tableData }
                                    : { type: slot.type, text: slot.field.textContent.replace(/\r/g, ''), html: getStoredBodyHtml(slot.field) });
                                continue;
                            }
                            const imageState = contentImageBlocks.find((item) => item.panel === element);
                            if (imageState) {
                                let imageId = imageState.imageId;
                                if (imageState.file || (imageState.clipboardSource && imageState.imageId)) {
                                    const imageBlob = imageState.file || await loadImageBlob(imageState.imageId);
                                    if (!imageBlob) throw new Error('붙여넣을 이미지 데이터를 찾을 수 없습니다.');
                                    imageId = createImageId();
                                    await saveImageBlob(imageId, imageBlob);
                                    newImageIds.push(imageId);
                                    committedImageStates.push({ state: imageState, imageId });
                                }
                                if (imageId) blocks.push({ type: 'image', imageId });
                                continue;
                            }
                            const googleDriveState = contentGoogleDriveBlocks.find((item) => item.panel === element);
                            if (googleDriveState) {
                                const documentData = parseGoogleDriveDocumentUrl(googleDriveState.url);
                                if (!documentData) throw new Error('Google Docs, Sheets, Slides 공유 링크를 입력해 주세요.');
                                blocks.push({ type: 'googleDrive', ...documentData, title: googleDriveState.title || '' });
                                continue;
                            }
                            const pdfState = contentPdfBlocks.find((item) => item.panel === element);
                            if (!pdfState) continue;
                            let pdfId = pdfState.pdfId;
                            if (pdfState.file) {
                                pdfId = createImageId();
                                await saveImageBlob(pdfId, pdfState.file);
                                newImageIds.push(pdfId);
                                committedImageStates.push({ state: pdfState, imageId: pdfId, assetKey: 'pdfId' });
                            }
                            if (pdfId) blocks.push({ type: 'pdf', pdfId, fileName: pdfState.fileName || '등록 PDF' });
                        }
                    } catch (error) {
                        newImageIds.forEach((imageId) => removeImageBlob(imageId).catch(() => {}));
                        showCardNotice(error?.message || '카드 저장에 실패했습니다.', true);
                        saveButton.disabled = false;
                        return;
                    }
                    committedImageStates.forEach(({ state, imageId }) => {
                        if (state.type === 'pdf') state.pdfId = imageId;
                        else state.imageId = imageId;
                        state.clipboardSource = false;
                    });
                    const retainedAssetIds = new Set(blocks.flatMap((block) => block.type === 'image' ? [block.imageId] : (block.type === 'pdf' ? [block.pdfId] : [])));
                    oldAssetIds.filter((id) => !retainedAssetIds.has(id)).forEach((id) => removeImageBlob(id).catch(showStorageWarning));
                    card.dataset.contentBlocks = JSON.stringify(blocks);
                    card.dataset.body = '';
                    card.dataset.bodyHtml = '';
                    card.dataset.body2 = '';
                    card.dataset.body2Html = '';
                    card.dataset.table = '';
                    card.dataset.table2 = '';
                    card.dataset.imageId = '';
                    card.dataset.imageUrl = '';
                    card.dataset.legacyImage = '';
                    card.dataset.bodyType = 'text';
                    card.dataset.bodyTypeLocked = 'true';
                    card.dataset.body2Type = 'text';
                } else {
                    card.dataset.body = primaryBodyField.textContent.replace(/\r/g, '');
                    card.dataset.bodyHtml = getStoredBodyHtml(primaryBodyField);
                    card.dataset.body2 = secondarySlot ? secondaryBodyField.textContent.replace(/\r/g, '') : '';
                    card.dataset.body2Html = secondarySlot ? getStoredBodyHtml(secondaryBodyField) : '';
                }
                renderTestCard(card);
                notifyChange();
                close();
            });
            const removeCard = () => {
                const row = card.parentElement;
                const imageIdToRemove = card.dataset.imageId || '';
                const blockAssetIds = card.dataset.contentBlocks ? JSON.parse(card.dataset.contentBlocks).flatMap((block) => block.type === 'image' ? [block.imageId] : (block.type === 'pdf' ? [block.pdfId] : [])).filter(Boolean) : [];
                const layout = row && row.classList.contains('test-card-left-right-side') ? row.parentElement : row;
                if (layout && layout.classList.contains('test-card-row-left-right')) {
                    const primary = layout.querySelector(':scope > .test-card-left-right-primary');
                    const side = layout.querySelector(':scope > .test-card-left-right-side');
                    if (card === primary) {
                        const remainingCards = Array.from(side.children);
                        card.remove();
                        if (remainingCards.length === 1) {
                            const remaining = remainingCards[0];
                            remaining.classList.add('test-created-card-single');
                            layout.parentElement.insertBefore(remaining, layout);
                            layout.remove();
                        } else {
                            layout.className = 'test-card-row';
                            remainingCards.forEach((remaining) => {
                                remaining.classList.remove('test-card-left-right-primary', 'test-created-card-single');
                                layout.appendChild(remaining);
                            });
                            side.remove();
                        }
                    } else {
                        card.remove();
                        if (side.children.length === 1) {
                            side.classList.add('test-card-left-right-side-single');
                        } else if (side.children.length === 0) {
                            primary.classList.add('test-created-card-single');
                            layout.parentElement.insertBefore(primary, layout);
                            layout.remove();
                        }
                    }
                } else if (row && row.classList.contains('test-card-row')) {
                    if (row.classList.contains('test-card-row-triple') && row.children.length === 3) {
                        card.remove();
                        row.classList.remove('test-card-row-triple');
                    } else if (row.children.length === 2) {
                        const remaining = row.children[0] === card ? row.children[1] : row.children[0];
                        remaining.classList.add('test-created-card-single');
                        row.parentElement.insertBefore(remaining, row);
                        row.remove();
                    } else {
                        card.remove();
                        row.remove();
                    }
                } else {
                    card.remove();
                }
                if (row && !row.isConnected) {
                    row._testCardResizeObserver?.disconnect();
                    row._testCardResizeObserver = null;
                }
                Array.from(testCardList.querySelectorAll(':scope > .test-card-row')).forEach((cardRow) => setupResizableRow(cardRow, cardRow.dataset.columnWidths ? JSON.parse(cardRow.dataset.columnWidths) : null));
                updateCardMoveButtons();
                notifyChange();
                removeImageBlob(imageIdToRemove).catch(showStorageWarning);
                blockAssetIds.forEach((imageId) => removeImageBlob(imageId).catch(showStorageWarning));
                close();
            };
            modal.querySelector('.test-card-edit-delete').addEventListener('click', () => {
                // 초기 상태는 카드의 모든 저장 값이 비어 있는 새 카드다.
                // 이미 등록된 값이 하나라도 있으면, 현재 편집 내용이 같아도 삭제 확인을 표시한다.
                const registeredContentExists = Boolean(
                    initialValues.title ||
                    initialValues.description ||
                    initialValues.body ||
                    initialValues.body2 ||
                    initialValues.tables.some(Boolean) ||
                    initialValues.image ||
                    Boolean(card.dataset.contentBlocks)
                );
                const hasChanges = registeredContentExists || editTouched ||
                    headerField.textContent.trim() !== initialValues.title ||
                    descriptionField.textContent.trim() !== initialValues.description ||
                    primaryBodyField.textContent.replace(/\r/g, '') !== initialValues.body ||
                    (secondaryBodyField ? secondaryBodyField.textContent.replace(/\r/g, '') : '') !== initialValues.body2 ||
                    bodySlots.some((slot, index) => slot.type !== initialValues.bodyTypes[index] || (slot.type === 'table' ? JSON.stringify(slot.tableData) : '') !== initialValues.tables[index]) ||
                    pendingImage !== initialValues.image;
                if (!hasChanges) {
                    removeCard();
                    return;
                }
                const confirmModal = document.createElement('div');
                confirmModal.className = 'test-card-delete-confirm-overlay';
                confirmModal.innerHTML = '<div class="test-card-delete-confirm" role="dialog" aria-modal="true"><p>작성된 내용이 있습니다. 삭제하겠습니까?</p><div><button type="button" class="test-card-delete-confirm-btn">삭제</button><button type="button" class="test-card-delete-cancel-btn">취소</button></div></div>';
                document.body.appendChild(confirmModal);
                confirmModal.querySelector('.test-card-delete-confirm-btn').addEventListener('click', () => { confirmModal.remove(); removeCard(); });
                confirmModal.querySelector('.test-card-delete-cancel-btn').addEventListener('click', () => confirmModal.remove());
            });
        }

        testAddCardBtn.classList.add('permission-editor-only');
        testAddCardBtn.addEventListener('click', () => {
            if (isEditorMode()) openTestCardTypeModal();
        });
        const restoreInitialRows = async () => {
            let migrated = false;
            if (Array.isArray(initialRows) && initialRows.length) {
                try {
                    migrated = await migrateLegacyCardImages(initialRows);
                    if (structuredContent && migrateLegacyCardsToStructuredContent(initialRows)) migrated = true;
                } catch (error) {
                    showStorageWarning(error);
                }
                restoring = true;
                initialRows.forEach((row) => addTestCard(row.type, row.cards, row.columnWidths));
                restoring = false;
                if (migrated) notifyChange();
            }
        };
        restoreInitialRows();
    }

    const testCardStorageKey = 'wms-test-menu-cards-v1';
    function loadTestCardRows() {
        try {
            const rows = JSON.parse(localStorage.getItem(testCardStorageKey));
            return Array.isArray(rows) ? rows : [];
        } catch (_) {
            return [];
        }
    }
    window.initializeSharedCardEditor = initializeSharedCardEditor;
    const testCardList = document.getElementById('testCardList');
    const testAddCardBtn = document.getElementById('testAddCardBtn');
    initializeSharedCardEditor({
        cardList: testCardList,
        addButton: testAddCardBtn,
        initialRows: loadTestCardRows(),
        onChange: (rows) => localStorage.setItem(testCardStorageKey, JSON.stringify(rows)),
        structuredContent: true,
        supportsTripleCards: true
    });
    window.dispatchEvent(new Event('shared-card-editor-ready'));
}());
