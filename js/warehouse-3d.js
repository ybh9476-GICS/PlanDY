(function () {
    const threeModuleUrl = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js';
    const mountedControllers = new WeakMap();
    let threeModulePromise;
    const worldUiResolutionScale = 2;

    function loadThree() {
        if (!threeModulePromise) threeModulePromise = import(threeModuleUrl);
        return threeModulePromise;
    }

    const googleSheetDefinitions = Object.freeze({
        floorPlan: { sheetName: '평면도', range: 'A4:AZ60', headers: ['Y\\X'] },
        rackTypes: { sheetName: '랙타입 마스터', range: 'A4:J', headers: ['랙타입코드', '랙타입명', '베이폭(mm)', '깊이(mm)', '전체높이(mm)', '단수', '단당높이(mm)'] },
        zones: { sheetName: '구역설정', range: 'A4:H', headers: ['구역코드', '구역명', '용도', '기본랙타입코드'] },
        racks: { sheetName: '랙배치', range: 'A4:K', headers: ['랙코드', '구역코드', '랙타입코드', '시작X(m)', '시작Y(m)', '방향', '베이수'] },
        locations: { sheetName: '로케이션 마스터', range: 'A4:H', headers: ['로케이션코드', '랙코드', '베이번호', '단번호', '최대수량'] },
        items: { sheetName: '품목 마스터', range: 'A4:I', headers: ['품목코드', '품목명', '분류', '표시색상', '가로(mm)', '세로(mm)', '높이(mm)'] },
        inventory: { sheetName: '재고 현황', range: 'A4:G', headers: ['로케이션코드', '품목코드', '재고수량', '최대수량', '재고상태'] }
    });

    function parseCsv(csvText) {
        const rows = [];
        let row = [];
        let cell = '';
        let quoted = false;
        const text = String(csvText || '').replace(/^\uFEFF/, '');
        for (let index = 0; index < text.length; index += 1) {
            const character = text[index];
            if (quoted) {
                if (character === '"' && text[index + 1] === '"') {
                    cell += '"';
                    index += 1;
                } else if (character === '"') quoted = false;
                else cell += character;
                continue;
            }
            if (character === '"') quoted = true;
            else if (character === ',') {
                row.push(cell.trim());
                cell = '';
            } else if (character === '\n' || character === '\r') {
                if (character === '\r' && text[index + 1] === '\n') index += 1;
                row.push(cell.trim());
                if (row.some((value) => value !== '')) rows.push(row);
                row = [];
                cell = '';
            } else cell += character;
        }
        row.push(cell.trim());
        if (row.some((value) => value !== '')) rows.push(row);
        return rows;
    }

    function csvToRecords(csvText, requiredHeaders, sheetName) {
        const rows = parseCsv(csvText);
        const headerIndex = rows.findIndex((row) => requiredHeaders.every((header) => row.includes(header)));
        if (headerIndex < 0) throw new Error(`${sheetName}: 필수 헤더를 찾지 못했습니다. (${requiredHeaders.join(', ')})`);
        const headers = rows[headerIndex].map((header) => String(header || '').trim());
        return rows.slice(headerIndex + 1)
            .filter((row) => row.some((value) => value !== ''))
            .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
    }

    function toNumber(value, fallback = 0) {
        const text = String(value ?? '').replace(/,/g, '').trim();
        if (!text) return fallback;
        const number = Number(text);
        return Number.isFinite(number) ? number : fallback;
    }

    function isEnabled(value) {
        return !['N', 'NO', 'FALSE', '0', '미사용'].includes(String(value ?? '').trim().toUpperCase());
    }

    function convertGoogleSheetCsv(csvByKey, options = {}) {
        const records = {};
        Object.entries(googleSheetDefinitions).forEach(([key, definition]) => {
            const sheetName = options.sheets?.[key] || definition.sheetName;
            records[key] = csvToRecords(csvByKey[key], definition.headers, sheetName);
        });

        const floorPlanByRack = new Map();
        records.floorPlan.forEach((row) => {
            const y = Number(row['Y\\X']);
            if (!Number.isFinite(y)) return;
            Object.entries(row).forEach(([header, value]) => {
                if (header === 'Y\\X') return;
                const x = Number(header);
                const rackCode = String(value || '').trim();
                if (!Number.isFinite(x) || !rackCode) return;
                const placement = floorPlanByRack.get(rackCode) || { minX: x, maxX: x, minY: y, maxY: y, cellCount: 0 };
                placement.minX = Math.min(placement.minX, x);
                placement.maxX = Math.max(placement.maxX, x);
                placement.minY = Math.min(placement.minY, y);
                placement.maxY = Math.max(placement.maxY, y);
                placement.cellCount += 1;
                floorPlanByRack.set(rackCode, placement);
            });
        });

        const zones = records.zones
            .filter((row) => row['구역코드'])
            .map((row) => ({
                code: row['구역코드'],
                name: row['구역명'],
                purpose: row['용도'],
                defaultRackTypeCode: row['기본랙타입코드'],
                aisleWidth: toNumber(row['통로폭(mm)']),
                temperatureClass: row['온도구분'] || '',
                priority: toNumber(row['작업우선순위']),
                description: row['설명'] || ''
            }));
        const rackTypes = records.rackTypes
            .filter((row) => row['랙타입코드'])
            .map((row) => ({
                code: row['랙타입코드'],
                name: row['랙타입명'],
                bayWidth: toNumber(row['베이폭(mm)']),
                depth: toNumber(row['깊이(mm)']),
                height: toNumber(row['전체높이(mm)']),
                levels: toNumber(row['단수']),
                levelHeight: toNumber(row['단당높이(mm)']),
                depthCount: toNumber(row['깊이수'], 1),
                maxWeight: toNumber(row['단당최대중량(kg)']),
                color: row['표시색상'] || '#64748b'
            }));
        let floorPlanAppliedCount = 0;
        const enabledRackRows = records.racks.filter((row) => row['랙코드'] && isEnabled(row['사용여부']));
        const usesFloorPlan = floorPlanByRack.size > 0;
        const unplacedRackCodes = usesFloorPlan
            ? enabledRackRows.map((row) => String(row['랙코드']).trim()).filter((code) => !floorPlanByRack.has(code))
            : [];
        const racks = enabledRackRows
            .filter((row) => !usesFloorPlan || floorPlanByRack.has(String(row['랙코드']).trim()))
            .map((row) => {
                const code = String(row['랙코드']).trim();
                const placement = floorPlanByRack.get(code);
                const storedDirection = ['세로', 'VERTICAL', 'V'].includes(String(row['방향'] || '').trim().toUpperCase()) ? 'vertical' : 'horizontal';
                let direction = storedDirection;
                if (placement) {
                    const width = placement.maxX - placement.minX + 1;
                    const depth = placement.maxY - placement.minY + 1;
                    if (width !== depth) direction = depth > width ? 'vertical' : 'horizontal';
                    floorPlanAppliedCount += 1;
                }
                return {
                    code,
                    zoneCode: row['구역코드'],
                    rackTypeCode: row['랙타입코드'],
                    startX: placement ? placement.minX * 1000 : toNumber(row['시작X(m)']) * 1000,
                    startY: placement ? placement.minY * 1000 : toNumber(row['시작Y(m)']) * 1000,
                    direction,
                    bayCount: toNumber(row['베이수']),
                    doubleSided: String(row['양면여부'] || '').trim().toUpperCase() === 'Y',
                    layoutSource: placement ? 'floorPlan' : 'rackPlacement'
                };
            });
        const items = records.items
            .filter((row) => row['품목코드'])
            .map((row) => ({
                code: row['품목코드'],
                name: row['품목명'],
                category: row['분류'],
                color: row['표시색상'] || '#ef4444',
                width: toNumber(row['가로(mm)']),
                depth: toNumber(row['세로(mm)']),
                height: toNumber(row['높이(mm)']),
                storageType: row['보관유형'] || '',
                unit: row['단위'] || ''
            }));
        const locations = records.locations
            .filter((row) => row['로케이션코드'])
            .map((row) => ({
                locationCode: row['로케이션코드'],
                rackCode: row['랙코드'],
                bay: toNumber(row['베이번호']),
                level: toNumber(row['단번호']),
                depth: toNumber(row['깊이번호'], 1),
                capacity: toNumber(row['최대수량']),
                status: row['상태'] || '',
                note: row['비고'] || ''
            }));
        const locationsByCode = new Map(locations.map((location) => [location.locationCode, location]));
        const statusMap = { 정상: 'normal', 주의: 'warning', 보류: 'hold', 불량: 'defect' };
        const visibleRackCodes = new Set(racks.map((rack) => rack.code));
        const inventory = records.inventory
            .filter((row) => {
                const location = locationsByCode.get(row['로케이션코드']);
                return row['로케이션코드'] && row['품목코드'] && toNumber(row['재고수량']) > 0
                    && (!usesFloorPlan || visibleRackCodes.has(location?.rackCode));
            })
            .map((row) => {
                const location = locationsByCode.get(row['로케이션코드']) || {};
                const rawStatus = String(row['재고상태'] || '').trim();
                return {
                    locationCode: row['로케이션코드'],
                    rackCode: location.rackCode || '',
                    bay: location.bay || 0,
                    level: location.level || 0,
                    depth: location.depth || 1,
                    itemCode: row['품목코드'],
                    quantity: toNumber(row['재고수량']),
                    capacity: toNumber(row['최대수량'], location.capacity || 0),
                    status: statusMap[rawStatus] || rawStatus.toLowerCase() || 'normal'
                };
            });

        const rackTypeByCode = new Map(rackTypes.map((type) => [type.code, type]));
        const floorPlanMaxX = Math.max(0, ...Object.keys(records.floorPlan[0] || {}).map(Number).filter(Number.isFinite));
        const floorPlanMaxY = Math.max(0, ...records.floorPlan.map((row) => Number(row['Y\\X'])).filter(Number.isFinite));
        let floorWidth = Math.max(10000, (floorPlanMaxX + 1) * 1000);
        let floorDepth = Math.max(10000, (floorPlanMaxY + 1) * 1000);
        racks.forEach((rack) => {
            const type = rackTypeByCode.get(rack.rackTypeCode);
            if (!type) return;
            const length = type.bayWidth * rack.bayCount;
            const width = rack.direction === 'vertical' ? type.depth : length;
            const depth = rack.direction === 'vertical' ? length : type.depth;
            floorWidth = Math.max(floorWidth, rack.startX + width + 4000);
            floorDepth = Math.max(floorDepth, rack.startY + depth + 4000);
        });
        return {
            schemaVersion: 1,
            meta: {
                name: options.name || 'Google Sheets 기준정보 창고',
                unit: 'mm',
                floorWidth: Math.ceil(floorWidth / 1000) * 1000,
                floorDepth: Math.ceil(floorDepth / 1000) * 1000,
                source: 'googleSheets',
                documentId: options.documentId || '',
                floorPlanAppliedCount,
                unplacedRackCodes,
                unmappedFloorRackCodes: [...floorPlanByRack.keys()].filter((code) => !racks.some((rack) => rack.code === code))
            },
            zones, rackTypes, racks, locations, items, inventory
        };
    }

    function googleTableToCsv(table) {
        const escapeCell = (value) => {
            const text = String(value ?? '');
            return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        };
        const headers = (table?.cols || []).map((column) => escapeCell(column?.label || column?.id || ''));
        const rows = (table?.rows || []).map((row) => (table?.cols || []).map((_, index) => {
            const cell = row?.c?.[index];
            return escapeCell(cell?.v ?? '');
        }).join(','));
        return [headers.join(','), ...rows].join('\n');
    }

    function getGoogleSheetQueryUrl(documentId, sheetName, range, callbackName) {
        if (!/^[A-Za-z0-9_-]{20,}$/.test(String(documentId || ''))) throw new Error('Google 스프레드시트 문서 ID가 올바르지 않습니다.');
        return `https://docs.google.com/spreadsheets/d/${documentId}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${encodeURIComponent(sheetName)}&range=${encodeURIComponent(range)}&headers=1&_=${Date.now()}`;
    }

    function loadGoogleSheetTable(documentId, sheetName, range, signal) {
        return new Promise((resolve, reject) => {
            const callbackName = `__wmsGoogleSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const script = document.createElement('script');
            let settled = false;
            const cleanup = () => {
                script.remove();
                delete window[callbackName];
                clearTimeout(timeout);
            };
            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                cleanup();
                callback(value);
            };
            window[callbackName] = (response) => {
                if (response?.status !== 'ok' || !response?.table) {
                    finish(reject, new Error(`${sheetName} 시트를 읽지 못했습니다. 공유 권한과 시트명을 확인해 주세요.`));
                    return;
                }
                finish(resolve, googleTableToCsv(response.table));
            };
            script.async = true;
            script.referrerPolicy = 'no-referrer';
            script.src = getGoogleSheetQueryUrl(documentId, sheetName, range, callbackName);
            script.addEventListener('error', () => finish(reject, new Error(`${sheetName} 시트 연결에 실패했습니다.`)), { once: true });
            signal.addEventListener('abort', () => finish(reject, new DOMException('요청이 취소되었습니다.', 'AbortError')), { once: true });
            const timeout = setTimeout(() => finish(reject, new Error(`${sheetName} 시트 응답 시간이 초과되었습니다.`)), 20000);
            document.head.appendChild(script);
        });
    }

    async function loadGoogleSheetData(config, signal) {
        const documentId = config?.documentId;
        const entries = await Promise.all(Object.entries(googleSheetDefinitions).map(async ([key, definition]) => {
            const sheetName = config?.sheets?.[key] || definition.sheetName;
            const csv = await loadGoogleSheetTable(documentId, sheetName, definition.range, signal);
            return [key, csv];
        }));
        return convertGoogleSheetCsv(Object.fromEntries(entries), config);
    }

    function validateWarehouseData(data) {
        const errors = [];
        if (!data || typeof data !== 'object') return ['기준정보 파일이 비어 있습니다.'];
        ['zones', 'rackTypes', 'racks', 'items', 'inventory'].forEach((key) => {
            if (!Array.isArray(data[key])) errors.push(`${key} 목록이 없습니다.`);
        });
        if (errors.length) return errors;
        const zoneCodes = new Set(data.zones.map((zone) => zone.code));
        const rackTypeCodes = new Set(data.rackTypes.map((type) => type.code));
        const itemCodes = new Set(data.items.map((item) => item.code));
        const rackCodes = new Set();
        data.racks.forEach((rack) => {
            if (!rack.code) errors.push('랙코드가 비어 있습니다.');
            else if (rackCodes.has(rack.code)) errors.push(`중복 랙코드: ${rack.code}`);
            else rackCodes.add(rack.code);
            if (!zoneCodes.has(rack.zoneCode)) errors.push(`${rack.code}: 존재하지 않는 구역 ${rack.zoneCode}`);
            if (!rackTypeCodes.has(rack.rackTypeCode)) errors.push(`${rack.code}: 존재하지 않는 랙타입 ${rack.rackTypeCode}`);
            if (!(Number(rack.bayCount) > 0)) errors.push(`${rack.code}: 베이수가 올바르지 않습니다.`);
        });
        data.inventory.forEach((stock) => {
            if (!rackCodes.has(stock.rackCode)) errors.push(`${stock.locationCode}: 존재하지 않는 랙 ${stock.rackCode}`);
            if (!itemCodes.has(stock.itemCode)) errors.push(`${stock.locationCode}: 존재하지 않는 품목 ${stock.itemCode}`);
        });
        return errors;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        })[character]);
    }

    const slotColorPalette = Object.freeze({
        empty: '#94a3b8',
        low: '#22c55e',
        medium: '#f59e0b',
        high: '#ef4444',
        normal: '#22c55e',
        warning: '#f59e0b',
        hold: '#a855f7',
        defect: '#ef4444',
        unknown: '#475569'
    });

    function getSlotVisualKey(slot, mode = 'utilization') {
        if (!slot?.occupied) return 'empty';
        if (mode === 'status') {
            const status = String(slot.stock?.status || '').trim().toLowerCase();
            return ['normal', 'warning', 'hold', 'defect'].includes(status) ? status : 'unknown';
        }
        const capacity = Number(slot.stock?.capacity || slot.location?.capacity || 0);
        if (!(capacity > 0)) return 'unknown';
        const rate = Math.max(0, Number(slot.stock?.quantity || 0) / capacity);
        if (rate < 0.5) return 'low';
        if (rate < 0.8) return 'medium';
        return 'high';
    }

    function createShell(container) {
        container.className = 'warehouse-3d-shell';
        container.innerHTML = `
            <div class="warehouse-3d-toolbar">
                <div class="warehouse-3d-toolbar-main">
                    <label>구역 <select class="warehouse-3d-zone-filter"><option value="">전체</option></select></label>
                    <label class="warehouse-3d-search-label">검색 <input class="warehouse-3d-search" type="search" placeholder="랙·품목 코드 또는 이름"></label>
                    <button class="warehouse-3d-reload" type="button" hidden>시트 새로고침</button>
                    <button class="warehouse-3d-fullscreen" type="button" aria-pressed="false">전체화면</button>
                </div>
                <span class="warehouse-3d-count" role="status"></span>
            </div>
            <div class="warehouse-3d-main">
                <div class="warehouse-3d-viewport" aria-label="3D 창고 화면">
                    <div class="warehouse-3d-loading" role="status">3D 창고 기준정보를 불러오는 중입니다.</div>
                    <div class="warehouse-3d-camera-views" role="group" aria-label="카메라 구도" hidden>
                        <button type="button" data-warehouse-camera-view="quarter" aria-label="쿼터 뷰: 30도 등각으로 보기" aria-pressed="true" title="쿼터 뷰">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7.5 4.3v9.4L12 21l-7.5-4.3V7.3L12 3Z"/><path d="m4.5 7.3 7.5 4.3 7.5-4.3M12 11.6V21"/></svg>
                        </button>
                        <button type="button" data-warehouse-camera-view="top" aria-label="탑 뷰: 중앙 위에서 보기" aria-pressed="false" title="탑 뷰">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path class="warehouse-3d-view-face" d="m12 3 7.5 4.3L12 11.6 4.5 7.3 12 3Z"/><path d="m12 3 7.5 4.3v9.4L12 21l-7.5-4.3V7.3L12 3Z"/><path d="m4.5 7.3 7.5 4.3 7.5-4.3M12 11.6V21"/></svg>
                        </button>
                        <button type="button" data-warehouse-camera-view="front" aria-label="프론트 뷰: 정면에서 보기" aria-pressed="false" title="프론트 뷰">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path class="warehouse-3d-view-face" d="M4.5 7.3 12 11.6V21l-7.5-4.3V7.3Z"/><path d="m12 3 7.5 4.3v9.4L12 21l-7.5-4.3V7.3L12 3Z"/><path d="m4.5 7.3 7.5 4.3 7.5-4.3M12 11.6V21"/></svg>
                        </button>
                        <button type="button" data-warehouse-camera-view="side" aria-label="사이드 뷰: 측면에서 보기" aria-pressed="false" title="사이드 뷰">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path class="warehouse-3d-view-face" d="M12 11.6 19.5 7.3v9.4L12 21v-9.4Z"/><path d="m12 3 7.5 4.3v9.4L12 21l-7.5-4.3V7.3L12 3Z"/><path d="m4.5 7.3 7.5 4.3 7.5-4.3M12 11.6V21"/></svg>
                        </button>
                        <button type="button" data-warehouse-grid-toggle aria-label="Grid 숨기기" aria-pressed="true" title="Grid 켜기/끄기">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16"/></svg>
                        </button>
                    </div>
                </div>
                <aside class="warehouse-3d-inspector" aria-live="polite">
                    <h5>선택 정보</h5>
                    <p>랙이나 적재 상자를 선택하면 상세 정보가 표시됩니다.</p>
                </aside>
            </div>
            <div class="warehouse-3d-legend" aria-label="선택한 재고 보기의 색상 범례">
                <div class="warehouse-3d-view-toggle" role="group" aria-label="재고 색상 보기 기준">
                    <span>보기</span>
                    <button type="button" data-warehouse-view="utilization" aria-pressed="true">적재율</button>
                    <button type="button" data-warehouse-view="status" aria-pressed="false">재고 상태</button>
                </div>
                <div class="warehouse-3d-legend-items"></div>
                <span class="warehouse-3d-source-status" role="status">기준정보를 확인하는 중입니다.</span>
            </div>`;
        return {
            viewport: container.querySelector('.warehouse-3d-viewport'),
            loading: container.querySelector('.warehouse-3d-loading'),
            inspector: container.querySelector('.warehouse-3d-inspector'),
            zoneFilter: container.querySelector('.warehouse-3d-zone-filter'),
            search: container.querySelector('.warehouse-3d-search'),
            reload: container.querySelector('.warehouse-3d-reload'),
            fullscreen: container.querySelector('.warehouse-3d-fullscreen'),
            viewButtons: [...container.querySelectorAll('[data-warehouse-view]')],
            cameraViews: container.querySelector('.warehouse-3d-camera-views'),
            cameraViewButtons: [...container.querySelectorAll('[data-warehouse-camera-view]')],
            gridToggle: container.querySelector('[data-warehouse-grid-toggle]'),
            legendItems: container.querySelector('.warehouse-3d-legend-items'),
            sourceStatus: container.querySelector('.warehouse-3d-source-status'),
            count: container.querySelector('.warehouse-3d-count')
        };
    }

    function showError(shell, messages) {
        shell.loading.className = 'warehouse-3d-error';
        shell.loading.innerHTML = `<strong>3D 창고를 표시하지 못했습니다.</strong><ul>${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>`;
    }

    function createLabelSprite(THREE, text) {
        const canvas = document.createElement('canvas');
        canvas.width = 256 * worldUiResolutionScale;
        canvas.height = 72 * worldUiResolutionScale;
        const context = canvas.getContext('2d');
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        const visuals = {
            normal: { fill: 'rgba(5, 15, 30, 0.92)', stroke: '#3b82f6', text: '#ffffff', scale: 1 },
            hover: { fill: 'rgba(35, 34, 13, 0.96)', stroke: '#FFFF97', text: '#ffffff', scale: 1.06 },
            selected: { fill: '#FFFF2D', stroke: '#FFF9B0', text: '#07111f', scale: 1.1 }
        };
        const applyScale = (scale) => sprite.scale.set(3.2 * scale, 0.9 * scale, 1);
        let displayedScale = 1;

        const drawLabel = (state = 'normal') => {
            const visual = visuals[state] || visuals.normal;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = visual.fill;
            context.fillRect(6, 6, 500, 132);
            context.strokeStyle = visual.stroke;
            context.lineWidth = 6;
            context.strokeRect(6, 6, 500, 132);
            context.fillStyle = visual.text;
            context.font = '700 64px sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, 256, 72);
            texture.needsUpdate = true;
        };
        sprite.setInteractionState = (state = 'normal') => {
            const visual = visuals[state] || visuals.normal;
            drawLabel(state);
            const startScale = displayedScale;
            const targetScale = visual.scale;
            material.opacity = 0.82;
            return (progress) => {
                displayedScale = startScale + (targetScale - startScale) * progress;
                applyScale(displayedScale);
                material.opacity = 0.82 + 0.18 * progress;
            };
        };
        drawLabel('normal');
        applyScale(displayedScale);
        material.opacity = 1;
        sprite.renderOrder = 1000;
        return sprite;
    }

    function startWarehouseScene(THREE, shell, data, signal) {
        const mm = (value) => Number(value || 0) / 1000;
        const floorWidth = mm(data.meta?.floorWidth || 52000);
        const floorDepth = mm(data.meta?.floorDepth || 58000);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#07111f');

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 250);
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.sortObjects = true;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute('aria-label', '기준정보 기반 3D 창고');
        shell.viewport.replaceChildren(renderer.domElement, shell.cameraViews);
        shell.cameraViews.hidden = false;

        scene.add(new THREE.HemisphereLight('#dbeafe', '#0f172a', 2.2));
        const sun = new THREE.DirectionalLight('#ffffff', 2.8);
        sun.position.set(25, 45, 20);
        sun.castShadow = true;
        scene.add(sun);
        const fillLight = new THREE.DirectionalLight('#dbeafe', 1.35);
        fillLight.position.set(floorWidth * 0.85, 28, floorDepth * 0.85);
        fillLight.target.position.set(floorWidth / 2, 2.5, floorDepth / 2);
        fillLight.castShadow = false;
        scene.add(fillLight, fillLight.target);

        const reflectionRoom = new THREE.Scene();
        reflectionRoom.background = new THREE.Color('#0b2138');
        const reflectionShell = new THREE.Mesh(new THREE.SphereGeometry(12, 24, 16), new THREE.MeshBasicMaterial({ color: '#12324c', side: THREE.BackSide }));
        reflectionRoom.add(reflectionShell);
        const addReflectionPanel = (color, position, rotation, size) => {
            const panel = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ color }));
            panel.position.set(...position);
            panel.rotation.set(...rotation);
            reflectionRoom.add(panel);
        };
        addReflectionPanel('#e0f2fe', [0, 7, 0], [-Math.PI / 2, 0, 0], [18, 4]);
        addReflectionPanel('#93c5fd', [0, 3, -8], [0, 0, 0], [18, 3]);
        addReflectionPanel('#bbf7d0', [-8, 3, 0], [0, Math.PI / 2, 0], [16, 3]);
        const reflectionPmrem = new THREE.PMREMGenerator(renderer);
        const floorReflectionEnvironment = reflectionPmrem.fromScene(reflectionRoom, 0.04).texture;
        reflectionPmrem.dispose();
        reflectionRoom.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) object.material.dispose();
        });
        scene.environment = floorReflectionEnvironment;

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(floorWidth, floorDepth),
            new THREE.MeshPhysicalMaterial({
                color: '#17603f',
                roughness: 0.08,
                metalness: 0.04,
                clearcoat: 1,
                clearcoatRoughness: 0.025,
                envMapIntensity: 2.4
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(floorWidth / 2, -0.02, floorDepth / 2);
        floor.receiveShadow = true;
        scene.add(floor);
        const grid = new THREE.GridHelper(Math.max(floorWidth, floorDepth), Math.ceil(Math.max(floorWidth, floorDepth)), '#78a98b', '#2f7454');
        grid.position.set(floorWidth / 2, 0, floorDepth / 2);
        scene.add(grid);

        const rackTypeByCode = new Map(data.rackTypes.map((type) => [type.code, type]));
        const itemByCode = new Map(data.items.map((item) => [item.code, item]));
        const zoneByCode = new Map(data.zones.map((zone) => [zone.code, zone]));
        const slotKey = (rackCode, bay, level, depth) => `${rackCode}|${bay}|${level}|${depth}`;
        const locationBySlot = new Map((data.locations || []).map((location) => [
            slotKey(location.rackCode, location.bay, location.level, location.depth || 1),
            location
        ]));
        const inventoryBySlot = new Map(data.inventory.map((stock) => [
            slotKey(stock.rackCode, stock.bay, stock.level, stock.depth || 1),
            stock
        ]));
        const inventoryByRack = new Map();
        data.inventory.forEach((stock) => {
            if (!inventoryByRack.has(stock.rackCode)) inventoryByRack.set(stock.rackCode, []);
            inventoryByRack.get(stock.rackCode).push(stock);
        });

        const rackEntries = [];
        const clickTargets = [];
        const labelTargets = [];
        const slotMeshEntries = [];
        const geometryCache = new Map();
        const outlineGeometryCache = new Map();
        const outlineTubeGeometryCache = new Map();
        const materialCache = new Map();
        const getGeometry = (width, height, depth) => {
            const key = `${width}:${height}:${depth}`;
            if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(width, height, depth));
            return geometryCache.get(key);
        };
        const getChamferedBoxGeometry = (width, height, depth) => {
            const chamfer = Math.min(0.055, Math.max(0.012, Math.min(width, height, depth) * 0.045));
            const key = `chamfer:${width}:${height}:${depth}:${chamfer}`;
            if (!geometryCache.has(key)) {
                const halfWidth = Math.max(chamfer * 2, width / 2 - chamfer);
                const halfHeight = Math.max(chamfer * 2, height / 2 - chamfer);
                const cornerCut = chamfer * 0.85;
                const shape = new THREE.Shape();
                shape.moveTo(-halfWidth + cornerCut, -halfHeight);
                shape.lineTo(halfWidth - cornerCut, -halfHeight);
                shape.lineTo(halfWidth, -halfHeight + cornerCut);
                shape.lineTo(halfWidth, halfHeight - cornerCut);
                shape.lineTo(halfWidth - cornerCut, halfHeight);
                shape.lineTo(-halfWidth + cornerCut, halfHeight);
                shape.lineTo(-halfWidth, halfHeight - cornerCut);
                shape.lineTo(-halfWidth, -halfHeight + cornerCut);
                shape.closePath();
                const geometry = new THREE.ExtrudeGeometry(shape, {
                    depth: Math.max(0.001, depth - chamfer * 2),
                    steps: 1,
                    curveSegments: 1,
                    bevelEnabled: true,
                    bevelSegments: 1,
                    bevelSize: chamfer,
                    bevelThickness: chamfer
                });
                geometry.center();
                geometry.computeVertexNormals();
                geometryCache.set(key, geometry);
            }
            return geometryCache.get(key);
        };
        const getSlotOutlineGeometry = (width, height, depth) => {
            const key = `${width}:${height}:${depth}`;
            if (!outlineGeometryCache.has(key)) {
                const boxGeometry = new THREE.BoxGeometry(width, height, depth);
                const edgeGeometry = new THREE.EdgesGeometry(boxGeometry);
                boxGeometry.dispose();
                outlineGeometryCache.set(key, edgeGeometry);
            }
            return outlineGeometryCache.get(key);
        };
        const getOutlineTubeGeometry = (length, radius) => {
            const key = `${length.toFixed(4)}:${radius}`;
            if (!outlineTubeGeometryCache.has(key)) outlineTubeGeometryCache.set(key, new THREE.CylinderGeometry(radius, radius, length, 6));
            return outlineTubeGeometryCache.get(key);
        };
        const addOuterEdgeTubes = (outline, edgeGeometry, radius, material, renderOrder) => {
            const positions = edgeGeometry.getAttribute('position');
            const up = new THREE.Vector3(0, 1, 0);
            for (let index = 0; index < positions.count; index += 2) {
                const start = new THREE.Vector3().fromBufferAttribute(positions, index);
                const end = new THREE.Vector3().fromBufferAttribute(positions, index + 1);
                const direction = end.clone().sub(start);
                const length = direction.length();
                if (!(length > 0)) continue;
                const segment = new THREE.Mesh(getOutlineTubeGeometry(length, radius), material);
                segment.position.copy(start).add(end).multiplyScalar(0.5);
                segment.quaternion.setFromUnitVectors(up, direction.normalize());
                segment.renderOrder = renderOrder;
                outline.add(segment);
            }
        };
        const getMaterial = (color, options = {}) => {
            const materialOptions = {
                roughness: 0.38,
                metalness: 0.12,
                clearcoat: 0.45,
                clearcoatRoughness: 0.28,
                ...options
            };
            const key = [
                color,
                materialOptions.transparent ? 't' : 'o',
                materialOptions.opacity ?? 1,
                materialOptions.roughness,
                materialOptions.metalness,
                materialOptions.clearcoat,
                materialOptions.clearcoatRoughness
            ].join(':');
            if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshPhysicalMaterial({ color, ...materialOptions }));
            return materialCache.get(key);
        };
        const rackHoverMaterial = new THREE.MeshBasicMaterial({ color: '#78ABFF', transparent: true, opacity: 0.92, depthTest: false, depthWrite: false });
        const rackSelectedMaterial = new THREE.MeshBasicMaterial({ color: '#3B82F6', transparent: true, opacity: 1, depthTest: false, depthWrite: false });
        const createRackOutline = (size, position, material) => {
            const outline = new THREE.Group();
            const edgeGeometry = getSlotOutlineGeometry(size[0], size[1], size[2]);
            addOuterEdgeTubes(outline, edgeGeometry, 0.042, material, 12);
            outline.position.set(position[0], position[1], position[2]);
            outline.visible = false;
            outline.renderOrder = 12;
            outline.userData = { material, maxOpacity: material.opacity };
            return outline;
        };
        const addBox = (group, size, position, color, userData, options = {}) => {
            const mesh = new THREE.Mesh(getGeometry(size[0], size[1], size[2]), getMaterial(color, options));
            mesh.position.set(position[0], position[1], position[2]);
            mesh.castShadow = options.castShadow !== false;
            mesh.receiveShadow = true;
            if (userData) mesh.userData = userData;
            group.add(mesh);
            return mesh;
        };

        const createSlotOutline = (color, radius) => {
            const outline = new THREE.Group();
            outline.visible = false;
            outline.renderOrder = 10;
            outline.userData = {
                radius,
                material: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
                maxOpacity: 1
            };
            return outline;
        };
        const hoverOutline = createSlotOutline('#FFFF97', 0.03);
        const selectedOutline = createSlotOutline('#FFFF2D', 0.03);
        const hoverCanvas = document.createElement('canvas');
        hoverCanvas.width = 520 * worldUiResolutionScale;
        hoverCanvas.height = 132 * worldUiResolutionScale;
        const hoverContext = hoverCanvas.getContext('2d');
        const hoverTexture = new THREE.CanvasTexture(hoverCanvas);
        hoverTexture.colorSpace = THREE.SRGBColorSpace;
        const hoverLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: hoverTexture, transparent: true, depthTest: false, depthWrite: false }));
        const hoverLabelLayer = new THREE.Group();
        hoverLabelLayer.renderOrder = 1000;
        hoverLabelLayer.add(hoverLabel);
        hoverLabel.visible = false;
        hoverLabel.renderOrder = 11;
        hoverLabel.material.opacity = 0;
        const hoverLabelBaseScale = [4.4, 1.12];

        data.racks.forEach((rack) => {
            const type = rackTypeByCode.get(rack.rackTypeCode);
            if (!type) return;
            const bayWidth = mm(type.bayWidth);
            const depth = mm(type.depth);
            const height = mm(type.height);
            const levelHeight = mm(type.levelHeight) || height / Math.max(1, type.levels);
            const length = bayWidth * rack.bayCount;
            const group = new THREE.Group();
            group.name = rack.code;
            const rackFrameColor = '#8b95a5';
            const rackFrameMaterial = {
                roughness: 0.2,
                metalness: 0.78,
                clearcoat: 0.62,
                clearcoatRoughness: 0.14
            };
            const rackData = { kind: 'rack', rack, type, zone: zoneByCode.get(rack.zoneCode) };
            const postSize = Math.min(0.1, Math.max(0.055, bayWidth * 0.045));
            for (let bay = 0; bay <= rack.bayCount; bay += 1) {
                const x = bay * bayWidth;
                addBox(group, [postSize, height, postSize], [x, height / 2, 0], rackFrameColor, rackData, rackFrameMaterial);
                addBox(group, [postSize, height, postSize], [x, height / 2, depth], rackFrameColor, rackData, rackFrameMaterial);
            }
            for (let level = 0; level <= type.levels; level += 1) {
                const y = Math.min(height, level * levelHeight);
                addBox(group, [length, 0.08, 0.09], [length / 2, y, 0], rackFrameColor, rackData, rackFrameMaterial);
                addBox(group, [length, 0.08, 0.09], [length / 2, y, depth], rackFrameColor, rackData, rackFrameMaterial);
                if (level < type.levels) addBox(
                    group,
                    [length, 0.035, depth],
                    [length / 2, y + 0.03, depth / 2],
                    '#334155',
                    rackData,
                    {
                        castShadow: false,
                        roughness: 0.38,
                        metalness: 0.62,
                        clearcoat: 0.35,
                        clearcoatRoughness: 0.22
                    }
                );
            }
            const stocks = inventoryByRack.get(rack.code) || [];
            const depthCount = Math.max(1, Math.round(Number(type.depthCount) || 1));
            const slotDepth = depth / depthCount;
            const boxWidth = Math.max(0.08, bayWidth * 0.92);
            const boxHeight = Math.max(0.08, levelHeight * 0.82);
            const boxDepth = Math.max(0.08, slotDepth * 0.9);
            const slots = [];
            for (let bay = 1; bay <= rack.bayCount; bay += 1) {
                for (let level = 1; level <= type.levels; level += 1) {
                    for (let depthIndex = 1; depthIndex <= depthCount; depthIndex += 1) {
                        const key = slotKey(rack.code, bay, level, depthIndex);
                        const stock = inventoryBySlot.get(key);
                        const location = locationBySlot.get(key);
                        const item = stock ? itemByCode.get(stock.itemCode) : null;
                        const occupied = Boolean(stock && Number(stock.quantity) > 0);
                        slots.push({
                            kind: 'slot',
                            locationCode: location?.locationCode || `${rack.code}-B${String(bay).padStart(2, '0')}-L${String(level).padStart(2, '0')}-D${String(depthIndex).padStart(2, '0')}`,
                            rack,
                            type,
                            zone: zoneByCode.get(rack.zoneCode),
                            bay,
                            level,
                            depth: depthIndex,
                            location,
                            stock,
                            item,
                            occupied,
                            group,
                            boxSize: [boxWidth, boxHeight, boxDepth],
                            position: [
                                (bay - 0.5) * bayWidth,
                                (level - 1) * levelHeight + boxHeight / 2 + 0.06,
                                (depthIndex - 0.5) * slotDepth
                            ]
                        });
                    }
                }
            }
            const createSlotInstances = (slotList, empty) => {
                if (!slotList.length) return;
                const material = getMaterial('#ffffff', empty
                    ? {
                        transparent: true,
                        opacity: 0.5,
                        depthWrite: false,
                        roughness: 0.18,
                        metalness: 0.14,
                        clearcoat: 0.9,
                        clearcoatRoughness: 0.08
                    }
                    : {
                        transparent: false,
                        opacity: 1,
                        roughness: 0.12,
                        metalness: 0.16,
                        clearcoat: 1,
                        clearcoatRoughness: 0.04
                    });
                const mesh = new THREE.InstancedMesh(getChamferedBoxGeometry(boxWidth, boxHeight, boxDepth), material, slotList.length);
                const matrix = new THREE.Matrix4();
                slotList.forEach((slot, index) => {
                    matrix.makeTranslation(slot.position[0], slot.position[1], slot.position[2]);
                    mesh.setMatrixAt(index, matrix);
                    mesh.setColorAt(index, new THREE.Color(slotColorPalette[getSlotVisualKey(slot, 'utilization')]));
                });
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
                mesh.castShadow = !empty;
                mesh.receiveShadow = true;
                mesh.userData = { kind: 'slotInstances', slots: slotList };
                group.add(mesh);
                clickTargets.push(mesh);
                slotMeshEntries.push({ mesh, slots: slotList });
            };
            createSlotInstances(slots.filter((slot) => !slot.occupied), true);
            createSlotInstances(slots.filter((slot) => slot.occupied), false);
            const pick = addBox(group, [length, height, depth], [length / 2, height / 2, depth / 2], '#ffffff', rackData, { transparent: true, opacity: 0.001, castShadow: false });
            pick.material.depthWrite = false;
            clickTargets.push(pick);
            const label = createLabelSprite(THREE, rack.code);
            label.position.set(length / 2, height + 0.65, depth / 2);
            label.userData = rackData;
            rackData.label = label;
            clickTargets.push(label);
            labelTargets.push(label);
            const labelLayer = new THREE.Group();
            labelLayer.renderOrder = 1000;
            labelLayer.add(label);
            group.add(labelLayer);
            const outlineSize = [length + 0.18, height + 0.18, depth + 0.18];
            const outlinePosition = [length / 2, height / 2, depth / 2];
            const rackHoverOutline = createRackOutline(outlineSize, outlinePosition, rackHoverMaterial);
            const rackSelectedOutline = createRackOutline(outlineSize, outlinePosition, rackSelectedMaterial);
            rackData.outlines = { hover: rackHoverOutline, selected: rackSelectedOutline };
            group.add(rackHoverOutline, rackSelectedOutline);
            const startX = mm(rack.startX);
            const startZ = mm(rack.startY);
            if (rack.direction === 'vertical') {
                group.position.set(startX + depth, 0, startZ);
                group.rotation.y = -Math.PI / 2;
            } else group.position.set(startX, 0, startZ);
            scene.add(group);
            rackEntries.push({
                rack, type, group, stocks, slots,
                searchText: `${rack.code} ${rack.zoneCode} ${zoneByCode.get(rack.zoneCode)?.name || ''} ${stocks.map((stock) => `${stock.itemCode} ${itemByCode.get(stock.itemCode)?.name || ''}`).join(' ')}`.toLowerCase()
            });
        });

        data.zones.forEach((zone) => {
            const option = document.createElement('option');
            option.value = zone.code;
            option.textContent = `${zone.code} · ${zone.name}`;
            shell.zoneFilter.appendChild(option);
        });

        let yaw = Math.PI / 4;
        let pitch = Math.PI / 6;
        let distance = Math.max(floorWidth, floorDepth) * 1.08;
        const target = new THREE.Vector3(floorWidth / 2, 2.5, floorDepth / 2);
        let animationFrame = 0;
        let destroyed = false;
        const activeWorldUiTransitions = new Set();
        const easeOutCubic = (progress) => 1 - ((1 - progress) ** 3);
        const updateWorldUiTransitions = (timestamp) => {
            activeWorldUiTransitions.forEach((transition) => {
                const progress = Math.min(1, Math.max(0, (timestamp - transition.startedAt) / transition.duration));
                const keep = transition.update(easeOutCubic(progress));
                if (progress >= 1 || keep === false) {
                    activeWorldUiTransitions.delete(transition);
                    transition.complete?.();
                }
            });
        };

        const updateCamera = () => {
            const horizontal = distance * Math.cos(pitch);
            camera.position.set(target.x + horizontal * Math.sin(yaw), target.y + distance * Math.sin(pitch), target.z + horizontal * Math.cos(yaw));
            camera.lookAt(target);
        };
        const render = (timestamp) => {
            animationFrame = 0;
            updateWorldUiTransitions(timestamp || performance.now());
            if (!destroyed && renderer.domElement.isConnected) renderer.render(scene, camera);
            if (activeWorldUiTransitions.size) requestRender();
        };
        const requestRender = () => {
            if (!animationFrame && !destroyed) animationFrame = requestAnimationFrame(render);
        };
        const startWorldUiTransition = (duration, update, complete) => {
            activeWorldUiTransitions.add({
                startedAt: performance.now(),
                duration,
                update,
                complete
            });
            requestRender();
        };
        const fadeWorldObject = (object, visible, { duration = 140, reset = false } = {}) => {
            const material = object?.userData?.material || object?.material;
            if (!material) return;
            const targetOpacity = visible ? (object.userData.maxOpacity ?? 1) : 0;
            if (visible) object.visible = true;
            if (!visible && !object.visible) return;
            const token = {};
            object.userData.worldTransitionToken = token;
            const startOpacity = reset ? 0 : material.opacity;
            if (reset) material.opacity = 0;
            if (Math.abs(startOpacity - targetOpacity) < 0.001 && !reset) {
                material.opacity = targetOpacity;
                if (!visible) object.visible = false;
                return;
            }
            startWorldUiTransition(duration, (progress) => {
                if (object.userData.worldTransitionToken !== token) return false;
                material.opacity = startOpacity + (targetOpacity - startOpacity) * progress;
                return true;
            }, () => {
                if (object.userData.worldTransitionToken === token && !visible) object.visible = false;
            });
        };

        const applyGridVisibility = (isVisible) => {
            grid.visible = Boolean(isVisible);
            shell.gridToggle.setAttribute('aria-pressed', String(grid.visible));
            shell.gridToggle.setAttribute('aria-label', grid.visible ? 'Grid 숨기기' : 'Grid 표시');
            requestRender();
        };
        const moveSlotOverlay = (overlay, slot) => {
            if (!slot) return;
            if (overlay.parent !== slot.group) { overlay.parent?.remove(overlay); slot.group.add(overlay); }
            overlay.position.set(slot.position[0], slot.position[1], slot.position[2]);
        };
        const updateSlotOutline = (outline, slot) => {
            if (!slot) { fadeWorldObject(outline, false); return; }
            const [width, height, depth] = slot.boxSize;
            const edgeGeometry = getSlotOutlineGeometry(width + 0.045, height + 0.045, depth + 0.045);
            if (outline.userData.edgeGeometry !== edgeGeometry) {
                outline.clear();
                const positions = edgeGeometry.getAttribute('position');
                const up = new THREE.Vector3(0, 1, 0);
                for (let index = 0; index < positions.count; index += 2) {
                    const start = new THREE.Vector3().fromBufferAttribute(positions, index);
                    const end = new THREE.Vector3().fromBufferAttribute(positions, index + 1);
                    const direction = end.clone().sub(start);
                    const length = direction.length();
                    if (!(length > 0)) continue;
                    const segment = new THREE.Mesh(getOutlineTubeGeometry(length, outline.userData.radius), outline.userData.material);
                    segment.position.copy(start).add(end).multiplyScalar(0.5);
                    segment.quaternion.setFromUnitVectors(up, direction.normalize());
                    segment.renderOrder = 10;
                    outline.add(segment);
                }
                outline.userData.edgeGeometry = edgeGeometry;
            }
            moveSlotOverlay(outline, slot);
            const slotChanged = outline.userData.slot !== slot;
            outline.userData.slot = slot;
            fadeWorldObject(outline, true, { reset: slotChanged });
        };
        const getSlotSummary = (slot) => {
            const capacity = Number(slot.stock?.capacity || slot.location?.capacity || 0);
            const quantity = Number(slot.stock?.quantity || 0);
            return { itemName: slot.item?.name || '빈 로케이션', quantity, capacity, rate: capacity > 0 ? Math.round((quantity / capacity) * 100) : null };
        };
        const updateHoverLabel = (slot) => {
            if (!slot) { fadeWorldObject(hoverLabel, false, { duration: 120 }); return; }
            const summary = getSlotSummary(slot);
            if (hoverLabelLayer.parent !== slot.group) { hoverLabelLayer.parent?.remove(hoverLabelLayer); slot.group.add(hoverLabelLayer); }
            hoverContext.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);
            hoverContext.fillStyle = 'rgba(7, 17, 31, 0.9)';
            hoverContext.fillRect(0, 0, hoverCanvas.width, hoverCanvas.height);
            hoverContext.strokeStyle = 'rgba(255, 255, 255, 0.68)';
            hoverContext.lineWidth = 6;
            hoverContext.strokeRect(3, 3, hoverCanvas.width - 6, hoverCanvas.height - 6);
            hoverContext.fillStyle = '#ffffff';
            hoverContext.font = '700 56px sans-serif';
            hoverContext.fillText(summary.itemName, 40, 78);
            hoverContext.fillStyle = '#dbeafe';
            hoverContext.font = '600 46px sans-serif';
            hoverContext.fillText(`수량 ${summary.quantity} / ${summary.capacity || '미설정'}  ·  적재율 ${summary.rate === null ? '용량 미설정' : `${summary.rate}%`}`, 40, 176);
            hoverTexture.needsUpdate = true;
            hoverLabel.position.set(slot.position[0], slot.position[1] + slot.boxSize[1] / 2 + 0.5, slot.position[2]);
            const slotChanged = hoverLabel.userData.slot !== slot;
            hoverLabel.userData.slot = slot;
            const startScale = slotChanged ? 0.94 : 1;
            hoverLabel.scale.set(hoverLabelBaseScale[0] * startScale, hoverLabelBaseScale[1] * startScale, 1);
            fadeWorldObject(hoverLabel, true, { duration: 160, reset: slotChanged });
            if (slotChanged) {
                const token = {};
                hoverLabel.userData.scaleTransitionToken = token;
                startWorldUiTransition(160, (progress) => {
                    if (hoverLabel.userData.scaleTransitionToken !== token) return false;
                    const scale = startScale + (1 - startScale) * progress;
                    hoverLabel.scale.set(hoverLabelBaseScale[0] * scale, hoverLabelBaseScale[1] * scale, 1);
                    return true;
                });
            }
        };
        let hoveredSlot = null;
        const setHoveredSlot = (slot) => {
            if (hoveredSlot === slot) return;
            hoveredSlot = slot || null;
            updateSlotOutline(hoverOutline, hoveredSlot);
            updateHoverLabel(hoveredSlot);
            requestRender();
        };
        const setSelectedSlot = (slot) => {
            updateSlotOutline(selectedOutline, slot || null);
            requestRender();
        };
        let hoveredRack = null;
        let selectedRack = null;
        const setRackLabelState = (rackData, state) => {
            const update = rackData?.label?.setInteractionState?.(state);
            if (update) startWorldUiTransition(160, (progress) => { update(progress); return true; });
        };
        const setHoveredRack = (rackData) => {
            if (hoveredRack === rackData) return;
            if (hoveredRack?.outlines?.hover) {
                const previousOutline = hoveredRack.outlines.hover;
                if (rackData) { previousOutline.visible = false; previousOutline.userData.material.opacity = 0; }
                else fadeWorldObject(previousOutline, false);
            }
            if (hoveredRack && hoveredRack !== selectedRack) setRackLabelState(hoveredRack, 'normal');
            hoveredRack = rackData || null;
            if (hoveredRack?.outlines?.hover) fadeWorldObject(hoveredRack.outlines.hover, true, { reset: true });
            if (hoveredRack && hoveredRack !== selectedRack) setRackLabelState(hoveredRack, 'hover');
            requestRender();
        };
        const setSelectedRack = (rackData) => {
            const previousSelectedRack = selectedRack;
            if (previousSelectedRack?.outlines?.selected) {
                const previousOutline = previousSelectedRack.outlines.selected;
                if (rackData) { previousOutline.visible = false; previousOutline.userData.material.opacity = 0; }
                else fadeWorldObject(previousOutline, false, { duration: 180 });
            }
            if (previousSelectedRack) setRackLabelState(previousSelectedRack, previousSelectedRack === hoveredRack ? 'hover' : 'normal');
            selectedRack = rackData || null;
            if (selectedRack?.outlines?.selected) fadeWorldObject(selectedRack.outlines.selected, true, { duration: 180, reset: true });
            if (selectedRack) setRackLabelState(selectedRack, 'selected');
            requestRender();
        };
        const showDefaultInspector = () => { shell.inspector.innerHTML = '<h5>선택 정보</h5><p>랙이나 적재 상자를 선택하면 상세 정보가 표시됩니다.</p>'; };
        const cameraViewPresets = {
            quarter: { yaw: Math.PI / 4, pitch: Math.PI / 6, distanceScale: 1.08, targetY: 2.5 },
            top: { yaw: 0, pitch: Math.PI / 2 - 0.01, distanceScale: 1.82, targetY: 0 },
            front: { yaw: 0, pitch: 0.08, distanceScale: 1.08, targetY: 2.5 },
            side: { yaw: Math.PI / 2, pitch: 0.08, distanceScale: 1.08, targetY: 2.5 }
        };
        const setActiveCameraView = (viewName = '') => {
            shell.cameraViewButtons.forEach((button) => {
                button.setAttribute('aria-pressed', String(button.dataset.warehouseCameraView === viewName));
            });
        };
        const applyCameraView = (viewName) => {
            const preset = cameraViewPresets[viewName] || cameraViewPresets.quarter;
            yaw = preset.yaw;
            pitch = preset.pitch;
            distance = Math.max(floorWidth, floorDepth) * preset.distanceScale;
            target.set(floorWidth / 2, preset.targetY, floorDepth / 2);
            updateCamera();
            setActiveCameraView(viewName);
            requestRender();
            renderer.domElement.focus();
        };
        shell.cameraViewButtons.forEach((button) => {
            button.addEventListener('click', () => applyCameraView(button.dataset.warehouseCameraView), { signal });
        });
        shell.gridToggle.addEventListener('click', () => applyGridVisibility(!grid.visible), { signal });
        const legendsByMode = {
            utilization: [
                ['empty', '비어 있음'],
                ['low', '1~49%'],
                ['medium', '50~79%'],
                ['high', '80~100%'],
                ['unknown', '용량 미설정']
            ],
            status: [
                ['empty', '비어 있음'],
                ['normal', '정상'],
                ['warning', '주의'],
                ['hold', '보류'],
                ['defect', '불량'],
                ['unknown', '상태 미설정']
            ]
        };
        let viewMode = 'utilization';
        const applyViewMode = (nextMode) => {
            viewMode = nextMode === 'status' ? 'status' : 'utilization';
            slotMeshEntries.forEach(({ mesh, slots }) => {
                slots.forEach((slot, index) => {
                    const visualKey = getSlotVisualKey(slot, viewMode);
                    mesh.setColorAt(index, new THREE.Color(slotColorPalette[visualKey]));
                });
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            });
            shell.viewButtons.forEach((button) => {
                button.setAttribute('aria-pressed', String(button.dataset.warehouseView === viewMode));
            });
            shell.legendItems.innerHTML = legendsByMode[viewMode]
                .map(([key, label]) => `<span><i class="is-${key}"></i>${label}</span>`)
                .join('');
            requestRender();
        };
        shell.viewButtons.forEach((button) => {
            button.addEventListener('click', () => applyViewMode(button.dataset.warehouseView), { signal });
        });
        applyViewMode('utilization');
        const resize = () => {
            const viewportWidth = shell.viewport.clientWidth;
            const viewportHeight = shell.viewport.clientHeight;
            // A hidden menu panel reports a zero-sized viewport. Keeping the
            // last canvas size avoids changing the card height while hidden.
            if (!viewportWidth || !viewportHeight) return;
            const width = Math.max(320, viewportWidth);
            const height = Math.max(360, viewportHeight);
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            requestRender();
        };
        updateCamera();
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(shell.viewport);
        resize();

        let pointerStart;
        renderer.domElement.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 && event.button !== 2) return;
            event.preventDefault();
            setHoveredSlot(null);
            setHoveredRack(null);
            const viewDirection = new THREE.Vector3();
            camera.getWorldDirection(viewDirection);
            viewDirection.y = 0;
            viewDirection.normalize();
            const viewRight = new THREE.Vector3().crossVectors(viewDirection, camera.up).normalize();
            pointerStart = {
                x: event.clientX,
                y: event.clientY,
                yaw,
                pitch,
                distance,
                target: target.clone(),
                viewDirection,
                viewRight,
                mode: event.button === 2 ? 'rotate' : 'pan',
                button: event.button,
                pointerId: event.pointerId
            };
            renderer.domElement.setPointerCapture(event.pointerId);
        }, { signal });
        renderer.domElement.addEventListener('pointermove', (event) => {
            if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
            const deltaX = event.clientX - pointerStart.x;
            const deltaY = event.clientY - pointerStart.y;
            if (Math.hypot(deltaX, deltaY) > 2) setActiveCameraView('');
            if (pointerStart.mode === 'rotate') {
                yaw = pointerStart.yaw - deltaX * 0.008;
                pitch = Math.max(0.02, Math.min(Math.PI / 2 - 0.02, pointerStart.pitch + deltaY * 0.006));
            } else {
                const panScale = Math.max(0.004, pointerStart.distance * 0.0015);
                target.copy(pointerStart.target);
                target.addScaledVector(pointerStart.viewRight, -deltaX * panScale);
                target.addScaledVector(pointerStart.viewDirection, deltaY * panScale);
                target.x = Math.max(0, Math.min(floorWidth, target.x));
                target.z = Math.max(0, Math.min(floorDepth, target.z));
            }
            updateCamera();
            requestRender();
        }, { signal });
        renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
        renderer.domElement.addEventListener('pointercancel', () => { pointerStart = null; }, { signal });
        renderer.domElement.addEventListener('wheel', (event) => {
            event.preventDefault();
            setActiveCameraView('');
            distance = Math.max(8, Math.min(140, distance * Math.exp(event.deltaY * 0.0012)));
            updateCamera();
            requestRender();
        }, { signal, passive: false });

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const isRaycastTargetVisible = (object) => {
            for (let node = object; node; node = node.parent) {
                if (!node.visible) return false;
            }
            return true;
        };
        const getSlotAtPointer = (event) => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(clickTargets, false).filter((hit) => isRaycastTargetVisible(hit.object));
            const hit = hits.find((candidate) => candidate.object.userData.kind === 'slotInstances');
            return hit && Number.isInteger(hit.instanceId) ? hit.object.userData.slots[hit.instanceId] || null : null;
        };
        const getLabelRackAtPointer = (event) => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hit = raycaster.intersectObjects(labelTargets, false).find((candidate) => isRaycastTargetVisible(candidate.object));
            return hit?.object.userData?.kind === 'rack' ? hit.object.userData : null;
        };
        const getRackAtPointer = (event) => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(clickTargets, false).filter((hit) => isRaycastTargetVisible(hit.object));
            return hits.find((candidate) => candidate.object.userData.kind === 'rack')?.object.userData || null;
        };
        const showSelection = (selection) => {
            if (selection.kind === 'slot') {
                const statusLabels = { normal: '정상', warning: '주의', hold: '보류', defect: '불량' };
                const capacity = Number(selection.stock?.capacity || selection.location?.capacity || 0);
                const quantity = Number(selection.stock?.quantity || 0);
                const rate = capacity > 0 ? Math.round((quantity / capacity) * 100) : null;
                const itemText = selection.item
                    ? `${escapeHtml(selection.item.code)} · ${escapeHtml(selection.item.name)}`
                    : '빈 슬롯';
                const statusText = selection.occupied
                    ? (statusLabels[String(selection.stock?.status || '').toLowerCase()] || '상태 미설정')
                    : '비어 있음';
                shell.inspector.innerHTML = `<h5>${escapeHtml(selection.locationCode)}</h5><dl><dt>품목</dt><dd>${itemText}</dd><dt>랙</dt><dd>${escapeHtml(selection.rack.code)} / ${escapeHtml(selection.zone?.name || selection.rack.zoneCode)}</dd><dt>셀 위치</dt><dd>${selection.bay}베이 · ${selection.level}단 · 깊이 ${selection.depth}</dd><dt>수량</dt><dd>${quantity} / ${capacity || '미설정'}</dd><dt>적재율</dt><dd>${rate === null ? '용량 미설정' : `${rate}%`}</dd><dt>재고 상태</dt><dd>${escapeHtml(statusText)}</dd></dl>`;
            } else {
                shell.inspector.innerHTML = `<h5>${escapeHtml(selection.rack.code)}</h5><dl><dt>구역</dt><dd>${escapeHtml(selection.rack.zoneCode)} · ${escapeHtml(selection.zone?.name || '')}</dd><dt>랙타입</dt><dd>${escapeHtml(selection.type.name)}</dd><dt>배치 기준</dt><dd>${selection.rack.layoutSource === 'floorPlan' ? '평면도' : '랙배치'}</dd><dt>베이</dt><dd>${selection.rack.bayCount}개</dd><dt>단수·깊이</dt><dd>${selection.type.levels}단 · 깊이 ${Math.max(1, Number(selection.type.depthCount) || 1)}</dd><dt>규격</dt><dd>${(selection.type.bayWidth * selection.rack.bayCount / 1000).toFixed(1)}m × ${(selection.type.depth / 1000).toFixed(1)}m × ${(selection.type.height / 1000).toFixed(1)}m</dd><dt>등록 재고</dt><dd>${(inventoryByRack.get(selection.rack.code) || []).length}개 로케이션</dd></dl>`;
            }
        };
        renderer.domElement.addEventListener('pointermove', (event) => {
            if (pointerStart) return;
            const labelRack = getLabelRackAtPointer(event);
            if (labelRack) {
                setHoveredSlot(null);
                setHoveredRack(labelRack);
                return;
            }
            const slot = getSlotAtPointer(event);
            setHoveredSlot(slot);
            setHoveredRack(slot ? null : getRackAtPointer(event));
        }, { signal });
        renderer.domElement.addEventListener('pointerleave', () => { setHoveredSlot(null); setHoveredRack(null); }, { signal });
        renderer.domElement.addEventListener('pointerup', (event) => {
            if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
            const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
            const button = pointerStart.button;
            pointerStart = null;
            if (button !== 0 || moved > 5) return;
            const labelRack = getLabelRackAtPointer(event);
            if (labelRack) {
                setSelectedSlot(null);
                setSelectedRack(labelRack);
                showSelection(labelRack);
                return;
            }
            const slot = getSlotAtPointer(event);
            if (slot) { setSelectedSlot(slot); setSelectedRack(null); showSelection(slot); return; }
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(clickTargets, false).filter((hit) => isRaycastTargetVisible(hit.object));
            const hit = hits[0];
            if (hit?.object.userData?.kind) { setSelectedSlot(null); setSelectedRack(hit.object.userData); showSelection(hit.object.userData); }
            else { setSelectedSlot(null); setSelectedRack(null); showDefaultInspector(); }
        }, { signal });

        const applyFilters = () => {
            const zone = shell.zoneFilter.value;
            const query = shell.search.value.trim().toLowerCase();
            let visibleCount = 0;
            let visibleSlots = 0;
            let visibleOccupiedSlots = 0;
            rackEntries.forEach((entry) => {
                const visible = (!zone || entry.rack.zoneCode === zone) && (!query || entry.searchText.includes(query));
                entry.group.visible = visible;
                if (visible) {
                    visibleCount += 1;
                    visibleSlots += entry.slots.length;
                    visibleOccupiedSlots += entry.slots.filter((slot) => slot.occupied).length;
                }
            });
            shell.count.textContent = `랙 ${visibleCount} / ${rackEntries.length} · 적재 셀 ${visibleOccupiedSlots} / ${visibleSlots}`;
            requestRender();
        };
        shell.zoneFilter.addEventListener('change', applyFilters, { signal });
        shell.search.addEventListener('input', applyFilters, { signal });
        applyFilters();
        requestRender();

        return () => {
            destroyed = true;
            if (animationFrame) cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
            geometryCache.forEach((geometry) => geometry.dispose());
            outlineGeometryCache.forEach((geometry) => geometry.dispose());
            outlineTubeGeometryCache.forEach((geometry) => geometry.dispose());
            materialCache.forEach((material) => material.dispose());
            rackHoverMaterial.dispose();
            rackSelectedMaterial.dispose();
            hoverOutline.userData.material.dispose();
            selectedOutline.userData.material.dispose();
            hoverTexture.dispose();
            hoverLabel.material.dispose();
            scene.traverse((object) => {
                if (object.material?.map) object.material.map.dispose();
                if (object.type === 'Sprite' && object.material) object.material.dispose();
            });
            renderer.dispose();
            floorReflectionEnvironment.dispose();
        };
    }

    async function mount(container, options = {}) {
        mountedControllers.get(container)?.dispose();
        const abortController = new AbortController();
        const shell = createShell(container);
        let disposeScene = () => {};
        const controller = {
            dispose() {
                abortController.abort();
                disposeScene();
                mountedControllers.delete(container);
            }
        };
        mountedControllers.set(container, controller);
        const syncFullscreenButton = () => {
            const active = document.fullscreenElement === container;
            shell.fullscreen.textContent = active ? '전체화면 종료' : '전체화면';
            shell.fullscreen.setAttribute('aria-pressed', String(active));
        };
        shell.fullscreen.disabled = !document.fullscreenEnabled || typeof container.requestFullscreen !== 'function';
        if (shell.fullscreen.disabled) shell.fullscreen.title = '이 브라우저에서는 전체화면을 사용할 수 없습니다.';
        shell.fullscreen.addEventListener('click', async () => {
            try {
                if (document.fullscreenElement === container) await document.exitFullscreen();
                else await container.requestFullscreen({ navigationUI: 'hide' });
            } catch (error) {
                shell.sourceStatus.classList.add('is-warning');
                shell.sourceStatus.textContent = `전체화면을 열지 못했습니다. — ${error?.message || '브라우저 권한을 확인해 주세요.'}`;
            }
        }, { signal: abortController.signal });
        document.addEventListener('fullscreenchange', syncFullscreenButton, { signal: abortController.signal });
        syncFullscreenButton();
        if (options.googleSheet?.documentId) {
            shell.reload.hidden = false;
            shell.reload.addEventListener('click', () => mount(container, options), { signal: abortController.signal });
            shell.sourceStatus.textContent = 'Google Sheets 기준정보를 불러오는 중입니다.';
        }
        try {
            const source = options.dataSource || 'data/warehouse-demo.json';
            const THREE = await loadThree();
            let data;
            let sheetError;
            if (options.googleSheet?.documentId) {
                try {
                    data = await loadGoogleSheetData(options.googleSheet, abortController.signal);
                } catch (error) {
                    if (error?.name === 'AbortError') throw error;
                    sheetError = error;
                }
            }
            if (!data) {
                const response = await fetch(source, { cache: 'no-store', signal: abortController.signal });
                if (!response.ok) throw new Error(`기준정보 파일을 불러오지 못했습니다. (${response.status})`);
                data = await response.json();
            }
            const errors = validateWarehouseData(data);
            if (errors.length) {
                showError(shell, errors.slice(0, 8));
                return controller;
            }
            if (abortController.signal.aborted || !container.isConnected) return controller;
            if (sheetError) {
                shell.sourceStatus.classList.add('is-warning');
                shell.sourceStatus.textContent = `Google Sheets 연결 실패 · 임시 데이터 표시 중 — ${sheetError.message}`;
            } else if (options.googleSheet?.documentId) {
                const loadedAt = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                shell.sourceStatus.classList.add('is-connected');
                const unmappedCount = data.meta?.unmappedFloorRackCodes?.length || 0;
                const unplacedCount = data.meta?.unplacedRackCodes?.length || 0;
                if (unmappedCount) shell.sourceStatus.classList.add('is-warning');
                shell.sourceStatus.textContent = `Google Sheets 연결됨 · ${loadedAt} · 평면도 배치 ${data.meta?.floorPlanAppliedCount || 0}개 · 재고 ${data.inventory.length}건${unplacedCount ? ` · 미배치 ${unplacedCount}개` : ''}${unmappedCount ? ` · 미등록 랙코드 ${unmappedCount}개` : ''}`;
            } else shell.sourceStatus.textContent = '내장 임시 기준정보를 표시하고 있습니다.';
            disposeScene = startWarehouseScene(THREE, shell, data, abortController.signal);
        } catch (error) {
            if (error?.name !== 'AbortError') showError(shell, [error?.message || '알 수 없는 오류가 발생했습니다.', '네트워크 연결과 Three.js 모듈 주소를 확인해 주세요.']);
        }
        return controller;
    }

    function disposeWithin(root) {
        root?.querySelectorAll?.('.warehouse-3d-shell').forEach((container) => mountedControllers.get(container)?.dispose());
    }

    window.wmsWarehouse3D = Object.freeze({
        mount,
        disposeWithin,
        validateWarehouseData,
        parseCsv,
        convertGoogleSheetCsv,
        getSlotVisualKey,
        getGoogleSheetQueryUrl,
        googleTableToCsv
    });
    window.dispatchEvent(new Event('wms-warehouse-3d-ready'));
}());
