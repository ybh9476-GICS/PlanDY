const { chromium } = require(process.env.PLANDY_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');

const baseUrl = process.env.PLANDY_TEST_URL || 'http://127.0.0.1:4173';
const storageKey = 'wms-by-gics-reference-data-v1';
const before = process.argv.includes('--before');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLANDY_BROWSER_CHANNEL || 'msedge' });
  try {
    for (const role of ['viewer', 'editor']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/#custom-1789604650974`);
      await page.locator('#loginUserId').fill(role === 'viewer' ? 'viewuser' : 'edituser');
      await page.locator('#loginPassword').fill(role === 'viewer' ? 'view1234' : 'edit!@#$');
      await page.locator('#loginSubmitBtn').click();
      await page.locator('.fp-editor').waitFor({ state: 'visible' });
      await page.locator('[data-action=masterData]').click();
      await page.locator('.fp-reference-grid td').first().waitFor();
      assert.equal(await page.getByRole('tab').count(), 13);
      if (before) {
        assert.equal(await page.locator('[data-reference-delete]').count(), 0);
        console.log(`${role}: sheet delete control absent before change`);
        await context.close();
        continue;
      }

      const sheetItem = page.locator('.fp-reference-tab-item').filter({ has: page.getByRole('tab', { name: '구역설정' }) });
      const deleteButton = sheetItem.locator('[data-reference-delete]');
      assert.equal(await page.locator('[data-reference-delete]').count(), 13);
      assert.equal(await deleteButton.evaluate(button => getComputedStyle(button).opacity), '0');
      await sheetItem.hover();
      assert.equal(await deleteButton.evaluate(button => getComputedStyle(button).opacity), '1');
      await deleteButton.click();
      const dialog = page.locator('.fp-reference-delete-dialog');
      await dialog.waitFor({ state: 'visible' });
      assert.match(await dialog.innerText(), /구역설정/);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), null);
      await dialog.locator('[data-reference-delete-cancel]').click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await page.getByRole('tab').count(), 13);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), null);

      await sheetItem.hover();
      await deleteButton.click();
      await dialog.locator('[data-reference-delete-confirm]').click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await page.getByRole('tab', { name: '구역설정' }).count(), 0);
      assert.equal(await page.getByRole('tab').count(), 12);
      assert.equal(await page.getByRole('tab', { name: '사용안내' }).getAttribute('aria-selected'), 'true');
      const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
      assert.equal(stored.book.sheets.length, 12);
      assert.equal(stored.book.sheets.some(sheet => sheet.name === '구역설정'), false);
      assert.equal(stored.book.sheets.some(sheet => sheet.name === '랙타입 마스터'), true);

      await page.getByRole('tab', { name: '랙타입 마스터' }).click();
      const activeItem = page.locator('.fp-reference-tab-item').filter({ has: page.getByRole('tab', { name: '랙타입 마스터' }) });
      await activeItem.hover();
      await activeItem.locator('[data-reference-delete]').click();
      await dialog.locator('[data-reference-delete-confirm]').click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await page.getByRole('tab', { name: '랙타입 마스터' }).count(), 0);
      assert.equal(await page.getByRole('tab', { name: '랙배치' }).getAttribute('aria-selected'), 'true');

      await page.reload();
      await page.locator('.fp-editor').waitFor({ state: 'visible' });
      await page.locator('[data-action=masterData]').click();
      await page.locator('.fp-reference-grid td').first().waitFor();
      assert.equal(await page.getByRole('tab').count(), 11);
      assert.equal(await page.getByRole('tab', { name: '구역설정' }).count(), 0);
      assert.equal(await page.getByRole('tab', { name: '랙타입 마스터' }).count(), 0);
      const keyboardDelete = page.locator('.fp-reference-tab-item').filter({ has: page.getByRole('tab', { name: '랙배치' }) }).locator('[data-reference-delete]');
      await keyboardDelete.focus();
      assert.equal(await keyboardDelete.evaluate(button => getComputedStyle(button).opacity), '1');

      const beforeFailure = await page.evaluate(key => localStorage.getItem(key), storageKey);
      await page.evaluate(() => {
        window.__originalReferenceSave = window.WmsFloorPlanReferenceStore.save;
        window.WmsFloorPlanReferenceStore.save = async () => { throw Error('시험 저장 실패'); };
      });
      await keyboardDelete.click();
      await dialog.locator('[data-reference-delete-confirm]').click();
      await dialog.locator('.fp-dialog-error').getByText('시험 저장 실패').waitFor();
      assert.equal(await page.getByRole('tab').count(), 11);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), beforeFailure);
      await dialog.locator('[data-reference-delete-cancel]').click();
      await page.evaluate(() => { window.WmsFloorPlanReferenceStore.save = window.__originalReferenceSave; });

      await page.evaluate(key => {
        const value = JSON.parse(localStorage.getItem(key));
        value.book.sheets = [value.book.sheets[0]];
        localStorage.setItem(key, JSON.stringify(value));
      }, storageKey);
      await page.reload();
      await page.locator('.fp-editor').waitFor({ state: 'visible' });
      await page.locator('[data-action=masterData]').click();
      await page.locator('.fp-reference-grid td').first().waitFor();
      assert.equal(await page.getByRole('tab').count(), 1);
      assert.equal(await page.locator('[data-reference-delete]').isDisabled(), true);
      console.log(`${role}: hover, cancel, delete inactive/active sheet, storage and reload passed`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
