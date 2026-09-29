const { chromium } = require(process.env.PLANDY_PLAYWRIGHT);
const assert = require('assert/strict');
const fs = require('fs');
const M = require('../js/floor-plan-model.js');

async function clickPoint(page, branch, index) {
  const hit = page.locator(`[data-point-hit="${index}"][data-point-branch="${branch}"],[data-node-handle="${index}"][data-branch-handle="${branch}"]`).first();
  const box = await hit.boundingBox();
  assert.ok(box, `point ${branch}:${index} is visible`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function createClosed(page, label, id, positions, testMinimum = false) {
  const canvas = page.locator('.fp-canvas');
  await page.getByRole('button', { name: label, exact: true }).click();
  await canvas.click({ position: positions[0] });
  await canvas.click({ position: positions[1] });
  if (testMinimum) {
    await canvas.click({ position: positions[0] });
    assert.match(await page.locator('.fp-notice').innerText(), /세 포인트 이상/);
    assert.equal(await page.locator(`.fp-list [data-select="${id}"]`).count(), 0, `${id} stays uncreated with two points`);
  }
  for (const position of positions.slice(2)) await canvas.click({ position });
  await canvas.click({ position: positions[0] });
  await page.locator(`.fp-list [data-select="${id}"]`).waitFor();
  assert.equal(await page.locator('[data-segment-hit]').count(), positions.length, `${id} renders its closing segment`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const editor of [false, true]) {
      const role = editor ? 'Editor' : 'Viewer';
      const context = await browser.newContext({ viewport: { width: 1540, height: 1100 }, acceptDownloads: true });
      await context.route('**/api/local-content/save', route => route.fulfill({ contentType: 'application/json', body: '{"saved":true}' }));
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
      if (editor) {
        assert.equal(await page.evaluate(() => window.wmsPermissions.login('edituser', 'edit!@#$')), true);
      } else {
        await page.locator('#loginUserId').fill('viewuser');
        await page.locator('#loginPassword').fill('view1234');
        await page.locator('#loginSubmitBtn').click();
      }
      await page.locator('.fp-editor').waitFor();
      await page.locator('[data-action=new]').click();

      await createClosed(page, '가이드 레일', 'GR01', [
        { x: 340, y: 260 }, { x: 500, y: 260 }, { x: 500, y: 420 }, { x: 340, y: 420 }
      ], true);
      await createClosed(page, 'AMR 통로', 'T01', [
        { x: 610, y: 260 }, { x: 760, y: 260 }, { x: 760, y: 410 }, { x: 610, y: 410 }
      ]);
      await createClosed(page, '컨베이어', 'CV01', [
        { x: 420, y: 560 }, { x: 580, y: 560 }, { x: 580, y: 720 }, { x: 420, y: 720 }
      ]);

      await page.locator('.fp-list [data-select=GR01]').click();
      await clickPoint(page, -1, 0);
      await page.locator('[data-action=addBranch]').click();
      await clickPoint(page, -1, 2);
      assert.equal(await page.locator('[data-segment-branch="0"]').count(), 1, `${role} connects to an existing target point`);

      const before = await page.locator('[data-segment-branch="0"]').evaluate(el => [el.getAttribute('x2'), el.getAttribute('y2')]);
      await clickPoint(page, -1, 2);
      const handle = page.locator('[data-node-handle="2"][data-branch-handle="-1"]');
      const box = await handle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 + 18, { steps: 6 });
      await page.mouse.up();
      const after = await page.locator('[data-segment-branch="0"]').evaluate(el => [el.getAttribute('x2'), el.getAttribute('y2')]);
      assert.notDeepEqual(after, before, `${role} connected segment follows the moved shared point`);
      await page.locator('[data-action=undo]').click();

      await clickPoint(page, -1, 1);
      await page.locator('[data-action=addBranch]').click();
      await clickPoint(page, -1, 3);
      assert.match(await page.locator('.fp-notice').innerText(), /겹치거나 교차/);
      assert.equal(await page.locator('[data-segment-branch="1"]').count(), 0, `${role} rejects a crossing connection`);
      await page.locator('.fp-canvas').press('Escape');

      await page.evaluate(() => { window.showSaveFilePicker = undefined; });
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: '저장', exact: true }).click()
      ]);
      const saved = M.readFile(JSON.parse(fs.readFileSync(await download.path(), 'utf8')));
      for (const id of ['GR01', 'T01', 'CV01']) assert.equal(saved.objects.find(object => object.id === id).closed, true, `${id} saves closed state`);
      assert.deepEqual(saved.objects.find(object => object.id === 'GR01').branches[0].target, { line: 'main', index: 2 });

      fs.mkdirSync('output/floor-plan-closed-tracks', { recursive: true });
      await page.screenshot({ path: `output/floor-plan-closed-tracks/${role.toLowerCase()}.png` });
      console.log(`${role}: PASS T/GR/CV close at first point, minimum-cycle and crossing guards, existing-point connection, shared-point move, undo, and .gics roundtrip`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
