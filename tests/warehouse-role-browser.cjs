const { chromium } = require(process.env.PLANDY_PLAYWRIGHT);
const assert = require('assert/strict');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    try {
        for (const editor of [false, true]) {
            const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
            const page = await context.newPage();
            await page.goto('http://127.0.0.1:4173/#custom-1788157191456');
            await page.waitForTimeout(1000);
            await page.locator('#loginUserId').fill(editor ? 'edituser' : 'viewuser');
            await page.locator('#loginPassword').fill(editor ? 'edit!@#$' : 'view1234');
            await page.locator('#loginSubmitBtn').click();
            await page.locator('.warehouse-3d-shell').waitFor({ timeout: 30000 });

            const expectedRole = editor ? 'editor' : 'viewer';
            assert.equal(await page.evaluate(() => window.wmsPermissions.getRole()), expectedRole);
            assert.equal(await page.locator('.warehouse-3d-brand').count(), 0, 'The temporary top-left title must be absent.');
            assert.equal(await page.locator('.warehouse-3d-kpi-card').count(), 9);
            for (const width of [1500, 1920]) {
                await page.setViewportSize({ width, height: 1000 });
                const kpi = await page.locator('.warehouse-3d-kpi-list').boundingBox();
                const actions = await page.locator('.warehouse-3d-toolbar-actions').boundingBox();
                assert.ok(kpi && actions, 'The toolbar KPI cards and actions must remain visible.');
                assert.ok(kpi.y >= actions.y + actions.height || kpi.x + kpi.width <= actions.x,
                    `The toolbar KPI cards and actions must not overlap at ${width}px.`);
            }
            assert.equal(await page.locator('.warehouse-3d-viewport').count(), 1);
            assert.equal(await page.locator('.warehouse-3d-object-search').isEnabled(), true);
            assert.equal(await page.locator('.warehouse-3d-reload').isVisible(), true);
            await page.locator('.warehouse-3d-object-search').fill('랙');
            assert.equal(await page.locator('.warehouse-3d-object-search').inputValue(), '랙');
            console.log(`${editor ? 'Editor' : 'Viewer'}: PASS interactive 3D screen is available without a role gate`);
            await context.close();
        }
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
