import test from "node:test";
import assert from "node:assert/strict";
import { readCurrentUser } from "../../frontend/src/data/auth.js";

test("React session reader treats only 401 as signed out", async () => {
  assert.equal(await readCurrentUser(async () => ({ status: 401 })), null);
  await assert.rejects(
    readCurrentUser(async () => ({ status: 503, ok: false })),
    /503/,
  );
});
test("React session reader preserves authenticated identity and forwards cancellation", async () => {
  const signal = new AbortController().signal;
  const user = { athleteId: "123", firstname: "Мария", csrfToken: "test-only" };
  const result = await readCurrentUser(async (url, options) => {
    assert.equal(url, "/me");
    assert.equal(options.signal, signal);
    assert.equal(options.credentials, "same-origin");
    return { ok: true, json: async () => user };
  }, signal);
  assert.deepEqual(result, user);
});
