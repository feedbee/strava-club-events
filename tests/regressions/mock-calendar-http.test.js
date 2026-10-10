import test from "node:test";
import assert from "node:assert/strict";
import { createMockApp } from "../../prototypes/calendar/backend/app.js";

test("standalone mock API supports scenarios, filtering and isolated login/logout", async () => {
  const server = await new Promise((resolve) => {
    const server = createMockApp().listen(0, "127.0.0.1", () =>
      resolve(server),
    );
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const initial = await fetch(base + "/me");
    const cookie = initial.headers.get("set-cookie").split(";")[0];
    const user = await initial.json();
    const request = (path, options = {}) =>
      fetch(base + path, {
        ...options,
        headers: { cookie, ...options.headers },
        redirect: "manual",
      });
    assert.equal(
      (await (await request("/events?clubs=1")).json()).events.length,
      42,
    );
    assert.equal((await request("/events?clubs=1&clubs=2")).status, 400);
    const choose = (scenario) =>
      request("/__mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
    assert.equal((await choose("invalid")).status, 400);
    await choose("empty");
    assert.equal((await (await request("/events")).json()).events.length, 0);
    assert.equal(
      (await (await fetch(base + "/events")).json()).events.length,
      84,
    );
    await choose("error");
    assert.equal((await request("/events")).status, 503);
    await choose("limited");
    const limited = await request("/events");
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.equal(
      (
        await request("/logout", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "csrfToken=wrong",
        })
      ).status,
      403,
    );
    const logout = await request("/logout", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken: user.csrfToken }).toString(),
    });
    assert.equal(logout.status, 303);
    assert.equal((await request("/me")).status, 401);
    assert.equal((await request("/events")).status, 401);
    assert.equal((await request("/login")).status, 302);
    assert.equal((await request("/me")).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
