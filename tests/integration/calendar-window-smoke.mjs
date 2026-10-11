import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMockApp } from '../../prototypes/calendar/backend/app.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await new Promise(resolve => { const s = createMockApp().listen(0, '127.0.0.1', () => resolve(s)); });
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/?demo=1`);
  await page.getByRole('button', { name: 'Today', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  assert.equal(await page.getByRole('button', { name: 'Previous month' }).isDisabled(), true);
  const dates = await page.locator('.calendar-day').evaluateAll(nodes => nodes.map(n => n.dataset.date));
  const now = new Date();
  const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  assert.equal(dates[0], key(new Date(now.getFullYear(), now.getMonth()-1, 1)));
  assert.equal(dates.at(-1), key(new Date(now.getFullYear(), now.getMonth()+4, 0)));
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next month' }).click();
  assert.equal(await page.getByRole('button', { name: 'Next month' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  for (let i = 0; i < 30; i++) {
    const next = page.getByRole('button', { name: 'Next day' });
    if (await next.isDisabled()) break;
    await next.click();
  }
  assert.equal(await page.getByRole('button', { name: 'Next day' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Next week' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.calendar-padding:visible').count(), 0);
  await page.locator('.calendar-viewport').evaluate(n => { n.scrollTop = n.scrollHeight; });
  await page.waitForTimeout(100);
  assert.equal(await page.getByRole('button', { name: 'Next month' }).isDisabled(), true);
  console.log('Calendar month/day/week/mobile navigation bounds passed.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
