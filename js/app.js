// SPA tab router and sidebar menu manager.
const navMenu = document.getElementById('navMenu');
const viewPanels = document.querySelectorAll('.view-panel');
const menuStorageKey = 'wms-sidebar-menu-settings-v1';
const customCardStorageKey = 'wms-custom-menu-cards-v1';
const overviewCardStorageKey = 'wms-overview-cards-v1';
const routeCardStorageKey = 'wms-route-cards-v1';
const authoringCardStorageKey = 'wms-authoring-cards-v1';
const isEditorMode = () => window.wmsPermissions?.isEditor() === true;
const overviewInitialCardRows = [
    {
        type: 'single',
        cards: [{
            title: 'WMS 기획 개요 및 프로세스 흐름',
            description: '유풍 창고 관리 시스템(WMS)의 공간 관리와 작업 안내를 위한 기획 콘텐츠입니다.',
            body: '1. 출발지와 입고지 검색 조건 입력\n2. 자재·자원 분류와 품목 유형 선택\n3. 선택 층의 재고·가용 공간 확인\n4. 최적 Location ID 산출\n5. E/V를 포함한 3D 이동 경로 안내\n6. 작업 가이드 제공'
        }]
    },
    {
        type: 'double',
        cards: [
            {
                title: '1F 선택층 현황 및 재고 인디케이터',
                description: '국가, 공장, 건물, 층 선택과 재고·가용 공간 정보를 확인합니다.',
                image: 'assets/wms/video_frames/video_step_1.jpg'
            },
            {
                title: '3D 층간 E/V 경유 최적 경로 가이드',
                description: '출입구부터 목적지까지의 수평·수직 이동 동선을 3D로 안내합니다.',
                image: 'assets/wms/video_frames/video_step_5.jpg'
            }
        ]
    },
    {
        type: 'single',
        cards: [{
            title: 'WMS 핵심 용어 및 구조 명세',
            contentBlocks: [{
                type: 'table',
                table: {
                    title: '핵심 용어',
                    hasHeader: true,
                    hasFirstColumnHeader: false,
                    columnWidths: [22, 24, 54],
                    rows: [
                        ['용어 (Term)', '기능 명칭', '설명'],
                        ['층 (Floor)', '층 편집', '건물 단위의 층별 창고 현황을 관리합니다.'],
                        ['범위 (Zone)', '범위 편집', '자재와 자원별로 구분하는 작업 영역입니다.'],
                        ['구역 (Area)', '구역 편집', 'Rack 집합과 작업 동선을 관리합니다.'],
                        ['레벨 (Level)', '레벨 (ID)', 'Rack의 수직 단위와 Location ID를 관리합니다.']
                    ]
                }
            }]
        }]
    }
];
const routeInitialCardRows = [
    {
        type: 'single',
        cards: [{
            title: '5단계 경로 탐색 흐름',
            description: '출발지와 입고지 조건을 기반으로 3D 최적 이동 경로를 생성합니다.',
            editLocked: true,
            contentBlocks: [{
                type: 'diagram',
                source: 'sequenceDiagram\nautonumber\nparticipant Worker\nparticipant UI as WMS 3D UI\nparticipant System as WMS Route Engine\nWorker->>UI: Select floor and start point\nWorker->>UI: Check inventory status\nWorker->>UI: Select destination and material\nSystem->>UI: Find available optimal location\nSystem->>UI: Generate 3D route via elevators'
            }]
        }]
    },
    {
        type: 'double',
        cards: [
            {
                title: '실시간 3D 경로 탐색 결과 뷰어',
                description: '출발지부터 목적지까지의 최적 경로를 3D 화면에서 확인합니다.',
                image: 'assets/wms/video_frames/video_step_5.jpg'
            },
            {
                title: '경로 기점 및 Location 명세',
                contentBlocks: [{
                    type: 'table',
                    table: {
                        title: '경로 경유지',
                        hasHeader: true,
                        hasFirstColumnHeader: false,
                        columnWidths: [18, 25, 37, 20],
                        rows: [
                            ['구분', '기점 명칭', '상세 위치 정보', '3D 비고'],
                            ['출발지', '1F 출입구', '1F > EAST 구역 출입구', '1F 출입구'],
                            ['경유지', '1F E/V / 2F E/V', '층간 수직 이송 동선', '1F E/V / 2F E/V'],
                            ['입고지', 'G2D / B2C', '2F > 부자재 창고 > G2D', 'G2D']
                        ]
                    }
                }]
            }
        ]
    }
];
const authoringInitialCardRows = [
    {
        type: 'single',
        cards: [{
            title: '3D Canvas Viewport',
            description: '선택한 창고 모델과 랙 배치 상태를 3D 화면에서 확인합니다.',
            image: 'assets/wms/video_frames/video_step_1.jpg'
        }]
    },
    {
        type: 'double',
        cards: [
            {
                title: '랙 타입 및 규격 설정',
                description: '랙 타입과 행·열, 너비·깊이·높이 값을 관리합니다.',
                body: '• 랙 타입: Single, Double, Pallet, High-Bay\n• 기본 행·열: 4 × 10\n• 기본 규격: 12.0m × 1.0m × 4.5m'
            },
            {
                title: '프리팹 및 변환 제어',
                description: '설정한 랙을 재사용하고 3D 공간에서 배치·회전·복제합니다.',
                body: '• 프리팹: Standard_Pallet_Rack_V2\n• 저장 및 불러오기\n• Move, Snap Place, Rotate, Duplicate, Delete'
            }
        ]
    },
    {
        type: 'single',
        cards: [{
            title: '저작도구 워크플로 및 편집 명세',
            contentBlocks: [{
                type: 'table',
                table: {
                    title: '저작도구 핵심 기능',
                    hasHeader: true,
                    hasFirstColumnHeader: false,
                    columnWidths: [20, 27, 53],
                    rows: [
                        ['구분', '편집 요소', '기능 및 옵션'],
                        ['1. 랙 타입', 'Rack Type Selector', 'Single, Double, Pallet, High-Bay 랙 유형 선택'],
                        ['2. 규격 설정', 'Dimension Editor', '행·열과 Width × Depth × Height 값을 설정'],
                        ['3. 프리팹', 'Prefab Manager', '설정한 랙을 저장하고 다른 창고에 불러오기'],
                        ['4. 변환 제어', '3D Transform Gizmo', '이동, 스냅 배치, 회전, 복제, 삭제']
                    ]
                }
            }]
        }]
    }
];
const menuIconLibrary = {
    document: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line></svg>',
    box: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
    truck: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17h4V5H2v12h3"></path><path d="M14 9h4l4 4v4h-3"></path><circle cx="7" cy="17" r="2"></circle><circle cx="17" cy="17" r="2"></circle></svg>',
    users: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    settings: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V20.3h-3v-.08A1.7 1.7 0 0 0 10.66 18.66a1.7 1.7 0 0 0-1.88.34l-.06.06L6.6 16.94l.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.56-1.04h-.08v-3h.08A1.7 1.7 0 0 0 7 9.92a1.7 1.7 0 0 0-.34-1.88L6.6 7.98 8.72 5.86l.06.06A1.7 1.7 0 0 0 10.66 6.26 1.7 1.7 0 0 0 11.7 4.7v-.08h3v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 9.92a1.7 1.7 0 0 0 1.56 1.04h.08v3h-.08A1.7 1.7 0 0 0 19.4 15z"></path></svg>',
    chart: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="3" y2="21"></line><line x1="3" y1="21" x2="21" y2="21"></line><path d="M7 16l4-5 3 3 6-8"></path></svg>',
    route: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="19" r="3"></circle><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"></path><circle cx="18" cy="5" r="3"></circle></svg>',
    map: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>'
};

function inferMenuIcon(label) {
    const value = String(label || '').replace(/\s+/g, '').toLowerCase();
    const rules = [
        ['box', ['재고', '창고', '보관', '품목', '랙', '물류']],
        ['truck', ['출고', '배송', '운송', '입고', '납품']],
        ['users', ['사용자', '고객', '직원', '권한', '조직']],
        ['chart', ['현황', '통계', '분석', '대시보드', '지표']],
        ['route', ['경로', '동선', '이동']],
        ['map', ['지도', '위치', '구역', '층', '범위']],
        ['settings', ['설정', '관리', '환경', '도구']]
    ];
    const matched = rules.find(([, keywords]) => keywords.some(keyword => value.includes(keyword)));
    return menuIconLibrary[matched ? matched[0] : 'document'];
}
const defaultMenus = Array.from(navMenu.querySelectorAll('.nav-link')).map((link, index) => ({
    id: link.getAttribute('data-tab'),
    parentId: null,
    label: link.querySelector('.hide-on-collapse').textContent.trim(),
    tooltip: link.getAttribute('data-tooltip'),
    icon: link.querySelector('svg').outerHTML,
    builtin: true,
    visible: true,
    order: index
}));

function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value;
    return element.innerHTML;
}

function loadMenus() {
    try {
        const saved = JSON.parse(localStorage.getItem(menuStorageKey));
        if (!saved || !Array.isArray(saved.menus)) return window.WmsMenuTreeModel.normalizeMenus(defaultMenus);
        deletedBuiltinIds = Array.isArray(saved.deletedBuiltinIds) ? saved.deletedBuiltinIds : [];
        const savedById = new Map(saved.menus.map(menu => [menu.id, menu]));
        const builtins = defaultMenus
            .filter(menu => !deletedBuiltinIds.includes(menu.id))
            .map(menu => ({ ...menu, ...(savedById.get(menu.id) || {}), builtin: true }));
        const customs = saved.menus.filter(menu => !menu.builtin && typeof menu.id === 'string' && typeof menu.label === 'string');
        return window.WmsMenuTreeModel.normalizeMenus([...builtins, ...customs]);
    } catch (_) { return window.WmsMenuTreeModel.normalizeMenus(defaultMenus); }
}

let deletedBuiltinIds = [];
let menus = loadMenus();
function saveMenus() {
    localStorage.setItem(menuStorageKey, JSON.stringify({ schemaVersion: 2, menus, deletedBuiltinIds }));
}
function getMenu(id) { return window.WmsMenuTreeModel.getMenu(menus, id); }
function getRootMenus() { return window.WmsMenuTreeModel.getRootMenus(menus); }
function getChildMenus(parentId) { return window.WmsMenuTreeModel.getChildren(menus, parentId); }
function menuHasChildren(parentId) { return window.WmsMenuTreeModel.hasChildren(menus, parentId); }
function getVisibleMenus() { return window.WmsMenuTreeModel.getVisibleMenus(menus); }
function getVisibleTabs() { return getVisibleMenus().map(menu => menu.id); }

window.wmsMenuTree = {
    getMenu: id => getMenu(id),
    getParent: id => {
        const menu = getMenu(id);
        return menu?.parentId ? getMenu(menu.parentId) : null;
    },
    getPathLabel: id => window.WmsMenuTreeModel.getPathLabel(menus, id)
};

function ensureCustomPanel(menu) {
    let panel = document.getElementById('view-' + menu.id);
    if (!panel) {
        panel = document.createElement('section');
        panel.id = 'view-' + menu.id;
        panel.className = 'content-area view-panel';
        panel.innerHTML = '<div class="test-card-list custom-card-list"></div><button type="button" class="test-add-card-btn custom-add-card-btn" aria-label="카드 추가">+</button>';
        document.getElementById('main-content').appendChild(panel);
        initializeCustomCardArea(menu, panel);
    }
    return panel;
}

function loadCustomCardState() {
    try { return JSON.parse(localStorage.getItem(customCardStorageKey)) || {}; } catch (_) { return {}; }
}

function saveCustomCardState(state) {
    localStorage.setItem(customCardStorageKey, JSON.stringify(state));
}

function loadOverviewCardRows() {
    try {
        const rows = JSON.parse(localStorage.getItem(overviewCardStorageKey));
        return Array.isArray(rows) ? rows : null;
    } catch (_) {
        return null;
    }
}

function migrateOverviewTableCards(rows) {
    let migrated = false;
    const nextRows = rows.map((row) => ({
        ...row,
        cards: Array.isArray(row.cards) ? row.cards.map((card) => {
            const contentBlocks = Array.isArray(card.contentBlocks) ? card.contentBlocks : [];
            if (contentBlocks.length || card.bodyType !== 'table' || !card.table) return card;
            migrated = true;
            return {
                ...card,
                body: '',
                bodyHtml: '',
                bodyType: 'text',
                table: null,
                contentBlocks: [{ type: 'table', table: card.table }]
            };
        }) : []
    }));
    return { rows: nextRows, migrated };
}

function migrateRouteTableCards(rows) {
    let migrated = false;
    const nextRows = rows.map((row) => ({
        ...row,
        cards: Array.isArray(row.cards) ? row.cards.map((card) => {
            const contentBlocks = Array.isArray(card.contentBlocks) ? card.contentBlocks : [];
            if (contentBlocks.length || card.bodyType !== 'table' || !card.table) return card;
            migrated = true;
            return {
                ...card,
                body: '',
                bodyHtml: '',
                bodyType: 'text',
                table: null,
                contentBlocks: [{ type: 'table', table: card.table }]
            };
        }) : []
    }));
    return { rows: nextRows, migrated };
}

function migrateAuthoringTableCards(rows) {
    let migrated = false;
    const nextRows = rows.map((row) => ({
        ...row,
        cards: Array.isArray(row.cards) ? row.cards.map((card) => {
            const contentBlocks = Array.isArray(card.contentBlocks) ? card.contentBlocks : [];
            if (contentBlocks.length || card.bodyType !== 'table' || !card.table) return card;
            migrated = true;
            return {
                ...card,
                body: '',
                bodyHtml: '',
                bodyType: 'text',
                table: null,
                contentBlocks: [{ type: 'table', table: card.table }]
            };
        }) : []
    }));
    return { rows: nextRows, migrated };
}

function initializeOverviewCardArea() {
    const cardList = document.getElementById('overviewCardList');
    const addButton = document.getElementById('overviewAddCardBtn');
    if (!cardList || !addButton) return;

    const connectSharedEditor = () => {
        if (cardList.dataset.sharedCardEditorInitialized || !window.initializeSharedCardEditor) return;
        cardList.dataset.sharedCardEditorInitialized = 'true';
        const savedRows = loadOverviewCardRows();
        const migration = savedRows === null ? null : migrateOverviewTableCards(savedRows);
        if (migration?.migrated) localStorage.setItem(overviewCardStorageKey, JSON.stringify(migration.rows));
        window.initializeSharedCardEditor({
            cardList,
            addButton,
            initialRows: migration ? migration.rows : overviewInitialCardRows,
            onChange: (rows) => localStorage.setItem(overviewCardStorageKey, JSON.stringify(rows)),
            structuredContent: true
        });
    };

    if (window.initializeSharedCardEditor) connectSharedEditor();
    else window.addEventListener('shared-card-editor-ready', connectSharedEditor, { once: true });
}

function loadRouteCardRows() {
    try {
        const rows = JSON.parse(localStorage.getItem(routeCardStorageKey));
        return Array.isArray(rows) ? rows : null;
    } catch (_) {
        return null;
    }
}

function initializeRouteCardArea() {
    const cardList = document.getElementById('routeCardList');
    const addButton = document.getElementById('routeAddCardBtn');
    if (!cardList || !addButton) return;

    const connectSharedEditor = () => {
        if (cardList.dataset.sharedCardEditorInitialized || !window.initializeSharedCardEditor) return;
        cardList.dataset.sharedCardEditorInitialized = 'true';
        const savedRows = loadRouteCardRows();
        const migration = savedRows === null ? null : migrateRouteTableCards(savedRows);
        if (migration?.migrated) localStorage.setItem(routeCardStorageKey, JSON.stringify(migration.rows));
        window.initializeSharedCardEditor({
            cardList,
            addButton,
            initialRows: migration ? migration.rows : routeInitialCardRows,
            onChange: (rows) => localStorage.setItem(routeCardStorageKey, JSON.stringify(rows)),
            structuredContent: true
        });
    };

    if (window.initializeSharedCardEditor) connectSharedEditor();
    else window.addEventListener('shared-card-editor-ready', connectSharedEditor, { once: true });
}

function loadAuthoringCardRows() {
    try {
        const rows = JSON.parse(localStorage.getItem(authoringCardStorageKey));
        return Array.isArray(rows) ? rows : null;
    } catch (_) {
        return null;
    }
}

function initializeAuthoringCardArea() {
    const cardList = document.getElementById('authoringCardList');
    const addButton = document.getElementById('authoringAddCardBtn');
    if (!cardList || !addButton) return;

    const connectSharedEditor = () => {
        if (cardList.dataset.sharedCardEditorInitialized || !window.initializeSharedCardEditor) return;
        cardList.dataset.sharedCardEditorInitialized = 'true';
        const savedRows = loadAuthoringCardRows();
        const migration = savedRows === null ? null : migrateAuthoringTableCards(savedRows);
        if (migration?.migrated) localStorage.setItem(authoringCardStorageKey, JSON.stringify(migration.rows));
        window.initializeSharedCardEditor({
            cardList,
            addButton,
            initialRows: migration ? migration.rows : authoringInitialCardRows,
            onChange: (rows) => localStorage.setItem(authoringCardStorageKey, JSON.stringify(rows)),
            structuredContent: true
        });
    };

    if (window.initializeSharedCardEditor) connectSharedEditor();
    else window.addEventListener('shared-card-editor-ready', connectSharedEditor, { once: true });
}

function initializeCustomCardArea(menu, panel) {
    const connectSharedEditor = () => {
        if (panel.dataset.sharedCardEditorInitialized || !window.initializeSharedCardEditor) return;
        panel.dataset.sharedCardEditorInitialized = 'true';
        const state = loadCustomCardState();
        window.initializeSharedCardEditor({
            cardList: panel.querySelector('.custom-card-list'),
            addButton: panel.querySelector('.custom-add-card-btn'),
            initialRows: Array.isArray(state[menu.id]) ? state[menu.id] : [],
            structuredContent: true,
            supportsTripleCards: true,
            onChange: (rows) => {
                const next = loadCustomCardState();
                next[menu.id] = rows;
                saveCustomCardState(next);
            }
        });
    };
    if (window.initializeSharedCardEditor) connectSharedEditor();
    else window.addEventListener('shared-card-editor-ready', connectSharedEditor, { once: true });
    return;

    const list = panel.querySelector('.custom-card-list');
    const addButton = panel.querySelector('.custom-add-card-btn');
    const state = loadCustomCardState();
    let rows = Array.isArray(state[menu.id]) ? state[menu.id] : [];

    function persist() {
        const next = loadCustomCardState();
        next[menu.id] = rows;
        saveCustomCardState(next);
    }

    function render() {
        list.replaceChildren();
        rows.forEach((row, rowIndex) => {
            const rowElement = document.createElement('div');
            rowElement.className = row.type === 'double' && row.cards.length > 1 ? 'test-card-row' : '';
            row.cards.forEach((card, cardIndex) => rowElement.appendChild(createCardElement(card, rowIndex, cardIndex, row.type === 'single' || row.cards.length === 1)));
            list.appendChild(rowElement);
        });
    }

    function createCardElement(card, rowIndex, cardIndex, isSingle) {
        const element = document.createElement('div');
        element.className = 'test-created-card' + (isSingle ? ' test-created-card-single' : '');
        const hasContent = Boolean(card.title || card.description || card.body);
        element.classList.toggle('test-card-is-empty', !hasContent);
        const content = document.createElement('div');
        content.className = 'test-card-content';
        if (card.title) { const title = document.createElement('div'); title.className = 'test-card-title'; title.textContent = card.title; content.appendChild(title); }
        if (card.description) { const description = document.createElement('div'); description.className = 'test-card-description'; description.textContent = card.description; content.appendChild(description); }
        if (card.body) { const body = document.createElement('div'); body.className = 'test-card-body-text'; body.textContent = card.body; content.appendChild(body); }
        element.appendChild(content);
        if (!hasContent) { const empty = document.createElement('span'); empty.className = 'test-card-empty'; empty.textContent = '빈 카드'; element.appendChild(empty); }
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'test-card-edit-btn'; edit.textContent = 'Edit';
        edit.addEventListener('click', event => { event.stopPropagation(); openCardEditor(rowIndex, cardIndex); });
        element.appendChild(edit);
        return element;
    }

    function openTypePicker() {
        const overlay = document.createElement('div');
        overlay.className = 'test-card-type-overlay';
        overlay.innerHTML = '<div class="test-card-type-modal" role="dialog" aria-modal="true"><div class="test-card-type-header"><h4>카드 타입 선택</h4><button type="button" class="test-card-type-close" aria-label="닫기">&times;</button></div><div class="test-card-type-body"><div class="test-card-type-options"><button type="button" class="test-card-type-option" data-type="single"><span class="test-card-type-preview single"><i></i></span><span>1열 카드</span></button><button type="button" class="test-card-type-option" data-type="double"><span class="test-card-type-preview double"><i></i><i></i></span><span>2열 카드</span></button></div></div><button type="button" class="test-card-type-register" disabled>등록</button></div>';
        let selected = '';
        const close = () => overlay.remove();
        overlay.querySelector('.test-card-type-close').addEventListener('click', close);
        overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
        overlay.querySelectorAll('.test-card-type-option').forEach(option => option.addEventListener('click', () => {
            selected = option.dataset.type;
            overlay.querySelectorAll('.test-card-type-option').forEach(item => item.classList.toggle('selected', item === option));
            overlay.querySelector('.test-card-type-register').disabled = false;
        }));
        overlay.querySelector('.test-card-type-register').addEventListener('click', () => {
            if (!selected) return;
            rows.push({ type: selected, cards: Array.from({ length: selected === 'double' ? 2 : 1 }, () => ({ title: '', description: '', body: '' })) });
            persist(); render(); close();
        });
        document.body.appendChild(overlay);
    }

    function openCardEditor(rowIndex, cardIndex) {
        const card = rows[rowIndex].cards[cardIndex];
        const overlay = document.createElement('div');
        overlay.className = 'test-card-edit-overlay';
        overlay.innerHTML = '<div class="test-card-edit-dialog" role="dialog" aria-modal="true"><div class="test-card-edit-header"><h4>카드 수정</h4><button type="button" class="test-card-edit-close" aria-label="닫기">&times;</button></div><div class="test-card-edit-body"><label>헤더<input class="custom-card-title-input" type="text"></label><label>헤더 설명<textarea class="custom-card-description-input"></textarea></label><label>본문<textarea class="custom-card-body-input"></textarea></label></div><div class="test-card-edit-actions"><button type="button" class="test-card-edit-save">등록</button><button type="button" class="test-card-edit-delete">삭제</button></div></div>';
        const title = overlay.querySelector('.custom-card-title-input');
        const description = overlay.querySelector('.custom-card-description-input');
        const body = overlay.querySelector('.custom-card-body-input');
        title.value = card.title || ''; description.value = card.description || ''; body.value = card.body || '';
        const close = () => overlay.remove();
        const remove = () => {
            const row = rows[rowIndex];
            row.cards.splice(cardIndex, 1);
            if (!row.cards.length) rows.splice(rowIndex, 1);
            else if (row.cards.length === 1) row.type = 'single';
            persist(); render(); close();
        };
        overlay.querySelector('.test-card-edit-close').addEventListener('click', close);
        overlay.querySelector('.test-card-edit-save').addEventListener('click', () => {
            rows[rowIndex].cards[cardIndex] = { title: title.value.trim(), description: description.value.trim(), body: body.value.trim() };
            persist(); render(); close();
        });
        overlay.querySelector('.test-card-edit-delete').addEventListener('click', () => {
            if (!card.title && !card.description && !card.body) { remove(); return; }
            if (window.confirm('작성된 내용이 있습니다. 삭제하겠습니까?')) remove();
        });
        overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
        document.body.appendChild(overlay);
        title.focus();
    }

    addButton.addEventListener('click', openTypePicker);
    render();
}

function handleNavClick(event) {
    if (window.wmsPermissions?.isAuthenticated?.() !== true) return;
    const tabId = event.currentTarget.dataset.tab;
    event.preventDefault();
    window.location.hash = tabId;
    switchTab(tabId);
}

let expandedMainMenuId = null;

function createMenuLink(menu, isSubmenu = false) {
    if (!menu.builtin) ensureCustomPanel(menu);
    const iconMarkup = isSubmenu ? '' : menu.icon;
    const link = document.createElement('a');
    link.href = '#' + menu.id;
    link.dataset.tab = menu.id;
    link.dataset.tooltip = menu.tooltip || menu.label;
    link.dataset.menuLevel = isSubmenu ? 'submenu' : 'main';
    link.className = 'nav-link ' + (isSubmenu ? 'nav-link-submenu' : 'nav-link-main');
    link.innerHTML = '<div class="nav-link-indicator" style="display:none;"></div>' + iconMarkup + '<span class="hide-on-collapse">' + escapeHtml(menu.label) + '</span>';
    link.addEventListener('click', handleNavClick);
    return link;
}

function updateSidebarMenuState(tabId) {
    const activeMenu = getMenu(tabId);
    const activeMainId = activeMenu?.parentId || activeMenu?.id || null;

    navMenu.querySelectorAll('[data-menu-group]').forEach(group => {
        const mainId = group.dataset.menuGroup;
        const isExpanded = mainId === expandedMainMenuId;
        const submenu = group.querySelector('.nav-submenu');
        const toggle = group.querySelector('.nav-submenu-toggle');
        const mainLink = group.querySelector('.nav-link-main');
        if (submenu) submenu.hidden = !isExpanded;
        if (toggle) {
            toggle.setAttribute('aria-expanded', String(isExpanded));
            toggle.title = isExpanded ? '하위 메뉴 접기' : '하위 메뉴 펼치기';
        }
        mainLink?.classList.toggle('has-active-child', Boolean(activeMenu?.parentId && activeMainId === mainId));
    });

    navMenu.querySelectorAll('.nav-link[data-tab]').forEach(link => {
        const isTarget = link.dataset.tab === tabId;
        link.classList.toggle('active', isTarget);
        const indicator = link.querySelector('.nav-link-indicator');
        if (indicator) indicator.style.display = isTarget ? 'block' : 'none';
    });
}

function renderMenus() {
    navMenu.replaceChildren();
    const visibleIds = new Set(getVisibleTabs());
    getRootMenus().filter(menu => visibleIds.has(menu.id)).forEach(menu => {
        const visibleChildren = getChildMenus(menu.id).filter(child => visibleIds.has(child.id));
        const group = document.createElement('div');
        group.className = 'nav-menu-group';
        group.dataset.menuGroup = menu.id;
        const mainRow = document.createElement('div');
        mainRow.className = 'nav-menu-main-row';
        mainRow.appendChild(createMenuLink(menu));

        if (visibleChildren.length) {
            const submenuId = 'submenu-' + menu.id;
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'nav-submenu-toggle hide-on-collapse';
            toggle.setAttribute('aria-controls', submenuId);
            toggle.setAttribute('aria-label', menu.label + ' 하위 메뉴 펼치기 또는 접기');
            toggle.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 5 5 5-5 5"></path></svg>';
            toggle.addEventListener('click', () => {
                expandedMainMenuId = expandedMainMenuId === menu.id ? null : menu.id;
                updateSidebarMenuState(window.location.hash.replace('#', ''));
            });
            mainRow.appendChild(toggle);

            const submenu = document.createElement('div');
            submenu.id = submenuId;
            submenu.className = 'nav-submenu';
            submenu.hidden = true;
            visibleChildren.forEach(child => submenu.appendChild(createMenuLink(child, true)));
            group.append(mainRow, submenu);
        } else {
            group.appendChild(mainRow);
        }
        navMenu.appendChild(group);
    });
    updateSidebarMenuState(window.location.hash.replace('#', ''));
}

function switchTab(tabId) {
    if (window.wmsPermissions?.isAuthenticated?.() !== true) return;
    if (tabId === 'home') tabId = 'overview';
    if (tabId === 'dashboard') tabId = 'floor';
    if (tabId === 'models') tabId = 'zone';
    if (tabId === 'simulations') tabId = 'rack';
    if (tabId === 'authoring') tabId = 'editor';
    if (!getVisibleTabs().includes(tabId)) tabId = getVisibleTabs()[0] || 'overview';

    const activeMenu = getMenu(tabId);
    expandedMainMenuId = activeMenu?.parentId || activeMenu?.id || null;
    updateSidebarMenuState(tabId);
    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.style.display = panel.id === 'view-' + tabId ? 'block' : 'none';
    });
}

initializeOverviewCardArea();
initializeRouteCardArea();
initializeAuthoringCardArea();
renderMenus();
window.addEventListener('hashchange', () => switchTab(window.location.hash.replace('#', '')));
window.addEventListener('wms-auth-change', (event) => {
    if (event.detail?.authenticated) switchTab(window.location.hash.replace('#', '') || getVisibleTabs()[0]);
});
switchTab(window.location.hash.replace('#', '') || getVisibleTabs()[0]);

const menuManagerModal = document.getElementById('menuManagerModal');
const menuManagerList = document.getElementById('menuManagerList');
const menuNameInput = document.getElementById('menuNameInput');
const menuAddBtn = document.getElementById('menuAddBtn');
const menuParentSelect = document.getElementById('menuParentSelect');

function applyMenuChange() {
    if (!isEditorMode()) return;
    menus = window.WmsMenuTreeModel.normalizeMenus(menus);
    saveMenus();
    renderMenus();
    renderMenuManager();
    const current = window.location.hash.replace('#', '');
    if (!getVisibleTabs().includes(current)) window.location.hash = getVisibleTabs()[0] || 'overview';
    switchTab(window.location.hash.replace('#', ''));
}

function updateMenu(id, changes) {
    menus = menus.map(menu => menu.id === id ? { ...menu, ...changes } : menu);
    applyMenuChange();
}

function moveMenu(id, direction) {
    menus = window.WmsMenuTreeModel.moveWithinParent(menus, id, direction);
    applyMenuChange();
}

function moveMenuToParent(id, parentId) {
    const menu = getMenu(id);
    const normalizedParentId = parentId || null;
    if (!menu || menu.parentId === normalizedParentId) return;
    if (menuHasChildren(id)) {
        window.alert('하위 메뉴가 있는 메인 메뉴는 다른 메뉴 아래로 이동할 수 없습니다. 하위 메뉴를 먼저 이동하거나 삭제해 주세요.');
        renderMenuManager();
        return;
    }
    const parent = normalizedParentId ? getMenu(normalizedParentId) : null;
    if (normalizedParentId && (!parent || parent.parentId)) {
        window.alert('메인 메뉴만 상위 메뉴로 선택할 수 있습니다.');
        renderMenuManager();
        return;
    }
    const siblingCount = menus.filter(item => item.parentId === normalizedParentId && item.id !== id).length;
    menus = menus.map(item => item.id === id ? { ...item, parentId: normalizedParentId, order: siblingCount } : item);
    applyMenuChange();
}

function removeMenu(id) {
    const menu = menus.find(item => item.id === id);
    if (!menu) return;
    if (menuHasChildren(id)) {
        window.alert('이 메뉴에는 하위 메뉴가 있어 삭제할 수 없습니다. 하위 메뉴를 먼저 삭제해 주세요.');
        return;
    }
    if (!menu.parentId && getRootMenus().length === 1) {
        window.alert('최소 한 개의 메인 메뉴는 유지해야 합니다.');
        return;
    }
    if (!window.confirm('“' + menu.label + '” 메뉴를 삭제하겠습니까?')) return;
    if (menu.builtin) {
        if (!deletedBuiltinIds.includes(id)) deletedBuiltinIds.push(id);
        menus = menus.filter(item => item.id !== id);
    } else {
        document.getElementById('view-' + id)?.remove();
        menus = menus.filter(item => item.id !== id);
    }
    applyMenuChange();
}

function startMenuRename(menu, label, actions) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'menu-row-name-input';
    input.value = menu.label;
    input.maxLength = 30;
    input.setAttribute('aria-label', '메뉴 이름 수정');
    label.replaceWith(input);
    Array.from(actions.children).forEach(button => button.disabled = true);

    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'menu-row-action'; cancel.textContent = '취소';
    cancel.addEventListener('click', renderMenuManager);
    const save = document.createElement('button');
    save.type = 'button'; save.className = 'menu-row-action save'; save.textContent = '저장';
    const commit = () => {
        const name = input.value.trim();
        if (name.length < 2 || name.length > 30) { window.alert('메뉴 이름은 2~30자로 입력하세요.'); input.focus(); return; }
        if (menus.some(item => item.id !== menu.id && item.label.trim() === name)) { window.alert('같은 이름의 메뉴가 이미 있습니다.'); input.focus(); return; }
        updateMenu(menu.id, { label: name, tooltip: name, icon: inferMenuIcon(name), iconAuto: true });
    };
    save.addEventListener('click', commit);
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); commit(); }
        if (event.key === 'Escape') { event.preventDefault(); renderMenuManager(); }
    });
    actions.append(cancel, save);
    input.focus();
    input.select();
}

function renderMenuParentOptions() {
    const selectedParentId = menuParentSelect.value;
    menuParentSelect.replaceChildren();
    const mainOption = document.createElement('option');
    mainOption.value = '';
    mainOption.textContent = '메인 메뉴';
    menuParentSelect.appendChild(mainOption);
    getRootMenus().forEach(menu => {
        const option = document.createElement('option');
        option.value = menu.id;
        option.textContent = menu.label + '의 하위 메뉴';
        menuParentSelect.appendChild(option);
    });
    if (Array.from(menuParentSelect.options).some(option => option.value === selectedParentId)) {
        menuParentSelect.value = selectedParentId;
    }
}

function createMenuManagerRow(menu, siblings, index) {
        const row = document.createElement('div');
        row.className = 'menu-manager-row' + (menu.parentId ? ' is-submenu' : '') + (menu.visible === false ? ' is-hidden' : '');
        row.dataset.menuId = menu.id;
        const visible = document.createElement('input');
        visible.type = 'checkbox';
        visible.checked = menu.visible !== false;
        visible.setAttribute('aria-label', menu.label + ' 표시');
        visible.addEventListener('change', () => updateMenu(menu.id, { visible: visible.checked }));
        const label = document.createElement('span');
        label.className = 'menu-row-label';
        label.textContent = menu.label;
        row.append(visible, label);
        const levelBadge = document.createElement('span');
        levelBadge.className = 'menu-row-level';
        levelBadge.textContent = menu.parentId ? '하위' : '메인';
        row.appendChild(levelBadge);
        if (menu.builtin) {
            const badge = document.createElement('span');
            badge.className = 'menu-row-builtin';
            badge.textContent = '기본';
            row.appendChild(badge);
        }

        const parentSelect = document.createElement('select');
        parentSelect.className = 'menu-row-parent-select';
        parentSelect.setAttribute('aria-label', menu.label + ' 상위 메뉴');
        const rootOption = document.createElement('option');
        rootOption.value = '';
        rootOption.textContent = '메인';
        parentSelect.appendChild(rootOption);
        getRootMenus().filter(rootMenu => rootMenu.id !== menu.id).forEach(rootMenu => {
            const option = document.createElement('option');
            option.value = rootMenu.id;
            option.textContent = rootMenu.label;
            parentSelect.appendChild(option);
        });
        parentSelect.value = menu.parentId || '';
        parentSelect.disabled = menuHasChildren(menu.id);
        parentSelect.title = parentSelect.disabled ? '하위 메뉴가 있으면 상위 메뉴를 변경할 수 없습니다.' : '상위 메뉴 변경';
        parentSelect.addEventListener('change', () => moveMenuToParent(menu.id, parentSelect.value));
        row.appendChild(parentSelect);

        const actions = document.createElement('div');
        actions.className = 'menu-row-actions';
        [['↑', '같은 계층에서 위로', index === 0, () => moveMenu(menu.id, -1)], ['↓', '같은 계층에서 아래로', index === siblings.length - 1, () => moveMenu(menu.id, 1)]].forEach(([text, title, disabled, action]) => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'menu-row-action'; button.textContent = text; button.title = title; button.disabled = disabled;
            button.addEventListener('click', action);
            actions.appendChild(button);
        });
        if (!menu.parentId) {
            const addChild = document.createElement('button');
            addChild.type = 'button'; addChild.className = 'menu-row-action add-child'; addChild.textContent = '+ 하위';
            addChild.title = menu.label + '에 하위 메뉴 추가';
            addChild.addEventListener('click', () => {
                menuParentSelect.value = menu.id;
                menuNameInput.focus();
            });
            actions.appendChild(addChild);
        }
        const rename = document.createElement('button');
        rename.type = 'button'; rename.className = 'menu-row-action'; rename.textContent = '수정'; rename.title = '이름 수정';
        rename.addEventListener('click', () => startMenuRename(menu, label, actions));
        actions.appendChild(rename);
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'menu-row-action delete'; remove.textContent = '삭제';
        remove.disabled = menuHasChildren(menu.id);
        remove.title = remove.disabled ? '하위 메뉴를 먼저 삭제해야 합니다.' : '메뉴 삭제';
        remove.addEventListener('click', () => removeMenu(menu.id));
        actions.appendChild(remove);
        row.appendChild(actions);
        return row;
}

function renderMenuManager() {
    menuManagerList.replaceChildren();
    renderMenuParentOptions();
    getRootMenus().forEach((menu, index, rootMenus) => {
        menuManagerList.appendChild(createMenuManagerRow(menu, rootMenus, index));
        const children = getChildMenus(menu.id);
        children.forEach((child, childIndex) => {
            menuManagerList.appendChild(createMenuManagerRow(child, children, childIndex));
        });
    });
}

function closeMenuManager() {
    menuManagerModal.classList.remove('is-open');
    menuManagerModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('sidebarMenuManageBtn').addEventListener('click', () => {
    if (!isEditorMode()) return;
    renderMenuManager();
    menuManagerModal.classList.add('is-open');
    menuManagerModal.setAttribute('aria-hidden', 'false');
    menuNameInput.focus();
});
document.getElementById('menuManagerCloseBtn').addEventListener('click', closeMenuManager);
menuManagerModal.addEventListener('click', event => { if (event.target === menuManagerModal) closeMenuManager(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menuManagerModal.classList.contains('is-open')) closeMenuManager(); });
menuNameInput.addEventListener('input', () => { menuAddBtn.disabled = !menuNameInput.value.trim(); });
document.getElementById('menuAddForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!isEditorMode()) return;
    const label = menuNameInput.value.trim();
    if (label.length < 2 || label.length > 30) {
        window.alert('메뉴 이름은 2~30자로 입력하세요.');
        menuNameInput.focus();
        return;
    }
    if (menus.some(menu => menu.label.trim() === label)) {
        window.alert('같은 이름의 메뉴가 이미 있습니다.');
        menuNameInput.focus();
        return;
    }
    const selectedParent = menuParentSelect.value ? getMenu(menuParentSelect.value) : null;
    const parentId = selectedParent && !selectedParent.parentId ? selectedParent.id : null;
    menus.push({
        id: 'custom-' + Date.now(), label, tooltip: label, icon: inferMenuIcon(label), iconAuto: true,
        parentId, builtin: false, visible: true,
        order: menus.filter(menu => menu.parentId === parentId).length
    });
    menuNameInput.value = '';
    menuParentSelect.value = '';
    menuAddBtn.disabled = true;
    applyMenuChange();
});

// Sidebar collapse state is intentionally kept separate from menu settings.
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('main-content');
const sidebarToggle = document.getElementById('sidebarToggle');
let isCollapsed = false;

function setCollapsedTextVisibility(collapsed) {
    document.querySelectorAll('.sidebar .hide-on-collapse').forEach(element => {
        if (collapsed) {
            element.classList.add('opacity-0');
            setTimeout(() => element.classList.add('hidden'), 150);
        } else {
            element.classList.remove('hidden');
            setTimeout(() => element.classList.remove('opacity-0'), 10);
        }
    });
}

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.add('transition-all');
    mainContent.classList.add('transition-all');
    isCollapsed = !isCollapsed;
    sidebar.classList.toggle('collapsed', isCollapsed);
    mainContent.classList.toggle('collapsed', isCollapsed);
    sidebarToggle.setAttribute('data-tooltip', isCollapsed ? '사이드바 펼치기' : '사이드바 접기');
    setCollapsedTextVisibility(isCollapsed);
});
