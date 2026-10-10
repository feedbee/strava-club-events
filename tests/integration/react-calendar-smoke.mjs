import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createMockApp } from "../../prototypes/calendar/backend/app.js";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = await new Promise((resolve) => {
  const server = createMockApp().listen(0, "127.0.0.1", () => resolve(server));
});
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_EXECUTABLE
      ? { executablePath: process.env.CHROME_EXECUTABLE }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(base + "/next/");
  await page.locator(".event-card").first().waitFor();
  const initialScroll = await page.locator(".calendar-viewport").evaluate(el => el.scrollTop);
  await page.getByRole("button", { name: "Month", exact: true }).click();
  assert.equal(await page.locator(".calendar-viewport").evaluate(el => el.scrollTop), initialScroll);
  assert.equal(await page.locator(".current-day .event-card").count(), 5);
  await page.locator(".current-day .day-overflow").click();
  assert.equal(await page.locator(".current-day .event-card").count(), 7);
  await page.locator(".current-day .day-overflow").click();
  assert.equal(await page.locator(".current-day .event-card").count(), 5);
  await page.locator(".current-day .event-card").first().click();
  await page.locator("dialog[open]").waitFor();
  assert.equal(
    await page
      .locator("dialog")
      .getByRole("heading", { name: "Route", exact: true })
      .count(),
    1,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "List", exact: true }).click();
  assert.equal(await page.locator(".event-card").count(), 84);
  assert.equal(
    await page.getByRole("button", { name: "Today", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Show only joined events").check();
  assert.equal(await page.locator(".event-card").count(), 28);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByRole("button", { name: "All clubs", exact: false }).click();
  await page.getByLabel("Warsaw Cycling Club", { exact: true }).check();
  assert.equal(await page.locator(".event-card").count(), 42);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  for (const width of [1440, 768, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.locator(".service-footer").evaluate(el => el.getBoundingClientRect().bottom <= innerHeight + 1), `Footer outside viewport at ${width}`);
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForFunction(
      () =>
        document.querySelector(".react-calendar").getBoundingClientRect()
          .width >=
        innerWidth - 48,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({ path: `/tmp/react-calendar-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Month", exact: true }).click();
  for (const direction of ["next", "previous"]) {
    for (let step = 0; step < 12; step++) {
      await page
        .locator(".calendar-viewport")
        .evaluate((element, direction) => {
          element.scrollTop = direction === "next" ? element.scrollHeight : 0;
        }, direction);
      await page.waitForTimeout(60);
      assert.ok((await page.locator(".calendar-day").count()) <= 168);
    }
  }
  const keys = await page
    .locator(".calendar-day")
    .evaluateAll((days) => days.map((day) => day.dataset.date));
  assert.equal(new Set(keys).size, keys.length);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.locator(".current-day .event-card").first().waitFor();
  await page.request.post(base + "/__mock", { data: { scenario: "empty" } });
  await page.reload();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByText("No matching events", { exact: true }).waitFor();
  await page.request.post(base + "/__mock", { data: { scenario: "error" } });
  await page.reload();
  await page.getByRole("alert").waitFor();
  await page.request.post(base + "/__mock", { data: { scenario: "dense" } });
  await page.getByRole("button", { name: "Try again" }).click();
  await page.locator(".event-card").first().waitFor();
  assert.deepEqual(errors, []);
  console.log("React calendar data/filters/Month/List browser smoke passed");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
