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
        // 3행의 연속된 X 좌표와 A열의 연속된 Y 좌표를 먼저 읽고 실제 평면도 범위를 계산한다.
        floorPlan: { sheetName: '평면도', xAxisRange: 'A3:3', yAxisRange: 'A3:A', headers: ['Y\\X'] },
        rackTypes: { sheetName: '랙타입 마스터', range: 'A4:H', headers: ['랙타입코드', '랙타입명', '베이폭(m)', '깊이(m)', '전체높이(m)', '단수', '단당높이(m)'] },
        zones: { sheetName: '구역설정', range: 'A4:D', headers: ['구역코드', '구역명', '용도', '기본랙타입코드'] },
        racks: { sheetName: '랙배치', range: 'A4:I', headers: ['랙코드', '구역코드', '랙타입코드', '방향', '베이 수(가로 칸 수)', '평면도 랙 전체 길이(m)', '평면도 랙 깊이(m)'] },
        locations: { sheetName: '로케이션 마스터', range: 'A4:F', headers: ['로케이션코드', '랙코드', '베이번호', '단번호', '깊이번호', '최대수량'] },
        items: { sheetName: '품목 마스터', range: 'A4:C', headers: ['품목코드', '품목명', '표시색상'] },
        inventory: { sheetName: '재고 현황', range: 'A4:D', headers: ['로케이션코드', '품목코드', '재고수량', '재고상태'] }
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

    function columnNumberToName(columnNumber) {
        let remaining = Math.floor(Number(columnNumber));
        if (!(remaining > 0)) throw new Error('평면도 열 번호가 올바르지 않습니다.');
        let name = '';
        while (remaining > 0) {
            remaining -= 1;
            name = String.fromCharCode(65 + (remaining % 26)) + name;
            remaining = Math.floor(remaining / 26);
        }
        return name;
    }

    function getSequentialAxisLength(values, axisName) {
        let length = 0;
        let reachedBlank = false;
        values.forEach((value) => {
            const text = String(value ?? '').trim();
            if (!text) {
                reachedBlank = true;
                return;
            }
            const number = Number(text);
            const expected = length + 1;
            if (reachedBlank || !Number.isInteger(number) || number !== expected) {
                throw new Error(`평면도 ${axisName}축은 1부터 빈칸 없이 연속된 숫자여야 합니다. (${expected} 확인)`);
            }
            length = expected;
        });
        return length;
    }

    function getFloorPlanAxisRange(xAxisCsv, yAxisCsv) {
        const xRows = parseCsv(xAxisCsv);
        const yRows = parseCsv(yAxisCsv);
        const xCount = getSequentialAxisLength((xRows[0] || []).slice(1), 'X');
        const yCount = getSequentialAxisLength(yRows.slice(1).map((row) => row[0]), 'Y');
        if (!xCount || !yCount) throw new Error('평면도 X·Y 좌표축을 확인해 주세요.');
        const lastColumn = columnNumberToName(xCount + 1);
        const lastRow = yCount + 3;
        return {
            range: `A3:${lastColumn}${lastRow}`,
            dataRange: `B4:${lastColumn}${lastRow}`,
            xCount,
            yCount
        };
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

        const floorPlanCellSize = Math.max(1, toNumber(options.floorPlanCellSizeMeters, 0.5) * 1000);
        const rackCodesFromMaster = new Set(records.racks.map((row) => String(row['랙코드'] || '').trim()).filter(Boolean));
        const floorPlanByRack = new Map();
        const floorPlanCells = [];
        const passageCells = [];
        const unmappedFloorRackCodes = new Set();
        records.floorPlan.forEach((row) => {
            const y = Number(row['Y\\X']);
            if (!Number.isFinite(y)) return;
            Object.entries(row).forEach(([header, value]) => {
                if (header === 'Y\\X') return;
                const x = Number(header);
                const cellValue = String(value || '').trim();
                if (!Number.isFinite(x) || !cellValue) return;
                floorPlanCells.push({ x, y, value: cellValue });
                const normalizedValue = cellValue.toUpperCase();
                if (normalizedValue === 'T') passageCells.push({ x, y });
                if (normalizedValue === 'F' || normalizedValue === 'T') return;
                const rackCode = rackCodesFromMaster.has(cellValue) ? cellValue : '';
                if (!rackCode) {
                    unmappedFloorRackCodes.add(cellValue);
                    return;
                }
                const placement = floorPlanByRack.get(rackCode) || { minX: x, maxX: x, minY: y, maxY: y, cellCount: 0 };
                placement.minX = Math.min(placement.minX, x);
                placement.maxX = Math.max(placement.maxX, x);
                placement.minY = Math.min(placement.minY, y);
                placement.maxY = Math.max(placement.maxY, y);
                placement.cellCount += 1;
                floorPlanByRack.set(rackCode, placement);
            });
        });

        const metersToMillimeters = (value, fallback = 0) => toNumber(value, fallback) * 1000;
        const zones = records.zones
            .filter((row) => row['구역코드'])
            .map((row) => ({
                code: row['구역코드'],
                name: row['구역명'],
                purpose: row['용도'],
                defaultRackTypeCode: row['기본랙타입코드']
            }));
        const rackTypes = records.rackTypes
            .filter((row) => row['랙타입코드'])
            .map((row) => ({
                code: row['랙타입코드'],
                name: row['랙타입명'],
                bayWidth: metersToMillimeters(row['베이폭(m)']),
                depth: metersToMillimeters(row['깊이(m)']),
                height: metersToMillimeters(row['전체높이(m)']),
                levels: toNumber(row['단수']),
                levelHeight: metersToMillimeters(row['단당높이(m)']),
                depthCount: toNumber(row['깊이수'], 1)
            }));
        const rackTypeByCode = new Map(rackTypes.map((type) => [type.code, type]));
        const layoutErrors = [];
        let floorPlanAppliedCount = 0;
        const enabledRackRows = records.racks.filter((row) => row['랙코드']);
        const usesFloorPlan = floorPlanByRack.size > 0;
        const unplacedRackCodes = usesFloorPlan
            ? enabledRackRows.map((row) => String(row['랙코드']).trim()).filter((code) => !floorPlanByRack.has(code))
            : [];
        const racks = enabledRackRows
            .filter((row) => !usesFloorPlan || floorPlanByRack.has(String(row['랙코드']).trim()))
            .map((row) => {
                const code = String(row['랙코드']).trim();
                const placement = floorPlanByRack.get(code);
                const type = rackTypeByCode.get(row['랙타입코드']);
                const storedDirection = ['세로', 'VERTICAL', 'V'].includes(String(row['방향'] || '').trim().toUpperCase()) ? 'vertical' : 'horizontal';
                const direction = storedDirection;
                const bayCount = toNumber(row['베이 수(가로 칸 수)']);
                let rackRowCount = 1;
                let floorPlan = null;
                if (placement) {
                    const columns = placement.maxX - placement.minX + 1;
                    const rows = placement.maxY - placement.minY + 1;
                    const planLength = (direction === 'vertical' ? rows : columns) * floorPlanCellSize;
                    const planWidth = (direction === 'vertical' ? columns : rows) * floorPlanCellSize;
                    if (!type) {
                        layoutErrors.push({ code, message: '랙타입을 찾을 수 없습니다.' });
                        return null;
                    }
                    const actualLength = type.bayWidth * bayCount;
                    const actualWidth = metersToMillimeters(row['랙깊이(m)'], type.depth / 1000);
                    const expectedPlanLength = metersToMillimeters(row['평면도 랙 전체 길이(m)']);
                    const expectedPlanWidth = metersToMillimeters(row['평면도 랙 깊이(m)']);
                    rackRowCount = Math.max(1, Math.round(actualWidth / type.depth));
                    floorPlan = {
                        columns,
                        rows,
                        cellCount: placement.cellCount,
                        planLength,
                        planWidth,
                        actualLength,
                        actualWidth,
                        remainingLength: planLength - actualLength,
                        remainingWidth: planWidth - actualWidth
                    };
                    if (placement.cellCount !== columns * rows) {
                        layoutErrors.push({ code, message: '평면도 마킹이 직사각형 범위가 아닙니다.' });
                        return null;
                    }
                    if (!(bayCount > 0) || actualLength > planLength + 0.001 || actualWidth > planWidth + 0.001) {
                        layoutErrors.push({ code, message: '평면도 범위보다 실제 랙 크기가 큽니다.' });
                        return null;
                    }
                    if ((expectedPlanLength > 0 && Math.abs(expectedPlanLength - planLength) > 0.001)
                        || (expectedPlanWidth > 0 && Math.abs(expectedPlanWidth - planWidth) > 0.001)) {
                        layoutErrors.push({ code, message: '랙배치의 평면도 크기와 실제 마킹 범위가 다릅니다.' });
                        return null;
                    }
                    floorPlanAppliedCount += 1;
                }
                const xPlanGap = floorPlan ? (direction === 'vertical' ? floorPlan.remainingWidth : floorPlan.remainingLength) : 0;
                const yPlanGap = floorPlan ? (direction === 'vertical' ? floorPlan.remainingLength : floorPlan.remainingWidth) : 0;
                return {
                    code,
                    zoneCode: row['구역코드'],
                    rackTypeCode: row['랙타입코드'],
                    startX: placement ? (placement.minX - 1) * floorPlanCellSize + Math.max(0, xPlanGap) / 2 : 0,
                    startY: placement ? (placement.minY - 1) * floorPlanCellSize + Math.max(0, yPlanGap) / 2 : 0,
                    direction,
                    bayCount,
                    rackRowCount,
                    layoutSource: placement ? 'floorPlan' : 'rackPlacement',
                    floorPlan
                };
            })
            .filter(Boolean);
        const items = records.items
            .filter((row) => row['품목코드'])
            .map((row) => ({
                code: row['품목코드'],
                name: row['품목명'],
                color: row['표시색상'] || '#ef4444'
            }));
        const locations = records.locations
            .filter((row) => row['로케이션코드'])
            .map((row) => ({
                locationCode: row['로케이션코드'],
                rackCode: row['랙코드'],
                rackRow: toNumber(row['랙열번호'], 1),
                bay: toNumber(row['베이번호']),
                level: toNumber(row['단번호']),
                depth: toNumber(row['깊이번호'], 1),
                capacity: toNumber(row['최대수량'])
            }));
        const locationsByCode = new Map(locations.map((location) => [location.locationCode, location]));
        const rackByCode = new Map(racks.map((rack) => [rack.code, rack]));
        const isLocationWithinRack = (location) => {
            const rack = rackByCode.get(location?.rackCode);
            const type = rack && rackTypeByCode.get(rack.rackTypeCode);
            return Boolean(rack && location.bay >= 1 && location.bay <= rack.bayCount
                && location.rackRow >= 1 && location.rackRow <= rack.rackRowCount
                && location.level >= 1 && location.level <= type?.levels
                && location.depth >= 1 && location.depth <= type?.depthCount);
        };
        const statusMap = { 정상: 'normal', 주의: 'warning', 보류: 'hold', 불량: 'defect' };
        const visibleRackCodes = new Set(racks.map((rack) => rack.code));
        const inventory = records.inventory
            .filter((row) => {
                const location = locationsByCode.get(row['로케이션코드']);
                return row['로케이션코드'] && row['품목코드'] && toNumber(row['재고수량']) > 0
                    && (!usesFloorPlan || (visibleRackCodes.has(location?.rackCode) && isLocationWithinRack(location)));
            })
            .map((row) => {
                const location = locationsByCode.get(row['로케이션코드']) || {};
                const rawStatus = String(row['재고상태'] || '').trim();
                return {
                    locationCode: row['로케이션코드'],
                    rackCode: location.rackCode || '',
                    rackRow: location.rackRow || 1,
                    bay: location.bay || 0,
                    level: location.level || 0,
                    depth: location.depth || 1,
                    itemCode: row['품목코드'],
                    quantity: toNumber(row['재고수량']),
                    capacity: location.capacity || 0,
                    status: statusMap[rawStatus] || rawStatus.toLowerCase() || 'normal'
                };
            });

        const outOfRangeLocationCodes = locations
            .filter((location) => rackByCode.has(location.rackCode) && !isLocationWithinRack(location))
            .map((location) => location.locationCode);
        const configuredFloorPlanX = toNumber(options.floorPlanAxis?.xCount);
        const configuredFloorPlanY = toNumber(options.floorPlanAxis?.yCount);
        const floorPlanMaxX = configuredFloorPlanX > 0 ? configuredFloorPlanX : Math.max(0, ...floorPlanCells.map((cell) => cell.x));
        const floorPlanMaxY = configuredFloorPlanY > 0 ? configuredFloorPlanY : Math.max(0, ...floorPlanCells.map((cell) => cell.y));
        const floorWidth = floorPlanMaxX * floorPlanCellSize;
        const floorDepth = floorPlanMaxY * floorPlanCellSize;
        const warehouseGapCount = Math.max(0, floorPlanMaxX * floorPlanMaxY - floorPlanCells.length);
        return {
            schemaVersion: 1,
            meta: {
                name: options.name || 'Google Sheets 기준정보 창고',
                unit: 'mm',
                floorWidth,
                floorDepth,
                floorPlanCellSize,
                warehouseCellCount: floorPlanCells.length,
                warehouseGapCount,
                passageCells: passageCells.map((cell) => ({
                    x: (cell.x - 1) * floorPlanCellSize,
                    y: (cell.y - 1) * floorPlanCellSize
                })),
                source: 'googleSheets',
                documentId: options.documentId || '',
                floorPlanRange: options.floorPlanAxis?.range || '',
                floorPlanAppliedCount,
                layoutErrors,
                outOfRangeLocationCodes,
                unplacedRackCodes,
                unmappedFloorRackCodes: [...unmappedFloorRackCodes]
            },
            zones, rackTypes, racks, locations, items, inventory
        };
    }

    function googleTableToCsv(table) {
        const escapeCell = (value) => {
            const text = String(value ?? '');
            return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        };
        const headers = (table?.cols || []).map((column) => escapeCell(column?.label ?? ''));
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
        const floorPlanDefinition = googleSheetDefinitions.floorPlan;
        const floorPlanSheetName = config?.sheets?.floorPlan || floorPlanDefinition.sheetName;
        const otherEntriesPromise = Promise.all(Object.entries(googleSheetDefinitions)
            .filter(([key]) => key !== 'floorPlan')
            .map(async ([key, definition]) => {
                const sheetName = config?.sheets?.[key] || definition.sheetName;
                const csv = await loadGoogleSheetTable(documentId, sheetName, definition.range, signal);
                return [key, csv];
            }));
        const [xAxisCsv, yAxisCsv, otherEntries] = await Promise.all([
            loadGoogleSheetTable(documentId, floorPlanSheetName, floorPlanDefinition.xAxisRange, signal),
            loadGoogleSheetTable(documentId, floorPlanSheetName, floorPlanDefinition.yAxisRange, signal),
            otherEntriesPromise
        ]);
        const floorPlanAxis = getFloorPlanAxisRange(xAxisCsv, yAxisCsv);
        const floorPlanCsv = await loadGoogleSheetTable(documentId, floorPlanSheetName, floorPlanAxis.range, signal);
        return convertGoogleSheetCsv(Object.fromEntries([['floorPlan', floorPlanCsv], ...otherEntries]), {
            ...(config || {}),
            floorPlanAxis
        });
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
                    <div class="warehouse-3d-slot-tooltip" role="status" hidden></div>
                    <div class="warehouse-3d-camera-views" role="group" aria-label="카메라 투영 및 구도" hidden>
                        <button class="warehouse-3d-projection-toggle" type="button" data-warehouse-projection-toggle data-projection="perspective" aria-label="현재 Perspective. Orthographic으로 전환" aria-pressed="false" title="Orthographic으로 전환">
                            <svg class="warehouse-3d-projection-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path class="warehouse-3d-projection-half warehouse-3d-projection-half-primary" d="M3.5 3.5h17l-17 17Z"/>
                                <path class="warehouse-3d-projection-half warehouse-3d-projection-half-secondary" d="M20.5 3.5v17h-17Z"/>
                                <text class="warehouse-3d-projection-letter warehouse-3d-projection-letter-p" x="8" y="9.2">P</text>
                                <text class="warehouse-3d-projection-letter warehouse-3d-projection-letter-o" x="16" y="16.5">O</text>
                                <rect class="warehouse-3d-projection-outline" x="3.5" y="3.5" width="17" height="17"/>
                            </svg>
                        </button>
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
            hoverTooltip: container.querySelector('.warehouse-3d-slot-tooltip'),
            inspector: container.querySelector('.warehouse-3d-inspector'),
            zoneFilter: container.querySelector('.warehouse-3d-zone-filter'),
            search: container.querySelector('.warehouse-3d-search'),
            reload: container.querySelector('.warehouse-3d-reload'),
            fullscreen: container.querySelector('.warehouse-3d-fullscreen'),
            viewButtons: [...container.querySelectorAll('[data-warehouse-view]')],
            projectionToggle: container.querySelector('[data-warehouse-projection-toggle]'),
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
            hover: { fill: 'rgba(15, 52, 96, 0.96)', stroke: '#78ABFF', text: '#ffffff', scale: 1.06 },
            selected: { fill: '#2563EB', stroke: '#BFDBFE', text: '#ffffff', scale: 1.1 }
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

    function calculateZoneFloorBounds(racks, rackTypes, clearance = 500, boundaryWidth = 0) {
        const typeByCode = new Map((rackTypes || []).map((type) => [type.code, type]));
        const boundsByZone = new Map();
        (racks || []).forEach((rack) => {
            const zoneCode = String(rack?.zoneCode || '').trim();
            const type = typeByCode.get(rack?.rackTypeCode);
            if (!zoneCode || !type) return;
            const length = Math.max(0, toNumber(type.bayWidth) * Math.max(0, toNumber(rack.bayCount)));
            const width = Math.max(0, toNumber(type.depth) * Math.max(1, toNumber(rack.rackRowCount, 1)));
            if (!(length > 0) || !(width > 0)) return;
            const startX = toNumber(rack.startX);
            const startY = toNumber(rack.startY);
            const vertical = rack.direction === 'vertical';
            const footprint = vertical
                ? { minX: startX, maxX: startX + width, minY: startY, maxY: startY + length }
                : { minX: startX, maxX: startX + length, minY: startY, maxY: startY + width };
            const bounds = boundsByZone.get(zoneCode) || { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
            bounds.minX = Math.min(bounds.minX, footprint.minX);
            bounds.maxX = Math.max(bounds.maxX, footprint.maxX);
            bounds.minY = Math.min(bounds.minY, footprint.minY);
            bounds.maxY = Math.max(bounds.maxY, footprint.maxY);
            boundsByZone.set(zoneCode, bounds);
        });
        const expansion = clearance + boundaryWidth / 2;
        return [...boundsByZone.entries()].map(([zoneCode, bounds]) => ({
            zoneCode,
            minX: bounds.minX - expansion,
            maxX: bounds.maxX + expansion,
            minY: bounds.minY - expansion,
            maxY: bounds.maxY + expansion
        }));
    }
    function buildPassageBoundarySegments(passageCells, cellSize = 500, boundaryWidth = 100) {
        const size = Math.max(1, toNumber(cellSize, 500));
        const thickness = Math.min(size, Math.max(1, toNumber(boundaryWidth, 100)));
        const cells = [];
        const occupied = new Set();
        (Array.isArray(passageCells) ? passageCells : []).forEach((cell) => {
            const x = toNumber(cell?.x);
            const y = toNumber(cell?.y);
            const key = `${x}:${y}`;
            if (occupied.has(key)) return;
            occupied.add(key);
            cells.push({ x, y });
        });
        const hasCell = (x, y) => occupied.has(`${x}:${y}`);
        const segments = [];
        cells.forEach(({ x, y }) => {
            if (!hasCell(x, y - size)) {
                segments.push({ side: 'top', x: x + size / 2, y: y + thickness / 2, width: size, depth: thickness });
            }
            if (!hasCell(x, y + size)) {
                segments.push({ side: 'bottom', x: x + size / 2, y: y + size - thickness / 2, width: size, depth: thickness });
            }
            if (!hasCell(x - size, y)) {
                segments.push({ side: 'left', x: x + thickness / 2, y: y + size / 2, width: thickness, depth: size });
            }
            if (!hasCell(x + size, y)) {
                segments.push({ side: 'right', x: x + size - thickness / 2, y: y + size / 2, width: thickness, depth: size });
            }
        });
        return segments;
    }
    function calculateRackFocusView(bounds, options = {}) {
        const min = {
            x: Number(bounds?.min?.x),
            y: Number(bounds?.min?.y),
            z: Number(bounds?.min?.z)
        };
        const max = {
            x: Number(bounds?.max?.x),
            y: Number(bounds?.max?.y),
            z: Number(bounds?.max?.z)
        };
        if (![min.x, min.y, min.z, max.x, max.y, max.z].every(Number.isFinite)
            || max.x < min.x || max.y < min.y || max.z < min.z) return null;
        const yaw = toNumber(options.yaw, Math.PI / 4);
        const pitch = toNumber(options.pitch, Math.PI / 6);
        const aspect = Math.max(0.01, toNumber(options.aspect, 1));
        const verticalHalfFov = Math.max(0.01, Math.min(Math.PI / 2 - 0.01, toNumber(options.verticalFovDegrees, 45) * Math.PI / 360));
        const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
        const padding = Math.max(1, toNumber(options.padding, 1.12));
        const nearPadding = Math.max(0.01, toNumber(options.nearPadding, 0.25));
        const center = {
            x: (min.x + max.x) / 2,
            y: (min.y + max.y) / 2,
            z: (min.z + max.z) / 2
        };
        const cosPitch = Math.cos(pitch);
        const sinPitch = Math.sin(pitch);
        const sinYaw = Math.sin(yaw);
        const cosYaw = Math.cos(yaw);
        const cameraBack = { x: cosPitch * sinYaw, y: sinPitch, z: cosPitch * cosYaw };
        const cameraRight = { x: cosYaw, y: 0, z: -sinYaw };
        const cameraUp = { x: -sinPitch * sinYaw, y: cosPitch, z: -sinPitch * cosYaw };
        let perspectiveDistance = nearPadding;
        let orthographicHalfHeight = 0.05;
        let depthExtent = 0;
        [min.x, max.x].forEach((x) => {
            [min.y, max.y].forEach((y) => {
                [min.z, max.z].forEach((z) => {
                    const offset = { x: x - center.x, y: y - center.y, z: z - center.z };
                    const horizontal = Math.abs(offset.x * cameraRight.x + offset.y * cameraRight.y + offset.z * cameraRight.z);
                    const vertical = Math.abs(offset.x * cameraUp.x + offset.y * cameraUp.y + offset.z * cameraUp.z);
                    const towardCamera = offset.x * cameraBack.x + offset.y * cameraBack.y + offset.z * cameraBack.z;
                    perspectiveDistance = Math.max(
                        perspectiveDistance,
                        towardCamera + horizontal * padding / Math.tan(horizontalHalfFov),
                        towardCamera + vertical * padding / Math.tan(verticalHalfFov),
                        towardCamera + nearPadding
                    );
                    orthographicHalfHeight = Math.max(orthographicHalfHeight, vertical * padding, horizontal * padding / aspect);
                    depthExtent = Math.max(depthExtent, Math.abs(towardCamera));
                });
            });
        });
        return {
            center,
            perspectiveDistance,
            orthographicViewHeight: orthographicHalfHeight * 2,
            depthExtent
        };
    }
    function startWarehouseScene(THREE, shell, data, signal) {
        const mm = (value) => Number(value || 0) / 1000;
        const floorWidth = mm(data.meta?.floorWidth || 52000);
        const floorDepth = mm(data.meta?.floorDepth || 58000);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#07111f');

        const perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 250);
        const orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 250);
        let camera = perspectiveCamera;
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.sortObjects = true;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute('aria-label', '기준정보 기반 3D 창고');
        shell.viewport.replaceChildren(renderer.domElement, shell.hoverTooltip, shell.cameraViews);
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
        const passageCellSize = mm(data.meta?.floorPlanCellSize || 500);
        const passageCells = Array.isArray(data.meta?.passageCells) ? data.meta.passageCells : [];
        const passageBoundaryWidthMm = 100;
        const passageBoundarySegments = buildPassageBoundarySegments(
            passageCells,
            data.meta?.floorPlanCellSize || 500,
            passageBoundaryWidthMm
        );
        let passageBoundaryGeometry = null;
        let passageBoundaryMaterial = null;
        if (passageBoundarySegments.length) {
            passageBoundaryGeometry = new THREE.BoxGeometry(1, 0.012, 1);
            passageBoundaryMaterial = new THREE.MeshBasicMaterial({ color: '#facc15' });
            const passageBoundaries = new THREE.InstancedMesh(
                passageBoundaryGeometry,
                passageBoundaryMaterial,
                passageBoundarySegments.length
            );
            const passageMatrix = new THREE.Matrix4();
            passageBoundarySegments.forEach((segment, index) => {
                passageMatrix.makeScale(mm(segment.width), 1, mm(segment.depth));
                passageMatrix.setPosition(mm(segment.x), 0.006, mm(segment.y));
                passageBoundaries.setMatrixAt(index, passageMatrix);
            });
            passageBoundaries.instanceMatrix.needsUpdate = true;
            passageBoundaries.renderOrder = 3;
            scene.add(passageBoundaries);
        }
        const grid = new THREE.Group();
        const gridPositions = [];
        for (let x = 0; x <= floorWidth + 0.0001; x += passageCellSize) {
            gridPositions.push(x, 0, 0, x, 0, floorDepth);
        }
        for (let z = 0; z <= floorDepth + 0.0001; z += passageCellSize) {
            gridPositions.push(0, 0, z, floorWidth, 0, z);
        }
        const gridGeometry = new THREE.BufferGeometry();
        gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
        grid.add(new THREE.LineSegments(
            gridGeometry,
            new THREE.LineBasicMaterial({ color: '#78a98b', transparent: true, opacity: 0.42 })
        ));
        const boundaryGeometry = new THREE.BufferGeometry();
        boundaryGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
            0, 0.006, 0, floorWidth, 0.006, 0,
            floorWidth, 0.006, 0, floorWidth, 0.006, floorDepth,
            floorWidth, 0.006, floorDepth, 0, 0.006, floorDepth,
            0, 0.006, floorDepth, 0, 0.006, 0
        ], 3));
        grid.add(new THREE.LineSegments(boundaryGeometry, new THREE.LineBasicMaterial({ color: '#2f7454' })));
        scene.add(grid);

        const rackTypeByCode = new Map(data.rackTypes.map((type) => [type.code, type]));
        const itemByCode = new Map(data.items.map((item) => [item.code, item]));
        const zoneByCode = new Map(data.zones.map((zone) => [zone.code, zone]));
        const slotKey = (rackCode, rackRow, bay, level, depth) => `${rackCode}|${rackRow}|${bay}|${level}|${depth}`;
        const locationBySlot = new Map((data.locations || []).map((location) => [
            slotKey(location.rackCode, location.rackRow || 1, location.bay, location.level, location.depth || 1),
            location
        ]));
        const inventoryBySlot = new Map(data.inventory.map((stock) => [
            slotKey(stock.rackCode, stock.rackRow || 1, stock.bay, stock.level, stock.depth || 1),
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
        const dimmedMaterialCache = new Map();
        const originalMaterialsByObject = new WeakMap();
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
        const getDimmedMaterial = (material) => {
            if (!material) return material;
            if (!dimmedMaterialCache.has(material)) {
                const dimmedMaterial = material.clone();
                dimmedMaterial.transparent = true;
                dimmedMaterial.opacity = 0.1;
                dimmedMaterial.depthWrite = false;
                dimmedMaterial.needsUpdate = true;
                dimmedMaterialCache.set(material, dimmedMaterial);
            }
            return dimmedMaterialCache.get(material);
        };
        const setRackEntryDimmed = (entry, dimmed) => {
            if (!entry || entry.dimmed === dimmed) return;
            entry.visualObjects.forEach((object) => {
                const originalMaterial = originalMaterialsByObject.get(object);
                object.material = dimmed
                    ? (Array.isArray(originalMaterial) ? originalMaterial.map(getDimmedMaterial) : getDimmedMaterial(originalMaterial))
                    : originalMaterial;
            });
            entry.dimmed = dimmed;
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

        data.racks.forEach((rack) => {
            const type = rackTypeByCode.get(rack.rackTypeCode);
            if (!type) return;
            const bayWidth = mm(type.bayWidth);
            const depth = mm(type.depth);
            const height = mm(type.height);
            const levelHeight = mm(type.levelHeight) || height / Math.max(1, type.levels);
            const length = bayWidth * rack.bayCount;
            const rackRowCount = Math.max(1, Math.round(Number(rack.rackRowCount) || 1));
            const rackWidth = depth * rackRowCount;
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
                for (let rackRow = 0; rackRow <= rackRowCount; rackRow += 1) {
                    addBox(group, [postSize, height, postSize], [x, height / 2, rackRow * depth], rackFrameColor, rackData, rackFrameMaterial);
                }
            }
            for (let level = 0; level <= type.levels; level += 1) {
                const y = Math.min(height, level * levelHeight);
                for (let rackRow = 0; rackRow < rackRowCount; rackRow += 1) {
                    const rowStart = rackRow * depth;
                    addBox(group, [length, 0.08, 0.09], [length / 2, y, rowStart], rackFrameColor, rackData, rackFrameMaterial);
                    addBox(group, [length, 0.08, 0.09], [length / 2, y, rowStart + depth], rackFrameColor, rackData, rackFrameMaterial);
                    if (level < type.levels) addBox(
                        group,
                        [length, 0.035, depth],
                        [length / 2, y + 0.03, rowStart + depth / 2],
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
                    for (let rackRow = 1; rackRow <= rackRowCount; rackRow += 1) {
                        for (let depthIndex = 1; depthIndex <= depthCount; depthIndex += 1) {
                        const key = slotKey(rack.code, rackRow, bay, level, depthIndex);
                        const stock = inventoryBySlot.get(key);
                        const location = locationBySlot.get(key);
                        const item = stock ? itemByCode.get(stock.itemCode) : null;
                        const occupied = Boolean(stock && Number(stock.quantity) > 0);
                        slots.push({
                            kind: 'slot',
                            locationCode: location?.locationCode || `${rack.code}-R${String(rackRow).padStart(2, '0')}-B${String(bay).padStart(2, '0')}-L${String(level).padStart(2, '0')}-D${String(depthIndex).padStart(2, '0')}`,
                            rack,
                            type,
                            zone: zoneByCode.get(rack.zoneCode),
                            rackRow,
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
                                (rackRow - 1) * depth + (depthIndex - 0.5) * slotDepth
                            ]
                        });
                    }
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
            const pick = addBox(group, [length, height, rackWidth], [length / 2, height / 2, rackWidth / 2], '#ffffff', rackData, { transparent: true, opacity: 0.001, castShadow: false });
            pick.material.depthWrite = false;
            clickTargets.push(pick);
            const label = createLabelSprite(THREE, rack.code);
            label.position.set(length / 2, height + 0.65, rackWidth / 2);
            label.userData = rackData;
            rackData.label = label;
            clickTargets.push(label);
            labelTargets.push(label);
            const labelLayer = new THREE.Group();
            labelLayer.renderOrder = 1000;
            labelLayer.add(label);
            group.add(labelLayer);
            const outlineSize = [length + 0.18, height + 0.18, rackWidth + 0.18];
            const outlinePosition = [length / 2, height / 2, rackWidth / 2];
            const rackHoverOutline = createRackOutline(outlineSize, outlinePosition, rackHoverMaterial);
            const rackSelectedOutline = createRackOutline(outlineSize, outlinePosition, rackSelectedMaterial);
            rackData.outlines = { hover: rackHoverOutline, selected: rackSelectedOutline };
            group.add(rackHoverOutline, rackSelectedOutline);
            const startX = mm(rack.startX);
            const startZ = mm(rack.startY);
            if (rack.direction === 'vertical') {
                group.position.set(startX + rackWidth, 0, startZ);
                group.rotation.y = -Math.PI / 2;
            } else group.position.set(startX, 0, startZ);
            scene.add(group);
            group.updateMatrixWorld(true);
            rackData.focusBounds = new THREE.Box3(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(length, height, rackWidth)
            ).applyMatrix4(group.matrixWorld);
            const visualObjects = [];
            group.traverse((object) => {
                if (!object.material || object === pick) return;
                originalMaterialsByObject.set(object, object.material);
                visualObjects.push(object);
            });
            rackEntries.push({
                rack, type, group, stocks, slots, rackData, visualObjects, dimmed: false,
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
        const perspectiveHalfFov = perspectiveCamera.fov * Math.PI / 360;
        const minimumCameraDistance = 8;
        const maximumCameraDistance = 140;
        let projectionMode = 'perspective';
        let viewportAspect = 1;
        let cameraFocusTransitionToken = 0;
        const getPerspectiveViewHeight = (cameraDistance = distance) => 2 * cameraDistance * Math.tan(perspectiveHalfFov);
        const getEquivalentCameraDistance = () => projectionMode === 'orthographic'
            ? orthographicViewHeight / (2 * Math.tan(perspectiveHalfFov))
            : distance;
        let orthographicViewHeight = getPerspectiveViewHeight();
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
        const updateProjectionMatrices = () => {
            perspectiveCamera.aspect = viewportAspect;
            perspectiveCamera.updateProjectionMatrix();
            const halfHeight = orthographicViewHeight / 2;
            const halfWidth = halfHeight * viewportAspect;
            orthographicCamera.left = -halfWidth;
            orthographicCamera.right = halfWidth;
            orthographicCamera.top = halfHeight;
            orthographicCamera.bottom = -halfHeight;
            orthographicCamera.updateProjectionMatrix();
        };
        const updateProjectionToggle = () => {
            const isOrthographic = projectionMode === 'orthographic';
            const currentLabel = isOrthographic ? 'Orthographic' : 'Perspective';
            const nextLabel = isOrthographic ? 'Perspective' : 'Orthographic';
            shell.projectionToggle.dataset.projection = projectionMode;
            shell.projectionToggle.setAttribute('aria-pressed', String(isOrthographic));
            shell.projectionToggle.setAttribute('aria-label', `현재 ${currentLabel}. ${nextLabel}으로 전환`);
            shell.projectionToggle.title = `${nextLabel}으로 전환`;
        };
        const render = (timestamp) => {
            animationFrame = 0;
            updateWorldUiTransitions(timestamp || performance.now());
            if (!destroyed && renderer.domElement.isConnected) {
                renderer.render(scene, camera);
                updateHoverTooltipPosition();
            }
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
        const focusRackInCurrentView = (rackData) => {
            const bounds = rackData?.focusBounds;
            const focusView = calculateRackFocusView(bounds, {
                yaw,
                pitch,
                aspect: viewportAspect,
                verticalFovDegrees: perspectiveCamera.fov,
                padding: 1.12
            });
            if (!focusView) return;
            const startTarget = target.clone();
            const endTarget = new THREE.Vector3(focusView.center.x, focusView.center.y, focusView.center.z);
            const startDistance = distance;
            const startOrthographicViewHeight = orthographicViewHeight;
            const endDistance = Math.max(minimumCameraDistance, Math.min(maximumCameraDistance, focusView.perspectiveDistance));
            const endOrthographicViewHeight = Math.max(0.5, Math.min(getPerspectiveViewHeight(maximumCameraDistance), focusView.orthographicViewHeight));
            const orthographicCameraDistance = Math.max(distance, focusView.depthExtent + 1);
            const token = ++cameraFocusTransitionToken;
            startWorldUiTransition(320, (progress) => {
                if (cameraFocusTransitionToken !== token) return false;
                target.lerpVectors(startTarget, endTarget, progress);
                if (projectionMode === 'orthographic') {
                    distance = startDistance + (orthographicCameraDistance - startDistance) * progress;
                    orthographicViewHeight = startOrthographicViewHeight + (endOrthographicViewHeight - startOrthographicViewHeight) * progress;
                } else {
                    distance = startDistance + (endDistance - startDistance) * progress;
                    orthographicViewHeight = getPerspectiveViewHeight(distance);
                }
                updateProjectionMatrices();
                updateCamera();
                return true;
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
        const updateHoverTooltipPosition = () => {
            const tooltip = shell.hoverTooltip;
            if (!hoveredSlot || tooltip.hidden) return;
            const anchor = new THREE.Vector3(
                hoveredSlot.position[0],
                hoveredSlot.position[1] + hoveredSlot.boxSize[1] / 2 + 0.22,
                hoveredSlot.position[2]
            );
            hoveredSlot.group.localToWorld(anchor);
            const cameraSpace = anchor.clone().applyMatrix4(camera.matrixWorldInverse);
            const projected = anchor.project(camera);
            const isOutsideViewport = cameraSpace.z >= 0 || projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1;
            tooltip.classList.toggle('is-offscreen', isOutsideViewport);
            if (isOutsideViewport) return;
            const rect = renderer.domElement.getBoundingClientRect();
            const padding = 10;
            const anchorX = (projected.x + 1) * rect.width / 2;
            const anchorY = (1 - projected.y) * rect.height / 2;
            const x = Math.max(padding, Math.min(rect.width - tooltip.offsetWidth - padding, anchorX + 14));
            const y = Math.max(padding, Math.min(rect.height - tooltip.offsetHeight - padding, anchorY - tooltip.offsetHeight - 14));
            tooltip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
        };
        const updateHoverTooltip = (slot) => {
            const tooltip = shell.hoverTooltip;
            if (!slot) {
                tooltip.hidden = true;
                tooltip.classList.remove('is-visible', 'is-offscreen');
                return;
            }
            const summary = getSlotSummary(slot);
            tooltip.innerHTML = `<strong>${escapeHtml(summary.itemName)}</strong><span>수량 ${summary.quantity} / ${summary.capacity || '미설정'} · 적재율 ${summary.rate === null ? '용량 미설정' : `${summary.rate}%`}</span>`;
            tooltip.hidden = false;
            tooltip.classList.add('is-visible');
            updateHoverTooltipPosition();
        };
        let hoveredSlot = null;
        const setHoveredSlot = (slot) => {
            if (hoveredSlot === slot) return;
            hoveredSlot = slot || null;
            updateSlotOutline(hoverOutline, hoveredSlot);
            updateHoverTooltip(hoveredSlot);
            requestRender();
        };
        const setSelectedSlot = (slot) => {
            updateSlotOutline(selectedOutline, slot || null);
            requestRender();
        };
        let hoveredRack = null;
        let selectedRack = null;
        let focusedRack = null;
        const setFocusedRack = (rackData) => {
            focusedRack = rackData || null;
            rackEntries.forEach((entry) => {
                setRackEntryDimmed(entry, Boolean(focusedRack && entry.rack !== focusedRack.rack));
            });
            requestRender();
        };
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
            cameraFocusTransitionToken += 1;
            const preset = cameraViewPresets[viewName] || cameraViewPresets.quarter;
            yaw = preset.yaw;
            pitch = preset.pitch;
            distance = Math.max(floorWidth, floorDepth) * preset.distanceScale;
            target.set(floorWidth / 2, preset.targetY, floorDepth / 2);
            orthographicViewHeight = getPerspectiveViewHeight(distance);
            updateProjectionMatrices();
            updateCamera();
            setActiveCameraView(viewName);
            requestRender();
            renderer.domElement.focus();
        };
        shell.cameraViewButtons.forEach((button) => {
            button.addEventListener('click', () => applyCameraView(button.dataset.warehouseCameraView), { signal });
        });
        const applyProjectionMode = (nextMode) => {
            const normalizedMode = nextMode === 'orthographic' ? 'orthographic' : 'perspective';
            if (normalizedMode === projectionMode) return;
            cameraFocusTransitionToken += 1;
            if (normalizedMode === 'orthographic') {
                orthographicViewHeight = getPerspectiveViewHeight(distance);
                projectionMode = 'orthographic';
                camera = orthographicCamera;
            } else {
                distance = Math.max(
                    minimumCameraDistance,
                    Math.min(maximumCameraDistance, orthographicViewHeight / (2 * Math.tan(perspectiveHalfFov)))
                );
                projectionMode = 'perspective';
                camera = perspectiveCamera;
            }
            updateProjectionMatrices();
            updateCamera();
            updateProjectionToggle();
            requestRender();
        };
        shell.projectionToggle.addEventListener('click', () => {
            applyProjectionMode(projectionMode === 'perspective' ? 'orthographic' : 'perspective');
        }, { signal });
        updateProjectionToggle();
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
            viewportAspect = width / height;
            updateProjectionMatrices();
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
            cameraFocusTransitionToken += 1;
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
                distance: getEquivalentCameraDistance(),
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
            cameraFocusTransitionToken += 1;
            const zoomFactor = Math.exp(event.deltaY * 0.0012);
            if (projectionMode === 'orthographic') {
                const minimumViewHeight = getPerspectiveViewHeight(minimumCameraDistance);
                const maximumViewHeight = getPerspectiveViewHeight(maximumCameraDistance);
                orthographicViewHeight = Math.max(minimumViewHeight, Math.min(maximumViewHeight, orthographicViewHeight * zoomFactor));
                updateProjectionMatrices();
            } else {
                distance = Math.max(minimumCameraDistance, Math.min(maximumCameraDistance, distance * zoomFactor));
            }
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
                shell.inspector.innerHTML = `<h5>${escapeHtml(selection.locationCode)}</h5><dl><dt>품목</dt><dd>${itemText}</dd><dt>랙</dt><dd>${escapeHtml(selection.rack.code)} / ${escapeHtml(selection.zone?.name || selection.rack.zoneCode)}</dd><dt>셀 위치</dt><dd>${selection.rackRow}랙열 · ${selection.bay}베이 · ${selection.level}단 · 깊이 ${selection.depth}</dd><dt>수량</dt><dd>${quantity} / ${capacity || '미설정'}</dd><dt>적재율</dt><dd>${rate === null ? '용량 미설정' : `${rate}%`}</dd><dt>재고 상태</dt><dd>${escapeHtml(statusText)}</dd></dl>`;
            } else {
                const plan = selection.rack.floorPlan;
                const planInfo = plan
                    ? `<dt>평면도 범위</dt><dd>${plan.columns}칸 × ${plan.rows}칸 (${(plan.planLength / 1000).toFixed(2)}m × ${(plan.planWidth / 1000).toFixed(2)}m)</dd><dt>여유 공간</dt><dd>길이 ${(plan.remainingLength / 1000).toFixed(2)}m · 폭 ${(plan.remainingWidth / 1000).toFixed(2)}m</dd>`
                    : '';
                shell.inspector.innerHTML = `<h5>${escapeHtml(selection.rack.code)}</h5><dl><dt>구역</dt><dd>${escapeHtml(selection.rack.zoneCode)} · ${escapeHtml(selection.zone?.name || '')}</dd><dt>랙타입</dt><dd>${escapeHtml(selection.type.name)}</dd><dt>배치 기준</dt><dd>${selection.rack.layoutSource === 'floorPlan' ? '평면도' : '랙배치'}</dd><dt>구성</dt><dd>${selection.rack.rackRowCount}랙열 · ${selection.rack.bayCount}베이</dd><dt>단수·깊이</dt><dd>${selection.type.levels}단 · 깊이 ${Math.max(1, Number(selection.type.depthCount) || 1)}</dd><dt>실제 규격</dt><dd>${(selection.type.bayWidth * selection.rack.bayCount / 1000).toFixed(2)}m × ${(selection.type.depth * selection.rack.rackRowCount / 1000).toFixed(2)}m × ${(selection.type.height / 1000).toFixed(2)}m</dd>${planInfo}<dt>등록 재고</dt><dd>${(inventoryByRack.get(selection.rack.code) || []).length}개 로케이션</dd></dl>`;
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
                setFocusedRack(labelRack);
                focusRackInCurrentView(labelRack);
                showSelection(labelRack);
                return;
            }
            const slot = getSlotAtPointer(event);
            if (slot) { setSelectedSlot(slot); setSelectedRack(null); setFocusedRack(null); showSelection(slot); return; }
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(clickTargets, false).filter((hit) => isRaycastTargetVisible(hit.object));
            const hit = hits[0];
            if (hit?.object.userData?.kind) { setSelectedSlot(null); setFocusedRack(null); setSelectedRack(hit.object.userData); showSelection(hit.object.userData); }
            else { setSelectedSlot(null); setSelectedRack(null); setFocusedRack(null); showDefaultInspector(); }
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
            const focusedEntry = focusedRack && rackEntries.find((entry) => entry.rack === focusedRack.rack);
            if (focusedRack && !focusedEntry?.group.visible) {
                setSelectedRack(null);
                setFocusedRack(null);
                showDefaultInspector();
            }
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
            dimmedMaterialCache.forEach((material) => material.dispose());
            rackHoverMaterial.dispose();
            rackSelectedMaterial.dispose();
            hoverOutline.userData.material.dispose();
            selectedOutline.userData.material.dispose();
            passageBoundaryGeometry?.dispose();
            passageBoundaryMaterial?.dispose();
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
            if (options.googleSheet?.documentId) {
                data = await loadGoogleSheetData(options.googleSheet, abortController.signal);
            } else {
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
            if (options.googleSheet?.documentId) {
                const loadedAt = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                shell.sourceStatus.classList.add('is-connected');
                const unmappedCount = data.meta?.unmappedFloorRackCodes?.length || 0;
                const unplacedCount = data.meta?.unplacedRackCodes?.length || 0;
                if (unmappedCount) shell.sourceStatus.classList.add('is-warning');
                const layoutErrorCount = data.meta?.layoutErrors?.length || 0;
                const outOfRangeCount = data.meta?.outOfRangeLocationCodes?.length || 0;
                if (layoutErrorCount || outOfRangeCount) shell.sourceStatus.classList.add('is-warning');
                shell.sourceStatus.textContent = `Google Sheets 연결됨 · ${loadedAt} · 평면도 배치 ${data.meta?.floorPlanAppliedCount || 0}개 · 재고 ${data.inventory.length}건${unplacedCount ? ` · 미배치 ${unplacedCount}개` : ''}${unmappedCount ? ` · 미등록 랙코드 ${unmappedCount}개` : ''}${layoutErrorCount ? ` · 배치 오류 ${layoutErrorCount}개` : ''}${outOfRangeCount ? ` · 범위초과 위치 ${outOfRangeCount}개` : ''}`;
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
        getFloorPlanAxisRange,
        convertGoogleSheetCsv,
        calculateZoneFloorBounds,
        buildPassageBoundarySegments,
        calculateRackFocusView,
        getSlotVisualKey,
        getGoogleSheetQueryUrl,
        googleTableToCsv
    });
    window.dispatchEvent(new Event('wms-warehouse-3d-ready'));
}());
