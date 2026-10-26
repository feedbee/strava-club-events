import { normalizePreferences } from "../../../shared/preferences.js";
export { DEFAULT_PREFERENCES, normalizePreferences } from "../../../shared/preferences.js";
export function preferenceKey({ demo, athleteId }) {
  return `strava-react-preferences:${demo ? "demo" : "account"}:${String(athleteId)}`;
}
export function readPreferences(storage, key) {
  try {
    return normalizePreferences(JSON.parse(storage.getItem(key)));
  } catch {
    return normalizePreferences(null);
  }
}
export function writePreferences(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(normalizePreferences(value)));
  } catch {
    /* Storage can be unavailable in private or restricted browsing. */
  }
}

export function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
