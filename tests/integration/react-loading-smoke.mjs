import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMockApp } from '../../prototypes/calendar/backend/app.js';
import { SCENARIOS } from '../../prototypes/calendar/backend/fixtures.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await new Promise(resolve => { const server = createMockApp().listen(0, '127.0.0.1', () => resolve(server)); });
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const mode of ['Month', 'List', 'Day']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(base + '/next/');
    await page.locator('.event-card').first().waitFor();
    await page.getByRole('button', { name: mode, exact: true }).click();
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByRole('button', { name: 'All sports', exact: false }).click();
    const before = await page.locator('.calendar-loading-region').boundingBox();
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    await page.route('**/events?*', async route => { await pending; await route.continue(); });
    await page.locator('.picker-options label').filter({ hasText: 'Cycling' }).click();
    await page.locator('.events-loading-overlay').waitFor();
    const after = await page.locator('.calendar-loading-region').boundingBox();
    assert.deepEqual(after, before);
    assert.equal(await page.locator('.calendar-content[inert]').count(), 1);
    assert.equal(await page.locator('.events-loading-spinner').count(), 1);
    if (mode === 'List') await page.screenshot({ path: '/tmp/react-loading-overlay.png' });
    release();
    await page.locator('.events-loading-overlay').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.calendar-content[inert]').count(), 0);
    await page.close();
  }
  console.log('Calendar loading overlays preserve layout in Month, List and Day.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
