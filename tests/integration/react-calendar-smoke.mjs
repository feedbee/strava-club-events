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
  await page.goto(base + "/");
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
  const dateHeadingStyle = (heading) => heading.evaluate((element) => {
    const headingStyle = getComputedStyle(element);
    const dateStyle = getComputedStyle(element.querySelector("time"));
    return [headingStyle.fontSize, headingStyle.textAlign, dateStyle.backgroundColor, dateStyle.padding, dateStyle.color];
  });
  const listDateHeading = page.locator(".list .current-day .agenda-date");
  const listDateStyle = await dateHeadingStyle(listDateHeading);
  assert.deepEqual(listDateStyle.slice(0, 2), ["15px", "center"]);
  assert.equal(listDateStyle[2], "rgb(252, 76, 2)");
  const otherListDate = page.locator(".list .calendar-day:not(.current-day) .agenda-date").first();
  const otherDateStyle = await dateHeadingStyle(otherListDate);
  assert.deepEqual(otherDateStyle, ["15px", "center", "rgb(84, 36, 199)", listDateStyle[3], "rgb(255, 255, 255)"]);
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
    assert.deepEqual(await dateHeadingStyle(listDateHeading), listDateStyle);
    await page.screenshot({ path: `/tmp/react-calendar-${width}.png` });
  }
  assert.equal(await page.locator(".list .detailed-card").count(), 84);
  await page.setViewportSize({ width: 500, height: 1198 });
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  const month = page.getByRole("group", { name: "Choose a date this month" });
  const weekdays = page.locator(".calendar-weekdays");
  assert.deepEqual(await weekdays.locator("span").allTextContents(), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const narrowHeader = await weekdays.boundingBox();
  const calendarBox = await page.locator(".react-calendar").boundingBox();
  assert.equal(narrowHeader.x, calendarBox.x);
  const narrowAgenda = page.locator(".month-agenda");
  assert.equal(narrowHeader.width, await narrowAgenda.evaluate((element) => element.clientWidth));
  await narrowAgenda.evaluate((element) => { element.style.scrollbarGutter = "stable"; });
  const dateColumn = await month.getByRole("button").nth(6).boundingBox();
  const weekdayColumn = await weekdays.locator("span").last().boundingBox();
  assert.equal(dateColumn.x + dateColumn.width / 2, weekdayColumn.x + weekdayColumn.width / 2);
  await narrowAgenda.evaluate((element) => { element.style.removeProperty("scrollbar-gutter"); });
  assert.equal(await month.getByRole("button").count(), 42);
  const selectedDate = month.locator('[aria-current="date"][aria-pressed="true"]');
  const selectedBackground = await selectedDate.evaluate((cell) => getComputedStyle(cell).backgroundColor);
  await selectedDate.hover();
  assert.equal(await selectedDate.evaluate((cell) => getComputedStyle(cell).backgroundColor), selectedBackground);
  const agenda = page.locator(".month-agenda");
  assert.deepEqual(await dateHeadingStyle(agenda.locator(".agenda-date")), listDateStyle);
  const agendaBox = await agenda.boundingBox();
  assert.equal(agendaBox.y + agendaBox.height, calendarBox.y + calendarBox.height);
  assert.equal(await agenda.locator(".detailed-card").count(), 7);
  await agenda.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  assert.ok(await agenda.evaluate((element) => element.scrollTop > 0));
  await page.getByRole("button", { name: "Today", exact: true }).click();
  assert.equal(await agenda.evaluate((element) => element.scrollTop), 0);
  await month.getByRole("button", { name: /, 0 events$/ }).and(month.locator(":enabled")).first().click();
  await page.getByText("No events on this date").waitFor();
  assert.deepEqual(await dateHeadingStyle(agenda.locator(".agenda-date")), otherDateStyle);
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  const strip = page.getByRole("group", { name: "Choose a day this week" });
  assert.equal(await strip.getByRole("button").count(), 7);
  const currentWeek = await strip.getByRole("button").first().getAttribute("aria-label");
  await page.getByRole("button", { name: "Next week" }).click();
  assert.notEqual(await strip.getByRole("button").first().getAttribute("aria-label"), currentWeek);
  await page.getByRole("button", { name: "Previous week" }).click();
  assert.equal(await strip.getByRole("button").first().getAttribute("aria-label"), currentWeek);
  const anotherDay = strip.locator('button:enabled[aria-pressed="false"]').first();
  const anotherDate = await anotherDay.getAttribute("aria-label");
  await anotherDay.click();
  await page.getByRole("heading", { name: anotherDate, exact: true }).waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Month", exact: true }).click();
  assert.equal(await month.count(), 0);
  assert.equal(await weekdays.locator("span").first().textContent(), "Monday");
  assert.equal((await weekdays.boundingBox()).height, narrowHeader.height);
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
