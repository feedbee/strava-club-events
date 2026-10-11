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
  const page = await browser.newPage();
  await page.goto(base + '/next/');
  await page.locator('.event-card').first().waitFor();
  const now = new Date();
  for (const [direction, offset] of [['Next', 1], ['Next', 2], ['Previous', 1], ['Previous', 0]]) {
    await page.getByRole('button', { name: `${direction} month`, exact: true }).click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const expected = new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    assert.equal(await page.locator('.calendar-toolbar h2').innerText(), expected);
  }
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.reload();
  await page.locator('.event-card').first().waitFor();
  for (let step = 0; step < 3; step++) {
    await page.getByRole('button', { name: 'Next month', exact: true }).click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await page.locator('.calendar-viewport').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const visibleMonth = await page.locator('.calendar-viewport').evaluate(el => {
    const day = [...el.querySelectorAll('[data-date]')].find(day => day.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 4);
    return new Date(day.dataset.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });
  assert.equal(await page.locator('.calendar-toolbar h2').innerText(), visibleMonth);
  await page.close();
  const recovery = await browser.newPage();
  await recovery.addInitScript(() => localStorage.setItem('strava-react-preferences:account:0', JSON.stringify({ clubs: ['99'] })));
  await recovery.route('**/events*', route => {
    if (new URL(route.request().url()).searchParams.has('clubs')) return route.fulfill({ status: 400, json: { error: 'Invalid saved filter' } });
    return route.continue();
  });
  await recovery.goto(base + '/next/');
  await recovery.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await recovery.locator('.event-card').first().waitFor();
  assert.equal(await recovery.getByRole('alert').count(), 0);
  await recovery.close();
  console.log('Month navigation and saved-filter recovery passed.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
