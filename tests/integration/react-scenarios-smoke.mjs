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
  for (const width of [1440, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/next/');
    for (const scenario of Object.keys(SCENARIOS)) {
      await page.request.post(base + '/__mock', { data: { scenario } });
      await page.reload();
      if (scenario === 'error' || scenario === 'limited') {
        await page.getByRole('alert').waitFor();
        assert.match(await page.getByRole('alert').innerText(), scenario === 'limited' ? /limit reached/ : /503/);
      } else {
        await page.locator('.react-calendar').waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${scenario}: horizontal overflow at ${width}`);
        if (scenario === 'partial') {
          await page.getByLabel('Data availability').waitFor();
          assert.match(await page.getByLabel('Data availability').innerText(), /10 of 12/);
        }
        if (scenario !== 'empty') {
          await page.getByRole('button', { name: 'List', exact: true }).click();
          await page.locator('.event-card').first().click();
          await page.locator('dialog[open]').waitFor();
          assert.ok(await page.locator('dialog').evaluate(el => el.getBoundingClientRect().width <= innerWidth));
          await page.keyboard.press('Escape');
        }
      }
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('All mock scenarios passed at desktop and mobile widths.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
