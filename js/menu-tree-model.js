(function (root, factory) {
    const model = factory();
    if (typeof module === 'object' && module.exports) module.exports = model;
    if (root) root.WmsMenuTreeModel = model;
}(typeof window !== 'undefined' ? window : globalThis, function () {
    const rootKey = '__root__';

    function numericOrder(menu, fallback) {
        return Number.isFinite(Number(menu.order)) ? Number(menu.order) : fallback;
    }

    function normalizeMenus(inputMenus) {
        const source = Array.isArray(inputMenus) ? inputMenus : [];
        const unique = [];
        const seenIds = new Set();

        source.forEach((menu, sourceIndex) => {
            if (!menu || typeof menu.id !== 'string' || !menu.id || seenIds.has(menu.id)) return;
            seenIds.add(menu.id);
            unique.push({
                ...menu,
                parentId: typeof menu.parentId === 'string' && menu.parentId ? menu.parentId : null,
                _sourceIndex: sourceIndex
            });
        });

        const menuById = new Map(unique.map(menu => [menu.id, menu]));
        unique.forEach(menu => {
            if (menu.parentId === menu.id || !menuById.has(menu.parentId)) menu.parentId = null;
        });

        // Only two levels are supported. Invalid grandchildren and cycles are
        // promoted to the main level so stored content never becomes unreachable.
        unique.forEach(menu => {
            if (!menu.parentId) return;
            const parent = menuById.get(menu.parentId);
            if (!parent || parent.parentId) menu.parentId = null;
        });

        const groups = new Map();
        unique.forEach(menu => {
            const key = menu.parentId || rootKey;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(menu);
        });
        groups.forEach(group => group.sort((a, b) => {
            const orderDifference = numericOrder(a, a._sourceIndex) - numericOrder(b, b._sourceIndex);
            return orderDifference || a._sourceIndex - b._sourceIndex;
        }));

        const normalized = [];
        const roots = groups.get(rootKey) || [];
        roots.forEach((menu, index) => {
            const rootMenu = { ...menu, parentId: null, order: index };
            delete rootMenu._sourceIndex;
            normalized.push(rootMenu);
            (groups.get(menu.id) || []).forEach((child, childIndex) => {
                const childMenu = { ...child, parentId: menu.id, order: childIndex };
                delete childMenu._sourceIndex;
                normalized.push(childMenu);
            });
        });
        return normalized;
    }

    function getMenu(menus, id) {
        return (Array.isArray(menus) ? menus : []).find(menu => menu.id === id) || null;
    }

    function getRootMenus(menus) {
        return normalizeMenus(menus).filter(menu => !menu.parentId);
    }

    function getChildren(menus, parentId) {
        return normalizeMenus(menus).filter(menu => menu.parentId === parentId);
    }

    function hasChildren(menus, parentId) {
        return (Array.isArray(menus) ? menus : []).some(menu => menu.parentId === parentId);
    }

    function getVisibleMenus(menus) {
        const normalized = normalizeMenus(menus);
        const visible = [];
        normalized.filter(menu => !menu.parentId && menu.visible !== false).forEach(rootMenu => {
            visible.push(rootMenu);
            normalized
                .filter(menu => menu.parentId === rootMenu.id && menu.visible !== false)
                .forEach(child => visible.push(child));
        });
        return visible;
    }

    function moveWithinParent(menus, id, direction) {
        const normalized = normalizeMenus(menus);
        const target = getMenu(normalized, id);
        if (!target || ![-1, 1].includes(direction)) return normalized;
        const siblings = normalized.filter(menu => menu.parentId === target.parentId);
        const index = siblings.findIndex(menu => menu.id === id);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return normalized;
        const firstOrder = siblings[index].order;
        siblings[index].order = siblings[nextIndex].order;
        siblings[nextIndex].order = firstOrder;
        return normalizeMenus(normalized);
    }

    function getPathLabel(menus, id) {
        const normalized = normalizeMenus(menus);
        const menu = getMenu(normalized, id);
        if (!menu) return '';
        const parent = menu.parentId ? getMenu(normalized, menu.parentId) : null;
        return parent ? `${parent.label} > ${menu.label}` : menu.label;
    }

    return {
        normalizeMenus,
        getMenu,
        getRootMenus,
        getChildren,
        hasChildren,
        getVisibleMenus,
        moveWithinParent,
        getPathLabel
    };
}));
