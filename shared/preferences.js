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
