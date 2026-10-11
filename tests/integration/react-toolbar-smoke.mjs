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
  for (const width of [1440, 1100, 1000, 999, 768, 481, 480, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.goto(base + '/?mock=1');
    await page.locator('.event-card').first().waitFor();
    const geometry = await page.locator('.calendar-toolbar').evaluate(el => {
      const modes = el.querySelector('.calendar-modes').getBoundingClientRect();
      const navigation = el.querySelector('.calendar-navigation').getBoundingClientRect();
      return { modesTop: modes.top, navigationTop: navigation.top, icons: [...el.querySelectorAll('.calendar-modes button svg')].map(svg => ({ width: svg.getBoundingClientRect().width, paths: svg.children.length })) };
    });
    assert.equal(geometry.icons.length, width <= 999 ? 3 : 4);
    assert.ok(geometry.icons.every(icon => icon.width === 14 && icon.paths > 0));
    if (width > 480) assert.equal(geometry.modesTop, geometry.navigationTop, `Separate control rows at ${width}`);
    else assert.ok(geometry.navigationTop > geometry.modesTop);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.close();
  }
  console.log('Calendar toolbar icons and prototype breakpoints passed.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
