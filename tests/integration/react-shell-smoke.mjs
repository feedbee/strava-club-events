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
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${base}/?demo=1&screen=login`);
  await page.getByRole("link", { name: "Connect with Strava" }).click();
  for (const width of [1440, 768, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Account menu" }).hover();
    await page.waitForTimeout(350);
    assert.ok(await page.getByRole("button", { name: "Logout" }).isVisible());
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.getByRole("button", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Connect with Strava" }).waitFor();
  await page.route("**/me", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.goto(`${base}/`);
  assert.equal(
    await page
      .getByRole("link", { name: "Connect with Strava" })
      .getAttribute("href"),
    "/login",
  );
  await page.unroute("**/me");
  await page.route("**/me", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.reload();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Connect with Strava" }).count(),
    0,
  );
  await page.unroute("**/me");
  await page.route("**/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        firstname: "Мария",
        lastname: "Rider",
        athleteId: "123",
        csrfToken: "test-only",
      }),
    }),
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("button", { name: "Account menu" }).hover();
  await page.waitForTimeout(350);
  assert.equal(
    await page.locator(".account-name").getAttribute("href"),
    "https://www.strava.com/athletes/123",
  );
  assert.equal(await page.locator("form").getAttribute("method"), "post");
  assert.equal(
    await page.locator("input[name=csrfToken]").inputValue(),
    "test-only",
  );
  assert.deepEqual(errors, []);
  console.log("React shell browser smoke passed");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
