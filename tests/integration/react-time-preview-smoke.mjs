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
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator(".event-card").first().waitFor();
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  assert.equal(await page.locator(".time-grid-heading h3").count(), 7);
  assert.ok(
    await page
      .locator('[data-hour="9"] .time-slot')
      .evaluateAll((slots) =>
        slots.some((slot) => slot.querySelectorAll(".event-card").length === 3),
      ),
  );
  assert.ok((await page.locator(".time-today time").boundingBox()).width < 200);
  const weekHeading = page.locator(".time-grid.week .time-grid-heading");
  await page.evaluate(() => document.fonts.ready);
  const currentWeekHeadingHeight = (await weekHeading.boundingBox()).height;
  await page.getByRole("button", { name: "Next week" }).click();
  assert.equal(await weekHeading.locator(".time-today").count(), 0);
  assert.equal((await weekHeading.boundingBox()).height, currentWeekHeadingHeight);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Day", exact: true }).click();
  assert.equal(await page.locator(".time-grid-heading").count(), 0);
  const dayStrip = page.getByRole("group", { name: "Choose a day this week" });
  assert.equal(await dayStrip.getByRole("button").count(), 7);
  const todayLabel = await dayStrip.locator('[aria-current="date"]').getAttribute("aria-label");
  const dayHeading = page.locator(".day-strip-heading");
  assert.equal(await dayHeading.getByRole("heading").textContent(), todayLabel);
  assert.equal(await dayHeading.locator("p").textContent(), "7 events");
  await page.getByRole("button", { name: "Next week" }).click();
  assert.notEqual(await dayHeading.getByRole("heading").textContent(), todayLabel);
  await page.getByRole("button", { name: "Previous week" }).click();
  assert.equal(await dayHeading.getByRole("heading").textContent(), todayLabel);
  assert.equal(await page.locator('[data-hour="9"] .event-card').count(), 3);
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  for (const delay of [0, 500, 830, 860, 930, 1050]) {
    await page.locator("h1").hover();
    const card = page.locator(".current-day .event-card").first();
    await card.hover();
    await page.waitForTimeout(delay);
    const r = await card.boundingBox();
    await page.mouse.click(r.x + 12, r.y + 20);
    await page.locator("dialog[open]").waitFor({ timeout: 2000 });
    await page.keyboard.press("Escape");
  }
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of width === 1440 ? ["Month", "Week", "Day"] : ["Day"]) {
      await page.locator("h1").hover();
      await page.getByRole("button", { name: mode, exact: true }).click();
      if (mode !== "List")
        await page.getByRole("button", { name: "Today", exact: true }).click();
      const card = page.locator(".react-calendar .event-card").first();
      assert.equal(await card.locator(".card-club").isVisible(), mode === "Day");
      await card.hover();
      const r = await card.boundingBox();
      await page.locator(".event-preview").waitFor();
      const preview = await page.locator(".event-preview").boundingBox();
      assert.ok(preview.height > r.height);
      assert.ok(preview.y >= 0 && preview.y + preview.height <= 1000);
      assert.ok(await page.locator(".event-preview .detailed-card-club").isVisible());
      assert.ok(preview.width >= r.width - 1);
      assert.ok(preview.x >= 0 && preview.x + preview.width <= width);
      await page.mouse.click(preview.x + preview.width - 8, preview.y + 20);
      await page.locator("dialog[open]").waitFor();
      await page.keyboard.press("Escape");
    }
    if (width === 320)
      assert.equal(
        await page.getByRole("button", { name: "Week", exact: true }).count(),
        0,
      );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 1000 });
  await page
    .getByRole("button", { name: "Month", exact: true, pressed: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log("React Week/Day and animation click/width browser smoke passed");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
