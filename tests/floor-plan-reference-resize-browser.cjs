const { chromium } = require(process.env.PLANDY_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLANDY_BROWSER_CHANNEL || 'msedge' });
  try {
    for (const role of ['viewer', 'editor']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
      await page.locator('#loginUserId').fill(role === 'viewer' ? 'viewuser' : 'edituser');
      await page.locator('#loginPassword').fill(role === 'viewer' ? 'view1234' : 'edit!@#$');
      await page.locator('#loginSubmitBtn').click();
      await page.locator('[data-action=masterData]').click();
      const cell = page.locator('[data-reference-row="2"][data-reference-column="1"]');
      await cell.waitFor();
      const header = page.locator('[data-reference-select-column="1"]');
      const before = await header.boundingBox();
      await cell.dblclick();
      const after = await header.boundingBox();
      assert.ok(Math.abs(after.width - before.width) < 1, role + ': A열이 편집 중 줄어들면 안 됩니다.');
      await page.locator('.fp-reference-cell-input').press('Escape');
      assert.equal(await page.locator('.fp-reference-cell-input').count(), 0);

      const columnHandle = page.locator('[data-reference-resize-column="1"]');
      const columnBox = await columnHandle.boundingBox();
      await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + columnBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(columnBox.x + columnBox.width / 2 + 90, columnBox.y + columnBox.height / 2, { steps: 5 });
      await page.mouse.up();
      await page.getByText('A열 너비 저장 완료').waitFor();
      const resizedWidth = (await header.boundingBox()).width;
      assert.ok(resizedWidth >= before.width + 85 && resizedWidth <= before.width + 95, role + ': 열 드래그 크기');

      const rowHandle = page.locator('[data-reference-resize-row="2"]');
      const rowBefore = await page.locator('[data-reference-table-row="2"]').boundingBox();
      const rowBox = await rowHandle.boundingBox();
      await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2 + 40, { steps: 5 });
      await page.mouse.up();
      await page.getByText('2행 높이 저장 완료').waitFor();
      const resizedHeight = (await page.locator('[data-reference-table-row="2"]').boundingBox()).height;
      assert.ok(resizedHeight >= rowBefore.height + 35 && resizedHeight <= rowBefore.height + 45, role + ': 행 드래그 크기');

      const originalText = await cell.textContent();
      await cell.dblclick();
      assert.ok(Math.abs((await header.boundingBox()).width - resizedWidth) < 1, role + ': 크기 조절 후 편집 중 열 너비');
      await page.locator('.fp-reference-cell-input').fill(originalText + ' 확인');
      await page.locator('.fp-reference-cell-input').press('Enter');
      await page.getByText('A2 저장 완료').waitFor();
      assert.equal(await cell.textContent(), originalText + ' 확인');
      assert.ok(Math.abs((await header.boundingBox()).width - resizedWidth) < 1, role + ': 셀 저장 후 열 너비');

      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wms-by-gics-reference-data-v1')).book.sheets[0]);
      assert.equal(stored.columnWidths[0][0], 1);
      assert.equal(stored.rowHeights[0][0], 2);
      await page.reload();
      await page.locator('[data-action=masterData]').click();
      await cell.waitFor();
      assert.equal(await cell.textContent(), originalText + ' 확인');
      assert.ok(Math.abs((await header.boundingBox()).width - resizedWidth) < 1, role + ': 열 너비 재로드');
      assert.ok(Math.abs((await page.locator('[data-reference-table-row="2"]').boundingBox()).height - resizedHeight) < 1, role + ': 행 높이 재로드');
      assert.deepEqual(errors, []);
      console.log('PASS ' + role + ': editing keeps width; dragged row/column sizes persist');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
