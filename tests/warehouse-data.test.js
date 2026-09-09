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
assert.strictEqual(cards[0].editLocked, true, 'The 3D warehouse block must retain its system read-only metadata.');
assert.strictEqual(cards[0].lockSource, 'system', 'The 3D warehouse card must not be mistaken for a manual whole-card lock.');
assert.strictEqual(cards[0].contentBlocks[0].type, 'warehouse3d', 'The first card must use the warehouse3d block.');
assert.strictEqual(cards.length, 1, 'The 3D test menu must use the confirmed single-card structure.');
assert.strictEqual(cards[0].contentBlocks[0].dataSource, 'data/warehouse-demo.json', 'The first card 3D warehouse data source changed unexpectedly.');
const referenceMenu = published.storage.menus.menus.find((candidate) => candidate.id === 'custom-1788911575236');
assert.ok(referenceMenu, 'The reference data menu is missing.');
const referenceBlocks = published.storage.customCards[referenceMenu.id].flatMap((row) => row.cards || []).flatMap((card) => card.contentBlocks || []);
const referenceSheet = referenceBlocks.find((block) => block.type === 'googleDrive');
assert.ok(referenceSheet, 'The reference data menu must retain its Google Sheets block.');
const warehouseBlock = cards[0].contentBlocks[0];
const gicsDocumentId = '12G9JIftGIVStzWUxIVZrz0JZsJ858Mc90V7-fnfBiHM';
assert.strictEqual(warehouseBlock.googleSheet.documentId, gicsDocumentId, 'The 3D card must use WMS_기준정보_템플릿_GICS.');
assert.strictEqual(warehouseBlock.googleSheet.floorPlanCellSizeMeters, 0.5, 'The GICS floor-plan cell size must be 0.5m.');
assert.strictEqual(warehouseBlock.googleSheet.documentId, referenceSheet.documentId, 'The 3D warehouse and reference menu must use the same Google Sheets document.');
assert.ok(referenceSheet.url.startsWith(`https://docs.google.com/spreadsheets/d/${gicsDocumentId}/edit`), 'The Google Sheets block must open the GICS sheet.');
assert.deepStrictEqual(
    Object.values(warehouseBlock.googleSheet.sheets).sort(),
    ['평면도', '구역설정', '랙타입 마스터', '랙배치', '로케이션 마스터', '품목 마스터', '재고 현황'].sort(),
    'The required Google Sheets tabs changed unexpectedly.'
);

const patch = patches.patches.find((candidate) => candidate.id === 'three-test-warehouse-floor-plan-v5');
assert.ok(patch, 'The browser card patch is missing.');
assert.strictEqual(patch.menuId, menu.id, 'The browser card patch targets the wrong menu.');
assert.strictEqual(patch.readingIndex, 0, 'The browser card patch must target the first and only card.');
assert.strictEqual(patch.card.contentBlocks[0].googleSheet.documentId, warehouseBlock.googleSheet.documentId, 'The browser patch Google Sheets document changed unexpectedly.');
assert.strictEqual(patch.card.contentBlocks[1].documentId, warehouseBlock.googleSheet.documentId, 'The browser patch must retain the Google Sheets block inside the 3D card.');
assert.ok(patch.cleanupGeneratedCards.some((card) => card.title === '기준 정보'), 'The browser patch must remove the obsolete separate reference card.');
assert.ok(contentModel.includes("type: 'warehouse3d'"), 'The shared card model must register the warehouse3d block.');
assert.ok(cardRenderer.includes("block.type === 'warehouse3d'"), 'The shared renderer must render the warehouse3d block.');
assert.ok(cardRenderer.includes("if (block.type === 'warehouse3d') return '3D 창고 화면';"), 'The card editor must identify the 3D warehouse block as read-only content.');
assert.ok(cardRenderer.includes('blocks.push(copyPlainValue(readOnlyState.block));'), 'Saving card metadata must preserve the 3D warehouse block unchanged.');
assert.ok(cardRenderer.includes('disposeWithin'), '3D resources must be disposed before card rerendering.');
assert.ok(warehouseRenderer.includes('three@0.185.1'), 'Three.js must use the reviewed pinned version.');
assert.ok(warehouseRenderer.includes('validateWarehouseData'), 'Warehouse data validation must run before rendering.');
assert.ok(!warehouseRenderer.includes('new THREE.Fog'), 'The warehouse scene must not fade distant racks with fog.');
assert.ok(warehouseRenderer.includes("const fillLight = new THREE.DirectionalLight('#dbeafe', 1.35)"), 'The warehouse scene must use one reflected-light fill.');
assert.ok(warehouseRenderer.includes('fillLight.castShadow = false'), 'The fill light must not add shadow rendering cost.');
assert.ok(warehouseRenderer.includes('/gviz/tq?tqx=responseHandler:'), 'The warehouse loader must use the Google Sheets callback endpoint.');
assert.ok(warehouseRenderer.includes("range: 'A4:I'"), 'The rack sheet must load the GICS row 4 header and all nine columns.');
assert.ok(warehouseRenderer.includes('rackRowCount'), 'Floor-plan width must calculate the number of physical rack rows.');
assert.ok(warehouseRenderer.includes('outOfRangeLocationCodes'), 'Locations outside the calculated rack range must be reported.');
assert.ok(warehouseRenderer.includes("xAxisRange: 'A3:3'"), 'The floor plan loader must discover the final X coordinate from row 3.');
assert.ok(warehouseRenderer.includes("yAxisRange: 'A3:A'"), 'The floor plan loader must discover the final Y coordinate from column A.');
assert.ok(warehouseRenderer.includes('floorPlanAxis.range'), 'The floor plan loader must fetch the dynamically calculated grid range.');
assert.ok(!warehouseRenderer.includes('passageTiles'), 'T cells must not render as filled passage tiles.');
assert.ok(warehouseRenderer.includes('const passageBoundaryWidthMm = 100;'), 'Passage boundaries must be exactly 10cm wide.');
assert.ok(warehouseRenderer.includes('buildPassageBoundarySegments'), 'Passage boundaries must be derived from exposed T-cell edges.');
assert.ok(warehouseRenderer.includes("passageBoundaryMaterial = new THREE.MeshBasicMaterial({ color: '#facc15' });"), 'Only the passage boundary must retain the yellow marking.');
assert.ok(!warehouseRenderer.includes('zoneBoundaryEntries'), 'Zone-code boundary rendering must be removed.');
assert.ok(!warehouseRenderer.includes('zoneBoundaryMaterial'), 'Zone-code boundary material must be removed.');
assert.ok(!warehouseRenderer.includes('임시 데이터 표시 중'), 'A GICS connection failure must not silently render stale demo data.');
assert.ok(warehouseRenderer.includes("script.referrerPolicy = 'no-referrer'"), 'The public sheet callback must not send the local page as referrer.');
assert.ok(warehouseRenderer.includes("mode: event.button === 2 ? 'rotate' : 'pan'"), 'Right drag must rotate and left drag must pan.');
assert.ok(warehouseRenderer.includes("addEventListener('contextmenu'"), 'The 3D canvas must suppress the right-click menu.');
assert.ok(warehouseRenderer.includes('container.requestFullscreen'), 'The warehouse card must support entering fullscreen.');
assert.ok(warehouseRenderer.includes('document.exitFullscreen'), 'The warehouse card must support leaving fullscreen.');
assert.ok(cardRenderer.includes('warehouse-forklift-cycle-v19'), 'The shared renderer must reload the unmanned forklift work cycle.');
assert.ok(warehouseStyles.includes('.warehouse-3d-shell:fullscreen'), 'Fullscreen warehouse layout styles are missing.');
assert.ok(warehouseStyles.includes('height: 540px; min-height: 540px;'), 'The regular warehouse viewport must keep a stable height.');
assert.ok(warehouseStyles.includes('.warehouse-3d-shell:fullscreen .warehouse-3d-main { flex: 1; height: auto; min-height: 0; }'), 'Fullscreen must override the regular warehouse height.');
assert.ok(warehouseStyles.includes('cursor: default'), 'The 3D canvas must use the normal cursor.');
assert.ok(warehouseRenderer.includes('if (!viewportWidth || !viewportHeight) return;'), 'A hidden warehouse viewport must not trigger a resize.');
assert.ok(!warehouseRenderer.includes('warehouse-3d-reset'), 'The screen reset button must be removed.');
assert.strictEqual((warehouseRenderer.match(/data-warehouse-camera-view=/g) || []).length, 4, 'The viewport must provide exactly four camera view buttons.');
assert.ok(warehouseRenderer.includes('role="group" aria-label="카메라 투영 및 구도"'), 'Projection and camera view buttons must share one accessible group.');
assert.strictEqual((warehouseRenderer.match(/data-warehouse-projection-toggle/g) || []).length, 2, 'The camera group and shell reference must use one projection toggle.');
assert.ok(!warehouseRenderer.includes('data-warehouse-projection="'), 'Separate projection buttons must be removed.');
assert.ok(warehouseRenderer.includes('data-projection="perspective" aria-label="현재 Perspective. Orthographic으로 전환" aria-pressed="false"'), 'Perspective must be the default toggle state.');
assert.ok(warehouseRenderer.includes('warehouse-3d-projection-letter-p'), 'The projection toggle must show a P initial.');
assert.ok(warehouseRenderer.includes('warehouse-3d-projection-letter-o'), 'The projection toggle must show an O initial.');
assert.ok(!warehouseRenderer.includes('data-warehouse-projection-label'), 'Projection buttons must not display text labels.');
assert.ok(warehouseRenderer.includes('new THREE.OrthographicCamera'), 'The 3D viewport must create an orthographic camera.');
assert.ok(warehouseRenderer.includes('let camera = perspectiveCamera;'), 'The active camera must default to the perspective camera.');
assert.ok(warehouseRenderer.includes('const getPerspectiveViewHeight'), 'Projection switching must calculate an equivalent visible height.');
assert.ok(warehouseRenderer.includes('const applyProjectionMode = (nextMode) =>'), 'The projection toggle must switch its camera mode.');
assert.ok(warehouseRenderer.includes("if (projectionMode === 'orthographic')"), 'Orthographic wheel zoom must use its own visible-height control.');
assert.ok(warehouseRenderer.includes('orthographicCamera.left = -halfWidth;'), 'Viewport resizing must update orthographic bounds.');
assert.ok(warehouseRenderer.includes("shell.projectionToggle.setAttribute('aria-pressed', String(isOrthographic))"), 'The projection toggle must announce the selected state.');
assert.ok(warehouseRenderer.includes("applyProjectionMode(projectionMode === 'perspective' ? 'orthographic' : 'perspective')"), 'One projection toggle must switch between Perspective and Orthographic.');
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
assert.ok(!warehouseRenderer.includes("setActiveCameraView('')"), 'The selected camera view must remain active during canvas interaction and zoom.');
assert.ok(warehouseRenderer.includes('data-warehouse-grid-toggle'), 'The camera view group must include a Grid toggle button.');
assert.ok(warehouseRenderer.includes('grid.visible = Boolean(isVisible)'), 'The Grid toggle must control Grid visibility.');
assert.ok(warehouseRenderer.includes("aria-label', grid.visible ? 'Grid 숨기기' : 'Grid 표시'"), 'The Grid toggle must announce its current action.');
assert.ok(warehouseStyles.includes('.warehouse-3d-camera-views'), 'The camera buttons must be positioned as one viewport overlay group.');
assert.ok(!warehouseStyles.includes('.warehouse-3d-camera-controls'), 'The projection buttons must not be separated from the camera view group.');
assert.ok(warehouseStyles.includes('.warehouse-3d-projection-toggle[data-projection="orthographic"]'), 'The P/O icon colors must invert in Orthographic mode.');
assert.ok(warehouseStyles.includes('width: 36px; height: 36px;'), 'Projection icons must inherit the same desktop button size as the view buttons.');
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
assert.ok(warehouseRenderer.includes("color: '#78a98b'"), 'The 0.5m floor grid must use the coordinated green line color.');
assert.ok(warehouseRenderer.includes("color: '#2f7454'"), 'The rectangular warehouse boundary must use the coordinated green color.');
assert.ok(warehouseRenderer.includes('x += passageCellSize'), 'Floor grid columns must follow the 0.5m GICS cell size.');
assert.ok(warehouseRenderer.includes('z += passageCellSize'), 'Floor grid rows must follow the 0.5m GICS cell size.');
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
assert.ok(warehouseRenderer.includes('setSelectedRack(null); setFocusedRack(null); showSelection(slot);'), 'Selecting a slot must clear rack selection and restore every rack opacity.');
assert.ok(warehouseRenderer.includes('const worldUiResolutionScale = 2'), 'World-space UI must render at a 2x internal resolution.');
assert.ok(warehouseRenderer.includes('canvas.width = 256 * worldUiResolutionScale'), 'Rack billboards must use the 2x resolution scale.');
assert.ok(warehouseRenderer.includes('warehouse-3d-slot-tooltip'), 'Slot hover information must have a dedicated screen-space UI container.');

assert.ok(warehouseRenderer.includes('const labelTargets = []'), 'Rack billboards must have a separate priority hit-target list.');
assert.ok(warehouseRenderer.includes('labelTargets.push(label)'), 'Each rack billboard must be registered in the priority hit-target list.');
assert.ok(/if \(labelRack\) \{\s*setHoveredSlot\(null\);\s*setHoveredRack\(labelRack\);\s*return;\s*\}\s*const slot = getSlotAtPointer\(event\);/.test(warehouseRenderer), 'Billboard hover must run before slot hover detection.');
assert.ok(/if \(labelRack\) \{\s*setSelectedSlot\(null\);\s*setSelectedRack\(labelRack\);\s*setFocusedRack\(labelRack\);\s*focusRackInCurrentView\(labelRack\);\s*showSelection\(labelRack\);\s*return;\s*\}\s*const slot = getSlotAtPointer\(event\);/.test(warehouseRenderer), 'Billboard selection must isolate and fit the rack before slot selection.');
assert.ok(warehouseRenderer.includes("normal: { fill: 'rgba(5, 15, 30, 0.92)'"), 'Rack billboards must have a normal visual state.');
assert.ok(warehouseRenderer.includes("hover: { fill: 'rgba(15, 52, 96, 0.96)'"), 'Rack billboard hover must use a lighter blue based on the normal state.');
assert.ok(warehouseRenderer.includes("selected: { fill: '#2563EB'"), 'Rack billboard selected state must use a stronger blue based on the normal state.');
assert.ok(warehouseRenderer.includes("sprite.setInteractionState = (state = 'normal') =>"), 'Rack billboards must expose an animated interaction-state renderer.');
assert.ok(warehouseRenderer.includes("setRackLabelState(selectedRack, 'selected')"), 'Rack selection must update the billboard selected state.');
assert.ok(warehouseRenderer.includes('dimmedMaterial.opacity = 0.1'), 'Non-selected racks must use exactly 10% opacity.');
assert.ok(warehouseRenderer.includes('dimmedMaterial.depthWrite = false'), 'Dimmed racks must not obstruct the selected rack through depth writes.');
assert.ok(warehouseRenderer.includes('originalMaterialsByObject'), 'Rack focus must preserve shared original materials for restoration.');
assert.ok(warehouseRenderer.includes('setFocusedRack(labelRack)'), 'Selecting a rack billboard must isolate the selected rack.');
assert.ok(warehouseRenderer.includes('focusRackInCurrentView(labelRack)'), 'Selecting a rack billboard must fit it in the current camera view.');
assert.ok(warehouseRenderer.includes('setFocusedRack(null); showSelection(slot)'), 'Selecting a slot must restore all rack opacity.');
assert.ok(warehouseRenderer.includes('if (focusedRack && !focusedEntry?.group.visible)'), 'Filtering out the focused rack must clear rack isolation.');
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
assert.ok(warehouseRenderer.includes('amrIsActive && shell.viewport.clientWidth && shell.viewport.clientHeight'), 'AMR animation frames must continue only while the warehouse viewport is visible.');
assert.ok(warehouseRenderer.includes('const fadeWorldObject ='), 'World-space UI outlines and labels must share the fade transition helper.');
assert.ok(warehouseRenderer.includes('const updateHoverTooltipPosition = ()'), 'Slot hover information must project its world anchor into the screen viewport.');
assert.ok(warehouseRenderer.includes('fadeWorldObject(hoveredRack.outlines.hover, true, { reset: true })'), 'Rack hover outlines must fade in smoothly.');
assert.ok(warehouseRenderer.includes('fadeWorldObject(selectedRack.outlines.selected, true, { duration: 180, reset: true })'), 'Rack selected outlines must fade in smoothly.');
assert.ok(warehouseRenderer.includes('hoveredSlot.group.localToWorld(anchor)'), 'The tooltip anchor must follow the hovered slot in world space.');
assert.ok(warehouseRenderer.includes('const projected = anchor.project(camera)'), 'The tooltip must convert world coordinates into screen coordinates.');
assert.ok(warehouseRenderer.includes("tooltip.classList.toggle('is-offscreen', isOutsideViewport)"), 'The tooltip must hide when its slot is outside the camera view.');
assert.ok(warehouseStyles.includes('.warehouse-3d-slot-tooltip'), 'The screen-space slot tooltip must have its own viewport style.');
assert.ok(/drawLabel\('normal'\);\s*applyScale\(displayedScale\);/.test(warehouseRenderer), 'Rack billboards must apply their normal scale before any interaction.');
const sandbox = {
    window: { dispatchEvent() {} },
    Event: function Event() {}
};
vm.runInNewContext(warehouseRenderer, sandbox);
const converter = sandbox.window.wmsWarehouse3D.convertGoogleSheetCsv;
const getFloorPlanAxisRange = sandbox.window.wmsWarehouse3D.getFloorPlanAxisRange;
const calculateZoneFloorBounds = sandbox.window.wmsWarehouse3D.calculateZoneFloorBounds;
const buildPassageBoundarySegments = sandbox.window.wmsWarehouse3D.buildPassageBoundarySegments;
const buildPassageNavigationGraph = sandbox.window.wmsWarehouse3D.buildPassageNavigationGraph;
const findPassagePath = sandbox.window.wmsWarehouse3D.findPassagePath;
const findNearestPassageNode = sandbox.window.wmsWarehouse3D.findNearestPassageNode;
const getForkTargetHeight = sandbox.window.wmsWarehouse3D.getForkTargetHeight;
const getForkliftTaskSequence = sandbox.window.wmsWarehouse3D.getForkliftTaskSequence;
const calculateRackFocusView = sandbox.window.wmsWarehouse3D.calculateRackFocusView;
const getSlotVisualKey = sandbox.window.wmsWarehouse3D.getSlotVisualKey;
const floorPlanAxis = JSON.parse(JSON.stringify(getFloorPlanAxisRange(
    ['Y\\X', ...Array.from({ length: 111 }, (_, index) => index + 1), '', '', ''].join(','),
    ['Y\\X', ...Array.from({ length: 66 }, (_, index) => index + 1)].join('\n')
)));
assert.deepStrictEqual(floorPlanAxis, {
    range: 'A3:DH69',
    dataRange: 'B4:DH69',
    xCount: 111,
    yCount: 66
}, 'The current DH3 and A69 axes must resolve to A3:DH69.');
assert.throws(
    () => getFloorPlanAxisRange('Y\\X,1,3', 'Y\\X\n1'),
    /평면도 X축은 1부터 빈칸 없이 연속된 숫자여야 합니다/,
    'A skipped axis coordinate must stop an ambiguous floor-plan load.'
);
const frontRackFocus = JSON.parse(JSON.stringify(calculateRackFocusView({
    min: { x: 0, y: 0, z: 0 },
    max: { x: 2, y: 6, z: 1 }
}, { yaw: 0, pitch: 0, aspect: 1, verticalFovDegrees: 45, padding: 1.12 })));
assert.deepStrictEqual(frontRackFocus.center, { x: 1, y: 3, z: 0.5 }, 'Rack focus must target the physical rack center.');
assert.ok(Math.abs(frontRackFocus.perspectiveDistance - 8.6117575695736) < 0.000001, 'Perspective focus must fit the rack height with padding.');
assert.ok(Math.abs(frontRackFocus.orthographicViewHeight - 6.72) < 0.000001, 'Orthographic focus must fit the rack height with padding.');
const contiguousPassageBoundary = JSON.parse(JSON.stringify(buildPassageBoundarySegments([
    { x: 0, y: 0 },
    { x: 500, y: 0 }
], 500, 100)));
assert.deepStrictEqual(contiguousPassageBoundary, [
    { side: 'top', x: 250, y: 50, width: 500, depth: 100 },
    { side: 'bottom', x: 250, y: 450, width: 500, depth: 100 },
    { side: 'left', x: 50, y: 250, width: 100, depth: 500 },
    { side: 'top', x: 750, y: 50, width: 500, depth: 100 },
    { side: 'bottom', x: 750, y: 450, width: 500, depth: 100 },
    { side: 'right', x: 950, y: 250, width: 100, depth: 500 }
], 'Adjacent T cells must share no internal boundary and every 10cm strip must stay inside the passage.');
const crossPassageCells = [];
for (let cellX = 0; cellX < 16; cellX += 1) {
    for (let cellY = 6; cellY < 10; cellY += 1) crossPassageCells.push({ x: cellX * 500, y: cellY * 500 });
}
for (let cellX = 6; cellX < 10; cellX += 1) {
    for (let cellY = 0; cellY < 16; cellY += 1) crossPassageCells.push({ x: cellX * 500, y: cellY * 500 });
}
const passageNavigation = buildPassageNavigationGraph(crossPassageCells, 500, 1600);
assert.ok(passageNavigation.nodesByKey.has('4:16'), 'A 1.6m AMR must fit near the center of a 2m horizontal passage.');
assert.ok(passageNavigation.nodesByKey.has('16:4'), 'A 1.6m AMR must fit near the center of a 2m vertical passage.');
const crossPassagePath = findPassagePath(passageNavigation, '4:16', '16:4');
assert.strictEqual(crossPassagePath[0].key, '4:16', 'A* must preserve the requested start node.');
assert.strictEqual(crossPassagePath[crossPassagePath.length - 1].key, '16:4', 'A* must reach the requested destination through the intersection.');
crossPassagePath.slice(1).forEach((node, index) => {
    const previous = crossPassagePath[index];
    assert.strictEqual(Math.abs(node.gridX - previous.gridX) + Math.abs(node.gridY - previous.gridY), 1, 'Every A* step must stay on an adjacent passage node.');
});
const narrowPassage = Array.from({ length: 12 }, (_, cellX) => Array.from({ length: 3 }, (unused, cellY) => ({ x: cellX * 500, y: cellY * 500 }))).flat();
assert.strictEqual(buildPassageNavigationGraph(narrowPassage, 500, 1600).nodes.length, 0, 'A 1.6m AMR must not enter a passage narrower than its diameter.');
assert.ok(warehouseRenderer.includes('const amrCount = 5;'), 'The warehouse scene must create exactly five AMRs.');
assert.ok(warehouseRenderer.includes('const forkliftClearanceDiameterMm = 1950;'), 'Unmanned forklifts must use their full turning envelope inside a 2m passage.');
const forkliftNavigation = buildPassageNavigationGraph(crossPassageCells, 500, 1950);
assert.ok(findPassagePath(forkliftNavigation, '4:16', '16:4').length > 0, 'A 1.95m forklift turning envelope must remain connected through a 2m cross passage.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.amrPathfinding = amrFleet.length ? 'astar' : 'unavailable';"), 'The viewport must expose the active A* navigation state for verification.');
assert.ok(warehouseRenderer.includes('· 무인 지게차 ${amrFleet.length}대'), 'The warehouse summary must show the active unmanned forklift count.');
assert.ok(warehouseRenderer.includes("group.name = `FORKLIFT-AMR-${index + 1}`;"), 'The round AMR model must be replaced with an unmanned forklift group.');
assert.ok(warehouseRenderer.includes("mastGroup.name = 'forklift-mast';"), 'The unmanned forklift must have a visible mast.');
assert.ok(warehouseRenderer.includes("forkAssembly.name = 'forklift-forks';"), 'The unmanned forklift must have a separately animated fork assembly.');
assert.ok(warehouseRenderer.includes("if (amr.state === 'driving')"), 'The unmanned forklift must use an explicit operation state machine.');
assert.ok(warehouseRenderer.includes("setForkliftState(amr, 'lifting', timestamp)"), 'Fork lifting must begin only after rack-facing alignment.');
assert.ok(warehouseRenderer.includes("setForkliftState(amr, 'retracting', timestamp)"), 'Forks must retract after picking or placing.');
assert.ok(warehouseRenderer.includes('moveToward(amr.forkHeight, travelForkHeight'), 'Forks must return to travel height while driving.');
assert.ok(warehouseRenderer.includes('setSlotInstanceVisible(target.slot, false)'), 'Picking must hide only the selected stored box instance.');
const firstLevelForkHeight = getForkTargetHeight({ position: [0, 0.72, 0], boxSize: [1, 1.2, 1] }, 0.06);
const highestLevelForkHeight = getForkTargetHeight({ position: [0, 5.62, 0], boxSize: [1, 1.2, 1] }, 0.06);
assert.ok(Math.abs(firstLevelForkHeight - 0.09) < 0.000001, 'The first-level fork height must stop immediately under the box.');
assert.ok(Math.abs(highestLevelForkHeight - 4.99) < 0.000001, 'The highest-level fork height must use the actual stored box bottom.');
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(getForkliftTaskSequence('picking'))),
    ['driving', 'aligning', 'lifting', 'extending', 'picking', 'retracting', 'lowering', 'waiting'],
    'Picking must follow the safe drive-align-lift-extend-retract-lower sequence.'
);
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(getForkliftTaskSequence('putaway'))),
    ['driving', 'aligning', 'lifting', 'extending', 'placing', 'retracting', 'lowering', 'waiting'],
    'Putaway must use the same safe fork sequence with a placing action.'
);
assert.strictEqual(findNearestPassageNode(passageNavigation, 1000, 4000, 400)?.key, '4:16', 'Docking must snap a rack approach point to its nearest safe passage node.');
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
const axisCsvWithTrailingBlankColumns = sandbox.window.wmsWarehouse3D.googleTableToCsv({
    cols: [{ id: 'A', label: 'Y\\X' }, { id: 'B', label: '1' }, { id: 'DI', label: '' }],
    rows: []
});
assert.strictEqual(
    axisCsvWithTrailingBlankColumns,
    'Y\\X,1,',
    'A blank axis header must not be replaced with its internal Google column id.'
);
const csv = (title, headers, values) => [title, '', '', headers.join(','), values.join(',')].join('\n');
const converted = converter({
    floorPlan: [
        '평면도', '', 'Y\\X,1,2,3,4,5,6',
        '1,T,F,F,F,F,F',
        '2,F,W01,W01,W01,W01,W01',
        '3,F,W01,W01,W01,W01,W01',
        '4,F,W01,W01,W01,W01,W01'
    ].join('\n'),
    zones: csv('구역설정', ['구역코드', '구역명', '용도', '기본랙타입코드'], ['A01', '테스트 구역', '완제품 보관', 'TYPE-1']),
    rackTypes: csv('랙타입 마스터', ['랙타입코드', '랙타입명', '베이폭(m)', '깊이(m)', '전체높이(m)', '단수', '단당높이(m)', '깊이수'], ['TYPE-1', '테스트 랙', '1.23', '1.23', '6.00', '4', '1.40', '2']),
    racks: csv('랙배치', ['랙코드', '구역코드', '랙타입코드', '방향', '베이 수(가로 칸 수)', '랙 전체 길이(m)', '랙깊이(m)', '평면도 랙 전체 길이(m)', '평면도 랙 깊이(m)'], ['W01', 'A01', 'TYPE-1', '가로', '2', '2.46', '1.23', '2.5', '1.5'])
        + '\nW02,A01,TYPE-1,가로,2,2.46,1.23,2.5,1.5',
    locations: csv('로케이션 마스터', ['로케이션코드', '랙코드', '베이번호', '단번호', '깊이번호', '최대수량', '랙열번호'], ['A01-W01-01-01-01', 'W01', '1', '1', '1', '12', '1']),
    items: csv('품목 마스터', ['품목코드', '품목명', '표시색상'], ['P-1', '테스트 품목', '#E74C3C']),
    inventory: csv('재고 현황', ['로케이션코드', '품목코드', '재고수량', '재고상태'], ['A01-W01-01-01-01', 'P-1', '8', '주의'])
}, {
    documentId: warehouseBlock.googleSheet.documentId,
    floorPlanCellSizeMeters: 0.5,
    floorPlanAxis: { range: 'A3:G8', dataRange: 'B4:G8', xCount: 6, yCount: 5 }
});
assert.strictEqual(sandbox.window.wmsWarehouse3D.validateWarehouseData(converted).length, 0, 'Converted Google Sheets data must pass warehouse validation.');
assert.strictEqual(converted.rackTypes[0].bayWidth, 1230, 'Meter-based rack widths must be converted to internal millimeters.');
assert.strictEqual(converted.inventory[0].capacity, 12, 'Inventory capacity must be read from the location master.');
assert.strictEqual(converted.racks[0].startX, 520, 'The 0.5m floor-plan X coordinate and rounding gap must center the rack.');
assert.strictEqual(converted.racks[0].startY, 635, 'The 0.5m floor-plan Y coordinate and rounding gap must center the rack.');
assert.strictEqual(converted.racks[0].direction, 'horizontal', 'The floor plan cell shape must override the rack placement direction.');
assert.strictEqual(converted.racks[0].layoutSource, 'floorPlan', 'The rack must report the floor plan as its placement source.');
assert.strictEqual(converted.racks[0].bayCount, 2, 'The floor-plan length must calculate the number of full standard bays.');
assert.strictEqual(converted.racks[0].rackRowCount, 1, 'The GICS rack depth must produce one physical rack row.');
assert.strictEqual(converted.racks[0].floorPlan.remainingLength, 40, 'The 0.5m ceiling gap along the rack length must remain measurable.');
assert.strictEqual(converted.racks[0].floorPlan.remainingWidth, 270, 'The 0.5m ceiling gap along the rack depth must remain measurable.');
assert.strictEqual(converted.meta.floorPlanAppliedCount, 1, 'The applied floor plan rack count must be reported.');
assert.strictEqual(converted.meta.floorPlanCellSize, 500, 'The internal floor-plan cell size must be 500mm.');
assert.strictEqual(converted.meta.floorPlanRange, 'A3:G8', 'The resolved floor-plan source range must remain inspectable.');
assert.strictEqual(converted.meta.floorWidth, 3000, 'Six populated floor-plan columns must create a 3m floor.');
assert.strictEqual(converted.meta.floorDepth, 2500, 'The five-row Y axis must create a 2.5m floor even when its final row is blank.');
assert.strictEqual(converted.meta.warehouseCellCount, 24, 'Every populated F, T, and rack cell must count as warehouse area.');
assert.strictEqual(converted.meta.warehouseGapCount, 6, 'Blank cells inside the recognized axis range must remain valid unassigned floor cells.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.passageCells)), [{ x: 0, y: 0 }], 'T must be stored as a passage coordinate, not a rack.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.unmappedFloorRackCodes)), [], 'F and T must not be reported as unknown rack codes.');
assert.strictEqual(converted.racks.length, 1, 'A rack removed from the floor plan must not be rendered.');
assert.strictEqual(converted.meta.unplacedRackCodes[0], 'W02', 'A rack missing from the floor plan must be reported as unplaced.');
assert.strictEqual(converted.locations.length, 1, 'Converted location master rows must remain available for empty slot rendering.');
assert.strictEqual(converted.locations[0].depth, 1, 'A location without an explicit depth must default to depth 1.');
assert.strictEqual(converted.locations[0].rackRow, 1, 'A location without a row value must use the first rack row.');
assert.strictEqual(converted.rackTypes[0].depthCount, 2, 'The rack depth count must be preserved for front/back slot boxes.');
assert.strictEqual(converted.inventory[0].status, 'warning', 'Korean inventory status must map to the 3D status.');
const zoneBounds = calculateZoneFloorBounds(converted.racks, converted.rackTypes, 500, 100);
assert.deepStrictEqual(JSON.parse(JSON.stringify(zoneBounds)), [{ zoneCode: 'A01', minX: -30, maxX: 3530, minY: 85, maxY: 2415 }], 'A 10cm zone boundary must preserve a 50cm clear gap from the centered rack.');

console.log('Warehouse 3D data and card checks passed.');
