const { chromium } = require(process.env.PLANDY_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');

const baseUrl = process.env.PLANDY_TEST_URL || 'http://127.0.0.1:4173';
const floorPlanMenu = 'custom-1789604650974';
const otherMenu = 'custom-1786691916656';
const before = process.argv.includes('--before');

async function widths(page) {
  return page.locator('.fp-main').evaluate(main => ({
    left: Math.round(main.querySelector('.fp-left').getBoundingClientRect().width),
    right: Math.round(main.querySelector('.fp-inspector').getBoundingClientRect().width),
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const editor of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/#${floorPlanMenu}`);
      await page.locator('#loginUserId').fill(editor ? 'edituser' : 'viewuser');
      await page.locator('#loginPassword').fill(editor ? 'edit!@#$' : 'view1234');
      await page.locator('#loginSubmitBtn').click();
      await page.locator('.fp-editor').waitFor({ state: 'visible' });
      const initial = await widths(page);
      console.log(`${editor ? 'Editor' : 'Viewer'} initial`, initial);
      if (!before) assert.deepEqual(initial, { left: 212, right: 278 });
      assert.equal(await page.locator('[data-panel-resizer]').count(), 2);
      const leftHandle = page.locator('[data-panel-resizer=left]');
      const handleBox = await leftHandle.boundingBox();
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(handleBox.x + handleBox.width / 2 - 60, handleBox.y + handleBox.height / 2, { steps: 5 });
      await page.mouse.up();
      if (!before) assert.equal((await widths(page)).left, 152);
      const rightHandle = page.locator('[data-panel-resizer=right]');
      await rightHandle.focus();
      await page.keyboard.press('ArrowRight');
      if (!before) assert.equal((await widths(page)).right, 268);
      console.log(`${editor ? 'Editor' : 'Viewer'} after resize`, await widths(page));
      await page.locator(`#navMenu [data-tab="${otherMenu}"]`).click();
      await page.locator(`#navMenu [data-tab="${floorPlanMenu}"]`).click();
      await page.locator('.fp-editor').waitFor({ state: 'visible' });
      const returned = await widths(page);
      console.log(`${editor ? 'Editor' : 'Viewer'} re-entry`, returned);
      if (!before) assert.deepEqual(returned, { left: 212, right: 278 });
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
