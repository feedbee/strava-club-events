import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createMockApp } from "../../prototypes/calendar/backend/app.js";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = await new Promise((resolve) => {
  const s = createMockApp().listen(0, "127.0.0.1", () => resolve(s));
});
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_EXECUTABLE
      ? { executablePath: process.env.CHROME_EXECUTABLE }
      : {}),
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(base + "/next/");
  await page.locator(".event-card").first().waitFor();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Show only joined events").check();
  await page.reload();
  await page.locator(".event-card").first().waitFor();
  assert.equal(await page.locator(".event-card").count(), 28);
  assert.equal(
    await page
      .getByRole("button", { name: "List", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "All clubs", exact: false }).click();
  await page.getByRole("textbox", { name: "Search clubs" }).fill("Warsaw");
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Weekend Wanderers", exact: true })
      .count(),
    0,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".picker-options").count(), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".filter-panel").count(), 0);
  assert.ok(
    await page
      .getByRole("button", { name: "Filters", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await page.locator(".event-card").first().focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  assert.ok(await page.getByRole("dialog").getAttribute("aria-labelledby"));
  assert.equal(await page.locator(".detail-link-row svg").count(), 4);
  await page.keyboard.press("Escape");
  assert.ok(
    await page
      .locator(".event-card")
      .first()
      .evaluate((el) => el === document.activeElement),
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "All clubs", exact: false }).click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const touch=await browser.newContext({hasTouch:true,viewport:{width:320,height:900}});
  const mobile=await touch.newPage();
  await mobile.goto(base+'/next/');await mobile.locator('.event-card').first().waitFor();
  await mobile.locator('.event-card').first().tap();await mobile.getByRole('dialog').waitFor();
  assert.equal(await mobile.locator('.event-preview').count(),0);
  await mobile.getByRole('button',{name:'Close event details'}).tap();
  await mobile.getByRole('button',{name:'Account menu'}).tap();
  assert.equal(await mobile.getByRole('button',{name:'Account menu'}).getAttribute('aria-expanded'),'true');
  await mobile.getByRole('button',{name:'Filters',exact:true}).tap();
  assert.equal(await mobile.getByRole('button',{name:'Account menu'}).getAttribute('aria-expanded'),'false');
  await touch.close();
  assert.deepEqual(errors, []);
  console.log(
    "React preferences, detail focus and filter keyboard smoke passed",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
