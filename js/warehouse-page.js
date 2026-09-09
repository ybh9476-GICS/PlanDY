(function () {
    const pageStates = new WeakMap();
    let rendererPromise;

    function getViewType(menu) {
        // Older browser drafts inherit only the published screen type, not card data or labels.
        const publishedMenu = window.WMS_PUBLISHED_CONTENT?.storage?.menus?.menus?.find(item => item.id === menu?.id);
        return (menu?.viewType ?? publishedMenu?.viewType) === 'warehouse3d' ? 'warehouse3d' : 'cards';
    }

    function getOptions(menu) {
        if (menu?.viewOptions) return menu.viewOptions;
        const saved = JSON.parse(localStorage.getItem('wms-custom-menu-cards-v1') || 'null');
        const rows = saved?.[menu.id] ?? window.WMS_PUBLISHED_CONTENT?.storage?.customCards?.[menu.id] ?? [];
        const block = rows.flatMap(row => row.cards || [])
            .flatMap(card => card.contentBlocks || []).find(item => item.type === 'warehouse3d');
        if (!block) throw new Error('이 메뉴의 3D 창고 연결 정보를 찾을 수 없습니다.');
        return block;
    }

    function loadRenderer() {
        if (window.wmsWarehouse3D) return Promise.resolve(window.wmsWarehouse3D);
        if (rendererPromise) return rendererPromise;
        rendererPromise = new Promise((resolve, reject) => {
            let script = document.querySelector('script[data-wms-warehouse-3d]');
            const created = !script;
            if (created) {
                script = document.createElement('script');
                script.src = 'js/warehouse-3d.js?v=warehouse-panel-resize-v30';
                script.dataset.wmsWarehouse3d = 'true';
            }
            const cleanup = () => {
                script.removeEventListener('load', loaded);
                script.removeEventListener('error', failed);
            };
            const loaded = () => {
                cleanup();
                if (window.wmsWarehouse3D) resolve(window.wmsWarehouse3D);
                else reject(new Error('3D 창고 화면을 초기화하지 못했습니다.'));
            };
            const failed = () => {
                cleanup();
                script.remove();
                reject(new Error('3D 창고 화면을 불러오지 못했습니다.'));
            };
            script.addEventListener('load', loaded);
            script.addEventListener('error', failed);
            if (created) document.head.appendChild(script);
        }).catch(error => {
            rendererPromise = null;
            throw error;
        });
        return rendererPromise;
    }

    function dispose(panel) {
        const state = pageStates.get(panel);
        if (!state) return;
        state.active = false;
        state.generation += 1;
        window.wmsWarehouse3D?.disposeWithin(panel);
        panel.replaceChildren();
    }

    async function setActive(panel, active, menu) {
        let state = pageStates.get(panel);
        if (!state) {
            state = { active: false, generation: 0 };
            pageStates.set(panel, state);
        }
        if (!active) {
            if (state.active) dispose(panel);
            return;
        }
        if (state.active || window.wmsPermissions?.isAuthenticated?.() !== true) return;
        state.active = true;
        const generation = ++state.generation;
        const isCurrent = () => state.active && generation === state.generation && panel.isConnected
            && window.wmsPermissions?.isAuthenticated?.() === true;
        const message = document.createElement('div');
        message.className = 'warehouse-page-message';
        message.setAttribute('role', 'status');
        message.textContent = '3D 창고를 불러오는 중입니다.';
        panel.replaceChildren(message);
        try {
            await window.wmsCardPatchReady;
            if (!isCurrent()) return;
            const options = getOptions(menu);
            const renderer = await loadRenderer();
            if (!isCurrent()) return;
            const mount = document.createElement('div');
            panel.replaceChildren(mount);
            await renderer.mount(mount, options);
        } catch (error) {
            if (!isCurrent()) return;
            message.textContent = error.message || '3D 창고를 불러오지 못했습니다.';
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.textContent = '다시 시도';
            retry.addEventListener('click', () => {
                dispose(panel);
                setActive(panel, true, menu);
            }, { once: true });
            message.appendChild(retry);
            panel.replaceChildren(message);
        }
    }

    window.wmsWarehousePage = { getViewType, setActive, dispose };
}());
