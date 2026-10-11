export const DEFAULT_PREFERENCES = {
  mode: "month",
  joinedOnly: false,
  clubs: [],
  sports: [],
};
export function normalizePreferences(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const selection = (items) =>
    Array.isArray(items)
      ? [
          ...new Set(
            items.filter((item) => typeof item === "string" && item.length > 0),
          ),
        ].slice(0, 10)
      : [];
  return {
    mode: ["month", "week", "day", "list"].includes(source.mode)
      ? source.mode
      : "month",
    joinedOnly: source.joinedOnly === true,
    clubs: selection(source.clubs).filter((id) => /^\d+$/.test(id)),
    sports: selection(source.sports),
  };
}
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
