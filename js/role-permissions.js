(function () {
    const roleStorageKey = 'wms-interface-role-v1';
    const userStorageKey = 'wms-local-login-user-v1';
    const validRoles = new Set(['viewer', 'editor']);
    const loginCredentialPattern = /^[A-Za-z0-9]{8}$/;
    const localAccounts = Object.freeze({
        edituser: { password: 'edit!@#$', role: 'editor' },
        viewuser: { password: 'view1234', role: 'viewer' }
    });
    let currentRole = 'viewer';
    let currentUserId = '';

    try {
        const savedRole = sessionStorage.getItem(roleStorageKey);
        const savedUserId = sessionStorage.getItem(userStorageKey);
        const restoredUserId = typeof savedUserId === 'string' ? savedUserId.trim() : '';
        if (localAccounts[restoredUserId]) {
            currentUserId = restoredUserId;
            if (validRoles.has(savedRole) && (savedRole !== 'editor' || localAccounts[restoredUserId].role === 'editor')) currentRole = savedRole;
        }
    } catch (_) {
        // Storage can be unavailable in private or restricted browser contexts.
    }

    const isAuthenticated = () => Boolean(currentUserId);
    const isEditor = () => isAuthenticated() && currentRole === 'editor';
    const getRoleLabel = () => currentRole === 'editor' ? 'Editor' : 'Viewer';
    const canSelectEditorRole = () => currentUserId === 'edituser';

    const brandFieldNames = ['title', 'description'];
    const brandDataKey = (field) => `brand${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    const syncBrandField = (field, value) => {
        const normalizedValue = String(value || '').trim();
        if (!brandFieldNames.includes(field) || !normalizedValue) return;
        const dataKey = brandDataKey(field);
        if (document.body.dataset[dataKey] !== normalizedValue) document.body.dataset[dataKey] = normalizedValue;
        document.querySelectorAll(`[data-brand-field="${field}"]`).forEach((element) => {
            if (element.textContent.trim() !== normalizedValue) element.textContent = normalizedValue;
        });
    };
    const initializeBrandSync = () => {
        brandFieldNames.forEach((field) => {
            const configuredValue = document.body.dataset[brandDataKey(field)];
            const initialValue = configuredValue || document.querySelector(`[data-brand-field="${field}"]`)?.textContent;
            syncBrandField(field, initialValue);
        });
        const brandObserver = new MutationObserver((records) => {
            records.forEach((record) => {
                if (record.type === 'attributes') {
                    const field = record.attributeName === 'data-brand-title' ? 'title' : 'description';
                    syncBrandField(field, document.body.dataset[brandDataKey(field)]);
                    return;
                }
                const fieldElement = record.target.nodeType === Node.ELEMENT_NODE
                    ? record.target.closest('[data-brand-field]')
                    : record.target.parentElement?.closest('[data-brand-field]');
                const field = fieldElement?.dataset.brandField;
                if (field && fieldElement.textContent.trim() !== document.body.dataset[brandDataKey(field)]) syncBrandField(field, fieldElement.textContent);
            });
        });
        brandObserver.observe(document.body, { attributes: true, attributeFilter: ['data-brand-title', 'data-brand-description'] });
        document.querySelectorAll('[data-brand-field]').forEach((element) => brandObserver.observe(element, { childList: true, characterData: true, subtree: true }));
        window.wmsBranding = {
            set: ({ title, description } = {}) => {
                if (title) syncBrandField('title', title);
                if (description) syncBrandField('description', description);
            },
            get: () => ({ title: document.body.dataset.brandTitle, description: document.body.dataset.brandDescription })
        };
    };

    initializeBrandSync();

    function updateUi() {
        const authenticated = isAuthenticated();
        document.body.dataset.authenticated = String(authenticated);
        document.documentElement.dataset.authenticated = String(authenticated);
        document.body.dataset.role = currentRole;
        document.documentElement.dataset.role = currentRole;
        const label = document.getElementById('permissionStatusLabel');
        const trigger = document.getElementById('permissionStatusBtn');
        const userLabel = document.getElementById('permissionUserId');
        if (label) label.textContent = authenticated ? `${currentUserId} · ${getRoleLabel()}` : '로그인 필요';
        if (trigger) trigger.dataset.tooltip = authenticated ? `${currentUserId} · ${getRoleLabel()}` : '로그인 필요';
        if (userLabel) userLabel.textContent = currentUserId || '사용자';
    }

    function persistSession() {
        try {
            if (isAuthenticated()) {
                sessionStorage.setItem(userStorageKey, currentUserId);
                sessionStorage.setItem(roleStorageKey, currentRole);
            } else {
                sessionStorage.removeItem(userStorageKey);
                sessionStorage.removeItem(roleStorageKey);
            }
        } catch (_) {
            // The current page still works when session persistence is unavailable.
        }
    }

    function applyRole(role) {
        currentRole = role === 'editor' && canSelectEditorRole() ? 'editor' : 'viewer';
        updateUi();
        persistSession();
        window.dispatchEvent(new CustomEvent('wms-role-change', { detail: { role: currentRole, userId: currentUserId } }));
    }

    function login(userId, password) {
        const nextUserId = String(userId || '').trim();
        const account = localAccounts[nextUserId];
        if (!loginCredentialPattern.test(nextUserId) || !account || account.password !== String(password || '')) return false;
        currentUserId = nextUserId;
        currentRole = account.role;
        updateUi();
        persistSession();
        window.dispatchEvent(new CustomEvent('wms-auth-change', { detail: { authenticated: true, userId: currentUserId } }));
        window.dispatchEvent(new CustomEvent('wms-role-change', { detail: { role: currentRole, userId: currentUserId } }));
        return true;
    }

    function logout() {
        currentUserId = '';
        currentRole = 'viewer';
        updateUi();
        persistSession();
        window.location.hash = '';
        window.dispatchEvent(new CustomEvent('wms-auth-change', { detail: { authenticated: false } }));
        window.dispatchEvent(new CustomEvent('wms-role-change', { detail: { role: currentRole, userId: '' } }));
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginUserId')?.focus();
    }

    window.wmsPermissions = { isEditor, isAuthenticated, getRole: () => currentRole, getUserId: () => currentUserId, setRole: applyRole, login, logout };

    const trigger = document.getElementById('permissionStatusBtn');
    const modal = document.getElementById('permissionModal');
    const loginForm = document.getElementById('loginForm');
    const loginUserId = document.getElementById('loginUserId');
    const loginPassword = document.getElementById('loginPassword');
    const loginUserIdHint = document.getElementById('loginUserIdHint');
    const loginPasswordHint = document.getElementById('loginPasswordHint');
    const loginSubmitButton = document.getElementById('loginSubmitBtn');
    const logoutConfirmModal = document.getElementById('logoutConfirmModal');
    if (!trigger || !modal || !loginForm || !loginUserId || !loginPassword || !loginUserIdHint || !loginPasswordHint || !loginSubmitButton || !logoutConfirmModal) {
        updateUi();
        return;
    }

    const confirmButton = document.getElementById('permissionConfirmBtn');
    const cancelButton = document.getElementById('permissionCancelBtn');
    const logoutButton = document.getElementById('logoutBtn');
    const logoutCancelButton = document.getElementById('logoutCancelBtn');
    const logoutConfirmButton = document.getElementById('logoutConfirmBtn');
    const radioButtons = Array.from(modal.querySelectorAll('input[name="permissionRole"]'));
    const editorRoleButton = radioButtons.find((radio) => radio.value === 'editor');
    let previouslyFocused = null;

    const setModalOpen = (target, open) => {
        target.classList.toggle('is-open', open);
        target.setAttribute('aria-hidden', String(!open));
    };
    const closePermission = () => {
        setModalOpen(modal, false);
        previouslyFocused?.focus();
    };
    const closeLogoutConfirm = () => setModalOpen(logoutConfirmModal, false);
    const openPermission = () => {
        if (!isAuthenticated()) return;
        previouslyFocused = document.activeElement;
        if (editorRoleButton) {
            editorRoleButton.disabled = !canSelectEditorRole();
            editorRoleButton.setAttribute('aria-disabled', String(editorRoleButton.disabled));
        }
        const selected = radioButtons.find((radio) => radio.value === currentRole);
        if (selected) selected.checked = true;
        setModalOpen(modal, true);
        selected?.focus();
    };
    const normalizeLoginUserId = (field) => {
        const normalized = field.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
        const changed = field.value !== normalized;
        if (changed) field.value = normalized;
        return changed;
    };
    const updateLoginFieldHint = (field, hint, invalidInput, isUserId) => {
        hint.classList.remove('is-warning', 'is-success');
        if (field.dataset.isComposing === 'true') {
            hint.textContent = '한글 입력 중 — 영문으로 전환하세요';
            hint.classList.add('is-warning');
        } else if (isUserId && (invalidInput || field.dataset.invalidInput === 'true')) {
            hint.textContent = '영문·숫자만 사용할 수 있습니다';
            hint.classList.add('is-warning');
        } else if ((isUserId ? loginCredentialPattern.test(field.value) : field.value.length === 8)) {
            hint.textContent = '입력 완료';
            hint.classList.add('is-success');
        } else if (field.value) {
            hint.textContent = `${field.value.length}/8자`;
        } else {
            hint.textContent = isUserId ? '영문·숫자 8자' : '8자';
        }
    };
    const updateLoginSubmitState = () => {
        const userInvalidInput = loginUserId.dataset.isComposing === 'true' ? false : normalizeLoginUserId(loginUserId);
        const passwordInvalidInput = false;
        if (userInvalidInput) loginUserId.dataset.invalidInput = 'true';
        else if (loginUserId.value) delete loginUserId.dataset.invalidInput;
        if (passwordInvalidInput) loginPassword.dataset.invalidInput = 'true';
        else if (loginPassword.value) delete loginPassword.dataset.invalidInput;
        updateLoginFieldHint(loginUserId, loginUserIdHint, userInvalidInput, true);
        updateLoginFieldHint(loginPassword, loginPasswordHint, passwordInvalidInput, false);
        const account = localAccounts[loginUserId.value];
        loginSubmitButton.disabled = !(loginCredentialPattern.test(loginUserId.value) && account?.password === loginPassword.value);
    };

    loginUserId.addEventListener('input', updateLoginSubmitState);
    loginPassword.addEventListener('input', updateLoginSubmitState);
    [loginUserId, loginPassword].forEach((field) => {
        field.addEventListener('compositionstart', () => {
            field.dataset.isComposing = 'true';
            updateLoginSubmitState();
        });
        field.addEventListener('compositionend', () => {
            delete field.dataset.isComposing;
            field.dataset.invalidInput = 'true';
            updateLoginSubmitState();
        });
    });
    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (loginSubmitButton.disabled || !login(loginUserId.value, loginPassword.value)) return;
        loginPassword.value = '';
        updateLoginSubmitState();
    });
    trigger.addEventListener('click', openPermission);
    cancelButton.addEventListener('click', closePermission);
    confirmButton.addEventListener('click', () => {
        const selected = radioButtons.find((radio) => radio.checked);
        applyRole(selected?.value || 'viewer');
        closePermission();
    });
    logoutButton.addEventListener('click', () => {
        setModalOpen(modal, false);
        setModalOpen(logoutConfirmModal, true);
        logoutCancelButton.focus();
    });
    logoutCancelButton.addEventListener('click', () => {
        closeLogoutConfirm();
        openPermission();
    });
    logoutConfirmButton.addEventListener('click', () => {
        closeLogoutConfirm();
        logout();
    });
    modal.addEventListener('click', (event) => { if (event.target === modal) closePermission(); });
    logoutConfirmModal.addEventListener('click', (event) => { if (event.target === logoutConfirmModal) closeLogoutConfirm(); });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (logoutConfirmModal.classList.contains('is-open')) {
            event.preventDefault();
            closeLogoutConfirm();
            openPermission();
        } else if (modal.classList.contains('is-open')) {
            event.preventDefault();
            closePermission();
        }
    });
    document.addEventListener('click', (event) => {
        if (isAuthenticated() || loginForm.contains(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    updateUi();
    updateLoginSubmitState();
    if (!isAuthenticated()) window.setTimeout(() => loginUserId.focus(), 0);
}());
