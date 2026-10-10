import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePreferences,
  preferenceKey,
  readPreferences,
  writePreferences,
} from "../../frontend/src/data/preferences.js";
test("React preferences validate modes, deduplicate selections and discard private fields", () => {
  const value = normalizePreferences({
    mode: "bad",
    joinedOnly: "true",
    clubs: ["1", "1", 2],
    sports: Array.from({ length: 12 }, (_, i) => String(i)),
    csrfToken: "private",
  });
  assert.deepEqual(value.clubs, ["1"]);
  assert.equal(value.sports.length, 10);
  assert.equal(value.mode, "month");
  assert.equal(value.joinedOnly, false);
  assert.ok(!("csrfToken" in value));
});
test("React preferences isolate athletes and demo and tolerate unavailable storage", () => {
  assert.notEqual(
    preferenceKey({ athleteId: 1 }),
    preferenceKey({ athleteId: 2 }),
  );
  assert.notEqual(
    preferenceKey({ athleteId: 1 }),
    preferenceKey({ athleteId: 1, demo: true }),
  );
  const storage = {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  };
  assert.equal(readPreferences(storage, "x").mode, "month");
  assert.doesNotThrow(() => writePreferences(storage, "x", {}));
});
