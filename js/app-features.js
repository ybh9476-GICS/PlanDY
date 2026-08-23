// Global Search Engine Logic
    const searchModal = document.getElementById('searchModal');
    const searchModalContainer = document.querySelector('.search-modal-container');
    const searchModalHeader = document.querySelector('.search-modal-header');
    const searchInput = document.getElementById('searchInput');
    const searchSubmitBtn = document.getElementById('searchSubmitBtn');
    const searchModalCloseBtn = document.getElementById('searchModalCloseBtn');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const searchResultsHeader = document.getElementById('searchResultsHeader');
    const searchResultsList = document.getElementById('searchResultsList');

    const tabNameMap = {
        'overview': '개요',
        'floor': '층 관리',
        'zone': '범위 관리',
        'rack': '랙 관리',
        'editor': '저작도구',
        'route': '경로 찾기',
        'settings': '시스템 설정'
    };

    function getSearchTabTitle(tabId) {
        const hierarchicalLabel = window.wmsMenuTree?.getPathLabel?.(tabId);
        if (hierarchicalLabel) return hierarchicalLabel;
        const menuLink = Array.from(document.querySelectorAll('.nav-link[data-tab]'))
            .find(link => link.dataset.tab === tabId);
        const menuLabel = menuLink?.querySelector('.hide-on-collapse')?.textContent.trim();
        return menuLabel || tabNameMap[tabId] || tabId;
    }

    let isDraggingModal = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialContainerLeft = 0;
    let initialContainerTop = 0;

    function positionSearchModalNearButton() {
        const searchBtn = document.querySelector('[data-tooltip="검색"]');
        if (searchBtn) {
            const btnRect = searchBtn.getBoundingClientRect();
            searchModalContainer.style.transform = 'none';
            searchModalContainer.style.left = (btnRect.right + 12) + 'px';
            const modalHeight = searchModalContainer.offsetHeight || 280;
            let top = btnRect.bottom - modalHeight;
            top = Math.max(16, Math.min(top, window.innerHeight - modalHeight - 16));
            searchModalContainer.style.top = top + 'px';
            searchModalContainer.style.bottom = 'auto';
        }
    }

    function openSearchModal() {
        closeNotificationModal();
        closeHelpModal();
        searchModal.style.display = 'block';
        positionSearchModalNearButton();
        searchInput.focus();
    }

    function closeSearchModal() {
        searchModal.style.display = 'none';
        searchInput.value = '';
        searchResultsContainer.style.display = 'none';
        searchResultsList.innerHTML = '';
        document.querySelectorAll('.search-target-highlight').forEach(function(el) {
            el.classList.remove('search-target-highlight');
        });
    }

    // Draggable Search Modal Header
    searchModalHeader.addEventListener('mousedown', function(e) {
        if (e.target.closest('#searchModalCloseBtn')) return;

        isDraggingModal = true;
        searchModalHeader.style.cursor = 'grabbing';

        const rect = searchModalContainer.getBoundingClientRect();
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialContainerLeft = rect.left;
        initialContainerTop = rect.top;

        searchModalContainer.style.transform = 'none';
        searchModalContainer.style.left = initialContainerLeft + 'px';
        searchModalContainer.style.top = initialContainerTop + 'px';

        document.addEventListener('mousemove', onModalMouseMove);
        document.addEventListener('mouseup', onModalMouseUp);
    });

    function onModalMouseMove(e) {
        if (!isDraggingModal) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        let newLeft = initialContainerLeft + dx;
        let newTop = initialContainerTop + dy;

        const maxLeft = window.innerWidth - searchModalContainer.offsetWidth;
        const maxTop = window.innerHeight - searchModalContainer.offsetHeight;

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        searchModalContainer.style.left = newLeft + 'px';
        searchModalContainer.style.top = newTop + 'px';
    }

    function onModalMouseUp() {
        if (isDraggingModal) {
            isDraggingModal = false;
            searchModalHeader.style.cursor = 'move';
            document.removeEventListener('mousemove', onModalMouseMove);
            document.removeEventListener('mouseup', onModalMouseUp);
        }
    }

    const sidebarSearchBtn = document.getElementById('sidebarSearchBtn');
    const sidebarBellBtn = document.getElementById('sidebarBellBtn');
    const sidebarHelpBtn = document.getElementById('sidebarHelpBtn');

    if (sidebarSearchBtn) {
        sidebarSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSearchModal();
        });
    }

    searchModalCloseBtn.addEventListener('click', closeSearchModal);

    // Notification Modal Logic
    const notificationModal = document.getElementById('notificationModal');
    const notificationModalContainer = document.getElementById('notificationModalContainer');
    const notificationModalHeader = document.getElementById('notificationModalHeader');
    const notificationModalCloseBtn = document.getElementById('notificationModalCloseBtn');

    let isDraggingNotification = false;
    let notifStartX = 0, notifStartY = 0, notifInitLeft = 0, notifInitTop = 0;

    function positionNotificationModalNearButton() {
        const bellBtn = document.getElementById('sidebarBellBtn') || document.querySelector('[data-tooltip="업데이트 내역"]');
        if (bellBtn) {
            const btnRect = bellBtn.getBoundingClientRect();
            notificationModalContainer.style.transform = 'none';
            notificationModalContainer.style.left = (btnRect.right + 12) + 'px';
            const modalHeight = notificationModalContainer.offsetHeight || 380;
            let top = btnRect.bottom - modalHeight;
            top = Math.max(16, Math.min(top, window.innerHeight - modalHeight - 16));
            notificationModalContainer.style.top = top + 'px';
            notificationModalContainer.style.bottom = 'auto';
        }
    }

    function openNotificationModal() {
        closeSearchModal();
        closeHelpModal();
        notificationModal.style.display = 'block';
        positionNotificationModalNearButton();
    }

    function closeNotificationModal() {
        notificationModal.style.display = 'none';
        document.querySelectorAll('.search-target-highlight').forEach(function(el) {
            el.classList.remove('search-target-highlight');
        });
    }

    if (sidebarBellBtn) {
        sidebarBellBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openNotificationModal();
        });
    }

    if (notificationModalCloseBtn) {
        notificationModalCloseBtn.addEventListener('click', closeNotificationModal);
    }

    if (notificationModalHeader) {
        notificationModalHeader.addEventListener('mousedown', function(e) {
            if (e.target.closest('#notificationModalCloseBtn')) return;
            isDraggingNotification = true;
            notificationModalHeader.style.cursor = 'grabbing';

            const rect = notificationModalContainer.getBoundingClientRect();
            notifStartX = e.clientX;
            notifStartY = e.clientY;
            notifInitLeft = rect.left;
            notifInitTop = rect.top;

            notificationModalContainer.style.transform = 'none';
            notificationModalContainer.style.left = notifInitLeft + 'px';
            notificationModalContainer.style.top = notifInitTop + 'px';

            document.addEventListener('mousemove', onNotifMouseMove);
            document.addEventListener('mouseup', onNotifMouseUp);
        });
    }

    function onNotifMouseMove(e) {
        if (!isDraggingNotification) return;
        const dx = e.clientX - notifStartX;
        const dy = e.clientY - notifStartY;
        let newLeft = notifInitLeft + dx;
        let newTop = notifInitTop + dy;
        const maxLeft = window.innerWidth - notificationModalContainer.offsetWidth;
        const maxTop = window.innerHeight - notificationModalContainer.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));
        notificationModalContainer.style.left = newLeft + 'px';
        notificationModalContainer.style.top = newTop + 'px';
    }

    function onNotifMouseUp() {
        if (isDraggingNotification) {
            isDraggingNotification = false;
            notificationModalHeader.style.cursor = 'move';
            document.removeEventListener('mousemove', onNotifMouseMove);
            document.removeEventListener('mouseup', onNotifMouseUp);
        }
    }

    // Help Modal Logic
    const helpModal = document.getElementById('helpModal');
    const helpModalCloseBtn = document.getElementById('helpModalCloseBtn');
    const helpConfirmBtn = document.getElementById('helpConfirmBtn');
    let helpPreviouslyFocused = null;

    function setHelpToggleState(button, open) {
        const panel = document.getElementById(button.getAttribute('aria-controls'));
        const section = button.closest('.help-level1, .help-level2');
        button.setAttribute('aria-expanded', String(open));
        button.querySelector('.help-toggle-icon').textContent = open ? '▼' : '▶';
        section?.classList.toggle('is-open', open);
        if (panel) panel.hidden = !open;
    }

    function initializeHelpAccordion() {
        if (!helpModal) return;
        helpModal.querySelectorAll('.help-level1-toggle').forEach((button) => {
            button.addEventListener('click', () => {
                const nextOpen = button.getAttribute('aria-expanded') !== 'true';
                setHelpToggleState(button, nextOpen);
            });
        });
        helpModal.querySelectorAll('.help-level2-toggle').forEach((button) => {
            button.addEventListener('click', () => setHelpToggleState(button, button.getAttribute('aria-expanded') !== 'true'));
        });
    }

    function collapseAllHelpSections() {
        if (!helpModal) return;
        helpModal.querySelectorAll('.help-level1-toggle, .help-level2-toggle').forEach((button) => {
            setHelpToggleState(button, false);
        });
    }

    initializeHelpAccordion();

    function closeHelpModal() {
        if (!helpModal?.classList.contains('is-open')) return;
        helpModal.classList.remove('is-open');
        helpModal.setAttribute('aria-hidden', 'true');
        if (document.body.dataset.authenticated === 'true') helpPreviouslyFocused?.focus();
        helpPreviouslyFocused = null;
    }

    function openHelpModal() {
        if (window.wmsPermissions?.isAuthenticated?.() !== true || !helpModal) return;
        closeSearchModal();
        closeNotificationModal();
        if (updateRegisterModal?.style.display !== 'none') closeUpdateRegisterModal();
        helpPreviouslyFocused = document.activeElement;
        collapseAllHelpSections();
        helpModal.classList.add('is-open');
        helpModal.setAttribute('aria-hidden', 'false');
        helpModalCloseBtn?.focus();
    }

    sidebarHelpBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openHelpModal();
    });
    helpModalCloseBtn?.addEventListener('click', closeHelpModal);
    helpConfirmBtn?.addEventListener('click', closeHelpModal);
    helpModal?.addEventListener('click', (event) => { if (event.target === helpModal) closeHelpModal(); });
    window.addEventListener('wms-auth-change', (event) => { if (!event.detail?.authenticated) closeHelpModal(); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (searchModal && searchModal.style.display !== 'none') closeSearchModal();
            if (notificationModal && notificationModal.style.display !== 'none') closeNotificationModal();
            if (helpModal?.classList.contains('is-open')) closeHelpModal();
            if (updateRegisterModal && updateRegisterModal.style.display !== 'none') closeUpdateRegisterModal();
        }
    });

    // ==========================================
    // Update Registration System
    // ==========================================
    const updateItemsList = document.getElementById('updateItemsList');
    const updateEmptyMessage = document.getElementById('updateEmptyMessage');
    const floatingUpdateBtn = document.getElementById('floatingUpdateBtn');
    const updateRegisterModal = document.getElementById('updateRegisterModal');
    const updateSelectedText = document.getElementById('updateSelectedText');
    const updateMenuLocation = document.getElementById('updateMenuLocation');
    const updateDescription = document.getElementById('updateDescription');
    const updateSubmitBtn = document.getElementById('updateSubmitBtn');
    const updateCancelBtn = document.getElementById('updateCancelBtn');
    const updateRegisterCloseBtn = document.getElementById('updateRegisterCloseBtn');

    let pendingSelectedText = '';
    let pendingMenuLocation = '';
    const updateEntries = [];

    function canRegisterUpdate() {
        return window.wmsPermissions?.isAuthenticated?.() === true && window.wmsPermissions?.isEditor?.() === true;
    }

    function clearPendingUpdateRegistration() {
        floatingUpdateBtn.style.display = 'none';
        pendingSelectedText = '';
        pendingMenuLocation = '';
        pendingTargetElement = null;
        pendingTabId = '';
    }

    // Detect current active tab name
    function getCurrentTabName() {
        const activeLink = document.querySelector('.nav-link.active[data-tab]');
        if (activeLink) {
            const tabId = activeLink.getAttribute('data-tab');
            return window.wmsMenuTree?.getPathLabel?.(tabId) || tabNameMap[tabId] || tabId;
        }
        return '알 수 없음';
    }

    let pendingTargetElement = null;
    let pendingTabId = '';

    // Show floating button on text selection (mouseup)
    document.addEventListener('mouseup', function(e) {
        // 카드 수정 팝업이 열려 있는 동안에는 전역 업데이트 버튼을 만들지 않는다.
        // 팝업 본문에서의 선택은 팝업 전용 서식 도구가 처리한다.
        if (!canRegisterUpdate() || document.querySelector('.test-card-edit-overlay')) {
            clearPendingUpdateRegistration();
            return;
        }
        // Ignore if inside modals or floating button
        if (e.target.closest('#searchModal') || e.target.closest('#notificationModal') ||
            e.target.closest('#updateRegisterModal') || e.target.closest('#menuManagerModal') || e.target.closest('#helpModal') ||
            e.target.closest('#floatingUpdateBtn') ||
            e.target.closest('.sidebar')) return;

        setTimeout(function() {
            if (!canRegisterUpdate()) {
                clearPendingUpdateRegistration();
                return;
            }
            const selection = window.getSelection();
            const selectedStr = selection.toString().trim();

            if (selectedStr.length > 0) {
                pendingSelectedText = selectedStr;
                pendingMenuLocation = getCurrentTabName();

                // Store the target element and tab for navigation
                if (selection.anchorNode) {
                    let node = selection.anchorNode;
                    pendingTargetElement = node.nodeType === 3 ? node.parentElement : node;
                    // Find which tab this element belongs to
                    const panel = pendingTargetElement.closest('.view-panel');
                    if (panel) {
                        pendingTabId = panel.id.replace('view-', '');
                    } else {
                        const activeLink = document.querySelector('.nav-link.active[data-tab]');
                        pendingTabId = activeLink ? activeLink.getAttribute('data-tab') : 'overview';
                    }
                }

                floatingUpdateBtn.style.display = 'block';
                let left = e.clientX + 8;
                let top = e.clientY - 36;
                // Clamp to viewport
                if (left + 160 > window.innerWidth) left = window.innerWidth - 170;
                if (top < 8) top = e.clientY + 12;
                floatingUpdateBtn.style.left = left + 'px';
                floatingUpdateBtn.style.top = top + 'px';
            } else {
                clearPendingUpdateRegistration();
            }
        }, 10);
    });

    // Hide floating button on click elsewhere
    document.addEventListener('mousedown', function(e) {
        if (!canRegisterUpdate() || document.querySelector('.test-card-edit-overlay')) {
            clearPendingUpdateRegistration();
            return;
        }
        if (e.target.closest('#menuManagerModal')) return;
        if (!e.target.closest('#floatingUpdateBtn')) {
            // small delay to let mouseup fire first
            setTimeout(function() {
                const sel = window.getSelection();
                if (!sel || sel.toString().trim().length === 0) {
                    floatingUpdateBtn.style.display = 'none';
                }
            }, 200);
        }
    });

    // Click floating button → open registration modal
    floatingUpdateBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!canRegisterUpdate()) {
            clearPendingUpdateRegistration();
            return;
        }
        floatingUpdateBtn.style.display = 'none';
        openUpdateRegisterModal();
    });

    function openUpdateRegisterModal() {
        if (!canRegisterUpdate() || !pendingSelectedText) {
            clearPendingUpdateRegistration();
            return;
        }
        updateSelectedText.textContent = pendingSelectedText;
        updateMenuLocation.textContent = pendingMenuLocation;
        updateDescription.value = '';
        updateRegisterModal.style.display = 'block';
        setTimeout(function() { updateDescription.focus(); }, 100);
    }

    function closeUpdateRegisterModal() {
        updateRegisterModal.style.display = 'none';
        clearPendingUpdateRegistration();
        window.getSelection().removeAllRanges();
    }

    window.addEventListener('wms-role-change', () => {
        if (!canRegisterUpdate()) {
            clearPendingUpdateRegistration();
            if (updateRegisterModal.style.display !== 'none') closeUpdateRegisterModal();
        }
    });
    window.addEventListener('wms-auth-change', () => {
        if (!canRegisterUpdate()) {
            clearPendingUpdateRegistration();
            if (updateRegisterModal.style.display !== 'none') closeUpdateRegisterModal();
        }
    });

    updateRegisterCloseBtn.addEventListener('click', closeUpdateRegisterModal);
    updateCancelBtn.addEventListener('click', closeUpdateRegisterModal);

    // Submit update entry
    updateSubmitBtn.addEventListener('click', function() {
        if (!canRegisterUpdate()) {
            closeUpdateRegisterModal();
            return;
        }
        const selectedText = pendingSelectedText;
        const menuLocation = pendingMenuLocation;
        const description = updateDescription.value.trim();

        if (!selectedText) return;

        const now = new Date();
        const dateStr = now.getFullYear() + '.' +
            String(now.getMonth() + 1).padStart(2, '0') + '.' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');

        const entry = {
            selectedText: selectedText,
            menuLocation: menuLocation,
            description: description,
            date: dateStr,
            timestamp: now.getTime(),
            targetElement: pendingTargetElement,
            tabId: pendingTabId
        };
        updateEntries.unshift(entry);

        renderUpdateItems();
        closeUpdateRegisterModal();
        pendingTargetElement = null;
        pendingTabId = '';
    });

    function renderUpdateItems() {
        updateItemsList.innerHTML = '';

        // Remove entries older than 1 week
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        for (let i = updateEntries.length - 1; i >= 0; i--) {
            if (updateEntries[i].timestamp && (now - updateEntries[i].timestamp) > oneWeekMs) {
                updateEntries.splice(i, 1);
            }
        }

        if (updateEntries.length === 0) {
            updateEmptyMessage.style.display = 'block';
            return;
        }
        updateEmptyMessage.style.display = 'none';

        updateEntries.forEach(function(entry, idx) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cssText = 'padding:0.75rem 0.85rem; border-radius:6px; background:#f8fafc; border:1px solid #e2e8f0; margin-bottom:0; cursor:pointer; transition: background 0.15s, border-color 0.15s;';

            let descHtml = '';
            if (entry.description) {
                descHtml = '<p style="font-size:12px; margin:0.25rem 0 0 0; color:#475569; line-height:1.4;">' +
                    entry.description.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
            }

            const truncatedText = entry.selectedText.length > 120
                ? entry.selectedText.substring(0, 120) + '...'
                : entry.selectedText;

            card.innerHTML =
                '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">' +
                    '<div style="display:flex; align-items:center; gap:0.35rem;">' +
                        '<span style="font-size:11px; font-weight:600; color:#2563eb; background:#eff6ff; padding:1px 6px; border-radius:3px;">' + entry.menuLocation + '</span>' +
                    '</div>' +
                    '<div style="display:flex; align-items:center; gap:0.35rem;">' +
                        '<span style="font-size:11px; color:#94a3b8;">' + entry.date + '</span>' +
                        '<button class="update-delete-btn" data-idx="' + idx + '" title="삭제" style="display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border:none; background:transparent; color:#94a3b8; cursor:pointer; border-radius:3px; font-size:14px; line-height:1; padding:0; transition: color 0.15s, background 0.15s;" onmouseover="this.style.color=\'#ef4444\'; this.style.background=\'#fef2f2\';" onmouseout="this.style.color=\'#94a3b8\'; this.style.background=\'transparent\';">&times;</button>' +
                    '</div>' +
                '</div>' +
                '<p style="font-size:12.5px; font-weight:600; color:#0f172a; margin:0 0 0.15rem 0; line-height:1.4; word-break:break-all;">"' +
                    truncatedText.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"</p>' +
                descHtml;

            // Hover effect for card
            card.addEventListener('mouseenter', function() {
                card.style.background = '#f1f5f9';
                card.style.borderColor = '#cbd5e1';
            });
            card.addEventListener('mouseleave', function() {
                card.style.background = '#f8fafc';
                card.style.borderColor = '#e2e8f0';
            });

            // Delete button click
            const deleteBtn = card.querySelector('.update-delete-btn');
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const deleteIdx = parseInt(this.getAttribute('data-idx'));
                updateEntries.splice(deleteIdx, 1);
                renderUpdateItems();
            });

            // Card click → navigate to tab and scroll to element
            card.addEventListener('click', function(e) {
                if (e.target.closest('.update-delete-btn')) return;

                // Remove previous highlights
                document.querySelectorAll('.search-target-highlight').forEach(function(el) {
                    el.classList.remove('search-target-highlight');
                });

                if (entry.tabId) {
                    window.location.hash = entry.tabId;
                    switchTab(entry.tabId);
                }

                if (entry.targetElement && entry.targetElement.isConnected) {
                    setTimeout(function() {
                        entry.targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        entry.targetElement.classList.add('search-target-highlight');
                    }, 100);
                }
            });

            updateItemsList.appendChild(card);
        });
    }

    // ==========================================
    // Search Engine Logic
    // ==========================================
    function executeSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            searchResultsContainer.style.display = 'none';
            return;
        }

        const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        if (keywords.length === 0) return;

        const results = [];
        const seenTexts = new Set();

        const visibleTabIds = typeof getVisibleTabs === 'function'
            ? getVisibleTabs()
            : Object.keys(tabNameMap);

        visibleTabIds.forEach(tabId => {
            const panel = document.getElementById('view-' + tabId);
            if (!panel) return;

            const targets = panel.querySelectorAll('h3, h4, p, th, td, li, .card-title, .card-desc, .section-title, .section-subtitle, .test-card-title, .test-card-description, .test-card-body-text');
            
            targets.forEach(elem => {
                let text = elem.innerText || elem.textContent;
                if (!text) return;

                text = text.replace(/\s+/g, ' ').trim();
                if (text.length === 0) return;

                const lowerText = text.toLowerCase();
                const matchedKW = keywords.find(kw => lowerText.includes(kw));

                if (matchedKW) {
                    const uniqueKey = tabId + ':' + text;
                    if (seenTexts.has(uniqueKey)) return;
                    seenTexts.add(uniqueKey);

                    let displaySentence = text;
                    if (displaySentence.length > 90) {
                        const kwIdx = lowerText.indexOf(matchedKW);
                        const start = Math.max(0, kwIdx - 25);
                        const end = Math.min(text.length, kwIdx + 65);
                        displaySentence = (start > 0 ? '...' : '') + text.substring(start, end).trim() + (end < text.length ? '...' : '');
                    }

                    let highlightedText = displaySentence;
                    keywords.forEach(function(kw) {
                        if (!kw) return;
                        var lowerKw = kw.toLowerCase();
                        var idx = highlightedText.toLowerCase().indexOf(lowerKw);
                        if (idx !== -1) {
                            var matchedStr = highlightedText.substring(idx, idx + kw.length);
                            highlightedText = highlightedText.substring(0, idx) + '<mark>' + matchedStr + '</mark>' + highlightedText.substring(idx + kw.length);
                        }
                    });

                    results.push({
                        tabId: tabId,
                        tabTitle: getSearchTabTitle(tabId),
                        sentence: highlightedText,
                        targetElement: elem
                    });
                }
            });
        });

        searchResultsContainer.style.display = 'block';
        searchResultsList.innerHTML = '';

        if (results.length === 0) {
            searchResultsHeader.innerText = '검색 결과 (0건)';
            const noMatchMessage = document.createElement('div');
            noMatchMessage.className = 'search-result-no-match';
            noMatchMessage.textContent = '"' + query + '"에 대한 검색 결과가 없습니다.';
            searchResultsList.appendChild(noMatchMessage);
        } else {
            searchResultsHeader.innerText = '검색 결과 (' + results.length + '건)';
            
            results.forEach(function(res) {
                const card = document.createElement('div');
                card.className = 'search-result-card';
                card.innerHTML = '<div class="search-result-sentence">' + res.sentence + '</div>' +
                    '<div class="search-result-meta">' +
                    '<span class="search-result-badge">' + res.tabTitle + '</span>' +
                    '</div>';

                card.addEventListener('click', () => {
                    if (typeof getVisibleTabs === 'function' && !getVisibleTabs().includes(res.tabId)) {
                        executeSearch();
                        return;
                    }
                    document.querySelectorAll('.search-result-card').forEach(function(c) {
                        c.classList.remove('active-result');
                    });
                    card.classList.add('active-result');

                    document.querySelectorAll('.search-target-highlight').forEach(function(el) {
                        el.classList.remove('search-target-highlight');
                    });

                    window.location.hash = res.tabId;
                    switchTab(res.tabId);

                    setTimeout(() => {
                        res.targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        res.targetElement.classList.add('search-target-highlight');
                    }, 100);
                });

                searchResultsList.appendChild(card);
            });
        }

        setTimeout(positionSearchModalNearButton, 10);
    }

    searchSubmitBtn.addEventListener('click', executeSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            executeSearch();
        }
    });
