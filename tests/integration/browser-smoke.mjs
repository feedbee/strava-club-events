import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { backend, apiResponse } from '../helpers/runtime.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const load = await backend({ modules: { 'node-fetch': { default: async () => apiResponse([]) } } });
const { app } = await load('src/app.js');
const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  const page = await browser.newPage({ timezoneId: 'Europe/Warsaw' }); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/Content Security Policy|Refused to (load|execute|apply)/i.test(message.text())) errors.push(message.text()); });
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.route(`${base}/me`, route => route.fulfill({ json: { csrfToken: 'ab'.repeat(32), athleteId: 1, firstname: 'Test', lastname: 'User' } }));
  const date = new Date(); date.setDate(date.getDate()+1); date.setHours(10,0,0,0);
  const nextOccurrence = new Date(date.getTime() + 86400000);
  await page.route(`${base}/events*`, route => route.fulfill({ json: {
    events: [date, nextOccurrence].map(start => ({ id: 'test-event',
      occurrence_id: `1:test-event:${start.toISOString()}`, title: 'Dependency smoke ride', start_date: start.toISOString(),
      strava_event_url: 'https://www.strava.com/clubs/1/group_events/1', club_info: {id:1,name:'Test Club',logo:''}, joined: true })),
    clubs: [{id:1,name:'Test Club',sport_type:'cycling',logo:''}],
    meta: {clubs_total:1,clubs_processed:1,events_total:2,routes_skipped:0,routes_failed:1,partial:true,retry_after:120,limits:{events_per_club:100}},
  } }));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.fc-event-title').filter({hasText:'Dependency smoke ride'}).first().waitFor();
  assert.equal(await page.locator('.fc-event-title').filter({hasText:'Dependency smoke ride'}).count(), 2);
  assert.equal(await page.evaluate(() => FullCalendar.version), '6.1.21');
  assert.match(await page.locator('#limits-warning').innerText(), /Route details could not be loaded for 1 route/);
  assert.match(await page.locator('#limits-warning').innerText(), /2 minutes/);
  await page.locator('#btn-list-view').click();
  await page.locator('.lv-event-title').filter({hasText:'Dependency smoke ride'}).first().waitFor();
  assert.equal(await page.locator('.lv-event-title').count(), 2);
  const expectedDay = await page.evaluate(iso => { const d = new Date(iso); return d.toLocaleDateString('en-US', {weekday:'long',month:'long',day:'numeric'}); }, date.toISOString());
  assert.ok((await page.locator('.lv-date-header').first().innerText()).replace(/\s+/g, ' ').toLowerCase().includes(expectedDay.toLowerCase()), JSON.stringify({ expectedDay, actual: await page.locator('.lv-date-header').first().innerText() }));
  await page.locator('#btn-calendar-view').click();
  await page.locator('.fc-timeGridWeek-button').click();
  await page.locator('.fc-timegrid').waitFor();
  // A failed filter request must preserve the calendar and remove its loading state.
  await page.unroute(`${base}/events*`);
  await page.route(`${base}/events*`, route => route.fulfill({status:429,json:{error:'Strava rate limit reached',retry_after:120}}));
  await page.locator('#toggle-filters').click();
  await page.locator('#clubFilterTrigger').click();
  await page.locator('#clubFilterList input[value="1"]').check();
  await page.locator('#error-message').filter({hasText:'Strava request limit reached'}).waitFor();
  assert.match(await page.locator('#error-message').innerText(), /2 minutes/);
  assert.equal(await page.locator('#calendar').evaluate(el => el.classList.contains('calendar-loading')), false);
  await page.locator('.fc-timegrid').waitFor();
  if (process.env.BROWSER_SCREENSHOT) await page.screenshot({path:process.env.BROWSER_SCREENSHOT,fullPage:true});
  await page.unroute(`${base}/events*`);
  await page.route(`${base}/events*`, route => route.fulfill({status:401,json:{error:'Session expired'}}));
  await page.locator('#clubFilterList input[value="1"]').uncheck();
  await page.locator('#auth').waitFor({state:'visible'});
  assert.equal(await page.locator('#calendar').isVisible(), false);
  assert.equal(await page.locator('#list-view').isVisible(), false);
  assert.equal(await page.locator('#user-name').textContent(), '');
  assert.equal(await page.locator('.lv-event-title').count(), 0);
  // Profile failure during initial loading is handled too.
  await page.unroute(`${base}/me`);
  await page.route(`${base}/me`, route => route.fulfill({status:401,json:{error:'Not authenticated'}}));
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#auth').waitFor({state:'visible'});
  assert.equal(await page.locator('#calendar').isVisible(), false);
  // Exercise the form contract with a fixture POST redirect.
  await page.unroute(`${base}/me`);
  await page.route(`${base}/me`, route => route.fulfill({json:{athleteId:1,firstname:'Test',lastname:'User',csrfToken:'ab'.repeat(32)}}));
  await page.unroute(`${base}/events*`);
  await page.route(`${base}/events*`, route => route.fulfill({json:{events:[],clubs:[],meta:{clubs_total:0}}}));
  let logoutPosted = false;
  await page.route(`${base}/logout`, async route => {
    assert.equal(route.request().method(), 'POST');
    assert.equal(new URLSearchParams(route.request().postData()).get('csrfToken'), 'ab'.repeat(32));
    logoutPosted = true;
    await page.unroute(`${base}/me`);
    await page.route(`${base}/me`, response => response.fulfill({status:401,json:{error:'Signed out'}}));
    await route.fulfill({status:303,headers:{location:base},body:''});
  });
  await page.reload({waitUntil:'networkidle'});
  await page.locator('.user-profile').hover();
  await page.locator('.logout-link').click();
  await page.locator('#auth').waitFor({state:'visible'});
  assert.equal(logoutPosted, true);
  await page.route(`${base}/limits`, route => route.fulfill({json:{clubs_fetch:200,clubs:25,events_per_club:100,routes:20}}));
  await page.goto(`${base}/limits.html`, {waitUntil:'networkidle'});
  assert.equal(await page.locator('#limit-clubs-fetch').textContent(), '200');
  assert.deepEqual(errors, []);
  console.log('Browser smoke passed: FullCalendar 6.1.21 + SRI, month/list/week, recurring occurrences, local date, filter failure cleanup, authentication loss, POST logout, CSP and limits page, no uncaught page errors');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => {server.close(resolve);server.closeAllConnections();});
}
