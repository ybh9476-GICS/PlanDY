const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const warehouse = JSON.parse(fs.readFileSync(path.join(root, 'data', 'warehouse-demo.json'), 'utf8'));
const published = JSON.parse(fs.readFileSync(path.join(root, 'data', 'site-content.json'), 'utf8'));
const patches = JSON.parse(fs.readFileSync(path.join(root, 'data', 'card-patches.json'), 'utf8'));
const contentModel = fs.readFileSync(path.join(root, 'js', 'card-content-model.js'), 'utf8');
const cardRenderer = fs.readFileSync(path.join(root, 'js', 'test-editor-v14.js'), 'utf8');
const warehouseRenderer = fs.readFileSync(path.join(root, 'js', 'warehouse-3d.js'), 'utf8');
const warehouseStyles = fs.readFileSync(path.join(root, 'css', 'test-editor.css'), 'utf8');

assert.strictEqual(warehouse.schemaVersion, 1, 'Warehouse data schema version must be 1.');
['zones', 'rackTypes', 'racks', 'items', 'inventory'].forEach((key) => {
    assert.ok(Array.isArray(warehouse[key]), `Warehouse ${key} must be an array.`);
});

const unique = (values, label) => {
    const compact = values.filter(Boolean);
    assert.strictEqual(new Set(compact).size, compact.length, `${label} values must be unique.`);
};
unique(warehouse.zones.map((zone) => zone.code), 'Zone code');
unique(warehouse.rackTypes.map((rackType) => rackType.code), 'Rack type code');
unique(warehouse.racks.map((rack) => rack.code), 'Rack code');
unique(warehouse.items.map((item) => item.code), 'Item code');
unique(warehouse.inventory.map((stock) => stock.locationCode), 'Location code');

const zoneCodes = new Set(warehouse.zones.map((zone) => zone.code));
const rackTypeCodes = new Set(warehouse.rackTypes.map((rackType) => rackType.code));
const rackCodes = new Set(warehouse.racks.map((rack) => rack.code));
const itemCodes = new Set(warehouse.items.map((item) => item.code));
warehouse.racks.forEach((rack) => {
    assert.ok(zoneCodes.has(rack.zoneCode), `${rack.code} references an unknown zone.`);
    assert.ok(rackTypeCodes.has(rack.rackTypeCode), `${rack.code} references an unknown rack type.`);
    assert.ok(Number(rack.bayCount) > 0, `${rack.code} must have a positive bay count.`);
});
warehouse.inventory.forEach((stock) => {
    assert.ok(rackCodes.has(stock.rackCode), `${stock.locationCode} references an unknown rack.`);
    assert.ok(itemCodes.has(stock.itemCode), `${stock.locationCode} references an unknown item.`);
});

const menu = published.storage.menus.menus.find((candidate) => candidate.label === '3D 테스트');
assert.ok(menu, 'The 3D 테스트 menu is missing.');
assert.strictEqual(menu.id, 'custom-1788157191456', 'The 3D 테스트 menu id changed unexpectedly.');
const rows = published.storage.customCards[menu.id];
const cards = rows.flatMap((row) => row.cards || []);
assert.strictEqual(cards[0].title, '3D 창고 레이아웃', 'The first card must be the 3D warehouse card.');
assert.strictEqual(cards[0].editLocked, true, 'The 3D warehouse card must be read-only.');
assert.strictEqual(cards[0].contentBlocks[0].type, 'warehouse3d', 'The first card must use the warehouse3d block.');
assert.strictEqual(cards[0].contentBlocks[0].dataSource, 'data/warehouse-demo.json', 'The first card 3D warehouse data source changed unexpectedly.');
assert.strictEqual(cards[1].title, '기준 정보', 'The second Google Sheets card must remain unchanged.');
assert.strictEqual(cards[1].contentBlocks[0].type, 'googleDrive', 'The second card must remain a Google Drive card.');
const warehouseBlock = cards[0].contentBlocks[0];
assert.strictEqual(warehouseBlock.googleSheet.documentId, cards[1].contentBlocks[0].documentId, 'The 3D card must use the Google Sheets document.');
assert.deepStrictEqual(
    Object.values(warehouseBlock.googleSheet.sheets).sort(),
    ['평면도', '구역설정', '랙타입 마스터', '랙배치', '로케이션 마스터', '품목 마스터', '재고 현황'].sort(),
    'The required Google Sheets tabs changed unexpectedly.'
);

const patch = patches.patches.find((candidate) => candidate.id === 'three-test-warehouse-floor-plan-v3');
assert.ok(patch, 'The browser card patch is missing.');
assert.strictEqual(patch.menuId, menu.id, 'The browser card patch targets the wrong menu.');
assert.strictEqual(patch.readingIndex, 1, 'The browser card patch must target the second card.');
assert.strictEqual(patch.card.contentBlocks[0].googleSheet.documentId, warehouseBlock.googleSheet.documentId, 'The browser patch Google Sheets document changed unexpectedly.');
assert.ok(contentModel.includes("type: 'warehouse3d'"), 'The shared card model must register the warehouse3d block.');
assert.ok(cardRenderer.includes("block.type === 'warehouse3d'"), 'The shared renderer must render the warehouse3d block.');
assert.ok(cardRenderer.includes('disposeWithin'), '3D resources must be disposed before card rerendering.');
assert.ok(warehouseRenderer.includes('three@0.185.1'), 'Three.js must use the reviewed pinned version.');
assert.ok(warehouseRenderer.includes('validateWarehouseData'), 'Warehouse data validation must run before rendering.');
assert.ok(!warehouseRenderer.includes('new THREE.Fog'), 'The warehouse scene must not fade distant racks with fog.');
assert.ok(warehouseRenderer.includes("const fillLight = new THREE.DirectionalLight('#dbeafe', 1.35)"), 'The warehouse scene must use one reflected-light fill.');
assert.ok(warehouseRenderer.includes('fillLight.castShadow = false'), 'The fill light must not add shadow rendering cost.');
assert.ok(warehouseRenderer.includes('/gviz/tq?tqx=responseHandler:'), 'The warehouse loader must use the Google Sheets callback endpoint.');
assert.ok(warehouseRenderer.includes("range: 'A4:K'"), 'The rack sheet must start from the row 4 header.');
assert.ok(warehouseRenderer.includes("range: 'A4:AZ60'"), 'The floor plan grid range must be loaded.');
assert.ok(warehouseRenderer.includes("script.referrerPolicy = 'no-referrer'"), 'The public sheet callback must not send the local page as referrer.');
assert.ok(warehouseRenderer.includes("mode: event.button === 2 ? 'rotate' : 'pan'"), 'Right drag must rotate and left drag must pan.');
assert.ok(warehouseRenderer.includes("addEventListener('contextmenu'"), 'The 3D canvas must suppress the right-click menu.');
assert.ok(warehouseRenderer.includes('container.requestFullscreen'), 'The warehouse card must support entering fullscreen.');
assert.ok(warehouseRenderer.includes('document.exitFullscreen'), 'The warehouse card must support leaving fullscreen.');
assert.ok(cardRenderer.includes('warehouse-footer-source-status-v16'), 'The shared renderer must load the footer source status layout.');
assert.ok(warehouseStyles.includes('.warehouse-3d-shell:fullscreen'), 'Fullscreen warehouse layout styles are missing.');
assert.ok(warehouseStyles.includes('height: 540px; min-height: 540px;'), 'The regular warehouse viewport must keep a stable height.');
assert.ok(warehouseStyles.includes('.warehouse-3d-shell:fullscreen .warehouse-3d-main { flex: 1; height: auto; min-height: 0; }'), 'Fullscreen must override the regular warehouse height.');
assert.ok(warehouseStyles.includes('cursor: default'), 'The 3D canvas must use the normal cursor.');
assert.ok(warehouseRenderer.includes('if (!viewportWidth || !viewportHeight) return;'), 'A hidden warehouse viewport must not trigger a resize.');
assert.ok(!warehouseRenderer.includes('warehouse-3d-reset'), 'The screen reset button must be removed.');
assert.strictEqual((warehouseRenderer.match(/data-warehouse-camera-view=/g) || []).length, 4, 'The viewport must provide exactly four camera view buttons.');
assert.ok(warehouseRenderer.includes('role="group" aria-label="카메라 구도"'), 'The camera view buttons must be grouped accessibly.');
assert.ok(warehouseRenderer.includes('data-warehouse-camera-view="quarter"'), 'The 30-degree quarter view button is missing.');
assert.ok(warehouseRenderer.includes('data-warehouse-camera-view="top"'), 'The centered top view button is missing.');
assert.ok(warehouseRenderer.includes('data-warehouse-camera-view="front"'), 'The front view button is missing.');
assert.ok(warehouseRenderer.includes('data-warehouse-camera-view="side"'), 'The side view button is missing.');
assert.ok(warehouseRenderer.includes('<svg viewBox="0 0 24 24" aria-hidden="true">'), 'Camera view buttons must use inline icons.');
assert.strictEqual((warehouseRenderer.match(/warehouse-3d-view-face/g) || []).length, 3, 'Top, front, and side view icons must each have one filled cube face.');
assert.ok(warehouseStyles.includes('.warehouse-3d-camera-views .warehouse-3d-view-face { fill: currentColor; }'), 'Filled cube faces must follow the current button icon color.');
assert.ok(warehouseRenderer.includes('quarter: { yaw: Math.PI / 4, pitch: Math.PI / 6'), 'Quarter view must use a 30-degree isometric elevation.');
assert.ok(warehouseRenderer.includes('top: { yaw: 0, pitch: Math.PI / 2 - 0.01'), 'Top view must look down from the warehouse center.');
assert.ok(warehouseRenderer.includes('front: { yaw: 0, pitch: 0.08'), 'Front view must use the front camera direction.');
assert.ok(warehouseRenderer.includes('side: { yaw: Math.PI / 2, pitch: 0.08'), 'Side view must use the side camera direction.');
assert.ok(warehouseRenderer.includes('data-warehouse-grid-toggle'), 'The camera view group must include a Grid toggle button.');
assert.ok(warehouseRenderer.includes('grid.visible = Boolean(isVisible)'), 'The Grid toggle must control Grid visibility.');
assert.ok(warehouseRenderer.includes("aria-label', grid.visible ? 'Grid 숨기기' : 'Grid 표시'"), 'The Grid toggle must announce its current action.');
assert.ok(warehouseStyles.includes('.warehouse-3d-camera-views'), 'The camera buttons must be positioned as one viewport overlay group.');
assert.ok(warehouseStyles.includes('.warehouse-3d-camera-views button[aria-pressed="true"]'), 'The selected camera view must have an active visual state.');
assert.ok(
    warehouseRenderer.indexOf('<span class="warehouse-3d-source-status"') > warehouseRenderer.indexOf('<div class="warehouse-3d-legend"'),
    'The Google Sheets connection status must be placed inside the bottom legend.'
);
assert.ok(!warehouseRenderer.includes('warehouse-3d-help'), 'The bottom-right mouse operation guide must be removed.');
assert.ok(warehouseStyles.includes('margin-left: auto; padding: 0'), 'The connection status must align to the former bottom-right guide position.');
assert.ok(warehouseRenderer.includes('data-warehouse-view="utilization"'), 'The utilization view toggle is missing.');
assert.ok(warehouseRenderer.includes('data-warehouse-view="status"'), 'The inventory status view toggle is missing.');
assert.ok(
    warehouseRenderer.indexOf('<div class="warehouse-3d-legend" aria-label="선택한 재고 보기의 색상 범례">') < warehouseRenderer.indexOf('<div class="warehouse-3d-view-toggle"'),
    'The inventory view toggle must be placed inside the legend.'
);
assert.ok(warehouseStyles.includes('min-width: 46px; min-height: 22px'), 'The legend view buttons must use the compact size.');
assert.ok(warehouseRenderer.includes('new THREE.InstancedMesh'), 'Warehouse slots must use instanced rendering.');
assert.ok(warehouseRenderer.includes('new THREE.ExtrudeGeometry'), 'Warehouse boxes must use a chamfered extruded geometry.');
assert.ok(warehouseRenderer.includes('bevelSegments: 1'), 'Warehouse boxes must use one chamfer step on every edge.');
assert.ok(warehouseRenderer.includes('getChamferedBoxGeometry(boxWidth, boxHeight, boxDepth)'), 'Both occupied and empty slot boxes must share the chamfered geometry.');
assert.ok(warehouseRenderer.includes('depthIndex <= depthCount'), 'Every rack depth position must create a slot box.');
assert.ok(warehouseRenderer.includes("applyViewMode('utilization')"), 'The default warehouse view must be utilization.');
assert.ok(warehouseStyles.includes('.warehouse-3d-legend .is-empty'), 'The empty slot legend style is missing.');
assert.ok(warehouseRenderer.includes("const rackFrameColor = '#8b95a5'"), 'Rack posts and beams must use one neutral steel gray.');
assert.ok(warehouseRenderer.includes('metalness: 0.78'), 'Rack posts and beams must use a metallic material.');
assert.ok(warehouseRenderer.includes('new THREE.MeshPhysicalMaterial'), 'Warehouse surfaces must use physically based reflective materials.');
assert.ok(warehouseRenderer.includes("color: '#17603f'"), 'The warehouse floor must use the waterproof green color.');
assert.ok(/color: '#17603f',\r?\n\s+roughness: 0\.08,\r?\n\s+metalness: 0\.04,\r?\n\s+clearcoat: 1,\r?\n\s+clearcoatRoughness: 0\.025,\r?\n\s+envMapIntensity: 2\.4/.test(warehouseRenderer), 'The warehouse floor must use wet-gloss coating values.');
assert.ok(warehouseRenderer.includes('new THREE.PMREMGenerator(renderer)'), 'The wet floor must receive a prefiltered reflection environment.');
assert.ok(warehouseRenderer.includes('scene.environment = floorReflectionEnvironment'), 'The wet floor reflection environment must be applied to the scene.');
assert.ok(warehouseRenderer.includes("'#78a98b', '#2f7454'"), 'The floor grid must use coordinated green colors.');
assert.ok(warehouseRenderer.includes('clearcoat: 0.62'), 'Rack frames must use a reflective steel coating.');
assert.ok(warehouseRenderer.includes('clearcoat: 0.9'), 'Empty slot boxes must use a strong reflective coating.');
assert.ok(warehouseRenderer.includes('clearcoat: 1'), 'Occupied slot boxes must use the strongest reflective coating.');
assert.ok(warehouseRenderer.includes('clearcoatRoughness: 0.04'), 'Occupied slot reflections must remain sharp.');
assert.ok(!warehouseRenderer.includes("const frameColor = type.color"), 'Rack type colors must not be applied to rack frames.');
assert.ok(warehouseRenderer.includes('opacity: 0.5'), 'Empty slot boxes must use 50% opacity.');
assert.ok(warehouseRenderer.includes('depthWrite: false'), 'Transparent empty slot boxes must not write to the depth buffer.');
assert.ok(warehouseRenderer.includes('clickTargets.push(label)'), 'Floating rack labels must be selectable with the rack body.');
assert.ok(warehouseRenderer.includes('createRackOutline'), 'Rack-level hover and selected outlines must be created.');
assert.ok(warehouseRenderer.includes('setHoveredRack(slot ? null : getRackAtPointer(event))'), 'Rack body and billboards must show a hover outline when no slot is hovered.');
assert.ok(warehouseRenderer.includes('setSelectedRack(hit.object.userData)'), 'Selecting a rack must show its persistent outline.');
assert.ok(warehouseRenderer.includes('setSelectedRack(null); showSelection(slot);'), 'Selecting a slot must clear any rack-level selection outline.');
assert.ok(warehouseRenderer.includes('const worldUiResolutionScale = 2'), 'World-space UI must render at a 2x internal resolution.');
assert.ok(warehouseRenderer.includes('canvas.width = 256 * worldUiResolutionScale'), 'Rack billboards must use the 2x resolution scale.');
assert.ok(warehouseRenderer.includes('hoverCanvas.width = 520 * worldUiResolutionScale'), 'Slot hover labels must use the 2x resolution scale.');

assert.ok(warehouseRenderer.includes('const labelTargets = []'), 'Rack billboards must have a separate priority hit-target list.');
assert.ok(warehouseRenderer.includes('labelTargets.push(label)'), 'Each rack billboard must be registered in the priority hit-target list.');
assert.ok(/if \(labelRack\) \{\s*setHoveredSlot\(null\);\s*setHoveredRack\(labelRack\);\s*return;\s*\}\s*const slot = getSlotAtPointer\(event\);/.test(warehouseRenderer), 'Billboard hover must run before slot hover detection.');
assert.ok(/if \(labelRack\) \{\s*setSelectedSlot\(null\);\s*setSelectedRack\(labelRack\);\s*showSelection\(labelRack\);\s*return;\s*\}\s*const slot = getSlotAtPointer\(event\);/.test(warehouseRenderer), 'Billboard selection must run before slot selection.');
assert.ok(warehouseRenderer.includes("normal: { fill: 'rgba(5, 15, 30, 0.92)'"), 'Rack billboards must have a normal visual state.');
assert.ok(warehouseRenderer.includes("hover: { fill: 'rgba(35, 34, 13, 0.96)'"), 'Rack billboards must have a hover visual state.');
assert.ok(warehouseRenderer.includes("selected: { fill: '#FFFF2D'"), 'Rack billboards must have a selected visual state.');
assert.ok(warehouseRenderer.includes("sprite.setInteractionState = (state = 'normal') =>"), 'Rack billboards must expose an animated interaction-state renderer.');
assert.ok(warehouseRenderer.includes("setRackLabelState(selectedRack, 'selected')"), 'Rack selection must update the billboard selected state.');
assert.ok(warehouseRenderer.includes('new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })'), 'Rack billboard materials must not block foreground rendering.');
assert.ok(warehouseRenderer.includes('sprite.renderOrder = 1000'), 'Rack billboards must use a dedicated top rendering order.');
assert.ok(warehouseRenderer.includes('renderer.sortObjects = true'), 'The renderer must preserve billboard and outline ordering.');
assert.ok(warehouseRenderer.includes('outline.renderOrder = 12'), 'Rack outlines must render before rack billboards.');
assert.ok(warehouseRenderer.includes('new THREE.EdgesGeometry(boxGeometry)'), 'Cell outlines must use a simple box outer edge geometry.');
assert.ok(!warehouseRenderer.includes('new THREE.EdgesGeometry(getChamferedBoxGeometry(width, height, depth), 20)'), 'Cell outlines must not include chamfer seam edges.');
assert.ok(warehouseRenderer.includes('addOuterEdgeTubes(outline, edgeGeometry, 0.042, material, 12)'), 'Rack outlines must use the same thick outer-edge tubes as selected cells.');
assert.ok(warehouseRenderer.includes('new THREE.MeshBasicMaterial({ color: \'#78ABFF\''), 'Rack hover outlines must use the requested blue material.');
assert.ok(warehouseRenderer.includes('new THREE.MeshBasicMaterial({ color: \'#3B82F6\''), 'Rack selected outlines must use the requested blue material.');
assert.ok(warehouseRenderer.includes('labelLayer.renderOrder = 1000'), 'Rack billboards must use a top-level render group instead of only sprite order.');
assert.ok(warehouseRenderer.includes('group.add(labelLayer)'), 'Rack billboard render groups must remain attached to their rack.');
assert.ok(warehouseRenderer.includes('const isRaycastTargetVisible = (object)'), 'Hidden parent groups must be considered during raycasting.');
assert.ok(warehouseRenderer.includes('const activeWorldUiTransitions = new Set()'), 'World-space UI transitions must be tracked independently.');
assert.ok(warehouseRenderer.includes('if (activeWorldUiTransitions.size) requestRender()'), 'Animation frames must stop when no world UI transition remains.');
assert.ok(warehouseRenderer.includes('const fadeWorldObject ='), 'World-space UI outlines and labels must share the fade transition helper.');
assert.ok(warehouseRenderer.includes('fadeWorldObject(hoverLabel, false, { duration: 120 })'), 'Slot hover labels must fade out smoothly.');
assert.ok(warehouseRenderer.includes('fadeWorldObject(hoveredRack.outlines.hover, true, { reset: true })'), 'Rack hover outlines must fade in smoothly.');
assert.ok(warehouseRenderer.includes('fadeWorldObject(selectedRack.outlines.selected, true, { duration: 180, reset: true })'), 'Rack selected outlines must fade in smoothly.');
assert.ok(warehouseRenderer.includes('hoverLabelLayer.renderOrder = 1000'), 'Slot hover labels must use a top-level render group.');
assert.ok(warehouseRenderer.includes('hoverLabelLayer.add(hoverLabel)'), 'The hover label must be attached to its top-level render group.');
assert.ok(warehouseRenderer.includes('slot.group.add(hoverLabelLayer)'), 'The hover label render group must follow the hovered slot.');
assert.ok(/drawLabel\('normal'\);\s*applyScale\(displayedScale\);/.test(warehouseRenderer), 'Rack billboards must apply their normal scale before any interaction.');
const sandbox = {
    window: { dispatchEvent() {} },
    Event: function Event() {}
};
vm.runInNewContext(warehouseRenderer, sandbox);
const converter = sandbox.window.wmsWarehouse3D.convertGoogleSheetCsv;
const getSlotVisualKey = sandbox.window.wmsWarehouse3D.getSlotVisualKey;
assert.strictEqual(getSlotVisualKey({ occupied: false }, 'utilization'), 'empty', 'An empty slot must use the translucent empty color.');
assert.strictEqual(getSlotVisualKey({ occupied: true, stock: { quantity: 49, capacity: 100 } }, 'utilization'), 'low', 'Utilization below 50% must use the low color.');
assert.strictEqual(getSlotVisualKey({ occupied: true, stock: { quantity: 50, capacity: 100 } }, 'utilization'), 'medium', 'Utilization from 50% must use the medium color.');
assert.strictEqual(getSlotVisualKey({ occupied: true, stock: { quantity: 80, capacity: 100 } }, 'utilization'), 'high', 'Utilization from 80% must use the high color.');
assert.strictEqual(getSlotVisualKey({ occupied: true, stock: { status: 'hold' } }, 'status'), 'hold', 'Status view must use the inventory status color.');
assert.strictEqual(getSlotVisualKey({ occupied: true, stock: { quantity: 1, capacity: 0 } }, 'utilization'), 'unknown', 'A slot without capacity must use the unknown color.');
const tableCsv = sandbox.window.wmsWarehouse3D.googleTableToCsv({
    cols: [{ id: 'A', label: '랙코드' }, { id: 'B', label: '설명' }],
    rows: [{ c: [{ v: 'W01' }, { v: '쉼표, 포함' }] }]
});
assert.strictEqual(tableCsv, '랙코드,설명\nW01,"쉼표, 포함"', 'Google callback tables must convert to valid CSV.');
const csv = (title, headers, values) => [title, '', '', headers.join(','), values.join(',')].join('\n');
const converted = converter({
    floorPlan: csv('평면도', ['Y\\X', '0', '1', '2', '3', '4', '5'], ['10', '', '', '', '', 'W01', 'W01']),
    zones: csv('구역설정', ['구역코드', '구역명', '용도', '기본랙타입코드'], ['A01', '테스트 구역', '보관', 'TYPE-1']),
    rackTypes: csv('랙타입 마스터', ['랙타입코드', '랙타입명', '베이폭(mm)', '깊이(mm)', '전체높이(mm)', '단수', '단당높이(mm)', '깊이수'], ['TYPE-1', '테스트 랙', '2700', '1100', '6000', '4', '1400', '2']),
    racks: csv('랙배치', ['랙코드', '구역코드', '랙타입코드', '시작X(m)', '시작Y(m)', '방향', '베이수'], ['W01', 'A01', 'TYPE-1', '1', '2', '세로', '2'])
        + '\nW02,A01,TYPE-1,8,12,가로,2',
    locations: csv('로케이션 마스터', ['로케이션코드', '랙코드', '베이번호', '단번호', '최대수량'], ['A01-W01-01-01-01', 'W01', '1', '1', '12']),
    items: csv('품목 마스터', ['품목코드', '품목명', '분류', '표시색상', '가로(mm)', '세로(mm)', '높이(mm)'], ['P-1', '테스트 품목', '완제품', '#E74C3C', '1000', '800', '700']),
    inventory: csv('재고 현황', ['로케이션코드', '품목코드', '재고수량', '최대수량', '재고상태'], ['A01-W01-01-01-01', 'P-1', '8', '12', '주의'])
}, { documentId: warehouseBlock.googleSheet.documentId });
assert.strictEqual(sandbox.window.wmsWarehouse3D.validateWarehouseData(converted).length, 0, 'Converted Google Sheets data must pass warehouse validation.');
assert.strictEqual(converted.racks[0].startX, 4000, 'The floor plan X coordinate must override the rack placement coordinate.');
assert.strictEqual(converted.racks[0].startY, 10000, 'The floor plan Y coordinate must override the rack placement coordinate.');
assert.strictEqual(converted.racks[0].direction, 'horizontal', 'The floor plan cell shape must override the rack placement direction.');
assert.strictEqual(converted.racks[0].layoutSource, 'floorPlan', 'The rack must report the floor plan as its placement source.');
assert.strictEqual(converted.meta.floorPlanAppliedCount, 1, 'The applied floor plan rack count must be reported.');
assert.strictEqual(converted.racks.length, 1, 'A rack removed from the floor plan must not be rendered.');
assert.strictEqual(converted.meta.unplacedRackCodes[0], 'W02', 'A rack missing from the floor plan must be reported as unplaced.');
assert.strictEqual(converted.locations.length, 1, 'Converted location master rows must remain available for empty slot rendering.');
assert.strictEqual(converted.locations[0].depth, 1, 'A location without an explicit depth must default to depth 1.');
assert.strictEqual(converted.rackTypes[0].depthCount, 2, 'The rack depth count must be preserved for front/back slot boxes.');
assert.strictEqual(converted.inventory[0].status, 'warning', 'Korean inventory status must map to the 3D status.');

console.log('Warehouse 3D data and card checks passed.');
