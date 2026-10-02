const { chromium } = require(process.env.PLANDY_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLANDY_BROWSER_CHANNEL || 'msedge' });
  try {
    for (const role of ['viewer', 'editor']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const errors = [], googleRequests = [], dialogs = [], downloads = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (/docs\.google\.com\/spreadsheets|sheets\.googleapis\.com/.test(request.url())) googleRequests.push(request.url());
      });
      page.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.accept(); });
      page.on('download', download => downloads.push(download.suggestedFilename()));
      await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
      await page.locator('#loginUserId').fill(role === 'viewer' ? 'viewuser' : 'edituser');
      await page.locator('#loginPassword').fill(role === 'viewer' ? 'view1234' : 'edit!@#$');
      await page.locator('#loginSubmitBtn').click();
      await page.locator('.fp-editor').waitFor();
      await page.evaluate(() => {
        const key = 'wms-sidebar-menu-settings-v1';
        const saved = JSON.parse(localStorage.getItem(key));
        const menu = saved.menus.find(item => item.id === 'custom-1789604650974');
        menu.label = '평면도 에디터'; menu.tooltip = '평면도 에디터';
        localStorage.setItem(key, JSON.stringify(saved));
      });
      await page.reload();
      await page.locator('.fp-editor').waitFor();
      assert.equal(await page.locator('.nav-link[data-tab="custom-1789604650974"]').innerText(), 'WMS by Gics');
      for (const action of ['drawing', 'masterData', 'viewer3d']) {
        const button = page.locator('[data-action="' + action + '"]').first();
        assert.equal(await button.isVisible(), true);
        const box = await button.boundingBox();
        assert.equal(Math.round(box.width), 32);
        assert.equal(Math.round(box.height), 32);
      }
      const drawingBefore = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('wms-floor-plan-editor'))));
      assert.equal(await page.locator('[data-action=drawing]').getAttribute('aria-pressed'), 'true');
      await page.locator('[data-action=masterData]').click();
      await page.locator('.fp-reference-grid td').first().waitFor();
      for (const action of ['import', 'export', 'excelImport', 'excelExport']) {
        assert.equal(await page.locator('.fp-toolbar [data-action=' + action + ']').isVisible(), true, action + ' should be visible in reference mode');
      }
      assert.equal(await page.locator('.fp-main').isVisible(), false);
      assert.equal(await page.locator('.fp-reference-tabs [data-reference-tab]').count(), 13);
      assert.equal(await page.locator('.fp-reference-heading,[data-reference-title],[data-reference-selection]').count(), 0);
      assert.equal(await page.locator('[data-reference-name]').textContent(), '새 기준정보');
      const sidebarBox = await page.locator('.fp-reference-sidebar').boundingBox();
      const gridBox = await page.locator('.fp-reference-grid').boundingBox();
      assert.ok(sidebarBox.x < gridBox.x, 'Sheet list should appear to the left of the table');
      const nameBox = await page.locator('.fp-reference-name').boundingBox();
      const structureBox = await page.locator('.fp-reference-structure-controls').boundingBox();
      assert.ok(structureBox.x > nameBox.x, 'Row and column buttons should appear to the right of the reference name');
      assert.equal(await page.locator('[data-reference-command="refresh"],[data-reference-command="previous"],[data-reference-command="next"],[data-reference-range]').count(), 0);
      await page.getByRole('tab', { name: '로케이션 마스터' }).click();
      await page.locator('.fp-reference-grid').evaluate(grid => {
        for (let index = 0; index < 30 && !grid.querySelector('[data-reference-row="879"]'); index++) {
          grid.scrollTop = grid.scrollHeight;
          grid.dispatchEvent(new Event('scroll'));
        }
      });
      assert.equal(await page.locator('[data-reference-row="879"][data-reference-column="1"]').count(), 1, 'Last row must remain reachable without page buttons');
      await page.locator('[data-reference-select-row="879"]').click();
      assert.equal(await page.locator('[data-reference-select-row="879"]').getAttribute('aria-pressed'), 'true');
      await page.getByRole('tab', { name: '사용안내' }).click();
      await page.locator('[data-reference-command=rename]').click();
      await page.locator('[data-reference-new-name]').fill('작업용 기준정보 ' + role);
      await page.locator('[data-reference-rename-confirm]').click();
      await page.getByText('기준정보 이름을 변경했습니다.').waitFor();
      assert.equal(await page.locator('[data-reference-name]').textContent(), '작업용 기준정보 ' + role);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('wms-by-gics-reference-data-v1')).name), '작업용 기준정보 ' + role);
      assert.equal(await page.locator('[data-reference-row="1"][data-reference-column="1"]').textContent(), 'WMS 3D 창고 기준정보 템플릿');
      assert.equal(await page.locator('[data-action=masterData]').getAttribute('aria-pressed'), 'true');
      await page.locator('[data-reference-row="1"][data-reference-column="1"]').focus();
      await page.locator('[data-reference-row="1"][data-reference-column="1"]').press('Escape');
      assert.equal(await page.locator('.fp-reference-workspace').isVisible(), true);
      assert.equal(await page.locator('[data-action=masterData]').getAttribute('aria-pressed'), 'true');
      assert.equal(googleRequests.length, 0, 'The independent reference mode must not contact Google');

      await page.locator('[data-reference-row="1"][data-reference-column="1"]').dblclick();
      const inlineInput = page.locator('[data-reference-row="1"][data-reference-column="1"] .fp-reference-cell-input');
      await inlineInput.fill('독립 기준정보 ' + role);
      if (process.argv.includes('--screenshot')) {
        const output = path.resolve(__dirname, '../output/floor-plan-reference');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, role + '-inline.png') });
      }
      assert.equal(await page.locator('.fp-reference-dialog').count(), 0);
      await inlineInput.press('Enter');
      await inlineInput.waitFor({ state: 'detached' });
      assert.equal(await page.locator('[data-reference-row="1"][data-reference-column="1"]').textContent(), '독립 기준정보 ' + role);
      await page.locator('[data-reference-row="1"][data-reference-column="1"]').focus();
      await page.locator('[data-reference-row="1"][data-reference-column="1"]').press('Enter');
      await page.locator('[data-reference-row="1"][data-reference-column="1"] .fp-reference-cell-input').waitFor();
      await page.locator('[data-reference-row="1"][data-reference-column="1"] .fp-reference-cell-input').press('Escape');
      assert.equal(await page.locator('.fp-reference-workspace').isVisible(), true);
      const beforeRow2 = await page.locator('[data-reference-row="2"][data-reference-column="1"]').textContent();
      await page.locator('[data-reference-row="2"][data-reference-column="1"]').dblclick();
      const canceledInput = page.locator('[data-reference-row="2"][data-reference-column="1"] .fp-reference-cell-input');
      await canceledInput.fill('저장하면 안 되는 값');
      await canceledInput.press('Escape');
      assert.equal(await page.locator('[data-reference-row="2"][data-reference-column="1"]').textContent(), beforeRow2);
      assert.equal(await page.locator('[data-action=masterData]').getAttribute('aria-pressed'), 'true');
      await page.locator('[data-reference-row="3"][data-reference-column="1"]').dblclick();
      await page.locator('[data-reference-row="3"][data-reference-column="1"] .fp-reference-cell-input').fill('바깥 클릭 저장 ' + role);
      await page.locator('.fp-reference-sidebar h3').click();
      assert.equal(await page.locator('[data-reference-row="3"][data-reference-column="1"]').textContent(), '바깥 클릭 저장 ' + role);
      await page.locator('[data-reference-row="4"][data-reference-column="1"]').dblclick();
      await page.locator('[data-reference-row="4"][data-reference-column="1"] .fp-reference-cell-input').fill('모드 전환 저장 ' + role);
      await page.locator('[data-action=drawing]').click();
      await page.locator('[data-action=masterData]').click();
      assert.equal(await page.locator('[data-reference-row="4"][data-reference-column="1"]').textContent(), '모드 전환 저장 ' + role);
      await page.locator('[data-reference-select-row="1"]').click();
      await page.locator('[data-reference-command=add-row]').click();
      await page.getByText('행을 추가했습니다.').waitFor();
      assert.equal(await page.locator('[data-reference-row="3"][data-reference-column="1"]').textContent(), beforeRow2);
      await page.locator('[data-reference-select-row="2"]').click();
      await page.locator('[data-reference-command=delete-row]').click();
      await page.getByText('행 1개를 삭제했습니다.').waitFor();
      assert.equal(await page.locator('[data-reference-row="2"][data-reference-column="1"]').textContent(), beforeRow2);
      await page.locator('[data-reference-select-column="1"]').click();
      await page.locator('[data-reference-command=add-column]').click();
      await page.getByText('열을 추가했습니다.').waitFor();
      await page.locator('[data-reference-select-column="2"]').click();
      await page.locator('[data-reference-command=delete-column]').click();
      await page.getByText('열 1개를 삭제했습니다.').waitFor();
      assert.equal(await page.locator('[data-reference-row="1"][data-reference-column="1"]').textContent(), '독립 기준정보 ' + role);
      assert.equal(await page.evaluate(() => typeof window.showSaveFilePicker), 'function');
      await page.evaluate(() => {
        window.__referencePickerCalls = [];
        window.__referencePickerCancel = false;
        window.__referencePicker = async options => {
          const call = { options, userActivation: navigator.userActivation?.isActive, closed: false, byteLength: 0, firstCharacters: '' };
          window.__referencePickerCalls.push(call);
          if (window.__referencePickerCancel) throw new DOMException('Canceled', 'AbortError');
          const extension = options.types[0].accept['application/octet-stream'] ? 'tbl' : 'xlsx';
          return {
            name: window.__referencePickerName || '선택한 위치의 기준정보.' + extension,
            createWritable: async () => ({
              write: async data => {
                call.byteLength = data.byteLength || data.length;
                call.firstCharacters = typeof data === 'string' ? data.slice(0, 20) : String.fromCharCode(...new Uint8Array(data).slice(0, 4));
                call.data = typeof data === 'string' ? data : Array.from(new Uint8Array(data));
              },
              close: async () => { call.closed = true; },
              abort: async () => {}
            })
          };
        };
        window.showSaveFilePicker = window.__referencePicker;
      });
      await page.locator('.fp-toolbar [data-action=export]').click();
      await page.waitForFunction(() => window.__referencePickerCalls[0]?.closed);
      assert.equal(await page.locator('[data-reference-name]').textContent(), '선택한 위치의 기준정보');
      await page.locator('.fp-toolbar [data-action=excelExport]').click();
      await page.waitForFunction(() => window.__referencePickerCalls[1]?.closed);
      const pickerCalls = await page.evaluate(() => window.__referencePickerCalls.map(({ data, ...call }) => call));
      assert.equal(pickerCalls.length, 2);
      assert.equal(pickerCalls[0].userActivation, true);
      assert.equal(pickerCalls[1].userActivation, true);
      assert.equal(pickerCalls[0].options.suggestedName, '작업용 기준정보 ' + role + '.tbl');
      assert.equal(pickerCalls[1].options.suggestedName, '선택한 위치의 기준정보.xlsx');
      assert.equal(pickerCalls[0].options.startIn, 'desktop');
      assert.equal(pickerCalls[0].options.excludeAcceptAllOption, true);
      assert.match(pickerCalls[0].firstCharacters, /^\{"format"/);
      assert.equal(pickerCalls[1].firstCharacters.slice(0, 2), 'PK');
      await page.evaluate(() => { window.__referencePickerCancel = true; });
      await page.locator('.fp-toolbar [data-action=export]').click();
      await page.getByText('파일 저장을 취소했습니다.').waitFor();
      assert.equal(await page.locator('.fp-reference-save-dialog').count(), 0);
      await page.evaluate(() => { window.showSaveFilePicker = undefined; });
      await page.locator('.fp-toolbar [data-action=export]').click();
      await page.getByText('이 브라우저에서는 파일 저장 창을 열 수 없습니다.').waitFor();
      assert.equal(await page.locator('.fp-reference-save-dialog').count(), 0);
      assert.equal(downloads.length, 0);
      await page.evaluate(() => {
        window.showSaveFilePicker = window.__referencePicker;
        window.__referencePickerCancel = false;
        window.__referencePickerName = '사용자 기준정보.tbl';
      });
      await page.locator('.fp-toolbar [data-action=export]').click();
      await page.waitForFunction(() => window.__referencePickerCalls[3]?.closed);
      assert.equal(await page.locator('[data-reference-name]').textContent(), '사용자 기준정보');
      const tblBytes = Buffer.from(await page.evaluate(() => window.__referencePickerCalls[3].data), 'utf8');
      await page.locator('[data-reference-row="1"][data-reference-column="1"]').dblclick();
      await page.locator('.fp-reference-cell-input').fill('파일에서 복원할 값');
      await page.locator('.fp-reference-cell-input').press('Enter');
      await page.locator('.fp-reference-cell-input').waitFor({ state: 'detached' });
      await page.locator('[data-reference-file=tbl]').setInputFiles({ name: '기준정보.tbl', mimeType: 'application/json', buffer: tblBytes });
      await page.getByText('기준정보.tbl의 기준정보 13개 시트를 열었습니다.').waitFor();
      assert.equal(await page.locator('[data-reference-name]').textContent(), '기준정보');
      assert.equal(await page.locator('[data-reference-row="1"][data-reference-column="1"]').textContent(), '독립 기준정보 ' + role);
      await page.locator('[data-reference-file=tbl]').setInputFiles({ name: '잘못된.tbl', mimeType: 'application/json', buffer: Buffer.from('{') });
      await page.getByText('.tbl 파일의 JSON 내용을 읽을 수 없습니다.').waitFor();
      assert.equal(await page.locator('[data-reference-row="1"][data-reference-column="1"]').textContent(), '독립 기준정보 ' + role);
      await page.evaluate(() => { window.__referencePickerName = 'Excel 기준정보.xlsx'; });
      await page.locator('.fp-toolbar [data-action=excelExport]').click();
      await page.waitForFunction(() => window.__referencePickerCalls[4]?.closed);
      const excelBytes = Buffer.from(await page.evaluate(() => window.__referencePickerCalls[4].data));
      await page.locator('[data-reference-file=xlsx]').setInputFiles({ name: '기준정보.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: excelBytes });
      await page.getByText('기준정보.xlsx의 기준정보 13개 시트를 열었습니다.').waitFor();
      assert.equal(await page.locator('[data-reference-name]').textContent(), '기준정보');
      assert.equal(await page.locator('[data-reference-row="1"][data-reference-column="1"]').textContent(), '독립 기준정보 ' + role);
      assert.equal(dialogs.some(message => message.includes('기준정보.tbl') && message.includes('덮어쓰겠습니까')), true);
      assert.equal(dialogs.some(message => message.includes('기준정보.xlsx') && message.includes('덮어쓰겠습니까')), true);
      await page.getByRole('tab', { name: '랙타입 마스터' }).click();
      assert.match(await page.locator('.fp-reference-grid').innerText(), /랙타입코드/);
      assert.equal(googleRequests.length, 0);

      if (process.argv.includes('--screenshot')) {
        const output = path.resolve(__dirname, '../output/floor-plan-reference');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, role + '.png') });
      }
      await page.reload();
      await page.locator('.fp-editor').waitFor();
      await page.locator('[data-action=masterData]').click();
      await page.locator('[data-reference-row="1"][data-reference-column="1"]').waitFor();
      assert.equal(await page.locator('[data-reference-name]').textContent(), '기준정보');
      assert.equal(await page.locator('[data-reference-row="1"][data-reference-column="1"]').textContent(), '독립 기준정보 ' + role);
      await page.locator('[data-action=drawing]').click();
      assert.equal(await page.locator('.fp-toolbar [data-action=excelImport]').isVisible(), false);
      assert.equal(await page.locator('.fp-toolbar [data-action=excelExport]').isVisible(), false);
      assert.equal(await page.locator('.fp-main').isVisible(), true);
      assert.equal(await page.locator('.fp-reference-workspace').isVisible(), false);
      const drawingAfter = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('wms-floor-plan-editor'))));
      assert.deepEqual(drawingAfter, drawingBefore);
      const position = page.locator('[data-field=x]').first();
      const originalPosition = await position.inputValue();
      await position.fill('3.50');
      await position.press('Enter');
      assert.equal(await position.inputValue(), '3.50');
      await page.locator('[data-action=undo]').click();
      assert.equal(await position.inputValue(), originalPosition);
      await page.locator('[data-action=viewer3d]').click();
      await page.locator('.wms-workspace-modes').waitFor({ timeout: 30000 });
      assert.equal(await page.locator('.wms-workspace-modes button').count(), 3);
      assert.equal(await page.locator('.wms-workspace-modes [data-wms-workspace=viewer3d]').getAttribute('aria-pressed'), 'true');
      if (process.argv.includes('--screenshot')) {
        const output = path.resolve(__dirname, '../output/floor-plan-reference');
        await page.screenshot({ path: path.join(output, role + '-3d.png') });
      }
      await page.locator('.wms-workspace-modes [data-wms-workspace=reference]').click();
      await page.locator('.fp-reference-grid [data-reference-row="1"][data-reference-column="1"]').waitFor();
      assert.equal(await page.locator('[data-action=masterData]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-reference-row="1"][data-reference-column="1"]').textContent(), '독립 기준정보 ' + role);
      await page.setViewportSize({ width: 560, height: 800 });
      const narrowSidebar = await page.locator('.fp-reference-sidebar').boundingBox();
      const narrowTable = await page.locator('.fp-reference-grid').boundingBox();
      assert.ok(narrowSidebar.y + narrowSidebar.height <= narrowTable.y, 'Narrow layout should place the sheet list above the table');
      assert.equal(await page.locator('[data-reference-name]').isVisible(), true);
      assert.deepEqual(errors, []);
      console.log('PASS ' + role + ': independent edits persist; drawing and existing 3D mode return paths work');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
