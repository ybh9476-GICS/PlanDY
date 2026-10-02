const { chromium } = require(process.env.PLANDY_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLANDY_BROWSER_CHANNEL || 'msedge' });
  try {
    for (const role of ['viewer', 'editor']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const errors = [], downloads = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('download', download => downloads.push(download.suggestedFilename()));
      await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
      await page.locator('#loginUserId').fill(role === 'viewer' ? 'viewuser' : 'edituser');
      await page.locator('#loginPassword').fill(role === 'viewer' ? 'view1234' : 'edit!@#$');
      await page.locator('#loginSubmitBtn').click();
      await page.locator('.fp-editor').waitFor();
      await page.evaluate(() => {
        window.__savePicks = [];
        window.showSaveFilePicker = async options => {
          const pick = { options, writes: [], closed: false };
          window.__savePicks.push(pick);
          return {
            name: options.suggestedName,
            createWritable: async () => ({
              write: async data => { pick.writes.push(typeof data === 'string' ? data : data.byteLength); },
              close: async () => { pick.closed = true; },
              abort: async () => {}
            })
          };
        };
      });
      const save = page.locator('.fp-toolbar [data-action=export]');
      await save.click();
      await page.waitForFunction(() => window.__savePicks[0]?.closed);
      await save.click();
      await page.waitForFunction(() => window.__savePicks[1]?.closed);
      assert.equal(await page.evaluate(() => window.__savePicks.length), 2, role + ': each drawing save must open the picker');

      await page.locator('[data-action=masterData]').click();
      await page.locator('.fp-reference-grid td').first().waitFor();
      await save.click();
      await page.waitForFunction(() => window.__savePicks[2]?.closed);
      await save.click();
      await page.waitForFunction(() => window.__savePicks[3]?.closed);
      await page.locator('.fp-toolbar [data-action=excelExport]').click();
      await page.waitForFunction(() => window.__savePicks[4]?.closed);
      assert.equal(await page.evaluate(() => window.__savePicks.length), 5, role + ': each reference export must open the picker');

      await page.evaluate(() => { window.showSaveFilePicker = undefined; });
      await save.click();
      await page.getByText('이 브라우저에서는 파일 저장 창을 열 수 없습니다.').waitFor();
      assert.equal(await page.locator('.fp-reference-save-dialog').count(), 0);
      await page.locator('[data-action=drawing]').click();
      await save.click();
      await page.locator('.fp-notice').filter({ hasText: '이 브라우저에서는 파일 저장 창을 열 수 없습니다.' }).waitFor();
      assert.equal(downloads.length, 0, role + ': unsupported browser must not silently download');

      assert.deepEqual(errors, []);
      console.log('PASS ' + role + ': every file save opens a picker; unsupported browser reports an error');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
