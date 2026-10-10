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
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(base);
  await page.locator(".ride").first().waitFor();
  await page.getByText("Mock data", { exact: true }).click();
  await page.getByLabel("Scenario").selectOption("empty");
  await page.waitForFunction(() =>
    document.querySelector("#events-stats")?.textContent.includes("0 events"),
  );
  assert.equal(await page.locator(".ride").count(), 0);
  await page.getByText("Mock data", { exact: true }).click();
  await page.getByLabel("Scenario").selectOption("long");
  await page.locator(".ride").first().waitFor();
  assert.ok(
    (await page.locator(".ride strong").first().innerText()).includes(
      "Очень длинное",
    ),
  );
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.getByRole("link", { name: "Connect with Strava" }).click();
  await page.locator(".ride").first().waitFor();
  await page.goto(base + "/next/");
  await page.getByRole("button", { name: "Account menu" }).hover();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.getByRole("link", { name: "Connect with Strava" }).click();
  await page.getByRole("button", { name: "Account menu" }).waitFor();
  assert.deepEqual(errors, []);
  console.log("Mock backend/prototype/React browser smoke passed");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
