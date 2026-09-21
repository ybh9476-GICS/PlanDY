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
assert.ok(warehouseRenderer.includes("const bufferCodeMatch = /^B(\\d+)$/.exec(normalizedValue);"), 'Any B-prefixed numeric code must be parsed as a numbered handoff buffer coordinate.');
assert.ok(warehouseRenderer.includes("const stationCodeMatch = /^S(\\d+)$/.exec(normalizedValue);"), 'Any S-prefixed numeric code must be parsed as a numbered inbound/outbound station.');
assert.ok(warehouseRenderer.includes("if (normalizedValue === 'S' || stationCodeMatch) stationCells.push({"), 'The original unnumbered S station value must remain compatible.');
assert.ok(warehouseRenderer.includes("if (normalizedValue === 'ST') shuttlePassageCells.push({ x, y });"), 'ST must be parsed as a shuttle-only passage coordinate.');
assert.ok(warehouseRenderer.includes("if (normalizedValue === 'CV') conveyorCells.push({ x, y });"), 'CV must be parsed as a conveyor-track coordinate.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseConveyorSource = 'floorPlan-CV';"), 'The viewport must expose the floor-plan source of conveyor cells.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseConveyorColor = '#facc15';"), 'CV lines must use the same yellow as T passage lines.');
assert.ok(warehouseRenderer.includes("conveyorBoundaries.name = 'WAREHOUSE-CONVEYOR-TRACK-LINES';"), 'CV cells must create a separate conveyor boundary layer.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.warehouseConveyorLineCount'), 'The viewport must expose the CV line count for browser verification.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseBufferSource = 'floorPlan-B';"), 'The viewport must expose the floor-plan source of handoff buffer cells.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseBufferColor = '#ffffff';"), 'B lines must use the same white as D dock lines.');
assert.ok(warehouseRenderer.includes("bufferBoundaries.name = 'WAREHOUSE-HANDOFF-BUFFER-LINES';"), 'B cells must create a separate handoff buffer boundary layer.');
assert.ok(warehouseRenderer.includes("bufferBoundaryMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });"), 'B boundary material must be white.');
assert.ok(warehouseRenderer.includes("label.name = `WAREHOUSE-HANDOFF-BUFFER-BILLBOARD-${bufferCode}`;"), 'Each numbered handoff buffer must have an identifiable billboard.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.warehouseStationCellCount'), 'The viewport must expose the station cell count for browser verification.');
assert.ok(warehouseRenderer.includes("shuttleFrameGroup.name = 'WAREHOUSE-4WAY-SHUTTLE-FRAMES';"), 'ST cells must create an identifiable four-way shuttle frame layer.');
assert.ok(warehouseRenderer.includes("coverage: 'full-cell-area'"), 'The shuttle frame must fill the ST cell footprint instead of rendering thin center rails.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.shuttlePassageCellCount'), 'The viewport must expose the ST cell count for browser verification.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleFrameCoverage = 'full-ST-area';"), 'The viewport must expose full ST-area frame coverage.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.shuttleFrameLevelCount'), 'The viewport must expose the repeated shuttle frame level count.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.shuttleFrameTileCount'), 'The viewport must expose the total multi-level shuttle frame tile count.');
assert.ok(warehouseRenderer.includes("group.name = `WAREHOUSE-INOUT-STATION-${station.code}`;"), 'Connected S cells must create numbered inbound/outbound stations.');
assert.ok(!warehouseRenderer.includes('createLabelSprite(THREE, station.code'), 'Inbound/outbound stations must not render name billboards.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleStationBillboardCount = '0';"), 'The viewport must expose that station billboards are hidden.');
assert.ok(!warehouseRenderer.includes('stationRollerMaterial'), 'Inbound/outbound stations must not render cylindrical roller bars.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleStationRollerCount = '0';"), 'The viewport must expose that station roller bars are removed.');
assert.ok(!warehouseRenderer.includes('stationDeckMaterial'), 'Inbound/outbound stations must not render the box deck beneath shuttle lifts.');
assert.ok(!warehouseRenderer.includes('const deckGeometry = new THREE.BoxGeometry(width, 0.16, depth);'), 'The obsolete station floor box geometry must be removed.');
assert.ok(!warehouseRenderer.includes('shuttleStationEntries.push({ ...station, group, deck, width, depth });'), 'Station data must not retain a removed visual deck reference.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleStationDeckCount = '0';"), 'The viewport must expose that station floor boxes are removed.');
assert.ok(warehouseRenderer.includes("group.name = `WAREHOUSE-SHUTTLE-LIFT-${lift.code}`;"), 'The rack transfer points must create shuttle lifts.');
assert.ok(warehouseRenderer.includes('shuttleStationEntries.slice(0, 3)'), 'Only the first three numbered stations may create shuttle lifts.');
assert.ok(warehouseRenderer.includes('platformCount: 1'), 'Every lift must expose exactly one moving platform.');
assert.ok(warehouseRenderer.includes("placement: 'station-centered'"), 'Every shuttle lift must be centered over its inbound/outbound station.');
assert.ok(warehouseRenderer.includes('footprint: [lift.width, lift.depth]'), 'Every shuttle lift must inherit its station footprint.');
assert.ok(warehouseRenderer.includes("frameAlignment: 'post-inner-faces'"), 'Lift beams must terminate at the inner faces of the four vertical posts.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.shuttleLiftPlatformCount'), 'The viewport must expose the lift platform count.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleLiftFrameAlignment = 'post-inner-faces';"), 'The viewport must expose the corrected lift frame alignment.');
assert.ok(warehouseRenderer.includes('new THREE.BoxGeometry(innerWidth, shuttleFrameHeight, shuttleFrameHeight)'), 'Lift horizontal beams must use the shuttle frame height.');
assert.ok(warehouseRenderer.includes('lift.levelStops.map((levelY) => levelY + shuttleFrameCenterOffset)'), 'Every lift transfer-level beam must align with the shuttle frame center height.');
assert.ok(warehouseRenderer.includes('rackTopFrameElevation'), 'The lift top horizontal frame must align with the rack top frame elevation.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleLiftHorizontalFrameAlignment = 'shuttle-level-center-and-rack-top';"), 'The viewport must expose lift horizontal-frame alignment for browser verification.');
assert.ok(!warehouseRenderer.includes('WAREHOUSE-SHUTTLE-STATION-CONNECTORS'), 'Repeated diagonal station connector floors must not protrude through lift posts.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleLiftFloorAlignment = 'moving-platform-inside-posts';"), 'The viewport must expose the corrected lift floor alignment.');
assert.ok(warehouseRenderer.includes("platform.rotation.set(0, 0, 0);"), 'The moving lift floor must remain axis aligned.');
assert.ok(warehouseRenderer.includes("platform.name = 'shuttle-lift-platform-anchor';"), 'The lift must keep a non-rendered logical anchor for shuttle movement.');
assert.ok(!warehouseRenderer.includes('liftPlatformGeometry'), 'The lift must not leave a visible box platform after raising the shuttle.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleLiftVisiblePlatformCount = '0';"), 'The viewport must expose that lift box platforms are not rendered.');
assert.ok(warehouseRenderer.includes("group.name = `FOUR-WAY-SHUTTLE-${equipmentCode}`;"), 'The shuttle system must identify each moving vehicle by its equipment master code.');
assert.ok(warehouseRenderer.includes('const shuttleFootprintMm = calculateShuttleFootprintMm('), 'Four-way shuttle vehicles must derive their footprint from the floor-plan station width.');
assert.ok(warehouseRenderer.includes('shuttleFootprintMm - shuttlePathToleranceMm'), 'The dynamically sized shuttle must retain a proportional navigation tolerance.');
assert.ok(warehouseRenderer.includes('const shuttleFrameHeight = 0.085;'), 'The shuttle frame must expose one shared height for its rails and vehicle body.');
assert.ok(warehouseRenderer.includes('new THREE.BoxGeometry(shuttleBodySize, shuttleFrameHeight, shuttleBodySize)'), 'The blue shuttle body thickness must equal the shuttle frame height and fit inside the rails.');
assert.ok(!warehouseRenderer.includes('shuttleTopGeometry'), 'The separate cyan shuttle top plate marked in red must be removed.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.shuttleVehicleFootprint'), 'The viewport must expose the shuttle footprint for browser verification.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleBodyPlacement = 'inside-frame';"), 'The viewport must expose that the shuttle body sits inside the yellow frame.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleTopPlate = 'false';"), 'The viewport must expose that the separate top plate is absent.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.shuttlePathClearance'), 'The viewport must expose the shuttle path clearance used for browser verification.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleSizingSource = 'floorPlan-S';"), 'The viewport must expose the automatic floor-plan sizing source.');
assert.ok(warehouseRenderer.includes("shuttle.loadDimensions.source === 'rack-slot'"), 'The carried shuttle load must use its destination rack slot dimensions.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.shuttleLoadSizes'), 'The viewport must expose every shuttle load size for browser verification.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleLiftPlacement = 'station-centered';"), 'The viewport must expose station-centered lift placement.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.shuttleFlow = shuttleFleet.length ? 'amr-station-shuttle-rack-bidirectional' : 'unavailable';"), 'The viewport must expose the bidirectional AMR/station/shuttle flow.');
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
assert.ok(warehouseRenderer.includes("truck.name = `WAREHOUSE-STATIC-5T-TRUCK-${layout.rackCode}`;"), 'Each loading dock must own an identifiable static five-ton box truck.');
assert.ok(warehouseRenderer.includes("cargoDimensions: { length: 6.2, width: 2.2, height: 2.3 }"), 'The truck cargo box must retain the requested reference dimensions.');
assert.ok(warehouseRenderer.includes('const createCabGeometry = () => {'), 'The truck must use one low-poly cab-over shell.');
assert.ok(warehouseRenderer.includes("addPart('truck-cab-shell', createCabGeometry()"), 'The sloped cab shell must replace stacked rectangular cab boxes.');
assert.ok(warehouseRenderer.includes("modelStyle: 'reference-low-poly-cab-over'"), 'The truck must identify the attached-image-inspired model style.');
assert.ok(warehouseRenderer.includes("box('truck-windshield', [1.82, 0.82, 0.012], [0, 2.08, 8.17], materials.glass);"), 'The broad front windshield must sit flat outside the vertical cab face.');
assert.ok(warehouseRenderer.includes("new THREE.ShapeGeometry(sideWindowShape)"), 'The cab must include trapezoidal side windows from the reference silhouette.');
assert.ok(warehouseRenderer.includes("box('truck-side-mirror'"), 'The reference truck must include side mirrors.');
assert.ok(warehouseRenderer.includes("box('truck-front-grille'"), 'The reference truck must include the dark front grille.');
assert.ok(warehouseRenderer.includes("box('truck-cargo-corner-trim'"), 'The cargo box must include the thin edge trim visible in the reference.');
assert.ok(warehouseRenderer.includes('const truckAxlePositions = [1.08, 2.2, 7.15];'), 'The truck must use one front axle and tandem rear axles.');
assert.ok(!warehouseRenderer.includes("truck-cab-lower"), 'The old stacked lower cab box must be removed.');
assert.ok(!warehouseRenderer.includes("truck-cab-upper"), 'The old stacked upper cab box must be removed.');
assert.ok(!warehouseRenderer.includes("truck-cargo-vertical-trim"), 'The cargo box sides must remain plain like the reference.');
assert.ok(warehouseRenderer.includes('const staticTrucks = loadingDockLayoutEntries.map(createStaticTruck).filter(Boolean);'), 'Every numbered loading dock must create one truck.');
assert.ok(!warehouseRenderer.includes('const loadingDockLayouts = calculateLoadingDockLayouts('), 'The scene list variable must not shadow the dock layout function during initialization.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseTruck = staticTrucks.length ? 'static-5t-fleet' : 'none';"), 'The viewport must expose truck fleet availability for browser verification.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.warehouseTruckCount = String(staticTrucks.length);'), 'The viewport must expose the per-dock truck count.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.warehouseTruckDockCodes'), 'The viewport must expose the dock code assigned to every truck.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseTruckModel = staticTrucks.length ? 'reference-low-poly-cab-over' : 'none';"), 'The viewport must expose the replacement truck model.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseTruckAxleCount = staticTrucks.length ? '3' : '0';"), 'The viewport must expose the three-axle reference silhouette.');
assert.ok(warehouseRenderer.includes('function createTruckInfoBillboardSprite(THREE, info = {})'), 'Truck information must use a dedicated billboard renderer.');
assert.ok(warehouseRenderer.includes("context.fillText(workType, 28, 44);"), 'The truck billboard title must start with the inbound or outbound label.');
assert.ok(warehouseRenderer.includes('canvas.width = 520 * worldUiResolutionScale;'), 'The truck billboard must remove unused horizontal space.');
assert.ok(warehouseRenderer.includes('canvas.height = 300 * worldUiResolutionScale;'), 'The truck billboard must fit progress and the bottom invoice button.');
assert.ok(warehouseRenderer.includes("context.fillText(vehicleNumber, 104, 44, 392);"), 'The vehicle registration number must sit close to the operation label on the title row.');
assert.ok(warehouseRenderer.includes('const y = 116 + index * 50;'), 'Truck billboard body rows must use compact vertical spacing.');
assert.ok(warehouseRenderer.includes('context.fillText(value, 136, y, 360);'), 'Truck billboard values must sit close to their labels.');
assert.ok(warehouseRenderer.includes("const invoiceButtonLabel = '송장보기';"), 'The truck billboard must display the invoice button label.');
assert.ok(warehouseRenderer.includes("const companyLabel = workType === '출고' ? '공급처' : '납품처';"), 'Sender and receiver data must use the requested warehouse labels.');
assert.ok(warehouseRenderer.includes("[companyLabel, companyName]"), 'The truck billboard must display the sender or receiver company name.');
assert.ok(warehouseRenderer.includes("[`${workType} 예정`, itemSummary]"), 'The truck billboard must display the scheduled item and quantity.');
assert.ok(warehouseRenderer.includes("fontReference: 'transport-equipment-billboard'"), 'Truck billboard text sizing must declare the transport-equipment reference.');
assert.ok(warehouseRenderer.includes('infoBillboard.position.set(0, warehouseFloorElevation + 3.55, cargoLength / 2);'), 'Truck information must sit above the cargo body at a readable height.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseTruckInfoFields = 'vehicle-number,company-name,scheduled-item-quantity';"), 'The viewport must expose all truck billboard fields.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.warehouseTruckInfoInvoiceButton = '송장보기';"), 'The viewport must expose the invoice button label.');
assert.ok(warehouseRenderer.includes('const loadingDockBillboardHeight = warehouseFloorElevation + 2.6;'), 'Loading-dock billboards must sit above the dock and truck body at a readable height.');
assert.ok(warehouseRenderer.includes('const label = createLabelSprite(THREE, layout.rackCode);'), 'Loading docks must reuse the rack billboard visual style.');
assert.ok(warehouseRenderer.includes("label.name = `WAREHOUSE-LOADING-DOCK-BILLBOARD-${layout.rackCode}`;"), 'Every loading-dock billboard must remain identifiable in the 3D scene.');
assert.ok(warehouseRenderer.includes("billboardStyle: 'rack-label'"), 'Loading-dock billboards must declare the shared rack-label style.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.warehouseDockBillboardCount = String(loadingDockBillboards.length);'), 'The viewport must expose the number of loading-dock billboards.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.warehouseDockBillboardCodes'), 'The viewport must expose every displayed loading-dock code.');
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
assert.ok(warehouseRenderer.includes('formatLocalDateTime(new Date(value))'), 'Equipment history and the clock must use the same local date-time format.');
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
assert.ok(warehouseRenderer.includes('const mobileEquipmentRows = [...amrFleet, ...shuttleFleet].map'), 'Equipment rows must represent the real AMR and shuttle fleets, not mockup entries.');
assert.ok(warehouseRenderer.includes('const barcodeTunnelEquipmentRows = barcodeTunnelModel.entries.map'), 'Scan tunnels must be represented in the equipment rows.');
assert.ok(warehouseRenderer.includes('equipment: [...mobileEquipmentRows, ...barcodeTunnelEquipmentRows]'), 'The equipment group must combine transport equipment and scan tunnels.');
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
assert.ok(warehouseRenderer.includes('getChamferedBoxGeometry(boxWidth, boxHeight, boxDepth)'), 'Empty slot boxes must retain their full cell-height visualization.');
assert.ok(warehouseRenderer.includes('getChamferedBoxGeometry(boxWidth, unitLoad.cargoHeight, boxDepth)'), 'Occupied boxes must reserve pallet height while preserving the combined unit-load height.');
assert.ok(warehouseRenderer.includes('const unitLoadPalletHeight = 0.14;'), 'Rack and shuttle pallets must use the proposed 14cm height.');
assert.ok(warehouseRenderer.includes("const unitLoadPalletColor = '#6b5a45';"), 'Rack and shuttle pallets must share the proposed dark gray-brown color.');
assert.ok(warehouseRenderer.includes("deckMesh.name = 'rack-pallet-decks';"), 'Occupied rack cells must include instanced pallet decks.');
assert.ok(warehouseRenderer.includes("supportMesh.name = 'rack-pallet-four-way-supports';"), 'Occupied rack pallets must use four-way support blocks.');
assert.ok(warehouseRenderer.includes('xOffsets.flatMap((x) => zOffsets.map((z) => ({ x, z })))'), 'Four-way pallets must arrange nine independent supports in a 3x3 layout.');
assert.ok(!warehouseRenderer.includes("runnerMesh.name = 'rack-pallet-runners';"), 'The previous one-direction continuous pallet runners must be removed.');
assert.ok(warehouseRenderer.includes('const occupiedSlots = slots.filter((slot) => slot.occupied);'), 'Only occupied rack cells may receive pallets.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.rackPalletCount'), 'The viewport must expose the occupied rack pallet count.');
assert.ok(warehouseRenderer.includes("load.name = 'shuttle-carried-unit-load';"), 'A shuttle must carry the box and pallet as one visible unit load.');
assert.ok(warehouseRenderer.includes("pallet.name = 'shuttle-carried-pallet';"), 'A shuttle load must include the same pallet structure.');
assert.ok(warehouseRenderer.includes("support.name = 'shuttle-pallet-four-way-support';"), 'Shuttle-carried pallets must use the same four-way support shape.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.palletForkEntryDirections = '4';"), 'The viewport must expose four-direction fork entry for browser verification.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.palletSupportLayout = '3x3';"), 'The viewport must expose the 3x3 pallet support layout.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.shuttlePalletCount'), 'The viewport must expose the shuttle pallet count.');
assert.ok(warehouseRenderer.includes('(slot?.palletInstances || []).forEach'), 'Rack task visibility changes must keep the box and its pallet together.');
assert.ok(warehouseRenderer.includes('depthIndex <= depthCount'), 'Every rack depth position must create a slot box.');
assert.ok(warehouseRenderer.includes('const depthFramePositions = getRackDepthFramePositions(rackRowCount, depthCount, depth);'), 'Rack frame positions must follow the rack type depth count.');
assert.ok(/const rackFrameMaterial[\s\S]*?castShadow: false/.test(warehouseRenderer), 'Rack posts and beams must not cast shadows.');
assert.ok(warehouseRenderer.includes("applyViewMode('utilization')"), 'The default warehouse view must be utilization.');
assert.ok(warehouseStyles.includes('.warehouse-3d-legend .is-empty'), 'The empty slot legend style is missing.');
assert.ok(warehouseRenderer.includes("const rackHorizontalFrameColor = '#f5b942'"), 'Rack horizontal frames must use the shuttle yellow.');
assert.ok(warehouseRenderer.includes("const rackVerticalFrameColor = '#2979FF'"), 'Rack vertical frames must use the requested blue.');
assert.ok(warehouseRenderer.includes("const shuttleFrameMaterial = new THREE.MeshStandardMaterial({ color: '#f5b942'"), 'Shuttle horizontal frames must retain the shared yellow.');
assert.ok(warehouseRenderer.includes("const liftSteelMaterial = new THREE.MeshPhysicalMaterial({ color: '#2979FF'"), 'Shuttle lift vertical frames must use the shared blue.');
assert.ok(warehouseRenderer.includes("const liftAccentMaterial = new THREE.MeshStandardMaterial({ color: '#f5b942'"), 'Shuttle lift horizontal frames must use the shared yellow.');
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
assert.ok(warehouseRenderer.includes('const levelLabelTargets = []'), 'Rack level billboards must have their own priority hit-target list.');
assert.ok(warehouseRenderer.includes("levelLabelGroup.name = `${rack.code}-LEVEL-BILLBOARDS`;"), 'Every rack must own a dedicated level billboard group.');
assert.ok(warehouseRenderer.includes('for (let rackLevel = 1; rackLevel <= type.levels; rackLevel += 1)'), 'Rack level billboards must follow the rack master level count.');
assert.ok(warehouseRenderer.includes('function createLevelBadgeSprite(THREE, level)'), 'Rack levels must use a dedicated badge renderer.');
assert.ok(warehouseRenderer.includes('const levelLabel = createLevelBadgeSprite(THREE, rackLevel);'), 'Every rack level must render as the distinct badge style.');
assert.ok(!warehouseRenderer.includes('createLabelSprite(THREE, `LV${rackLevel}`'), 'Rack levels must not reuse the rectangular rack-name billboard.');
assert.ok(warehouseRenderer.includes('levelLabelTargets.push(levelLabel);'), 'Every generated level billboard must be selectable.');
assert.ok(warehouseRenderer.includes("levelLabel.userData = { kind: 'rack-level-label'"), 'Level billboards must retain their rack and level selection data.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.rackLevelBillboardCount"), 'The viewport must expose the generated level billboard count.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.rackLevelBillboardShape = 'circle';"), 'The viewport must expose the distinct circular level badge shape.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.rackLevelBillboardLabelFormat = 'L-number';"), 'The viewport must expose the compact level badge text format.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.selectedRackLevel"), 'The viewport must expose the selected rack level for browser verification.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.rackLevelView = active ? 'top' : '';"), 'A selected rack level must expose top-view mode.');
assert.ok(warehouseRenderer.includes('entry.slots.forEach(applySlotInstanceVisibility);'), 'Rack level focus must refresh every slot instance while preserving task visibility.');
assert.ok(warehouseRenderer.includes("entry.group.visible = !active || selectedEntry;"), 'Rack level focus must hide every non-selected rack.');
assert.ok(warehouseRenderer.includes("const focusRackLevelTopView = (rackData, level) =>"), 'Selecting a level must use a rack-centered top-view camera.');
assert.ok(warehouseRenderer.includes("target.set(center.x, warehouseFloorElevation + (level - 0.5) * rackLevelHeight, center.z);"), 'The top view must center the selected rack and level.');
assert.ok(warehouseRenderer.includes("const showRackLevelSelection = (rackData, level) =>"), 'The inspector must show selected-level capacity, inventory and status information.');
assert.match(warehouseRenderer, /const setSelectedRack = \(rackData\) => \{[\s\S]*?restoreCameraAfterRackLevelClear\?\.\(selectedRack\)/, 'Leaving a rack level through another selection must restore the quarter-view camera.');
assert.ok(warehouseRenderer.includes("const rackLevelLabel = getRackLevelLabelAtPointer(event);"), 'Pointer selection must check level billboards before other 3D objects.');
assert.ok(/if \(labelRack\) \{\s*setHoveredSlot\(null\);\s*setHoveredRack\(labelRack\);\s*return;\s*\}\s*const slot = getSlotAtPointer\(event\);/.test(warehouseRenderer), 'Billboard hover must run before slot hover detection.');
assert.ok(/if \(labelRack\) \{\s*setSelectedZone\('', false\);\s*setSelectedSlot\(null\);\s*setHoveredSlot\(null\);\s*setSelectedRack\(labelRack\);\s*setFocusedRack\(labelRack\);\s*focusRackInCurrentView\(labelRack\);\s*showSelection\(labelRack\);\s*return;\s*\}\s*const slot = getSlotAtPointer\(event\);/.test(warehouseRenderer), 'Billboard selection must clear zone and slot information, isolate and fit the rack before slot selection.');
assert.ok(warehouseRenderer.includes("normal: { fill: '#050f1e'"), 'Rack billboards must have an opaque normal visual state.');
assert.ok(warehouseRenderer.includes("hover: { fill: '#0f3460'"), 'Rack billboard hover must use an opaque lighter blue state.');
assert.ok(warehouseRenderer.includes("selected: { fill: '#2563EB'"), 'Rack billboard selected state must use a stronger blue based on the normal state.');
assert.ok(warehouseRenderer.includes("sprite.setInteractionState = (state = 'normal') =>"), 'Rack billboards must expose an animated interaction-state renderer.');
assert.ok(warehouseRenderer.includes("setRackLabelState(selectedRack, 'selected')"), 'Rack selection must update the billboard selected state.');
assert.ok(warehouseRenderer.includes('dimmedMaterial.opacity = 0.1'), 'Non-selected racks must use exactly 10% opacity.');
assert.ok(warehouseRenderer.includes('dimmedMaterial.depthWrite = false'), 'Dimmed racks must not obstruct the selected rack through depth writes.');
assert.ok(warehouseRenderer.includes('originalMaterialsByObject'), 'Rack focus must preserve shared original materials for restoration.');
assert.ok(warehouseRenderer.includes('rackStructureObjects.push('), 'Rack posts, beams and shelf frames must be tracked separately from inventory boxes.');
assert.ok(warehouseRenderer.includes("entry.rack === focusedRack.rack ? 'frames' : 'all'"), 'The selected rack must dim only its structure while other racks dim completely.');
assert.ok(warehouseRenderer.includes('shuttleFrameVisualObjects.push(object);'), 'Shuttle deck and passage frames must participate in rack-focus dimming.');
assert.ok(warehouseRenderer.includes('shuttleFrameVisualObjects.push(post);'), 'Shuttle lift vertical frames must participate in rack-focus dimming.');
assert.ok(warehouseRenderer.includes('setShuttleFrameDimmed(Boolean(focusedRack));'), 'Selecting any rack must dim the shuttle frame with the other racks.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.rackFocusDimming = focusedRack ? 'rack-and-shuttle-frames' : 'none';"), 'The viewport must expose rack and shuttle frame focus dimming for browser verification.');
assert.ok(warehouseRenderer.includes('setFocusedRack(labelRack)'), 'Selecting a rack billboard must isolate the selected rack.');
assert.ok(warehouseRenderer.includes('focusRackInCurrentView(labelRack)'), 'Selecting a rack billboard must fit it in the current camera view.');
assert.ok(warehouseRenderer.includes('setFocusedRack(null); showSelection(slot)'), 'Selecting a slot must restore all rack opacity.');
assert.ok(warehouseRenderer.includes('rackEntries.forEach((entry) => { entry.group.visible = true; });'), 'Removing the top filters must keep every rack visible.');
assert.ok(warehouseRenderer.includes('new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })'), 'Every billboard material must ignore 3D depth and tone mapping.');
assert.ok(warehouseRenderer.includes('const billboardRenderOrder = 10000'), 'Every billboard must share a render order above 3D objects and selection overlays.');
assert.ok(warehouseRenderer.includes('sprite.renderOrder = billboardRenderOrder'), 'Rack, level, AMR and shuttle billboards must use the shared foreground render order.');
assert.ok(warehouseRenderer.includes("normal: { fill: '#050f1e'"), 'Billboard content backgrounds must be opaque so selection outlines cannot show through.');
assert.ok(warehouseRenderer.includes('const baseOpacity = 1'), 'Billboard sprite materials must remain fully opaque during interaction transitions.');
assert.ok(warehouseRenderer.includes('renderer.sortObjects = true'), 'The renderer must preserve billboard and outline ordering.');
assert.ok(warehouseRenderer.includes('outline.renderOrder = 12'), 'Rack outlines must render before rack billboards.');
assert.ok(warehouseRenderer.includes('new THREE.EdgesGeometry(boxGeometry)'), 'Cell outlines must use a simple box outer edge geometry.');
assert.ok(!warehouseRenderer.includes('new THREE.EdgesGeometry(getChamferedBoxGeometry(width, height, depth), 20)'), 'Cell outlines must not include chamfer seam edges.');
assert.ok(warehouseRenderer.includes('addOuterEdgeTubes(outline, edgeGeometry, 0.042, material, 12)'), 'Rack outlines must use the same thick outer-edge tubes as selected cells.');
assert.ok(warehouseRenderer.includes('new THREE.MeshBasicMaterial({ color: \'#78ABFF\''), 'Rack hover outlines must use the requested blue material.');
assert.ok(warehouseRenderer.includes('new THREE.MeshBasicMaterial({ color: \'#3B82F6\''), 'Rack selected outlines must use the requested blue material.');
assert.ok(warehouseRenderer.includes('labelLayer.renderOrder = billboardRenderOrder'), 'Rack billboards must use the shared foreground render group.');
assert.ok(warehouseRenderer.includes('levelLabelGroup.renderOrder = billboardRenderOrder'), 'Rack level billboards must use the shared foreground render group.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.billboardOcclusionMode = 'foreground-opaque';"), 'The viewport must expose foreground billboard rendering for browser verification.');
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
const calculateLoadingDockLayouts = sandbox.window.wmsWarehouse3D.calculateLoadingDockLayouts;
const calculateLoadingDockLayout = sandbox.window.wmsWarehouse3D.calculateLoadingDockLayout;
const calculateLoadingYardLayout = sandbox.window.wmsWarehouse3D.calculateLoadingYardLayout;
const getRackDepthFramePositions = sandbox.window.wmsWarehouse3D.getRackDepthFramePositions;
const getWarehouseStructureOcclusion = sandbox.window.wmsWarehouse3D.getWarehouseStructureOcclusion;
const buildPassageBoundarySegments = sandbox.window.wmsWarehouse3D.buildPassageBoundarySegments;
const groupConnectedFloorCells = sandbox.window.wmsWarehouse3D.groupConnectedFloorCells;
const buildConveyorLayout = sandbox.window.wmsWarehouse3D.buildConveyorLayout;
const conveyorRect = (x, y, width, depth, size = 500) => Array.from({ length: width * depth }, (_, i) => ({
    x: (x + i % width) * size, y: (y + Math.floor(i / width)) * size
}));
const verifyConveyorCoverage = (cells, layout) => {
    const expected = new Set(cells.map((cell) => `${cell.x}:${cell.y}`));
    const covered = new Set();
    layout.modules.forEach((module) => {
        for (let y = module.minY; y < module.maxY; y += layout.cellSize) {
            for (let x = module.minX; x < module.maxX; x += layout.cellSize) {
                const key = `${x}:${y}`;
                assert.ok(expected.has(key), 'Conveyors must not cover non-CV floor cells.');
                assert.ok(!covered.has(key), 'Junctions must never contain overlapping conveyor modules.');
                covered.add(key);
            }
        }
    });
    assert.strictEqual(covered.size, expected.size, 'Every CV cell must have a conveyor surface.');
    layout.rails.forEach((rail) => {
        const x = rail.x - rail.dx * layout.cellSize / 2 - layout.cellSize / 2;
        const y = rail.y - rail.dy * layout.cellSize / 2 - layout.cellSize / 2;
        assert.ok(!expected.has(`${x + rail.dx * layout.cellSize}:${y + rail.dy * layout.cellSize}`),
            'No side rail may block a shared conveyor connection.');
    });
};
assert.strictEqual(buildConveyorLayout([]).modules.length, 0, 'Removing CV must remove all conveyor modules.');
[4, 2, 1].forEach((width) => {
    const cells = conveyorRect(0, 0, 16, width);
    const layout = buildConveyorLayout(cells);
    verifyConveyorCoverage(cells, layout);
    assert.strictEqual(layout.modules.length, 1);
    assert.strictEqual(layout.modules[0].axis, 'x');
    assert.strictEqual(layout.modules[0].width, width * 500, 'Conveyor width must follow 2m, 1m and 0.5m CV bands.');
    assert.ok(layout.rails.every((rail) => rail.axis === 'x'), 'Straight endpoints must stay open.');
    const rotated = buildConveyorLayout(cells.map((cell) => ({ x: cell.y, y: cell.x })));
    assert.strictEqual(rotated.modules[0].axis, 'z');
    assert.strictEqual(rotated.modules[0].width, width * 500);
});
const conveyorShapes = {
    corner: [...conveyorRect(0, 0, 16, 4), ...conveyorRect(0, 0, 4, 16)],
    tee: [...conveyorRect(0, 0, 20, 4), ...conveyorRect(8, 0, 4, 16)],
    cross: [...conveyorRect(0, 8, 20, 4), ...conveyorRect(8, 0, 4, 20)],
    multiple: [...conveyorRect(0, 0, 32, 4), ...conveyorRect(8, 0, 4, 16), ...conveyorRect(22, 0, 4, 16)],
    widthChange: [...conveyorRect(0, 0, 10, 4), ...conveyorRect(10, 1, 10, 2)],
    separated: [...conveyorRect(0, 0, 16, 4), ...conveyorRect(30, 20, 2, 12)]
};
Object.entries(conveyorShapes).forEach(([name, cells]) => {
    const layout = buildConveyorLayout(cells);
    verifyConveyorCoverage(cells, layout);
    if (['corner', 'tee', 'cross'].includes(name)) {
        assert.strictEqual(layout.modules.filter((module) => module.axis === 'transfer').length, 1,
            `${name} must contain exactly one transfer module.`);
        assert.strictEqual(layout.modules.find((module) => module.axis === 'transfer').width, 2000);
    }
    if (name === 'multiple') assert.strictEqual(layout.modules.filter((module) => module.axis === 'transfer').length, 2);
    if (name === 'widthChange') assert.deepStrictEqual([...new Set(layout.modules.map((module) => module.width))], [2000, 1000]);
    const moved = buildConveyorLayout(cells.map((cell) => ({ x: cell.x + 3500, y: cell.y + 2000 })));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(moved.modules)), JSON.parse(JSON.stringify(layout.modules.map((module) => ({
        ...module, minX: module.minX + 3500, maxX: module.maxX + 3500, minY: module.minY + 2000, maxY: module.maxY + 2000
    })))), 'Moving CV cells must translate their modules without changing dimensions.');
});
const coarseConveyor = buildConveyorLayout(conveyorRect(0, 0, 8, 2, 1000), 1000);
assert.strictEqual(coarseConveyor.modules[0].width, 2000, 'Conveyors must respect the configured cell size.');
const calculateAmrPassageClearanceMm = sandbox.window.wmsWarehouse3D.calculateAmrPassageClearanceMm;
const buildAmrCorridorAssignments = sandbox.window.wmsWarehouse3D.buildAmrCorridorAssignments;
const buildShuttleRailLayout = sandbox.window.wmsWarehouse3D.buildShuttleRailLayout;
const calculateShuttleFootprintMm = sandbox.window.wmsWarehouse3D.calculateShuttleFootprintMm;
const calculateShuttleLoadDimensions = sandbox.window.wmsWarehouse3D.calculateShuttleLoadDimensions;
const calculateLiftFrameDimensions = sandbox.window.wmsWarehouse3D.calculateLiftFrameDimensions;
const buildOrthogonalConnectorPath = sandbox.window.wmsWarehouse3D.buildOrthogonalConnectorPath;
const calculateShuttleLevelElevations = sandbox.window.wmsWarehouse3D.calculateShuttleLevelElevations;
const buildShuttleFrameLayout = sandbox.window.wmsWarehouse3D.buildShuttleFrameLayout;
const buildPassageNavigationGraph = sandbox.window.wmsWarehouse3D.buildPassageNavigationGraph;
const findPassagePath = sandbox.window.wmsWarehouse3D.findPassagePath;
const findNearestPassageNode = sandbox.window.wmsWarehouse3D.findNearestPassageNode;
const getForkTargetHeight = sandbox.window.wmsWarehouse3D.getForkTargetHeight;
const getForkliftTaskSequence = sandbox.window.wmsWarehouse3D.getForkliftTaskSequence;
const calculateRackFocusView = sandbox.window.wmsWarehouse3D.calculateRackFocusView;
const getSlotVisualKey = sandbox.window.wmsWarehouse3D.getSlotVisualKey;
const getCartonStackLayout = sandbox.window.wmsWarehouse3D.getCartonStackLayout;
[[1, 0.86, 1], [2.4, 1.1, 1.8], [0.25, 0.1, 0.4]].forEach(([width, height, depth]) => {
    const layout = getCartonStackLayout(width, height, depth);
    assert.strictEqual(layout.positions.length, 8, 'A transport unit must show eight individual cartons.');
    const [w, h, d] = layout.cartonSize;
    const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} must equal ${expected}`);
    near(Math.min(...layout.positions.map(p => p.x - w / 2)), -width / 2);
    near(Math.max(...layout.positions.map(p => p.x + w / 2)), width / 2);
    near(Math.min(...layout.positions.map(p => p.y - h / 2)), 0);
    near(Math.max(...layout.positions.map(p => p.y + h / 2)), height);
    near(Math.min(...layout.positions.map(p => p.z - d / 2)), -depth / 2);
    near(Math.max(...layout.positions.map(p => p.z + d / 2)), depth / 2);
    layout.positions.forEach((a, i) => layout.positions.slice(i + 1).forEach(b => {
        assert.ok(Math.abs(a.x - b.x) >= w || Math.abs(a.y - b.y) >= h || Math.abs(a.z - b.z) >= d,
            'Cartons must remain separated instead of overlapping when cell dimensions change.');
    }));
});
const cartonAppearanceContext = vm.createContext({});
vm.runInContext(warehouseRenderer.slice(warehouseRenderer.indexOf('    function setUnitLoadStoredAppearance('),
    warehouseRenderer.indexOf('    function getSlotVisualKey(')), cartonAppearanceContext);
const changeStoredAppearance = vm.runInContext('setUnitLoadStoredAppearance', cartonAppearanceContext);
let storedCargoColor;
const inventoryCargo = { visible: true, material: { color: { set(color) { storedCargoColor = color; } } } };
const transportCartons = { visible: false };
const testPallet = { width: 1, depth: 1 };
const testLoad = { userData: { loadSize: [1, 1, 1] }, pallet: testPallet,
    getObjectByName(name) { return name === 'forklift-carried-load-box' ? inventoryCargo : transportCartons; } };
changeStoredAppearance(testLoad, false, '#ef4444');
assert.strictEqual(inventoryCargo.visible, false);
assert.strictEqual(transportCartons.visible, true, 'Non-rack cargo must use cardboard packaging independently of inventory color.');
changeStoredAppearance(testLoad, true, '#f59e0b');
assert.strictEqual(inventoryCargo.visible, true);
assert.strictEqual(transportCartons.visible, false, 'Stored packaging must not duplicate the inventory-colored rack cargo.');
assert.strictEqual(storedCargoColor, '#f59e0b');
changeStoredAppearance(testLoad, true, '#22c55e');
assert.strictEqual(storedCargoColor, '#22c55e', 'Stored cargo must follow a changed inventory color view.');
changeStoredAppearance(testLoad, false);
assert.strictEqual(transportCartons.visible, true, 'Picking must restore cardboard packaging.');
assert.strictEqual(testLoad.pallet, testPallet);
assert.deepStrictEqual(testLoad.userData.loadSize, [1, 1, 1], 'Appearance changes must preserve the transported unit dimensions.');
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
const numberedLoadingDocks = JSON.parse(JSON.stringify(calculateLoadingDockLayouts(
    [], [], 12000, 10000, 'W04',
    [
        { x: 1000, y: 9000, code: 'D01' }, { x: 1500, y: 9000, code: 'D01' },
        { x: 5000, y: 9000, code: 'D02' }, { x: 5500, y: 9000, code: 'D02' },
        { x: 9000, y: 9000, code: 'D03' }, { x: 9500, y: 9000, code: 'D03' }
    ],
    500
)));
assert.deepStrictEqual(
    numberedLoadingDocks.map(({ rackCode, anchorX, anchorZ, yaw }) => ({ rackCode, anchorX, anchorZ, yaw })),
    [
        { rackCode: 'D01', anchorX: 1500, anchorZ: 10000, yaw: 0 },
        { rackCode: 'D02', anchorX: 5500, anchorZ: 10000, yaw: 0 },
        { rackCode: 'D03', anchorX: 9500, anchorZ: 10000, yaw: 0 }
    ],
    'Every numbered dock group must create an independent truck anchor and orientation.'
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
    side: 'front', approachDepth: 15000,
    centerX: 5000, centerZ: 15500, sizeX: 14000, sizeZ: 15000
}, 'The vehicle yard must extend from the front floor-plan boundary with side shoulders.');
const rightLoadingYard = JSON.parse(JSON.stringify(calculateLoadingYardLayout(rightLoadingDock, 10000, 8000)));
assert.deepStrictEqual(rightLoadingYard, {
    side: 'right', approachDepth: 15000,
    centerX: 17500, centerZ: 4000, sizeX: 15000, sizeZ: 12000
}, 'Moving W04 to a side wall must rotate and reposition the vehicle yard with the floor plan.');
assert.strictEqual(calculateLoadingYardLayout(null, 10000, 8000), null, 'A missing W04 loading side must not create an arbitrary vehicle yard.');
const calculateTruckYardPlacement = sandbox.window.wmsWarehouse3D.calculateTruckYardPlacement;
const truckFootprint = { minX: -1300, maxX: 1300, minZ: -250, maxZ: 8500 };
const cornerDocks = calculateLoadingDockLayouts([], [], 20000, 30000, 'W04', [
    { x: 3000, y: 28000, code: 'D01' }, { x: 19500, y: 28000, code: 'D03' }
], 500);
assert.strictEqual(cornerDocks[1].side, 'right', 'Reproduce the corner dock that previously sent D03 onto unsupported ground.');
const cornerYard = calculateLoadingYardLayout(cornerDocks[0], 20000, 30000);
const correctedCornerTruck = calculateTruckYardPlacement(cornerDocks[1], cornerYard, truckFootprint);
assert.strictEqual(correctedCornerTruck.side, 'front', 'D03 must park on the existing front yard, even when the dock is closer to a side wall.');
assert.strictEqual(correctedCornerTruck.yaw, 0);
assert.strictEqual(correctedCornerTruck.anchorX, 19750, 'The truck must retain its alignment with the dock along the yard edge.');
['front', 'back', 'left', 'right'].forEach((side) => {
    [[20000, 30000], [500, 500], [52000, 8000]].forEach(([width, depth]) => {
        const yard = calculateLoadingYardLayout({ side }, width, depth);
        [{ minX: -5000, maxX: -4500, minZ: -5000, maxZ: -4500 },
            { minX: width, maxX: width + 500, minZ: depth, maxZ: depth + 500 }].forEach((bounds) => {
            const placement = calculateTruckYardPlacement({ bounds }, yard, truckFootprint);
            assert.ok(placement, 'Every supported yard orientation and floor size must fit the truck.');
            const result = placement.bounds;
            assert.ok(result.minX >= yard.centerX - yard.sizeX / 2 + 249.99);
            assert.ok(result.maxX <= yard.centerX + yard.sizeX / 2 - 249.99);
            assert.ok(result.minZ >= yard.centerZ - yard.sizeZ / 2 + 249.99);
            assert.ok(result.maxZ <= yard.centerZ + yard.sizeZ / 2 - 249.99);
        });
    });
});
assert.strictEqual(calculateTruckYardPlacement(cornerDocks[0], null, truckFootprint), null, 'No yard must mean no floating truck.');
assert.strictEqual(calculateTruckYardPlacement(cornerDocks[0], { ...cornerYard, sizeZ: 1000 }, truckFootprint), null,
    'A truck must never be displayed on a yard too small for its physical footprint.');
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
const groupedStations = JSON.parse(JSON.stringify(groupConnectedFloorCells([
    { x: 3000, y: 0 }, { x: 3500, y: 0 },
    { x: 3000, y: 2000 }, { x: 3500, y: 2000 }, { x: 4000, y: 2000 }
], 500)));
assert.deepStrictEqual(groupedStations.map((group) => ({
    count: group.cells.length,
    minX: group.minX,
    minY: group.minY,
    maxX: group.maxX,
    maxY: group.maxY
})), [
    { count: 2, minX: 3000, minY: 0, maxX: 4000, maxY: 500 },
    { count: 3, minX: 3000, minY: 2000, maxX: 4500, maxY: 2500 }
], 'Separated S-cell clusters must become independent stations in top-to-bottom order.');
const shuttleRailLayout = JSON.parse(JSON.stringify(buildShuttleRailLayout([
    { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 }
], [
    { x: 1500, y: 0 }, { x: 2000, y: 0 },
    { x: 1500, y: 1000 }
], 500)));
assert.strictEqual(shuttleRailLayout.segments.filter((segment) => !segment.stationConnector).length, 2, 'Adjacent ST cells must create one shuttle navigation segment per shared direction.');
assert.strictEqual(shuttleRailLayout.segments.filter((segment) => segment.stationConnector).length, 2, 'Every separate S cluster must connect to its nearest ST passage.');
assert.deepStrictEqual(shuttleRailLayout.stations.map((station) => station.code), ['S01', 'S02'], 'Connected S clusters must receive expandable S01, S02 numbering.');
const numberedStationLayout = JSON.parse(JSON.stringify(buildShuttleRailLayout([
    { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 }
], [
    { x: 1500, y: 0, code: 'S2' },
    { x: 1500, y: 500, code: 'S01' }
], 500)));
assert.deepStrictEqual(numberedStationLayout.stations.map((station) => station.code), ['S01', 'S02'], 'Explicit S numbers must be normalized and preserved in numeric order.');
assert.strictEqual(numberedStationLayout.stations.length, 2, 'Adjacent cells with different S numbers must remain separate stations.');
const mixedStationLayout = JSON.parse(JSON.stringify(buildShuttleRailLayout([
    { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 }
], [
    { x: 1500, y: 0, code: 'S01' },
    { x: 1500, y: 1000 }
], 500)));
assert.deepStrictEqual(mixedStationLayout.stations.map((station) => station.code), ['S01', 'S02'], 'An unnumbered S cluster must receive the next unused number beside explicitly numbered stations.');
assert.strictEqual(calculateShuttleFootprintMm([
    { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
    { minX: 2000, maxX: 3000, minY: 0, maxY: 1000 }
], 500), 1000, 'A 1.0m S station width must produce a 1.0m shuttle footprint.');
assert.strictEqual(calculateShuttleFootprintMm([
    { minX: 0, maxX: 1500, minY: 0, maxY: 1500 }
], 500), 1500, 'A later 1.5m S station width must continue to resize the shuttle automatically.');
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(calculateShuttleLoadDimensions([
        { boxSize: [0.92, 0.656, 0.9] }
    ], 500))),
    { width: 0.92, height: 0.656, depth: 0.9, source: 'rack-slot' },
    'The carried shuttle load must exactly match the destination rack slot box.'
);
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(calculateShuttleLoadDimensions([], 500))),
    { width: 0.5, height: 0.5, depth: 0.5, source: 'floorPlan-cell-fallback' },
    'A missing rack slot must retain the floor-plan cell fallback.'
);
const oneMeterLiftFrame = calculateLiftFrameDimensions(1, 1, 0.09);
assert.ok(Math.abs(oneMeterLiftFrame.halfPostX - 0.455) < 1e-9, 'A 1m lift post must stay centered 45mm inside the outer edge.');
assert.ok(Math.abs(oneMeterLiftFrame.halfPostZ - 0.455) < 1e-9, 'All four lift posts must use the same untwisted corner offset.');
assert.ok(Math.abs(oneMeterLiftFrame.innerWidth - 0.82) < 1e-9, 'The X beam must span only between the inner faces of 90mm posts.');
assert.ok(Math.abs(oneMeterLiftFrame.innerDepth - 0.82) < 1e-9, 'The Z beam must span only between the inner faces of 90mm posts.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(buildOrthogonalConnectorPath(
    { x: 17.5, z: 6 }, { x: 17.25, z: 5.75 }
))), [
    { x: 17.5, z: 6 }, { x: 17.25, z: 6 }, { x: 17.25, z: 5.75 }
], 'A shuttle must leave the lift through an axis-aligned elbow instead of cutting across the floor diagonally.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(calculateShuttleLevelElevations([
    { rackTypeCode: 'RT-A' }
], [
    { code: 'RT-A', height: 6000, levelHeight: 1200, levels: 5 }
]))), [0, 1200, 2400, 3600, 4800], 'Shuttle frame levels must match every rack storage level exactly.');
const shuttleFrameLayout = JSON.parse(JSON.stringify(buildShuttleFrameLayout([
    { x: 0, y: 0 }, { x: 500, y: 0 }
], [0, 1200, 2400], 500)));
assert.strictEqual(shuttleFrameLayout.tiles.length, 6, 'Every ST cell must create one full-area frame tile at every rack level.');
assert.strictEqual(shuttleFrameLayout.boundaries.length, 18, 'Every rack level must repeat the outer boundary of the connected ST frame.');
assert.deepStrictEqual(shuttleFrameLayout.tiles[5], {
    x: 750,
    y: 250,
    levelY: 2400,
    width: 500,
    depth: 500
}, 'Multi-level frame tiles must retain the complete ST cell footprint.');
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
const threeOneMeterCorridors = [0, 4, 8].flatMap((rowStart) => (
    Array.from({ length: 8 }, (_, cellX) => [
        { x: cellX * 500, y: rowStart * 500 },
        { x: cellX * 500, y: (rowStart + 1) * 500 }
    ]).flat()
));
const adaptiveAmrClearance = calculateAmrPassageClearanceMm(threeOneMeterCorridors, 500, 1950);
assert.strictEqual(adaptiveAmrClearance, 900, 'A 1m passage must keep 100mm total clearance around the AMR route.');
const threeCorridorNavigation = buildPassageNavigationGraph(threeOneMeterCorridors, 500, adaptiveAmrClearance);
const threeCorridorAssignments = JSON.parse(JSON.stringify(buildAmrCorridorAssignments(
    threeCorridorNavigation,
    [
        { code: 'S01', passageX: 0, passageY: 500 },
        { code: 'S02', passageX: 0, passageY: 2500 },
        { code: 'S03', passageX: 0, passageY: 4500 }
    ],
    3
)));
assert.strictEqual(threeCorridorNavigation.components.length, 3, 'Three separated T strips must remain three independent AMR corridors.');
assert.deepStrictEqual(threeCorridorAssignments.map((assignment) => assignment.code), ['S01', 'S02', 'S03'], 'Three AMRs must map top-to-bottom to the three station corridors.');
assert.strictEqual(new Set(threeCorridorAssignments.map((assignment) => assignment.farKey)).size, 3, 'Each AMR must start from a different corridor endpoint.');
assert.ok(warehouseRenderer.includes('const configuredAmrEquipment = (data.equipment || []).filter'), 'The warehouse scene must derive AMRs from the equipment master.');
assert.ok(warehouseRenderer.includes("item.enabled && /^AMR-/i.test"), 'Only enabled AMR equipment rows may create 3D vehicles.');
assert.ok(warehouseRenderer.includes('const amrCount = amrEquipment.length;'), 'The AMR count must follow the enabled equipment rows.');
assert.ok(warehouseRenderer.includes('const forkliftClearanceDiameterMm = calculateAmrPassageClearanceMm('), 'AMR clearance must adapt to the actual connected passage width.');
assert.ok(warehouseRenderer.includes('const amrCorridorAssignments = buildAmrCorridorAssignments('), 'Enabled AMRs must be assigned across independent passage corridors.');
assert.ok(warehouseRenderer.includes('amr.corridorFarKey'), 'Each AMR must return to the far end of its assigned corridor after station work.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.amrCorridorAssignments'), 'The viewport must expose AMR-to-corridor assignments for browser verification.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.amrPositions'), 'The viewport must expose live AMR positions to verify movement inside each corridor.');
const forkliftNavigation = buildPassageNavigationGraph(crossPassageCells, 500, 1950);
assert.ok(findPassagePath(forkliftNavigation, '4:16', '16:4').length > 0, 'A 1.95m forklift turning envelope must remain connected through a 2m cross passage.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.amrPathfinding = amrFleet.length ? 'astar' : 'unavailable';"), 'The viewport must expose the active A* navigation state for verification.');
assert.ok(warehouseRenderer.includes('const turnWeight = nodesByKey.size + 1;'), 'A* must prefer fewer turns among equal-distance routes.');
assert.ok(!warehouseRenderer.includes('· 무인 지게차 ${amrFleet.length}대'), 'The removed top-right object summary must not be updated in the scene.');
assert.ok(warehouseRenderer.includes("group.name = `FORKLIFT-AMR-${index + 1}`;"), 'The round AMR model must be replaced with an unmanned forklift group.');
assert.ok(warehouseRenderer.includes("mastGroup.name = 'forklift-mast';"), 'The unmanned forklift must have a visible mast.');
assert.ok(warehouseRenderer.includes("forkAssembly.name = 'forklift-forks';"), 'The unmanned forklift must have a separately animated fork assembly.');
assert.ok(warehouseRenderer.includes('const amrVisualScale = 0.9;'), 'The AMR body must use the requested slightly smaller visual scale.');
assert.ok(warehouseRenderer.includes('group.scale.setScalar(amrVisualScale);'), 'Every AMR model must apply the shared visual scale.');
assert.ok(warehouseRenderer.includes('forkAssembly.scale.setScalar(1 / amrVisualScale);'), 'AMR forks must retain their pallet-compatible physical size.');
assert.ok(warehouseRenderer.includes('parentScale: amrVisualScale'), 'AMR billboards must compensate for the smaller parent model.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.amrVisualScale = String(amrVisualScale);"), 'The viewport must expose the AMR visual scale for browser verification.');
assert.ok(warehouseRenderer.includes("if (amr.state === 'driving')"), 'The unmanned forklift must use an explicit operation state machine.');
assert.ok(warehouseRenderer.includes("setForkliftState(amr, 'lifting', timestamp)"), 'Fork lifting must begin only after rack-facing alignment.');
assert.ok(warehouseRenderer.includes("setForkliftState(amr, 'retracting', timestamp)"), 'Forks must retract after picking or placing.');
assert.ok(warehouseRenderer.includes('moveToward(amr.forkHeight, travelForkHeight'), 'Forks must return to travel height while driving.');
assert.ok(warehouseRenderer.includes('setSlotInstanceVisible(target.slot, false)'), 'Picking must hide only the selected stored box instance.');
assert.ok(warehouseRenderer.includes('const size = target.slot.boxSize.slice();'), 'AMR cargo must keep the exact source unit-load dimensions.');
assert.ok(!warehouseRenderer.includes('Math.min(1.02, Math.max(0.55, sourceSize[0]))'), 'AMR cargo must not clamp the shuttle handoff width.');
assert.ok(warehouseRenderer.includes("pallet.name = 'forklift-carried-pallet';"), 'AMR cargo must retain the shuttle pallet.');
assert.ok(warehouseRenderer.includes("support.name = 'forklift-pallet-four-way-support';"), 'AMR pallets must retain four-way fork entry supports.');
assert.ok(warehouseRenderer.includes('const shuttleLoadDimensionsByStation = new Map();'), 'Station handoff loads must be linked to their shuttle dimensions.');
assert.ok(warehouseRenderer.includes("unitLoadSource: 'shuttle-handoff'"), 'Station cargo must identify its shuttle handoff source.');
assert.ok(warehouseRenderer.includes('position: [0, 0.02 + handoffDimensions.height / 2, 0]'), 'Station handoff cargo must sit just above the warehouse floor after deck removal.');
assert.ok(warehouseRenderer.includes('forkHeight: travelForkHeight'), 'AMR station handoff forks must lower to floor travel height after deck removal.');
assert.ok(warehouseRenderer.includes("shell.viewport.dataset.amrCargoScalePolicy = 'preserve-shuttle-unit-load';"), 'The viewport must expose exact shuttle load preservation for browser verification.');
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
        '1,T,ST,S7,CV,B4,D27',
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
    inventory: csv('재고 현황', ['로케이션코드', '품목코드', '재고수량', '재고상태'], ['A01-W01-01-01-01', 'P-1', '8', '주의']),
    workOrders: [
        '작업 코드,작업 구분,품목코드,수량(개),도크 코드,차량 번호,보낸 회사명,받을 회사명,경로 코드',
        'IN-001,입고,P-1,18,D01,81가1234,공급사 A,,IN01',
        'OUT-001,출고,P-1,6,D02,82나5678,,고객사 B'
    ].join('\n')
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
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.shuttlePassageCells)), [{ x: 500, y: 0 }], 'ST must be stored separately from the AMR passage coordinates.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.conveyorCells)), [{ x: 1500, y: 0 }], 'CV must be stored separately as a conveyor-track coordinate.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.bufferCells)), [{ x: 2000, y: 0, code: 'B04' }], 'A numbered B value must retain its normalized handoff buffer number and coordinate.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.truckSchedules)), [
    { scheduleCode: 'IN-001', routeCode: 'IN01', workType: '입고', dockCode: 'D01', vehicleNumber: '81가1234', senderCompanyName: '공급사 A', receiverCompanyName: '', itemCode: 'P-1', itemName: '테스트 품목', quantity: 18 },
    { scheduleCode: 'OUT-001', routeCode: '', workType: '출고', dockCode: 'D02', vehicleNumber: '82나5678', senderCompanyName: '', receiverCompanyName: '고객사 B', itemCode: 'P-1', itemName: '테스트 품목', quantity: 6 }
], 'Truck schedules must preserve dock, vehicle, company, item, and quantity information from the work-order sheet.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.stationCells)), [{ x: 1000, y: 0, code: 'S07' }], 'A numbered S value must retain its normalized station number and coordinate.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.dockCells)), [{ x: 2500, y: 0, code: 'D27' }], 'Any D-prefixed numeric code must retain its loading dock number and coordinate.');
assert.deepStrictEqual(JSON.parse(JSON.stringify(converted.meta.unmappedFloorRackCodes)), [], 'F, T, ST, CV, numbered station, dock, and buffer codes must not be reported as unknown rack codes.');
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
    '설비 마스터', '설비명,사용 여부,설비 코드,모델명,타입,설정 이동 속도(m/s)',
    ' 두 번째 ,Y, AMR-002 ,F-AMR-001,FORKLIFT,0.3', '첫 번째,Y,AMR-001,F-AMR-001,FORKLIFT,0.3', ',Y,AMR-003,,,', '비활성,N,AMR-004,F-AMR-001,FORKLIFT,0.3', ',,,,,,'
].join('\n')))), [
    { code: 'AMR-002', modelName: 'F-AMR-001', name: '두 번째', type: 'FORKLIFT', enabled: true, configuredSpeed: 0.3 },
    { code: 'AMR-001', modelName: 'F-AMR-001', name: '첫 번째', type: 'FORKLIFT', enabled: true, configuredSpeed: 0.3 },
    { code: 'AMR-003', modelName: '', name: 'AMR-003', type: '', enabled: true, configuredSpeed: 0 },
    { code: 'AMR-004', modelName: 'F-AMR-001', name: '비활성', type: 'FORKLIFT', enabled: false, configuredSpeed: 0.3 }
]);
assert.throws(() => parseEquipmentMaster('설비 코드,설비명,사용 여부\nAMR-001,A,Y\n AMR-001 ,B,Y'), /중복/);
assert.throws(() => parseEquipmentMaster('설비 코드,모델명\nAMR-001,A'), /설비 마스터/);
assert.ok(warehouseRenderer.includes("equipmentByCode.get(amr.equipmentCode)?.name || amr.equipmentCode"));
assert.ok(warehouseRenderer.includes("amr.label.userData = { ...amr.label.userData, kind: 'amr-label', amr };"));
const parseEquipmentStatus = sandbox.window.wmsWarehouse3D.parseEquipmentStatus;
const parsedEquipmentStatuses = JSON.parse(JSON.stringify(parseEquipmentStatus([
    '설비 상태 정보', '설비 상태,설비 코드,통신 연결',
    '대기, AMR-001 ,online', '충전,AMR-002,OFFLINE'
].join('\n'))));
assert.deepStrictEqual(parsedEquipmentStatuses.map(({ equipmentCode, communicationStatus, equipmentStatus }) => ({
    equipmentCode, communicationStatus, equipmentStatus
})), [
    { equipmentCode: 'AMR-001', communicationStatus: 'ONLINE', equipmentStatus: '대기' },
    { equipmentCode: 'AMR-002', communicationStatus: 'OFFLINE', equipmentStatus: '충전' }
]);
assert.strictEqual(parsedEquipmentStatuses[0].positionX, null);
assert.strictEqual(parsedEquipmentStatuses[0].battery, null);
assert.throws(() => parseEquipmentStatus('설비 코드,통신 연결,설비 상태\nAMR-001,ONLINE,대기\n AMR-001 ,OFFLINE,고장'), /중복/);
assert.ok(warehouseRenderer.includes("config?.sheets?.equipmentStatus || '설비 상태 정보'"));
assert.ok(warehouseRenderer.includes("'A2:O1000'"), 'Equipment status loading must start at its actual row-2 header so numeric telemetry columns keep their names.');
assert.ok(warehouseRenderer.includes("const equipmentStatusByCode = new Map"));
assert.ok(warehouseRenderer.includes("type === '4WAY' || /^4SHUTTLE-/i.test(code)"), 'Enabled 4WAY equipment rows must create the 3D shuttle fleet.');
assert.ok(warehouseRenderer.includes('shuttleEquipment.forEach((configuredEquipment, index) => {'), 'Every enabled shuttle master row must receive a 3D shuttle.');
assert.ok(warehouseRenderer.includes('equipment: [...mobileEquipmentRows, ...barcodeTunnelEquipmentRows]'), 'The equipment tree must include AMRs, shuttles and scan tunnels.');
assert.ok(warehouseRenderer.includes("item.equipmentKind === 'barcode-tunnel' ? selectedBarcodeTunnel === item.value"), 'A scan-tunnel row must synchronize its selected state.');
assert.ok(warehouseRenderer.includes("else if (item.equipmentKind === 'barcode-tunnel') setHoveredBarcodeTunnel(item.value);"), 'Hovering a scan-tunnel row must preview the 3D tunnel.');
assert.ok(warehouseRenderer.includes("else if (item.equipmentKind === 'barcode-tunnel') setSelectedBarcodeTunnel(item.value);"), 'Clicking a scan-tunnel row must select it and open its details.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.shuttleEquipmentCodes'), 'The viewport must expose shuttle master codes for browser verification.');
assert.ok(warehouseRenderer.includes('shuttle.label = createAmrLabelSprite(THREE, {'), 'Shuttles must reuse the AMR communication and equipment status billboard.');
assert.ok(warehouseRenderer.includes("equipmentKind: 'shuttle'"), 'Shuttle billboards must identify their equipment kind for interaction.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.shuttleStatusBillboardCount'), 'The viewport must expose the shuttle status billboard count.');
assert.ok(warehouseRenderer.includes('shell.viewport.dataset.shuttleStatusBillboardCodes'), 'The viewport must expose every shuttle status billboard code.');

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
    passageNavigation: {}, amrNavigableKeys: new Set(['dock']),
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
    assert.equal(a.carriage.position.y, 4.99 / amrVisualScale);
`, { assert, forkThickness: 0.055, travelForkHeight: 0.08, amrVisualScale: 0.9 });

const inspectorContext = vm.createContext({ assert });
vm.runInContext(warehouseRenderer.slice(warehouseRenderer.indexOf('    function escapeHtml('), warehouseRenderer.indexOf('    const slotColorPalette'))
    + warehouseRenderer.slice(warehouseRenderer.indexOf('    function getAmrInspectorHtml('), warehouseRenderer.indexOf('    function createAmrLabelSprite(')), inspectorContext);
const getAmrInspectorHtml = vm.runInContext('getAmrInspectorHtml', inspectorContext);
const formatLocalDateTime = vm.runInContext('formatLocalDateTime', inspectorContext);
vm.runInContext(warehouseRenderer.slice(warehouseRenderer.indexOf('    function getTruckInvoiceHtml('),
    warehouseRenderer.indexOf('    function createLevelBadgeSprite(')), inspectorContext);
const getTruckInvoiceHtml = vm.runInContext('getTruckInvoiceHtml', inspectorContext);
const invoiceAt = new Date(2026, 8, 16, 16, 58, 25);
const inboundInvoice = getTruckInvoiceHtml({ workType: '입고', scheduleCode: 'IN-REF', routeCode: 'IN01',
    vehicleNumber: '부산12가3456', senderCompanyName: '납품 회사', receiverCompanyName: '다른 수령처',
    itemCode: 'P-1', itemName: '품목 A', quantity: 1234, progressStatus: '하차 대기' }, 'D01', '테스트 창고', { barcode: 'HU-IN-REF' }, invoiceAt);
assert.ok(inboundInvoice.includes('입고 운송 송장') && inboundInvoice.includes('발송 정보 · 납품처'));
assert.ok(inboundInvoice.includes('납품 회사') && inboundInvoice.includes('테스트 창고') && !inboundInvoice.includes('다른 수령처'));
assert.ok(inboundInvoice.includes('D01 / IN01') && inboundInvoice.includes('HU-IN-REF'));
assert.equal((inboundInvoice.match(/>1,234</g) || []).length, 2, 'The item quantity and total must agree.');
assert.ok(inboundInvoice.includes('2026-09-16 오후 4:58:25'));
const outboundInvoice = getTruckInvoiceHtml({ workType: '출고', receiverCompanyName: '수령 회사', quantity: 6 }, 'D03', '테스트 창고', {}, invoiceAt);
assert.ok(outboundInvoice.includes('출고 운송 송장') && outboundInvoice.includes('수령 정보 · 공급처') && outboundInvoice.includes('수령 회사'));
assert.ok(outboundInvoice.includes('부산12가3456') && outboundInvoice.includes('미등록'), 'Missing metadata must remain explicitly unregistered.');
const unsafeInvoice = getTruckInvoiceHtml({ itemName: '<img src=x onerror=alert(1)>', senderCompanyName: '<script>bad</script>', quantity: -1 },
    '<dock>', '<warehouse>', { barcode: '<barcode>' }, invoiceAt);
assert.ok(!unsafeInvoice.includes('<img') && !unsafeInvoice.includes('<script>'));
assert.ok(unsafeInvoice.includes('&lt;barcode&gt;') && unsafeInvoice.includes('&lt;dock&gt;'));
assert.equal((unsafeInvoice.match(/>0</g) || []).length, 2, 'Invalid negative quantities must never be displayed as negative totals.');
assert.equal(formatLocalDateTime(new Date(2026, 8, 16, 16, 58, 25)), '2026-09-16 오후 4:58:25');
assert.equal(formatLocalDateTime(new Date(2026, 0, 2, 0, 3, 4)), '2026-01-02 오전 12:03:04');
assert.equal(formatLocalDateTime(new Date(2026, 8, 16, 12, 0, 0)), '2026-09-16 오후 12:00:00');
assert.ok(getAmrInspectorHtml({ communicationStatus: 'OFFLINE' }).includes('오프라인 (OFFLINE)'));
assert.ok(getAmrInspectorHtml({}).includes('미설정'));
const escapedInspector = getAmrInspectorHtml({equipmentCode:'<code>', equipmentName:'<img src=x onerror=alert(1)>', equipmentStatus:'<script>bad</script>'});
assert.ok(!escapedInspector.includes('<img') && !escapedInspector.includes('<script>'));
assert.ok(escapedInspector.includes('&lt;code&gt;'));
assert.ok(getAmrInspectorHtml({}).includes('data-warehouse-history="transport"'));
assert.ok(!getAmrInspectorHtml({}).includes('<ol'), 'The inspector exposes a button instead of inline history.');
const getTransportHistoryHtml = vm.runInContext('getTransportHistoryHtml', inspectorContext);
const transportInspector = getTransportHistoryHtml({ transportHistory: [{ jobCode: 'JOB1', status: '완료',
    itemInfo: '<item>', barcode: '<barcode>', from: 'B01', to: 'S02',
    assignedAt: '2026-09-16T00:00:00Z', loadedAt: null, unloadedAt: null }] });
assert.equal((transportInspector.match(/<td/g) || []).length, 8, 'A transport row keeps all eight requested fields.');
for (const text of ['완료', 'B01', 'S02', '—']) assert.ok(transportInspector.includes(text));
assert.ok(transportInspector.includes('&lt;item&gt;') && transportInspector.includes('&lt;barcode&gt;'));
assert.ok(getTransportHistoryHtml({}).includes('colspan="8"'));
const getScanHistoryHtml = vm.runInContext('getScanHistoryHtml', inspectorContext);
const scanRow = getScanHistoryHtml({ history: [{ passedAt: '2026-09-16T00:00:00Z', itemInfo: '<item>', barcode: 'HU-001', result: '정상 인식', destination: 'B03' }] });
assert.equal((scanRow.match(/<td/g) || []).length, 5);
for (const text of ['&lt;item&gt;', 'HU-001', '정상 인식', 'B03']) assert.ok(scanRow.includes(text));

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
    yaw: 0.65, pitch: 0.45, shell: { viewport: { dataset: {} }, inspector: { innerHTML: '', classList: { add() {} } } },
    getAmrInspectorHtml,
    showDefaultInspector() { followContext.shell.inspector.innerHTML = '<h5>선택 정보</h5>'; },
    easeOutCubic: t => 1 - (1 - t) ** 3,
    resetInspectorLayout() {}, setAmrLabelState() {}, setHoveredSlot() {}, requestRender() {}, updateProjectionMatrices() {}, updateCamera() {}
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
    let hover = slot, selected = null, shown = null, cleared = 0, rackHit = null, amrHit = null, levelHit = null, selectedLevel = null;
    const setHoveredSlot = value => { hover = value; if (!value) cleared++; };
    const setSelectedSlot = value => { selected = value; };
    const showSelection = value => { shown = value; };
    const getSlotAtPointer = () => slot;
    const getRackLevelLabelAtPointer = () => levelHit;
    const getLabelRackAtPointer = () => rackHit;
    const getLabelAmrAtPointer = () => amrHit;
    const getLabelBarcodeTunnelAtPointer = () => null;
    const getBarcodeTunnelAtPointer = () => null;
    const setHoveredBarcodeTunnel = () => {};
    const setSelectedBarcodeTunnel = () => {};
    const setHoveredRackLevelLabel = () => {};
    const selectRackLevel = value => { selectedLevel = value; };
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
    for (const kind of ['rack', 'amr', 'level']) {
        hover = slot; rackHit = kind === 'rack' ? {} : null; amrHit = kind === 'amr' ? {} : null; levelHit = kind === 'level' ? { level: 3 } : null;
        handlers.pointerdown(event); handlers.pointerup(event);
        assert.strictEqual(hover, null, 'Selecting a billboard must clear old slot information.');
        if (kind === 'level') assert.strictEqual(selectedLevel.level, 3, 'A level billboard click must select that rack level.');
    }
`, slotPointerContext);

// Exercise the real sprite drawing for every interaction state.
const labelSource = warehouseRenderer.slice(
    warehouseRenderer.indexOf('    function createLabelSprite('),
    warehouseRenderer.indexOf('    function calculateZoneFloorBounds(')
);
const labelContext = vm.createContext({
    assert, worldUiResolutionScale: 2, billboardRenderOrder: 10000,
    document: { createElement() {
        const context = {
            strokes: 0, lineStrokes: 0, arcs: [], texts: [], roundedRects: [], clearRect() {}, beginPath() {}, fill() {}, stroke() { this.lineStrokes++; },
            fillRect() {}, fillText(text) { this.texts.push(String(text)); }, scale() {}, moveTo() {}, lineTo() {},
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
    const levelBadge = createLevelBadgeSprite(THREE, 7);
    const inboundTruckLabel = createTruckInfoBillboardSprite(THREE, { workType: '입고', vehicleNumber: '81가1234', senderCompanyName: 'ABC물류', itemName: '품목 A', quantity: 120 });
    const outboundTruckLabel = createTruckInfoBillboardSprite(THREE, { workType: '출고', vehicleNumber: '82나5678', receiverCompanyName: 'XYZ유통', itemName: '품목 B', quantity: 80 });
    const defaultTruckLabel = createTruckInfoBillboardSprite(THREE, { workType: '입고' });
    const amrLabel = createAmrLabelSprite(THREE, { name: 'AMR001', communicationStatus: 'ONLINE', equipmentStatus: '대기' });
    const offlineAmrLabel = createAmrLabelSprite(THREE, { name: 'AMR002', communicationStatus: 'OFFLINE', equipmentStatus: '고장' });
    assert.strictEqual(rackLabel.scale.x, 3.2);
    assert.strictEqual(rackLabel.scale.y, 0.9);
    assert.strictEqual(levelBadge.scale.x, 0.72, 'Level badges must use a compact square hit area.');
    assert.strictEqual(levelBadge.scale.y, 0.72, 'Level badges must be square so the circular visual is not distorted.');
    assert.strictEqual(amrLabel.scale.x, 1.84, 'AMR billboard width must be 15% larger than the previous 1.6m width.');
    assert.strictEqual(amrLabel.scale.y, 1.035, 'The grouped billboard height must contain separate upper and lower UI rows.');
    for (const label of [rackLabel, levelBadge, amrLabel]) {
        assert.strictEqual(label.material.opacity, 1);
        assert.strictEqual(label.renderOrder, 10000);
        assert.strictEqual(label.material.depthTest, false);
        assert.strictEqual(label.material.depthWrite, false);
    }
    for (const state of ['normal', 'hover', 'selected']) {
        const rackUpdate = rackLabel.setInteractionState(state);
        const levelUpdate = levelBadge.setInteractionState(state);
        const amrUpdate = amrLabel.setInteractionState(state);
        for (const progress of [0, 0.5, 1]) {
            rackUpdate(progress); levelUpdate(progress); amrUpdate(progress);
            assert.ok(Math.abs(amrLabel.scale.x - rackLabel.scale.x * 0.575) < 1e-10);
            assert.ok(Math.abs(amrLabel.scale.y - rackLabel.scale.y * 1.15) < 1e-10);
            assert.strictEqual(amrLabel.material.opacity, 1);
            assert.strictEqual(rackLabel.material.opacity, 1);
            assert.strictEqual(levelBadge.material.opacity, 1);
        }
        assert.strictEqual(amrLabel.material.opacity, 1);
        assert.strictEqual(rackLabel.material.opacity, 1);
        assert.strictEqual(levelBadge.material.opacity, 1);
    }
    const amrCanvas = amrLabel.material.map.image.getContext('2d');
    const rackCanvas = rackLabel.material.map.image.getContext('2d');
    const levelCanvas = levelBadge.material.map.image.getContext('2d');
    const inboundTruckCanvas = inboundTruckLabel.material.map.image.getContext('2d');
    const outboundTruckCanvas = outboundTruckLabel.material.map.image.getContext('2d');
    assert.strictEqual(amrCanvas.font, '400 64px sans-serif');
    assert.strictEqual(rackCanvas.font, '700 64px sans-serif');
    assert.strictEqual(amrCanvas.strokes, 0, 'AMR labels must never draw a border.');
    assert.strictEqual(rackCanvas.strokes, 4, 'Rack labels retain borders in every state.');
    assert.strictEqual(levelCanvas.arcs.length, 4, 'Level badges must draw one circle in every interaction state.');
    assert.strictEqual(levelCanvas.lineStrokes, 4, 'Level badges must retain their circular border in every state.');
    assert.ok(levelCanvas.texts.every(text => text === 'L7'), 'Level badges must use the compact L-number format.');
    assert.strictEqual(levelBadge.userData.badgeShape, 'circle');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(inboundTruckCanvas.texts)), ['입고', '81가1234', '납품처', 'ABC물류', '입고 예정', '품목 A · 120개', '진행상태', '하차 대기', '송장보기']);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(outboundTruckCanvas.texts)), ['출고', '82나5678', '공급처', 'XYZ유통', '출고 예정', '품목 B · 80개', '진행상태', '상차 대기', '송장보기']);
    inboundTruckLabel.setProgressStatus('하차 완료');
    outboundTruckLabel.setProgressStatus('상차 중');
    assert.equal(inboundTruckLabel.userData.progressStatus, '하차 완료');
    assert.equal(outboundTruckLabel.userData.progressStatus, '상차 중');
    assert.equal(inboundTruckCanvas.texts.at(-2), '하차 완료');
    assert.equal(outboundTruckCanvas.texts.at(-2), '상차 중');
    assert.strictEqual(inboundTruckLabel.userData.fontReference, 'transport-equipment-billboard');
    assert.strictEqual(defaultTruckLabel.userData.vehicleNumber, '부산12가3456');
    assert.strictEqual(defaultTruckLabel.userData.spacing, 'compact');
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
assert.ok(warehouseRenderer.includes('amr.label.position.set(0, 3.26 / amrVisualScale, 0)'), 'AMR billboard height must remain unchanged after scaling its parent model.');

console.log('Warehouse 3D data, card, camera, AMR follow and billboard style checks passed.');
