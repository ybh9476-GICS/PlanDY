const { chromium } = require(process.env.PLANDY_PLAYWRIGHT);
const assert = require('assert/strict');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    try {
        for (const editor of [false, true]) {
            const context = await browser.newContext({ viewport: { width: 1500, height: 900 } });
            const page = await context.newPage();
            await page.goto('http://127.0.0.1:4173/#custom-1788157191456');
            await page.locator('#loginUserId').fill(editor ? 'edituser' : 'viewuser');
            await page.locator('#loginPassword').fill(editor ? 'edit!@#$' : 'view1234');
            await page.locator('#loginSubmitBtn').click();
            await page.locator('.warehouse-3d-bottom-panel.has-operations').waitFor({ timeout: 30000 });
            const result = await page.evaluate(() => {
                const panel = document.querySelector('.warehouse-3d-bottom-panel');
                const controls = panel.querySelector('.warehouse-operation-controls');
                const list = panel.querySelector('.warehouse-operation-list');
                const pause = controls.querySelector('button');
                const rect = node => {
                    const { x, y, width, height } = node.getBoundingClientRect();
                    return { x, y, width, height };
                };
                return {
                    panel: rect(panel), controls: rect(controls), list: rect(list), pause: rect(pause),
                    rowCount: list.querySelectorAll('.warehouse-operation-row').length,
                    scrollWidth: list.scrollWidth, clientWidth: list.clientWidth,
                    text: list.textContent.trim(),
                    listBesidePause: controls.contains(list) && list.getBoundingClientRect().left >= pause.getBoundingClientRect().right,
                    listOverflowX: getComputedStyle(list).overflowX,
                    viewportHeight: innerHeight
                };
            });
            console.log(`${editor ? 'Editor' : 'Viewer'}: ${JSON.stringify(result)}`);
            assert.ok(result.rowCount > 0, 'The operation routes must render.');
            assert.ok(result.listBesidePause, 'Operation statuses must appear beside the pause button.');
            assert.ok(result.panel.height < 60, 'The bottom panel must use a compact single row.');
            assert.ok(result.panel.y + result.panel.height <= result.viewportHeight, 'The status row must fit on screen.');
            assert.equal(result.listOverflowX, 'auto', 'Long statuses must remain horizontally scrollable.');
            const lastRowVisible = await page.evaluate(() => {
                const list = document.querySelector('.warehouse-operation-list');
                list.scrollLeft = list.scrollWidth;
                const last = list.lastElementChild.getBoundingClientRect();
                const viewport = list.getBoundingClientRect();
                return last.left >= viewport.left && last.right <= viewport.right + 1;
            });
            assert.ok(lastRowVisible, 'The last operation status must be reachable by scrolling.');
            await page.locator('.warehouse-operation-controls button').click();
            assert.equal(await page.locator('.warehouse-operation-controls button').textContent(), '운행 재개');
            await page.setViewportSize({ width: 900, height: 900 });
            const narrow = await page.evaluate(() => {
                const list = document.querySelector('.warehouse-operation-list');
                list.scrollLeft = list.scrollWidth;
                const last = list.lastElementChild.getBoundingClientRect();
                const viewport = list.getBoundingClientRect();
                return {
                    width: viewport.width,
                    lastRowVisible: last.right > viewport.left && last.right <= viewport.right + 1
                };
            });
            assert.ok(narrow.width >= 60, 'The status row must remain usable at narrower desktop widths.');
            assert.ok(narrow.lastRowVisible, 'The final route must be reachable at narrower desktop widths.');
            await context.close();
        }
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
