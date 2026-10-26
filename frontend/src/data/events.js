import { normalizeEventsResponse } from "../../../shared/events.js";
export { dateKey, normalizeEventsResponse, filterEvents, indexByDate } from "../../../shared/events.js";
export async function readEvents(request = fetch, signal, { clubs = [], sports = [] } = {}) {
  const query = new URLSearchParams();
  if (clubs.length) query.set("clubs", clubs.join(","));
  if (sports.length) query.set("sportTypes", sports.join(","));
  const response = await request(`/events${query.size ? `?${query}` : ""}`, {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      response.status === 429
        ? "Strava request limit reached. Please try again later."
        : `Unable to load events (${response.status})`,
    );
    error.status = response.status;
    error.retryAfter = body.retry_after;
    throw error;
  }
  return normalizeEventsResponse(await response.json());
}
