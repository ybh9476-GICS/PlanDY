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
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseSafetyLines = 'true';"), 'The requested warehouse scene must display passage boundary lines.');
assert.ok(warehouseRenderer.includes('const passageBoundaryWidthMm = 100;'), 'Passage boundaries must retain the requested 100mm width.');
assert.ok(warehouseRenderer.includes('const passageBoundaryInsetMm = 100;'), 'Passage boundaries must be inset 100mm from the passage edge.');
assert.ok(warehouseRenderer.includes("const dockCodeMatch = /^D(\\d+)$/.exec(normalizedValue);"), 'Any D-prefixed numeric code must be parsed as a numbered loading dock coordinate.');
assert.ok(warehouseRenderer.includes("if (normalizedValue === 'S') stationCells.push({ x, y });"), 'S must be parsed as an inbound/outbound station coordinate.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.warehouseStationCellCount'), 'The viewport must expose the station cell count for browser verification.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseDockCodes"), 'The viewport must expose the numbered loading dock codes for browser verification.');
assert.ok(!warehouseRenderer.includes("WAREHOUSE-LOADING-DOCK';"), 'The loading dock must not render a separate filled area object.');
assert.ok(warehouseRenderer.includes('const dockBoundarySegments = buildPassageBoundarySegments('), 'The loading dock must reuse the passage boundary segment builder.');
assert.ok(warehouseRenderer.includes("dockBoundaryMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });"), 'The loading dock boundary must use a white line material.');
assert.ok(warehouseRenderer.includes("dockBoundaries.name = 'WAREHOUSE-LOADING-DOCK-LINES';"), 'The loading dock line group must remain identifiable during browser verification.');
assert.ok(warehouseRenderer.includes('dockBoundaryGeometry?.dispose();'), 'Leaving the page must dispose loading dock boundary geometry.');
assert.ok(warehouseRenderer.includes('dockBoundaryMaterial?.dispose();'), 'Leaving the page must dispose loading dock boundary material.');
assert.ok(warehouseRenderer.includes("passageBoundaryMaterial = new THREE.MeshBasicMaterial({ color: '#facc15' });"), 'Passage boundaries must use the visible yellow line material.');
assert.ok(warehouseRenderer.includes('passageBoundaryGeometry?.dispose();'), 'Leaving the page must dispose passage boundary geometry.');
assert.ok(warehouseRenderer.includes('passageBoundaryMaterial?.dispose();'), 'Leaving the page must dispose passage boundary material.');
assert.ok(warehouseRenderer.includes("enclosure.name = 'WAREHOUSE-ENCLOSURE';"), 'The warehouse scene must include an enclosure group.');
assert.strictEqual((warehouseRenderer.match(/'WAREHOUSE-WALL-(?:BACK|FRONT|LEFT|RIGHT)'/g) || []).length, 4, 'The warehouse enclosure must define all four floor-plan boundary walls.');
assert.ok(warehouseRenderer.includes("if (side !== openWallSide) addEnclosurePlane"), 'The wall nearest W04 must be omitted from the enclosure.');
assert.ok(warehouseRenderer.includes("addEnclosurePlane('WAREHOUSE-CEILING'"), 'The warehouse enclosure must include a ceiling.');
assert.ok(warehouseRenderer.includes("[floorWidth / 2, warehouseHeight / 2, 0]"), 'The back wall must align with the floor-plan boundary.');
assert.ok(warehouseRenderer.includes("[floorWidth / 2, warehouseHeight / 2, floorDepth]"), 'The front wall must align with the floor-plan boundary.');
assert.ok(warehouseRenderer.includes("[0, warehouseHeight / 2, floorDepth / 2]"), 'The left wall must align with the floor-plan boundary.');
assert.ok(warehouseRenderer.includes("[floorWidth, warehouseHeight / 2, floorDepth / 2]"), 'The right wall must align with the floor-plan boundary.');
assert.ok(!warehouseRenderer.includes('enclosurePadding'), 'Warehouse walls must not remain outside the reference floor-plan boundary.');
assert.ok(warehouseRenderer.includes("const wallColumnSpacing = 4;"), 'Wall columns must repeat at approximately four-metre intervals.');
assert.ok(warehouseRenderer.includes("'WAREHOUSE-WALL-COLUMN'"), 'The enclosure must include structural wall columns.');
assert.ok(warehouseRenderer.includes("addEnclosureBox('WAREHOUSE-WALL-GIRT'"), 'The enclosure must include horizontal wall reinforcement.');
assert.ok(warehouseRenderer.includes("addEnclosureBox('WAREHOUSE-CEILING-BEAM-X'"), 'The ceiling must include transverse structural beams.');
assert.ok(warehouseRenderer.includes("addEnclosureBox('WAREHOUSE-CEILING-BEAM-Z'"), 'The ceiling must include longitudinal structural beams.');
assert.ok(/const structuralSteelMaterial[\s\S]*?color: '#556371'/.test(warehouseRenderer), 'Columns and beams must use the requested structural color.');
assert.ok(/const wallMaterial[\s\S]*?color: '#607080'/.test(warehouseRenderer), 'Changing structural color must preserve the wall surface color.');
assert.ok(warehouseRenderer.includes("'WAREHOUSE-CEILING-LIGHT-HOUSING'"), 'Ceiling lights must include visible housings.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseFloorAligned = 'true';"), 'The viewport must expose floor-boundary alignment for browser verification.');
assert.ok(warehouseRenderer.includes('const warehouseFloorElevation = 1.2;'), 'The warehouse floor top must be 1.2m above ground.');
assert.ok(warehouseRenderer.includes('new THREE.BoxGeometry(floorWidth, warehouseFloorElevation, floorDepth)'), 'The raised warehouse floor must have visible height instead of remaining a plane.');
assert.ok(warehouseRenderer.includes("floor.name = 'WAREHOUSE-RAISED-FLOOR';"), 'The raised floor must remain identifiable during browser verification.');
assert.ok(warehouseRenderer.includes('enclosure.position.y = warehouseFloorElevation;'), 'Walls and the ceiling must rise with the warehouse floor.');
assert.ok(warehouseRenderer.includes("truck.name = 'WAREHOUSE-STATIC-5T-TRUCK';"), 'The loading side must include a static five-ton box truck.');
assert.ok(warehouseRenderer.includes("cargoDimensions: { length: 6.2, width: 2.2, height: 2.3 }"), 'The truck cargo box must retain the requested reference dimensions.');
assert.ok(warehouseRenderer.includes('const createCabGeometry = () => {'), 'The truck must use one low-poly cab-over shell.');
assert.ok(warehouseRenderer.includes("addPart('truck-cab-shell', createCabGeometry()"), 'The sloped cab shell must replace stacked rectangular cab boxes.');
assert.ok(warehouseRenderer.includes("box('truck-windshield', [1.72, 0.9, 0.045]"), 'The simplified truck must include a broad sloped windshield.');
assert.ok(warehouseRenderer.includes("new THREE.ShapeGeometry(sideWindowShape)"), 'The cab must include trapezoidal side windows from the reference silhouette.');
assert.ok(!warehouseRenderer.includes("truck-cab-lower"), 'The old stacked lower cab box must be removed.');
assert.ok(!warehouseRenderer.includes("truck-cab-upper"), 'The old stacked upper cab box must be removed.');
assert.ok(!warehouseRenderer.includes("truck-cargo-vertical-trim"), 'The cargo box sides must remain plain like the reference.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseTruck = staticTruck ? 'static-5t' : 'none';"), 'The viewport must expose truck availability for browser verification.');
assert.ok(warehouseRenderer.includes("loadingYard.name = 'WAREHOUSE-LOADING-YARD';"), 'The truck approach must include a ground-level loading yard.');
assert.ok(warehouseRenderer.includes("loadingYard.position.set(mm(loadingYardLayout.centerX), -0.06"), 'The loading yard top must remain at ground height zero.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseLoadingYard = loadingYard ? 'true' : 'false';"), 'The viewport must expose loading-yard availability for browser verification.');
assert.ok(warehouseRenderer.includes("group.name = `WAREHOUSE-WALL-STRUCTURE-${side.toUpperCase()}`;"), 'Every wall direction must own a separate structure group.');
assert.ok(warehouseRenderer.includes("ceilingStructureGroup.name = 'WAREHOUSE-CEILING-STRUCTURE';"), 'Ceiling beams and light housings must use a separate visibility group.');
assert.ok(warehouseRenderer.includes('updateWarehouseStructureVisibility();'), 'Camera changes must update structure visibility.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseOcclusionMode = 'camera-aware';"), 'The viewport must expose camera-aware structure occlusion for browser verification.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseStructureShadows = 'false';"), 'The viewport must expose disabled enclosure shadows for browser verification.');
assert.ok(
    /const addEnclosureBox[\s\S]*?mesh\.castShadow = false;[\s\S]*?return mesh;/.test(warehouseRenderer),
    'Wall columns and ceiling structures must not cast shadows onto the warehouse floor.'
);
assert.ok(warehouseRenderer.includes('side: THREE.BackSide'), 'The ceiling must remain visible from inside without blocking the overhead view.');
assert.ok(warehouseRenderer.includes("const wallTexture = createPanelTexture('wall');"), 'The warehouse walls must use a panel surface texture.');
assert.ok(!warehouseRenderer.includes("const ceilingTexture = createPanelTexture('ceiling');"), 'The ceiling must not create a different surface texture.');
assert.ok(warehouseRenderer.includes('const ceilingMaterial = wallMaterial.clone();'), 'The ceiling must clone every wall material property.');
assert.ok(warehouseRenderer.includes('ceilingMaterial.side = THREE.BackSide;'), 'The matching ceiling material must remain visible from inside.');
assert.ok(warehouseRenderer.includes("new THREE.AmbientLight('#c7dcef', 0.48)"), 'The warehouse enclosure must receive balanced ambient light.');
assert.ok(warehouseRenderer.includes('renderer.toneMapping = THREE.ACESFilmicToneMapping;'), 'The renderer must use filmic tone mapping.');
assert.ok(warehouseRenderer.includes('renderer.shadowMap.type = THREE.PCFSoftShadowMap;'), 'The renderer must use soft shadow maps.');
assert.ok(warehouseRenderer.includes('enclosureResources.forEach((resource) => resource.dispose());'), 'Leaving the page must dispose enclosure resources.');
assert.ok(!warehouseRenderer.includes('zoneBoundaryEntries'), 'Zone-code boundary rendering must be removed.');
assert.ok(!warehouseRenderer.includes('zoneBoundaryMaterial'), 'Zone-code boundary material must be removed.');
assert.ok(!warehouseRenderer.includes('임시 데이터 표시 중'), 'A GICS connection failure must not silently render stale demo data.');
assert.ok(warehouseRenderer.includes("script.referrerPolicy = 'no-referrer'"), 'The public sheet callback must not send the local page as referrer.');
assert.ok(warehouseRenderer.includes("mode: event.button === 2 ? 'rotate' : 'pan'"), 'Right drag must rotate and left drag must pan.');
assert.ok(warehouseRenderer.includes("addEventListener('contextmenu'"), 'The 3D canvas must suppress the right-click menu.');
assert.ok(warehouseRenderer.includes('container.requestFullscreen'), 'The warehouse card must support entering fullscreen.');
assert.ok(warehouseRenderer.includes('document.exitFullscreen'), 'The warehouse card must support leaving fullscreen.');
assert.ok(cardRenderer.includes('warehouse-kpi-split-v57'), 'The shared renderer must load the current warehouse renderer.');
assert.ok(warehouseRenderer.includes('class="warehouse-3d-brand" aria-label="TEST, WMS Test Monitoring"'), 'The top-left toolbar must contain an accessible warehouse brand.');
assert.ok(warehouseRenderer.includes('class="warehouse-3d-brand-symbol"'), 'The temporary warehouse brand symbol must be rendered as a square element.');
assert.ok(warehouseRenderer.includes('<strong>TEST</strong>'), 'The warehouse brand must display TEST.');
assert.ok(warehouseRenderer.includes('<small>WMS Test Monitoring</small>'), 'The warehouse brand must display its description.');
assert.ok(warehouseStyles.includes('.warehouse-3d-brand-symbol'), 'The temporary square symbol must have a dedicated style.');
assert.ok(warehouseStyles.includes('flex: 0 0 26px; width: 26px; height: 26px;'), 'The temporary symbol must retain its compact square dimensions.');
assert.ok(warehouseRenderer.includes('class="warehouse-3d-kpi-list" role="list" aria-label="창고 운영 현황"'), 'The centered toolbar must contain an accessible KPI card list.');
['전체 적재율', '가용 셀', '입고 진행', '입고 완료', '입고 배정/요청', '출고 진행', '출고 완료', '출고 배정/요청', '미처리 알람'].forEach((label) => {
    assert.ok(warehouseRenderer.includes(label), `The toolbar KPI list must include ${label}.`);
});
assert.strictEqual((warehouseRenderer.match(/class="warehouse-3d-kpi-card/g) || []).length, 9, 'The toolbar must display nine KPI cards.');
assert.ok(warehouseRenderer.includes('role="progressbar" aria-label="전체 적재율"'), 'The utilization card must expose an accessible progress value.');
assert.ok(warehouseStyles.includes('grid-template-columns: repeat(9, minmax(0, 1fr));'), 'Desktop KPI cards must remain centered in one row.');
assert.ok(warehouseStyles.includes('@media (max-width: 1740px)'), 'KPI cards must move to a dedicated centered row before they overlap the toolbar actions.');
assert.ok(!warehouseRenderer.includes('warehouse-3d-zone-filter'), 'The top toolbar zone dropdown must be removed.');
assert.ok(!warehouseRenderer.includes('warehouse-3d-search-label'), 'The top toolbar rack and item search must be removed.');
assert.ok(!warehouseRenderer.includes('class="warehouse-3d-search"'), 'The removed top toolbar search input must not remain in the shell.');
assert.ok(warehouseRenderer.includes('class="warehouse-3d-object-search"'), 'The left hierarchy search must remain available.');
assert.ok(warehouseRenderer.includes('<time class="warehouse-3d-current-time" aria-label="현재 시간"></time>'), 'The top-right area must show the current time.');
assert.ok(
    warehouseRenderer.indexOf('<time class="warehouse-3d-current-time"') < warehouseRenderer.indexOf('<button class="warehouse-3d-reload"')
        && warehouseRenderer.indexOf('<button class="warehouse-3d-reload"') < warehouseRenderer.indexOf('<button class="warehouse-3d-fullscreen"'),
    'Current time, sheet refresh, and fullscreen actions must appear in that order.'
);
assert.ok(warehouseRenderer.includes('<button class="warehouse-3d-reload" type="button" aria-label="시트 새로고침" title="시트 새로고침" hidden>'), 'Sheet refresh must be an accessible icon button.');
assert.ok(warehouseRenderer.includes('<button class="warehouse-3d-fullscreen" type="button" aria-label="전체화면" title="전체화면" aria-pressed="false">'), 'Fullscreen must be an accessible icon button.');
assert.ok(!warehouseRenderer.includes('hidden>시트 새로고침</button>'), 'Sheet refresh must not show a text label.');
assert.ok(!warehouseRenderer.includes('aria-pressed="false">전체화면</button>'), 'Fullscreen must not show a text label.');
assert.ok(!warehouseRenderer.includes('shell.fullscreen.textContent'), 'Fullscreen state changes must preserve its SVG icon.');
assert.ok(warehouseRenderer.includes("shell.fullscreen.setAttribute('aria-label', label)"), 'Fullscreen state must still have an accessible name.');
assert.ok(!warehouseRenderer.includes('warehouse-3d-count'), 'The former top-right object summary must be removed.');
assert.ok(warehouseRenderer.includes('shell.currentTime.textContent = formatLocalDateTime(now);'), 'The date-time label must refresh from the local clock.');
assert.ok(warehouseRenderer.includes("].join('-') + ' ' + ["), 'The date and time must use YYYY-MM-DD HH:mm:ss separators.');
assert.ok(warehouseRenderer.includes('const currentTimeTimer = setInterval(updateCurrentTime, 1000);'), 'The current time must refresh every second.');
assert.ok(warehouseRenderer.includes('clearInterval(currentTimeTimer);'), 'Leaving the 3D screen must stop its clock timer.');
assert.ok(warehouseRenderer.includes('<aside class="warehouse-3d-side-panel warehouse-3d-side-panel-left" aria-label="객체 선택 패널">'), 'The left-side panel must contain the object selector.');
assert.ok(warehouseRenderer.includes('class="warehouse-3d-zone-buttons warehouse-3d-object-list" aria-label="창고 객체 탐색"'), 'Object selection buttons must be grouped accessibly.');
assert.ok(warehouseRenderer.includes("const selectableZones = data.zones.filter"), 'Zone buttons must be generated from zones that have a visible 3D rack footprint.');
assert.ok(warehouseRenderer.includes("selectableZones.map((zone) =>"), 'Only current 3D warehouse zones must receive selection buttons.');
assert.ok(warehouseRenderer.includes("calculateZoneFloorBounds(data.racks, data.rackTypes, 500)"), 'Zone volumes must be based on rack footprints with a 0.5m margin.');
assert.ok(warehouseRenderer.includes("opacity: 0.08"), 'Selected zone volumes must remain lightly transparent.');
assert.ok(warehouseRenderer.includes("depthWrite: false"), 'Zone volumes must not hide or corrupt depth-rendered warehouse objects.');
assert.ok(!warehouseRenderer.includes("clickTargets.push(mesh);\n            zoneVisualizationEntries"), 'Zone volumes must not become viewport click targets.');
assert.ok(warehouseRenderer.includes("const showZoneSelection = (zoneCode) =>"), 'Zone selection must populate the right information panel.');
assert.ok(warehouseRenderer.includes("entry.mesh.visible = isSelected || isHovered;"), 'Zone hover and selection must independently keep the volume visible.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.visibleZoneCodes"), 'Browser verification must be able to observe the currently visible zone volumes.');
assert.ok(warehouseRenderer.includes('const deselect = isObjectSelected(item);'), 'Clicking the selected list item must toggle the selection off.');
assert.ok(warehouseRenderer.includes("shell.objectOverview.addEventListener('click', () => {"), 'Integrated overview must provide a return to the full warehouse.');
for (const kind of ['zone', 'rack', 'equipment']) {
    assert.ok(warehouseRenderer.includes(`data-warehouse-object-section="${kind}"`), `${kind} must have its own expandable section.`);
}
assert.ok(warehouseRenderer.includes('equipment: amrFleet.map'), 'Equipment rows must represent the real 3D fleet, not mockup entries.');
assert.ok(warehouseRenderer.includes('rack: rackEntries.map'), 'Rack rows must represent the real rendered racks.');
assert.ok(warehouseRenderer.includes('const query = shell.objectSearch.value.trim().toLocaleLowerCase();'), 'Search must read one query for all object groups.');
assert.ok(warehouseRenderer.includes('shell.syncObjectSelection?.();'), 'Viewport selections must synchronize back to the list.');
assert.ok(warehouseStyles.includes('height: 32px; min-height: 32px;'), 'List rows must keep the approved compact height.');
assert.ok(warehouseStyles.includes('overscroll-behavior: contain;'), 'Scrolling long lists must stay inside the panel.');
assert.ok(warehouseRenderer.includes("setSelectedZone('', false);"), 'Selecting a viewport object or empty space must clear the zone selection.');
assert.ok(warehouseStyles.includes('.warehouse-3d-zone-button[aria-pressed="true"]'), 'The selected zone button must have a persistent visual state.');
assert.ok(
    warehouseRenderer.indexOf('warehouse-3d-side-panel-left') < warehouseRenderer.indexOf('warehouse-3d-viewport')
        && warehouseRenderer.indexOf('warehouse-3d-viewport') < warehouseRenderer.indexOf('warehouse-3d-inspector'),
    'The viewport must stay between the left and right panels.'
);
assert.ok(warehouseStyles.includes('--warehouse-left-panel-width: 230px;'), 'The left panel must start at the current 230px width.');
assert.ok(warehouseStyles.includes('--warehouse-right-panel-width: 230px;'), 'The right panel must start at the current 230px width.');
assert.ok(warehouseStyles.includes('.warehouse-3d-toolbar-actions {'), 'The clock and icon actions must share a right-aligned toolbar group.');
assert.ok(warehouseStyles.includes('width: 34px; height: 34px; min-height: 34px; padding: 0;'), 'Toolbar icons must use compact square buttons.');
assert.ok(warehouseStyles.includes('.warehouse-3d-fullscreen[aria-pressed="true"] .warehouse-3d-fullscreen-exit'), 'Fullscreen icon must reflect its current state.');
assert.ok(warehouseStyles.includes('"left-panel left-resizer viewport right-resizer inspector"') && warehouseStyles.includes('"left-panel left-resizer bottom-panel right-resizer inspector"'), 'Desktop layout must keep both panel boundaries alongside the viewport and its bottom panel.');
assert.ok(warehouseStyles.includes('grid-template-areas: "viewport" "bottom-panel" "left-panel" "inspector";'), 'Narrow screens must stack the viewport and both panels safely.');
assert.strictEqual((warehouseRenderer.match(/data-panel-resizer="/g) || []).length, 2, 'Both side panels must have one resize boundary.');
assert.ok(warehouseRenderer.includes('const minimumPanelWidth = 230;'), 'Side panels must not shrink below their current 230px width.');
assert.ok(warehouseRenderer.includes('mainWidth / 2'), 'A side panel must never exceed half of the main view.');
assert.ok(warehouseRenderer.includes('const minimumViewportWidth = 320;'), 'Panel resizing should preserve a usable center viewport where possible.');
assert.ok(warehouseRenderer.includes('handle.setPointerCapture(event.pointerId);'), 'Panel drag must keep pointer control until release.');
assert.ok(warehouseRenderer.includes("if (!['ArrowLeft', 'ArrowRight'].includes(event.key)"), 'Resize boundaries must also support keyboard adjustments.');
assert.ok(warehouseRenderer.includes('panelResizeObserver.disconnect();'), 'Leaving the 3D screen must dispose the panel resize observer.');
assert.ok(warehouseStyles.includes('cursor: ew-resize; touch-action: none;'), 'Panel boundaries must show a horizontal resize cursor.');
assert.ok(warehouseStyles.includes('.warehouse-3d-panel-resizer { display: none; }'), 'Stacked narrow-screen panels must hide horizontal resize handles.');
assert.ok(warehouseStyles.includes('.warehouse-3d-shell:fullscreen'), 'Fullscreen warehouse layout styles are missing.');
assert.ok(warehouseStyles.includes('height: 589px; min-height: 589px;') && warehouseStyles.includes('grid-template-rows: minmax(0, 1fr) 49px;'), 'The regular warehouse must keep a 540px viewport plus its 49px bottom panel.');
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
assert.ok(!warehouseRenderer.includes('warehouse-3d-source-status'), 'The former connection summary element must be removed.');
assert.ok(!warehouseRenderer.includes('shell.sourceStatus'), 'Loading and fullscreen flows must not write to the removed summary.');
assert.ok(warehouseRenderer.includes('<div class="warehouse-3d-bottom-panel" aria-label="하단 패널"></div>'), 'Preserve an empty bottom panel for future use.');
assert.ok(warehouseStyles.includes('height: 49px; min-height: 49px; flex: 0 0 49px;'), 'The empty bottom panel must not collapse.');
assert.ok(warehouseRenderer.indexOf('<div class="warehouse-3d-legend"') < warehouseRenderer.indexOf('data-panel-resizer="right"'), 'The legend must be inside the viewport, before the right-side panel.');
assert.ok(warehouseStyles.includes('position: absolute; right: 12px; bottom: 12px; z-index: 5;'), 'Anchor the legend to the bottom-right of the viewport.');
assert.ok(warehouseRenderer.includes('shell.viewport.replaceChildren(renderer.domElement, shell.hoverTooltip, shell.cameraViews, shell.legend);'), 'Scene initialization must preserve the new legend overlay.');
assert.ok(!warehouseRenderer.includes('warehouse-3d-help'), 'The bottom-right mouse operation guide must be removed.');
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
assert.ok(warehouseRenderer.includes('const depthFramePositions = getRackDepthFramePositions(rackRowCount, depthCount, depth);'), 'Rack frame positions must follow the rack type depth count.');
assert.ok(/const rackFrameMaterial[\s\S]*?castShadow: false/.test(warehouseRenderer), 'Rack posts and beams must not cast shadows.');
assert.ok(warehouseRenderer.includes("applyViewMode('utilization')"), 'The default warehouse view must be utilization.');
assert.ok(warehouseStyles.includes('.warehouse-3d-legend .is-empty'), 'The empty slot legend style is missing.');
assert.ok(warehouseRenderer.includes("const rackFrameColor = '#8b95a5'"), 'Rack posts and beams must use one neutral steel gray.');
assert.ok(warehouseRenderer.includes('metalness: 0.78'), 'Rack posts and beams must use a metallic material.');
assert.ok(warehouseRenderer.includes('new THREE.MeshPhysicalMaterial'), 'Warehouse surfaces must use physically based reflective materials.');
assert.ok(warehouseRenderer.includes("color: '#17603f'"), 'The warehouse floor must use the waterproof green color.');
assert.ok(/color: '#17603f',\r?\n\s+roughness: 0\.18,\r?\n\s+metalness: 0\.04,\r?\n\s+clearcoat: 0\.7,\r?\n\s+clearcoatRoughness: 0\.1,\r?\n\s+envMapIntensity: 1\.6/.test(warehouseRenderer), 'The green warehouse floor must retain a softer, reduced-reflection coating.');
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
assert.ok(/if \(labelRack\) \{\s*setSelectedZone\('', false\);\s*setSelectedSlot\(null\);\s*setHoveredSlot\(null\);\s*setSelectedRack\(labelRack\);\s*setFocusedRack\(labelRack\);\s*focusRackInCurrentView\(labelRack\);\s*showSelection\(labelRack\);\s*return;\s*\}\s*const slot = getSlotAtPointer\(event\);/.test(warehouseRenderer), 'Billboard selection must clear zone and slot information, isolate and fit the rack before slot selection.');
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
assert.ok(warehouseRenderer.includes('rackEntries.forEach((entry) => { entry.group.visible = true; });'), 'Removing the top filters must keep every rack visible.');
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
const calculateLoadingDockLayout = sandbox.window.wmsWarehouse3D.calculateLoadingDockLayout;
const calculateLoadingYardLayout = sandbox.window.wmsWarehouse3D.calculateLoadingYardLayout;
const getRackDepthFramePositions = sandbox.window.wmsWarehouse3D.getRackDepthFramePositions;
const getWarehouseStructureOcclusion = sandbox.window.wmsWarehouse3D.getWarehouseStructureOcclusion;
const buildPassageBoundarySegments = sandbox.window.wmsWarehouse3D.buildPassageBoundarySegments;
const buildPassageNavigationGraph = sandbox.window.wmsWarehouse3D.buildPassageNavigationGraph;
const findPassagePath = sandbox.window.wmsWarehouse3D.findPassagePath;
const findNearestPassageNode = sandbox.window.wmsWarehouse3D.findNearestPassageNode;
const getForkTargetHeight = sandbox.window.wmsWarehouse3D.getForkTargetHeight;
const getForkliftTaskSequence = sandbox.window.wmsWarehouse3D.getForkliftTaskSequence;
const calculateRackFocusView = sandbox.window.wmsWarehouse3D.calculateRackFocusView;
const getSlotVisualKey = sandbox.window.wmsWarehouse3D.getSlotVisualKey;
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(getRackDepthFramePositions(1, 4, 6))),
    [0, 1.5, 3, 4.5, 6],
    'A rack with depth count 4 must create four depth sections bounded by five frame planes.'
);
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
const frontLoadingDock = JSON.parse(JSON.stringify(calculateLoadingDockLayout(
    [{ code: 'W04', rackTypeCode: 'PALLET', startX: 200, startY: 8000, direction: 'horizontal', bayCount: 4 }],
    [{ code: 'PALLET', bayWidth: 1000, depth: 1000 }],
    10000,
    10000
)));
assert.strictEqual(frontLoadingDock.side, 'front', 'A horizontal W04 must open its nearest front/back loading face even when a rack end is closer to a side wall.');
assert.deepStrictEqual(
    { anchorX: frontLoadingDock.anchorX, anchorZ: frontLoadingDock.anchorZ, yaw: frontLoadingDock.yaw },
    { anchorX: 2200, anchorZ: 10000, yaw: 0 },
    'The truck rear must align with the W04 center and face outward from the selected wall.'
);
const rightLoadingDock = JSON.parse(JSON.stringify(calculateLoadingDockLayout(
    [{ code: 'W04', rackTypeCode: 'PALLET', startX: 8000, startY: 2000, direction: 'vertical', bayCount: 4 }],
    [{ code: 'PALLET', bayWidth: 1000, depth: 1000 }],
    10000,
    10000
)));
assert.strictEqual(rightLoadingDock.side, 'right', 'Moving vertical W04 to the right edge must move the loading side to the right wall.');
assert.deepStrictEqual(
    { anchorX: rightLoadingDock.anchorX, anchorZ: rightLoadingDock.anchorZ, yaw: rightLoadingDock.yaw },
    { anchorX: 10000, anchorZ: 4000, yaw: Math.PI / 2 },
    'The truck position and rotation must follow the changed floor-plan W04 footprint.'
);
const markedLoadingDock = JSON.parse(JSON.stringify(calculateLoadingDockLayout(
    [{ code: 'W04', rackTypeCode: 'PALLET', startX: 200, startY: 8000, direction: 'horizontal', bayCount: 4 }],
    [{ code: 'PALLET', bayWidth: 1000, depth: 1000 }],
    10000, 10000, 'W04',
    [{ x: 4000, y: 9000, code: 'D27' }, { x: 4500, y: 9000, code: 'D27' }, { x: 5000, y: 9000, code: 'D27' }],
    500
)));
assert.deepStrictEqual(
    {
        rackCode: markedLoadingDock.rackCode,
        source: markedLoadingDock.source,
        cellCount: markedLoadingDock.cellCount,
        side: markedLoadingDock.side,
        anchorX: markedLoadingDock.anchorX,
        anchorZ: markedLoadingDock.anchorZ
    },
    { rackCode: 'D27', source: 'floorPlanDock', cellCount: 3, side: 'front', anchorX: 4750, anchorZ: 10000 },
    'Numbered dock cells must override the W04 fallback and drive the truck position from the floor plan.'
);
assert.strictEqual(
    calculateLoadingDockLayout([], [], 10000, 10000, 'W04', [{ x: 0, y: 0 }], 500).side,
    'back',
    'A D marker at the back edge must move the dock and truck to the back wall.'
);
assert.strictEqual(
    calculateLoadingDockLayout([], [{ code: 'PALLET', bayWidth: 1000, depth: 1000 }], 10000, 10000),
    null,
    'Missing W04 data must preserve all walls and suppress the truck instead of guessing.'
);
const frontLoadingYard = JSON.parse(JSON.stringify(calculateLoadingYardLayout(frontLoadingDock, 10000, 8000)));
assert.deepStrictEqual(frontLoadingYard, {
    side: 'front', approachDepth: 11000,
    centerX: 5000, centerZ: 13500, sizeX: 14000, sizeZ: 11000
}, 'The vehicle yard must extend from the front floor-plan boundary with side shoulders.');
const rightLoadingYard = JSON.parse(JSON.stringify(calculateLoadingYardLayout(rightLoadingDock, 10000, 8000)));
assert.deepStrictEqual(rightLoadingYard, {
    side: 'right', approachDepth: 11000,
    centerX: 15500, centerZ: 4000, sizeX: 11000, sizeZ: 12000
}, 'Moving W04 to a side wall must rotate and reposition the vehicle yard with the floor plan.');
assert.strictEqual(calculateLoadingYardLayout(null, 10000, 8000), null, 'A missing W04 loading side must not create an arbitrary vehicle yard.');
const frontStructureOcclusion = JSON.parse(JSON.stringify(getWarehouseStructureOcclusion(
    { x: 50, y: 5, z: 80 },
    100,
    60,
    10
)));
assert.deepStrictEqual(frontStructureOcclusion.hiddenWalls, ['front'], 'The foreground wall structure must hide in the front view.');
assert.strictEqual(frontStructureOcclusion.ceilingHidden, false, 'A low front view must keep ceiling details visible.');
const quarterStructureOcclusion = JSON.parse(JSON.stringify(getWarehouseStructureOcclusion(
    { x: 130, y: 24, z: 90 },
    100,
    60,
    10
)));
assert.deepStrictEqual(quarterStructureOcclusion.hiddenWalls.sort(), ['front', 'right'], 'A quarter view must hide both foreground wall structures.');
assert.strictEqual(quarterStructureOcclusion.ceilingHidden, true, 'A camera above the roof must hide ceiling structure details.');
const topStructureOcclusion = JSON.parse(JSON.stringify(getWarehouseStructureOcclusion(
    { x: 50, y: 30, z: 30 },
    100,
    60,
    10
)));
assert.deepStrictEqual(topStructureOcclusion.hiddenWalls, [], 'A centered top view must keep all distant wall structures.');
assert.strictEqual(topStructureOcclusion.ceilingHidden, true, 'A top view must hide ceiling beams and light housings.');
const contiguousPassageBoundary = JSON.parse(JSON.stringify(buildPassageBoundarySegments([
    { x: 0, y: 0 },
    { x: 500, y: 0 }
], 500, 100, 100)));
assert.deepStrictEqual(contiguousPassageBoundary, [
    { side: 'top', x: 300, y: 150, width: 400, depth: 100 },
    { side: 'bottom', x: 300, y: 350, width: 400, depth: 100 },
    { side: 'left', x: 150, y: 250, width: 100, depth: 300 },
    { side: 'top', x: 700, y: 150, width: 400, depth: 100 },
    { side: 'bottom', x: 700, y: 350, width: 400, depth: 100 },
    { side: 'right', x: 850, y: 250, width: 100, depth: 300 }
], 'Adjacent T cells must share no internal boundary and every strip must begin 100mm inside the passage edge.');
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
const countPathTurns = (path) => {
    let turns = 0;
    let previousDirection = '';
    path.slice(1).forEach((node, index) => {
        const previous = path[index];
        const direction = `${Math.sign(node.gridX - previous.gridX)}:${Math.sign(node.gridY - previous.gridY)}`;
        if (previousDirection && direction !== previousDirection) turns += 1;
        previousDirection = direction;
    });
    return turns;
};
assert.strictEqual(countPathTurns(crossPassagePath), 1, 'The cross-passage route must reach the turnable intersection before rotating once.');
const openPassageCells = Array.from({ length: 12 }, (_, cellX) => (
    Array.from({ length: 12 }, (unused, cellY) => ({ x: cellX * 500, y: cellY * 500 }))
)).flat();
const openPassageNavigation = buildPassageNavigationGraph(openPassageCells, 500, 1950);
const openPassagePath = findPassagePath(openPassageNavigation, '4:4', '16:16');
assert.ok(openPassagePath.length > 0, 'The AMR must find a route across an open turnable passage area.');
assert.strictEqual(countPathTurns(openPassagePath), 1, 'Equal-distance routes must minimize turns instead of alternating rotation and movement.');
const narrowPassage = Array.from({ length: 12 }, (_, cellX) => Array.from({ length: 3 }, (unused, cellY) => ({ x: cellX * 500, y: cellY * 500 }))).flat();
assert.strictEqual(buildPassageNavigationGraph(narrowPassage, 500, 1600).nodes.length, 0, 'A 1.6m AMR must not enter a passage narrower than its diameter.');
assert.ok(warehouseRenderer.includes('const configuredAmrEquipment = (data.equipment || []).filter'), 'The warehouse scene must derive AMRs from the equipment master.');
assert.ok(warehouseRenderer.includes("item.enabled && /^AMR-/i.test"), 'Only enabled AMR equipment rows may create 3D vehicles.');
assert.ok(warehouseRenderer.includes('const amrCount = amrEquipment.length;'), 'The AMR count must follow the enabled equipment rows.');
assert.ok(warehouseRenderer.includes('const forkliftClearanceDiameterMm = 1950;'), 'Unmanned forklifts must use their full turning envelope inside a 2m passage.');
const forkliftNavigation = buildPassageNavigationGraph(crossPassageCells, 500, 1950);
assert.ok(findPassagePath(forkliftNavigation, '4:16', '16:4').length > 0, 'A 1.95m forklift turning envelope must remain connected through a 2m cross passage.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.amrPathfinding = amrFleet.length ? 'astar' : 'unavailable';"), 'The viewport must expose the active A* navigation state for verification.');
assert.ok(warehouseRenderer.includes('const turnWeight = nodesByKey.size + 1;'), 'A* must prefer fewer turns among equal-distance routes.');
assert.ok(!warehouseRenderer.includes('· 무인 지게차 ${amrFleet.length}대'), 'The removed top-right object summary must not be updated in the scene.');
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
        '1,T,S,F,F,F,D27',
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
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.stationCells)), [{ x: 500, y: 0 }], 'S must be stored as an inbound/outbound station coordinate, not a rack.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.dockCells)), [{ x: 2500, y: 0, code: 'D27' }], 'Any D-prefixed numeric code must retain its loading dock number and coordinate.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.unmappedFloorRackCodes)), [], 'F, T, S, and numbered dock codes must not be reported as unknown rack codes.');
assert.strictEqual(converted.racks.length, 1, 'A rack removed from the floor plan must not be rendered.');
assert.strictEqual(converted.meta.unplacedRackCodes[0], 'W02', 'A rack missing from the floor plan must be reported as unplaced.');
assert.strictEqual(converted.locations.length, 1, 'Converted location master rows must remain available for empty slot rendering.');
assert.strictEqual(converted.locations[0].depth, 1, 'A location without an explicit depth must default to depth 1.');
assert.strictEqual(converted.locations[0].rackRow, 1, 'A location without a row value must use the first rack row.');
assert.strictEqual(converted.rackTypes[0].depthCount, 2, 'The rack depth count must be preserved for front/back slot boxes.');
assert.strictEqual(converted.inventory[0].status, 'warning', 'Korean inventory status must map to the 3D status.');
const zoneBounds = calculateZoneFloorBounds(converted.racks, converted.rackTypes, 500, 100);
assert.deepStrictEqual(JSON.parse(JSON.stringify(zoneBounds)), [{ zoneCode: 'A01', minX: -30, maxX: 3530, minY: 85, maxY: 2415 }], 'A 10cm zone boundary must preserve a 50cm clear gap from the centered rack.');

// Execute the production camera controls with minimal rendering stubs.
// Keep the exact perspective presets while testing orthographic axis alignment.
const cameraControlsSource = warehouseRenderer.slice(
    warehouseRenderer.indexOf('        const cameraViewPresets = {'),
    warehouseRenderer.indexOf("        shell.projectionToggle.addEventListener('click'")
);
const cameraContext = vm.createContext({
    assert,
    setSelectedAmr() {}, amrFocusTransition: null,
    shell: { cameraViewButtons: [] }, signal: {},
    renderer: { domElement: { focus() {} } },
    requestRender() {}, updateProjectionMatrices() {}, updateProjectionToggle() {},
    cameraFocusTransitionToken: 0, yaw: 0, pitch: 0, distance: 60,
    floorWidth: 55.5, floorDepth: 33, sceneSpan: 63.5,
    cameraCenterX: 27.75, cameraCenterZ: 18.3, warehouseFloorElevation: 1.2,
    projectionMode: 'perspective',
    minimumCameraDistance: 8, maximumCameraDistance: 140, perspectiveHalfFov: Math.PI / 8,
    orthographicViewHeight: 0, perspectiveCamera: {}, orthographicCamera: {}, camera: {},
    target: { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } }
});
vm.runInContext(`
    const getPerspectiveViewHeight = (value = distance) => 2 * value * Math.tan(perspectiveHalfFov);
    const updateCamera = () => { camera.height = target.y + distance * Math.sin(pitch); };
    ${cameraControlsSource}
    for (const view of ['front', 'side']) {
        applyProjectionMode('perspective');
        applyCameraView(view);
        assert.strictEqual(pitch, 0.08);
        applyProjectionMode('orthographic');
        assert.strictEqual(pitch, 0, view + ' then orthographic must be horizontal.');
        assert.strictEqual(camera.height, target.y);
        assert.strictEqual(yaw, view === 'front' ? 0 : Math.PI / 2);
        applyCameraView('quarter');
        applyCameraView(view);
        assert.strictEqual(pitch, 0, 'Orthographic then ' + view + ' must be horizontal.');
        target.x += 3; target.y += 1; orthographicViewHeight *= 0.8;
        const savedTarget = JSON.stringify(target);
        const savedHeight = orthographicViewHeight;
        applyProjectionMode('perspective');
        assert.strictEqual(pitch, 0.08);
        applyProjectionMode('orthographic');
        assert.strictEqual(pitch, 0);
        assert.strictEqual(JSON.stringify(target), savedTarget, 'Projection switches must preserve panning.');
        assert.ok(Math.abs(orthographicViewHeight - savedHeight) < 1e-10, 'Projection switches must preserve zoom.');
    }
    for (const view of ['quarter', 'top']) {
        applyProjectionMode('perspective'); applyCameraView(view);
        const originalPitch = pitch;
        applyProjectionMode('orthographic');
        assert.strictEqual(pitch, originalPitch, 'Other presets must not change.');
    }
`, cameraContext);
const rotationSource = warehouseRenderer.match(/if \(pointerStart.mode === 'rotate'\) \{([\s\S]*?)\n            \} else \{/)[1];
vm.runInContext(`
    const rotate = (deltaX, deltaY) => { ${rotationSource} };
    applyCameraView('front');
    let pointerStart = { yaw, pitch };
    rotate(0, 0);
    assert.strictEqual(alignedCameraView, 'front', 'A click must not release alignment.');
    rotate(10, 0);
    assert.strictEqual(pitch, 0, 'Horizontal rotation must not jump above the horizon.');
    assert.strictEqual(alignedCameraView, null);
    rotate(0, 0);
    assert.strictEqual(yaw, pointerStart.yaw, 'Dragging back to the starting point must restore the starting heading.');
    assert.strictEqual(pitch, pointerStart.pitch);
    rotate(10, 20);
    const manualPitch = pitch, manualYaw = yaw;
    applyProjectionMode('perspective'); applyProjectionMode('orthographic');
    assert.strictEqual(pitch, manualPitch, 'Manual elevation must survive projection switches.');
    assert.strictEqual(yaw, manualYaw, 'Manual heading must survive projection switches.');
    applyCameraView('side');
    assert.strictEqual(pitch, 0, 'The view button must restore exact alignment.');
`, cameraContext);

// Equipment names are joined by their stable code, never by sheet row order.
const parseEquipmentMaster = sandbox.window.wmsWarehouse3D.parseEquipmentMaster;
assert.deepStrictEqual(JSON.parse(JSON.stringify(parseEquipmentMaster([
    '설비 마스터', '설비명,사용 여부,설비 코드',
    ' 두 번째 ,Y, AMR-002 ', '첫 번째,Y,AMR-001', ',Y,AMR-003', '비활성,N,AMR-004', ',,'
].join('\n')))), [
    { code: 'AMR-002', name: '두 번째', enabled: true },
    { code: 'AMR-001', name: '첫 번째', enabled: true },
    { code: 'AMR-003', name: 'AMR-003', enabled: true },
    { code: 'AMR-004', name: '비활성', enabled: false }
]);
assert.throws(() => parseEquipmentMaster('설비 코드,설비명,사용 여부\nAMR-001,A,Y\n AMR-001 ,B,Y'), /중복/);
assert.throws(() => parseEquipmentMaster('설비 코드,모델명\nAMR-001,A'), /설비 마스터/);
assert.ok(warehouseRenderer.includes("equipmentByCode.get(amr.equipmentCode)?.name || amr.equipmentCode"));
assert.ok(warehouseRenderer.includes("amr.label.userData = { ...amr.label.userData, kind: 'amr-label', amr };"));
const parseEquipmentStatus = sandbox.window.wmsWarehouse3D.parseEquipmentStatus;
assert.deepStrictEqual(JSON.parse(JSON.stringify(parseEquipmentStatus([
    '설비 상태 정보', '설비 상태,설비 코드,통신 연결',
    '대기, AMR-001 ,online', '충전,AMR-002,OFFLINE'
].join('\n')))), [
    { equipmentCode: 'AMR-001', communicationStatus: 'ONLINE', equipmentStatus: '대기' },
    { equipmentCode: 'AMR-002', communicationStatus: 'OFFLINE', equipmentStatus: '충전' }
]);
assert.throws(() => parseEquipmentStatus('설비 코드,통신 연결,설비 상태\nAMR-001,ONLINE,대기\n AMR-001 ,OFFLINE,고장'), /중복/);
assert.ok(warehouseRenderer.includes("config?.sheets?.equipmentStatus || '설비 상태 정보'"));
assert.ok(warehouseRenderer.includes("const equipmentStatusByCode = new Map"));

// Run the actual selection/follow code without WebGL to protect camera angles.
class FollowVector {
    constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
    add(v) { for (const key of ['x', 'y', 'z']) this[key] += v[key]; return this; }
    sub(v) { for (const key of ['x', 'y', 'z']) this[key] -= v[key]; return this; }
    addScaledVector(v, scale) { for (const key of ['x', 'y', 'z']) this[key] += v[key] * scale; return this; }
    clone() { return new FollowVector(this.x, this.y, this.z); }
    copy(v) { Object.assign(this, { x: v.x, y: v.y, z: v.z }); return this; }
    lerpVectors(a, b, t) {
        for (const key of ['x', 'y', 'z']) this[key] = a[key] + (b[key] - a[key]) * t;
        return this;
    }
}
// Execute the actual docking calculation against controlled rack/aisle coordinates.
class DockVector extends FollowVector {
    clone() { return new DockVector(this.x, this.y, this.z); }
    lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; }
    length() { return Math.sqrt(this.lengthSq()); }
    normalize() { const n = this.length(); return this.set(this.x / n, this.y / n, this.z / n); }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
}
const stackerDimensionsSource = warehouseRenderer.slice(
    warehouseRenderer.indexOf('        const stackerDimensions = '),
    warehouseRenderer.indexOf('        const createForkliftModel = ')
);
const dockingSource = warehouseRenderer.slice(
    warehouseRenderer.indexOf('        const getDockTarget = '),
    warehouseRenderer.indexOf('        rackEntries.forEach((entry) => {', warehouseRenderer.indexOf('        const getDockTarget = '))
);
const dockingContext = vm.createContext({
    assert, THREE: { Vector3: DockVector }, mm: v => v / 1000,
    getForkTargetHeight, forkThickness: 0.055, warehouseFloorElevation: 1.2,
    passageNavigation: {}, amrComponent: ['dock'],
    dockZ: -1000,
    findNearestPassageNode: () => ({ key: 'dock', x: 0, y: dockingContext.dockZ })
});
vm.runInContext(`${stackerDimensionsSource}\n${dockingSource}
    const slot = { position: [0, 1, 0.45], boxSize: [0.9, 0.6, 0.9], depth: 1, depthCount: 1,
        rackWidth: 1, locationCode: 'TEST-01', group: { localToWorld(v) { return v; } } };
    const dock = getDockTarget(slot);
    assert.ok(dock);
    assert.ok(Math.abs(dock.forkExtension + stackerDimensions.mastZ + stackerDimensions.forkCenterZ - 1.45) < 1e-9);
    dockZ = -700;
    assert.equal(getDockTarget(slot), null, 'Do not let support legs enter the rack.');
    dockZ = -2500;
    assert.equal(getDockTarget(slot), null, 'Reject unreachable cells instead of clamping and misaligning the load.');
`, dockingContext);
assert.ok(warehouseRenderer.includes("group.userData.modelType = 'slim-autonomous-stacker'"));
assert.ok(warehouseRenderer.includes("color: '#32b5e5'"));
assert.ok(warehouseRenderer.includes("box('stacker-support-leg'"));
assert.ok(warehouseRenderer.includes("box('stacker-fork-tine'"));
assert.ok(!warehouseRenderer.includes('const guardTopGeometry'));
assert.ok(!warehouseRenderer.includes('const counterweightGeometry'));
const forkHeightSource = warehouseRenderer.slice(
    warehouseRenderer.indexOf('        const setForkHeight = '),
    warehouseRenderer.indexOf('        const setForkExtension = ')
);
vm.runInNewContext(`${forkHeightSource}
    const a = { carriage: {position:{}}, mastMiddle:{position:{}}, mastUpper:{position:{}}, group:{userData:{}} };
    setForkHeight(a, 0.06);
    assert.equal(a.forkHeight, 0.06, 'The lowest shelf must be reachable below travel height.');
    setForkHeight(a, travelForkHeight);
    assert.equal(a.forkHeight, 0.08);
    setForkHeight(a, 4.99);
    assert.equal(a.carriage.position.y, 4.99);
`, { assert, forkThickness: 0.055, travelForkHeight: 0.08 });

const inspectorContext = vm.createContext({ assert });
vm.runInContext(warehouseRenderer.slice(warehouseRenderer.indexOf('    function escapeHtml('), warehouseRenderer.indexOf('    const slotColorPalette'))
    + warehouseRenderer.slice(warehouseRenderer.indexOf('    function getAmrInspectorHtml('), warehouseRenderer.indexOf('    function getAmrEquipmentStatusColor(')), inspectorContext);
const getAmrInspectorHtml = vm.runInContext('getAmrInspectorHtml', inspectorContext);
assert.ok(getAmrInspectorHtml({ communicationStatus: 'OFFLINE' }).includes('오프라인 (OFFLINE)'));
assert.ok(getAmrInspectorHtml({}).includes('미설정'));
const escapedInspector = getAmrInspectorHtml({equipmentCode:'<code>', equipmentName:'<img src=x onerror=alert(1)>', equipmentStatus:'<script>bad</script>'});
assert.ok(!escapedInspector.includes('<img') && !escapedInspector.includes('<script>'));
assert.ok(escapedInspector.includes('&lt;code&gt;'));

const followSource = warehouseRenderer.slice(
    warehouseRenderer.indexOf('        const setSelectedAmr = (amr) => {'),
    warehouseRenderer.indexOf('        const fadeWorldObject = ')
);
const followContext = vm.createContext({
    assert, THREE: { Vector3: FollowVector }, performance: { now: () => 1000 },
    followedAmr: null, hoveredAmr: null, amrFocusTransition: null,
    cameraFocusTransitionToken: 0, viewportAspect: 1.5,
    floorWidth: 55.5, floorDepth: 33, projectionMode: 'orthographic', alignedCameraView: null, signal: {},
    target: new FollowVector(28, 2.5, 16), distance: 60, orthographicViewHeight: 50,
    minimumCameraDistance: 8, maximumCameraDistance: 140, perspectiveHalfFov: Math.PI / 8,
    yaw: 0.65, pitch: 0.45, shell: { viewport: { dataset: {} }, inspector: { innerHTML: '' } },
    getAmrInspectorHtml,
    showDefaultInspector() { followContext.shell.inspector.innerHTML = '<h5>선택 정보</h5>'; },
    easeOutCubic: t => 1 - (1 - t) ** 3,
    setAmrLabelState() {}, setHoveredSlot() {}, requestRender() {}, updateProjectionMatrices() {}, updateCamera() {}
});
vm.runInContext(`
    ${followSource}
    const robot = { equipmentCode: 'AMR-001', equipmentName: 'AMR001', communicationStatus: 'ONLINE', equipmentStatus: '대기', group: { position: new THREE.Vector3(5, 0, 8) } };
    setSelectedAmr(robot);
    assert.ok(shell.inspector.innerHTML.includes('<h5>AMR001</h5>'));
    for (const text of ['설비 코드', 'AMR-001', '설비명', '통신 연결 상태', '온라인 (ONLINE)', '설비 상태', '대기']) assert.ok(shell.inspector.innerHTML.includes(text));
    updateAmrFollow(1250);
    assert.ok(distance < 60 && distance > 14, 'Focus must animate, not jump.');
    updateAmrFollow(1500);
    assert.strictEqual(orthographicViewHeight, 14, 'Keep a moderate 14m vertical view.');
    assert.strictEqual(target.x, 5); assert.strictEqual(target.y, 1.5); assert.strictEqual(target.z, 8);
    robot.group.position.x += 2; robot.group.position.z += 3;
    updateAmrFollow(1600);
    assert.strictEqual(target.x, 7); assert.strictEqual(target.z, 11);
    assert.strictEqual(yaw, 0.65); assert.strictEqual(pitch, 0.45);
    setSelectedAmr(null); robot.group.position.x += 2; updateAmrFollow(1700);
    assert.strictEqual(target.x, 7, 'Clearing selection must stop following.');
    assert.strictEqual(shell.viewport.dataset.followingAmrCode, '');
    assert.strictEqual(shell.inspector.innerHTML, '<h5>선택 정보</h5>', 'Deselecting must not leave stale AMR details.');
    shell.inspector.innerHTML = '<h5>랙 정보</h5>';
    setSelectedAmr(null);
    assert.strictEqual(shell.inspector.innerHTML, '<h5>랙 정보</h5>', 'No active AMR means unrelated inspector information must be preserved.');
    setSelectedAmr(robot); amrFocusTransition.zoomCancelled = true; distance = 25;
    updateAmrFollow(1500);
    assert.strictEqual(distance, 25, 'Manual wheel zoom must not be overwritten.');
    assert.strictEqual(target.x, 9, 'Manual zoom still follows the robot.');
    viewportAspect = 0.5; setSelectedAmr(robot); updateAmrFollow(1500);
    assert.strictEqual(orthographicViewHeight, 20, 'Narrow views retain at least 10m horizontally.');
`, followContext);

const followDragSource = warehouseRenderer.slice(
    warehouseRenderer.indexOf("        renderer.domElement.addEventListener('pointermove', (event) => {"),
    warehouseRenderer.indexOf("        renderer.domElement.addEventListener('contextmenu'")
);
vm.runInContext(`
    let dragHandler;
    const renderer = { domElement: { addEventListener(type, handler) { dragHandler = handler; } } };
    ${followDragSource}
    let pointerStart = {
        x: 0, y: 0, yaw, pitch, distance: 25, target: target.clone(),
        amrPosition: robot.group.position.clone(),
        viewRight: new THREE.Vector3(1, 0, 0), viewDirection: new THREE.Vector3(0, 0, -1),
        mode: 'pan', pointerId: 1
    };
    robot.group.position.x += 1;
    dragHandler({ pointerId: 1, clientX: 20, clientY: 10 });
    assert.strictEqual(followedAmr, robot, 'Panning must not deselect the AMR.');
    assert.strictEqual(target.x, 9.25, 'Panning must include AMR movement since pointerdown.');
    const savedOffset = amrFollowOffset.clone();
    assert.strictEqual(savedOffset.x, -0.75);
    assert.strictEqual(savedOffset.z, -0.375);
    robot.group.position.x += 2;
    updateAmrFollow(2000);
    assert.strictEqual(target.x, 11.25, 'Tracking must retain the manual pan offset.');
    pointerStart = { ...pointerStart, mode: 'rotate', yaw, pitch };
    const oldYaw = yaw;
    dragHandler({ pointerId: 1, clientX: 20, clientY: 10 });
    assert.strictEqual(followedAmr, robot, 'Rotation must not deselect the AMR.');
    assert.strictEqual(yaw, oldYaw - 0.16);
    const rotatedPitch = pitch;
    robot.group.position.z += 1; updateAmrFollow(2100);
    assert.strictEqual(pitch, rotatedPitch, 'Following must preserve the adjusted rotation.');
    assert.strictEqual(amrFollowOffset.x, savedOffset.x);
    assert.strictEqual(amrFollowOffset.z, savedOffset.z);
    setSelectedAmr(robot); updateAmrFollow(1500);
    assert.strictEqual(amrFollowOffset.x, 0, 'Selecting an AMR again must recenter it.');
    assert.strictEqual(target.x, robot.group.position.x);
`, followContext);

// Run actual pointer handlers: clicking must never transiently hide slot hover information.
const slotPointerDownAndMove = warehouseRenderer.slice(
    warehouseRenderer.indexOf('        let pointerStart;'),
    warehouseRenderer.indexOf("        renderer.domElement.addEventListener('contextmenu'")
);
const slotPointerUp = warehouseRenderer.slice(
    warehouseRenderer.indexOf("        renderer.domElement.addEventListener('pointerup'"),
    warehouseRenderer.indexOf('        const applyFilters = ')
);
const slotPointerContext = vm.createContext({
    assert, THREE: { Vector3: class extends FollowVector {
        normalize() { return this; }
        crossVectors() { return this.set(1, 0, 0); }
    } },
    camera: { up: new FollowVector(0, 1, 0), getWorldDirection(v) { v.set(0, 0, -1); } },
    target: new FollowVector(10, 2, 10), yaw: 0, pitch: 0.5,
    cameraFocusTransitionToken: 0, followedAmr: null, amrFocusTransition: null,
    projectionMode: 'perspective', alignedCameraView: null, floorWidth: 55, floorDepth: 33, signal: {},
    getEquivalentCameraDistance: () => 25,
    updateCamera() {}, requestRender() {}, setHoveredRack() {}, setHoveredAmr() {},
    setSelectedAmr() {}, setSelectedZone() {}, setSelectedRack() {}, setFocusedRack() {}, showDefaultInspector() {}, focusRackInCurrentView() {}
});
vm.runInContext(`
    const handlers = {};
    const renderer = { domElement: { addEventListener(type, handler) { handlers[type] = handler; }, setPointerCapture() {}, focus() {} } };
    const slot = { code: 'slot-1' };
    let hover = slot, selected = null, shown = null, cleared = 0, rackHit = null, amrHit = null;
    const setHoveredSlot = value => { hover = value; if (!value) cleared++; };
    const setSelectedSlot = value => { selected = value; };
    const showSelection = value => { shown = value; };
    const getSlotAtPointer = () => slot;
    const getLabelRackAtPointer = () => rackHit;
    const getLabelAmrAtPointer = () => amrHit;
    ${slotPointerDownAndMove}
    ${slotPointerUp}
    const event = { button: 0, pointerId: 1, clientX: 100, clientY: 100, preventDefault() {} };
    handlers.pointerdown(event);
    assert.strictEqual(hover, slot, 'Pointerdown must preserve the visible tooltip.');
    handlers.pointermove({ ...event, clientX: 101 });
    handlers.pointerup({ ...event, clientX: 101 });
    assert.strictEqual(hover, slot); assert.strictEqual(selected, slot); assert.strictEqual(shown, slot);
    assert.strictEqual(cleared, 0, 'A click must not hide and reshow tooltip, even transiently.');
    handlers.pointerdown(event); handlers.pointermove({ ...event, clientX: 120 });
    assert.strictEqual(hover, null, 'Actual panning must clear stale hover information.');
    handlers.pointerup({ ...event, clientX: 120 });
    hover = slot; handlers.pointerdown({ ...event, button: 2 });
    handlers.pointermove({ ...event, clientX: 120 });
    assert.strictEqual(hover, null, 'Actual rotation must clear stale hover information.');
    handlers.pointerup({ ...event, clientX: 120 });
    for (const kind of ['rack', 'amr']) {
        hover = slot; rackHit = kind === 'rack' ? {} : null; amrHit = kind === 'amr' ? {} : null;
        handlers.pointerdown(event); handlers.pointerup(event);
        assert.strictEqual(hover, null, 'Selecting a billboard must clear old slot information.');
    }
`, slotPointerContext);

// Exercise the real sprite drawing for every interaction state.
const labelSource = warehouseRenderer.slice(
    warehouseRenderer.indexOf('    function createLabelSprite('),
    warehouseRenderer.indexOf('    function calculateZoneFloorBounds(')
);
const labelContext = vm.createContext({
    assert, worldUiResolutionScale: 2,
    document: { createElement() {
        const context = {
            strokes: 0, lineStrokes: 0, arcs: [], texts: [], roundedRects: [], clearRect() {}, beginPath() {}, fill() {}, stroke() { this.lineStrokes++; },
            fillRect() {}, fillText(text) { this.texts.push(String(text)); },
            arc(...args) { this.arcs.push(args); }, roundRect(...args) { this.roundedRects.push(args); }, strokeRect() { this.strokes++; }
        };
        return { getContext() { return context; } };
    } },
    THREE: {
        CanvasTexture: class { constructor(image) { this.image = image; } },
        SpriteMaterial: class { constructor(options) { Object.assign(this, options); } },
        Sprite: class { constructor(material) { this.material = material; this.scale = new FollowVector(); } }
    }
});
vm.runInContext(`
    ${labelSource}
    const rackLabel = createLabelSprite(THREE, 'W01');
    const amrLabel = createAmrLabelSprite(THREE, { name: 'AMR001', communicationStatus: 'ONLINE', equipmentStatus: '대기' });
    const offlineAmrLabel = createAmrLabelSprite(THREE, { name: 'AMR002', communicationStatus: 'OFFLINE', equipmentStatus: '고장' });
    assert.strictEqual(rackLabel.scale.x, 3.2);
    assert.strictEqual(rackLabel.scale.y, 0.9);
    assert.strictEqual(amrLabel.scale.x, 1.84, 'AMR billboard width must be 15% larger than the previous 1.6m width.');
    assert.strictEqual(amrLabel.scale.y, 1.035, 'The grouped billboard height must contain separate upper and lower UI rows.');
    for (const label of [rackLabel, amrLabel]) assert.strictEqual(label.material.opacity, 0.8);
    for (const state of ['normal', 'hover', 'selected']) {
        const rackUpdate = rackLabel.setInteractionState(state);
        const amrUpdate = amrLabel.setInteractionState(state);
        for (const progress of [0, 0.5, 1]) {
            rackUpdate(progress); amrUpdate(progress);
            assert.ok(Math.abs(amrLabel.scale.x - rackLabel.scale.x * 0.575) < 1e-10);
            assert.ok(Math.abs(amrLabel.scale.y - rackLabel.scale.y * 1.15) < 1e-10);
            assert.ok(amrLabel.material.opacity <= 0.8 && rackLabel.material.opacity <= 0.8);
        }
        assert.strictEqual(amrLabel.material.opacity, 0.8);
        assert.strictEqual(rackLabel.material.opacity, 0.8);
    }
    const amrCanvas = amrLabel.material.map.image.getContext('2d');
    const rackCanvas = rackLabel.material.map.image.getContext('2d');
    assert.strictEqual(amrCanvas.font, '400 64px sans-serif');
    assert.strictEqual(rackCanvas.font, '700 64px sans-serif');
    assert.strictEqual(amrCanvas.strokes, 0, 'AMR labels must never draw a border.');
    assert.strictEqual(rackCanvas.strokes, 4, 'Rack labels retain borders in every state.');
    assert.strictEqual(amrCanvas.arcs.length, 20, 'AMR labels must draw a center dot and four wireless signal arcs in every interaction state.');
    assert.strictEqual(amrCanvas.lineStrokes, 16, 'The wireless icon must have two signal arcs on each side.');
    assert.strictEqual(amrCanvas.roundedRects.length, 8, 'Status and AMR name must remain two separate UI panels.');
    assert.ok(amrCanvas.texts.includes('AMR001'));
    assert.ok(amrCanvas.texts.includes('대기'));
    assert.strictEqual(amrLabel.userData.communicationStatus, 'ONLINE');
    assert.strictEqual(amrLabel.userData.communicationColor, '#00FF00');
    assert.strictEqual(amrLabel.userData.equipmentStatusColor, '#475569');
    assert.strictEqual(offlineAmrLabel.userData.communicationStatus, 'OFFLINE');
    assert.strictEqual(offlineAmrLabel.userData.communicationColor, '#9ca3af');
    assert.strictEqual(offlineAmrLabel.userData.equipmentStatusColor, '#dc2626');
`, labelContext);
assert.ok(warehouseRenderer.includes('amr.label = createAmrLabelSprite(THREE, {'));
assert.ok(warehouseRenderer.includes("const communicationColor = isOnline ? '#00FF00' : '#9ca3af';"));
assert.ok(warehouseRenderer.includes('The upper status row has no shared frame'));
assert.ok(warehouseRenderer.includes('context.roundRect(230, 48, 378, 116, 28)'));
assert.ok(warehouseRenderer.includes('context.fillText(statusText, 419, 106, 330)'));
assert.ok(warehouseRenderer.includes('amr.label.position.set(0, 3.26, 0)'));

console.log('Warehouse 3D data, card, camera, AMR follow and billboard style checks passed.');
