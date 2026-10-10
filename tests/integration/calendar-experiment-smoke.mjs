import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { backend } from "../helpers/runtime.js";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const load = await backend();
const { app } = await load("src/app.js");
const server = await new Promise((resolve) => {
  const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
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
  page.on("pageerror", (error) => errors.push(error.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${base}/prototypes/calendar/login.html`);
  await page.getByRole("link", { name: "Connect with Strava (demo)", exact: true }).click();
  await page.locator(".journey-weeks .ride").first().waitFor();
  await page.getByText("Alex Rider", { exact: true }).waitFor({ state: "attached" });
  const account = page.getByRole("button", { name: "Account menu", exact: true });
  assert.equal(await account.getAttribute("aria-expanded"), "false");
  await account.hover();
  await page.waitForTimeout(300);
  assert.equal(await account.getAttribute("aria-expanded"), "true");
  assert.ok(await page.getByRole("button", { name: "Logout", exact: true }).isVisible());
  await page.locator("#events-stats").hover();
  assert.equal(await account.getAttribute("aria-expanded"), "false");
  await account.focus();
  assert.equal(await account.getAttribute("aria-expanded"), "true");
  await page.keyboard.press("Escape");
  assert.equal(await account.getAttribute("aria-expanded"), "false");

  // Reproduce clicks before, during and after the preview's 850ms delay.
  for (const delay of [0, 300, 830, 860, 930, 1050]) {
    await page.locator("h1").hover();
    const card = page.locator(".journey-weeks .ride").first();
    await card.hover();
    await page.waitForTimeout(delay);
    const box = await card.boundingBox();
    await page.mouse.click(box.x + 12, box.y + 20);
    await page.locator("dialog[open]").waitFor({ timeout: 2000 });
    await page.keyboard.press("Escape");
  }
  await page.locator("h1").hover();
  await page.locator(".journey-weeks .ride").first().hover();
  await page.locator(".ride-title-hint").waitFor({ state: "visible" });
  const preview = await page.locator(".ride-title-hint").boundingBox();
  assert.equal(preview.height, 44);
  await page.mouse.click(preview.x + preview.width - 10, preview.y + 20);
  await page.locator("dialog[open]").waitFor();
  assert.equal(await page.locator("dialog .event-link-icon svg").count(), 2);
  await page.keyboard.press("Escape");

  // Exploring distant months must not accumulate an unbounded week DOM.
  await page.locator("h1").click();
  for (const direction of ["next", "previous"]) {
    for (let step = 0; step < 12; step++) {
      await page.locator(".journey-scroll").evaluate((element, direction) => {
        element.scrollTop = direction === "next" ? element.scrollHeight : 0;
      }, direction);
      await page.waitForTimeout(60);
      assert.ok((await page.locator(".journey-week").count()) <= 24);
    }
  }
  const dates = await page
    .locator(".journey-day")
    .evaluateAll((days) => days.map((day) => day.dataset.date));
  assert.equal(new Set(dates).size, dates.length);
  for (let index = 1; index < dates.length; index++) {
    const previous = new Date(`${dates[index - 1]}T12:00:00`);
    previous.setDate(previous.getDate() + 1);
    assert.equal(
      previous.getDate(),
      new Date(`${dates[index]}T12:00:00`).getDate(),
    );
  }

  for (const width of [1440, 768, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: "Month", exact: true }).click();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    const key = await page
      .locator(".day-more")
      .first()
      .getAttribute("data-more-date");
    const day = page.locator(`[data-date="${key}"]`);
    await day.locator(".day-more").click();
    assert.equal(await day.locator(".ride").count(), 7);
    await day.getByRole("button", { name: "Show less" }).click();
    assert.equal(await day.locator(".ride").count(), 5);
    await page.getByRole("button", { name: "List", exact: true }).click();
    assert.equal(await page.locator(".journey-day").count(), 12);
    assert.equal(await page.locator(".journey-weeks .ride").count(), 84);
    assert.equal(
      await page.getByRole("button", { name: "Today", exact: true }).count(),
      0,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (width < 1000)
      assert.equal(
        await page.getByRole("button", { name: "Week", exact: true }).count(),
        0,
      );
  }
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  assert.ok(
    await page
      .locator(".time-slot")
      .evaluateAll((slots) =>
        slots.some((slot) => slot.querySelectorAll(".ride").length === 3),
      ),
  );
  await page.getByRole("button", { name: "Filters", exact: false }).click();
  await page.getByText("Show only joined events", { exact: true }).click();
  assert.equal(
    await page.locator(".journey-weeks .ride:not(.joined)").count(),
    0,
  );
  assert.match(await page.locator("#events-stats").innerText(), /28 events/);
  await page.getByText("Show only joined events", { exact: true }).click();
  await page
    .getByRole("button", { name: "Filter by club", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Warsaw Cycling Club", exact: false })
    .check();
  await page.waitForFunction(() =>
    document.getElementById("events-stats").textContent.includes("42 events"),
  );
  assert.deepEqual(errors, []);
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.waitForURL("**/prototypes/calendar/login.html");
  console.log("Calendar experiment browser smoke passed");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
