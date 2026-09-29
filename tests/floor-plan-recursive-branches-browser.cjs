const { chromium } = require(process.env.PLANDY_PLAYWRIGHT);
const assert = require('assert/strict');
const fs = require('fs');
const M = require('../js/floor-plan-model.js');

async function clickPoint(page, branch, index) {
  let target = page.locator('[data-point-hit="' + index + '"][data-point-branch="' + branch + '"]');
  let box = await target.count() ? await target.boundingBox() : null;
  if (!box) {
    const line = page.locator('[data-segment-hit="0"][data-segment-branch="' + branch + '"]');
    const [x1,y1,x2,y2]=await line.evaluate(el=>['x1','y1','x2','y2'].map(name=>Number(el.getAttribute(name))));
    const svgBox=await page.locator('.fp-canvas').boundingBox();
    assert.ok(svgBox, 'path canvas is visible');
    await page.mouse.click(svgBox.x+(x1+x2)/2,svgBox.y+(y1+y2)/2);
    target = page.locator('[data-node-handle="' + index + '"][data-branch-handle="' + branch + '"]');
    box = await target.boundingBox();
  }
  assert.ok(box, 'path point hit target is visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const editor of [false, true]) {
      const role = editor ? 'editor' : 'viewer';
      const context = await browser.newContext({ viewport: { width: 1540, height: 1100 } });
      await context.route('**/api/local-content/save', route => route.fulfill({ contentType: 'application/json', body: '{"saved":true}' }));
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
      await page.waitForTimeout(1000);
      await page.locator('#loginUserId').fill(editor ? 'edituser' : 'viewuser');
      await page.locator('#loginPassword').fill(editor ? 'edit!@#$' : 'view1234');
      await page.locator('#loginSubmitBtn').click();
      await page.locator('.fp-editor').waitFor();
      const canvas = page.locator('.fp-canvas');
      const pathActions = page.locator('[data-path-actions]');
      const trackTool = page.getByRole('button', { name: 'AMR 통로', exact: true });

      await trackTool.click();
      await canvas.click({ position: { x: 700, y: 650 } });
      await canvas.press('Escape');
      assert.equal(await page.locator('.fp-list [data-select=T02]').count(), 0, role + ' cancels a one-point track with Escape');
      assert.equal(await pathActions.isVisible(), false);

      await trackTool.click();
      await canvas.click({ position: { x: 700, y: 650 } });
      await canvas.press('Enter');
      assert.equal(await page.locator('.fp-list [data-select=T02]').count(), 0, role + ' Enter no longer completes a track');
      assert.equal(await pathActions.isVisible(), true);
      await canvas.click({ position: { x: 760, y: 650 } });
      await canvas.press('Escape');
      assert.equal(await page.locator('.fp-list [data-select=T02]').count(), 1, role + ' completes a two-point track with Escape');

      for (const id of ['GR01', 'T01', 'CV01']) {
        await page.locator('.fp-list [data-select=' + id + ']').click();
        await clickPoint(page, -1, 1);
        assert.ok(await page.locator('[data-action=addBranch]').isEnabled(), role + ' can branch ' + id);
        assert.ok(await page.locator('[data-action=addNode]').isDisabled(), role + ' reserves point add for segment selection');
      }

      await page.locator('.fp-list [data-select=GR01]').click();
      await clickPoint(page, -1, 1);
      await page.locator('[data-action=addBranch]').click();
      await canvas.press('Escape');
      assert.equal(await page.locator('[data-segment-branch="0"]').count(), 0, role + ' cancels a branch with no new point');

      await clickPoint(page, -1, 1);
      await page.locator('[data-action=addBranch]').click();
      await canvas.click({ position: { x: 420, y: 500 } });
      await canvas.click({ position: { x: 520, y: 600 } });
      await canvas.press('Escape');
      assert.equal(await page.locator('[data-segment-branch="0"]').count(), 2, role + ' creates the first branch on canvas');
      assert.equal(await page.locator('[data-branch-select],[data-node]').count(), 0, role + ' keeps branch and point selector lists removed');

      await clickPoint(page, 0, 2);
      await page.locator('[data-action=addBranch]').click();
      await canvas.click({ position: { x: 650, y: 520 } });
      await canvas.click({ position: { x: 700, y: 440 } });
      await canvas.press('Escape');
      assert.equal(await page.locator('[data-segment-branch="1"]').count(), 2, role + ' creates a nested branch from a branch point');

      await clickPoint(page, 1, 0);
      const handle = page.locator('[data-node-handle="2"][data-branch-handle="0"]');
      let box = await handle.boundingBox();
      const beforeX = Number(await page.locator('[data-field=x]').inputValue());
      box = await handle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 28, box.y + box.height / 2 - 18, { steps: 8 });
      await page.mouse.up();
      const afterX = Number(await page.locator('[data-field=x]').inputValue());
      assert.notEqual(afterX, beforeX, role + ' moves the shared branch point directly on canvas');
      const [sourceX,sourceY]=await page.locator('[data-segment-hit="0"][data-segment-branch="1"]').evaluate(el=>['x1','y1'].map(name=>Number(el.getAttribute(name))));
      const [handleX,handleY]=await handle.evaluate(el=>['cx','cy'].map(name=>Number(el.getAttribute(name))));
      assert.ok(Math.abs(sourceX-handleX)<.01&&Math.abs(sourceY-handleY)<.01,role+' nested branch follows the moved shared point');

      await page.evaluate(() => { window.showSaveFilePicker = undefined; });
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: '저장', exact: true }).click()
      ]);
      const bytes = fs.readFileSync(await download.path());
      const saved = M.readFile(JSON.parse(bytes));
      const savedTrack = saved.objects.find(object => object.id === 'GR01');
      assert.equal(savedTrack.branches.length, 2);
      assert.equal(savedTrack.branches[1].parent, savedTrack.branches[0].id, role + ' saves recursive branch parent in .gics');
      assert.deepEqual(M.pathLines(savedTrack).find(line => line.id === savedTrack.branches[1].id).labels, ['2-2', '2-2-1', '2-2-2']);

      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: '열기', exact: true }).click()
      ]);
      await chooser.setFiles({ name: 'recursive.gics', mimeType: 'application/octet-stream', buffer: bytes });
      await page.waitForFunction(() => document.querySelectorAll('[data-tab-select]').length === 2);
      await page.locator('.fp-list [data-select=GR01]').click();
      assert.equal(await page.locator('[data-segment-branch="0"],[data-segment-branch="1"]').count(), 4, role + ' restores recursive branches from .gics');

      assert.equal(await page.locator('[data-action=deleteBranch]').count(), 0, role + ' removes the whole-branch delete control');
      await clickPoint(page, 0, 1);
      await page.locator('[data-action=deleteNode]').click();
      assert.equal(await page.locator('[data-segment-branch="0"],[data-segment-branch="1"]').count(), 3, role + ' deletes one branch point while preserving the branch');
      await clickPoint(page, 0, 1);
      await page.locator('[data-action=deleteNode]').click();
      assert.equal(await page.locator('[data-segment-branch="0"],[data-segment-branch="1"]').count(), 0, role + ' deletes the empty branch and its descendants with its last point');
      await page.locator('[data-action=undo]').click();
      await page.locator('[data-action=undo]').click();
      assert.equal(await page.locator('[data-segment-branch="0"],[data-segment-branch="1"]').count(), 4, role + ' restores point and branch deletion with undo');

      fs.mkdirSync('output/floor-plan-recursive-branches', { recursive: true });
      await page.screenshot({ path: 'output/floor-plan-recursive-branches/' + role + '.png' });
      console.log(role + ': PASS canvas-only branch creation, recursive numbering, shared-point drag, point-only branch deletion/undo, and .gics roundtrip');
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
