export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function normalizeEventsResponse(response) {
  const data = Array.isArray(response)
    ? { events: response, clubs: [], meta: null }
    : response;
  if (!data || !Array.isArray(data.events))
    throw new Error("Invalid events response");
  const seen = new Set();
  const events = data.events
    .map((event) => {
      if (!event || !Number.isFinite(new Date(event.start_date).getTime()))
        throw new Error("Invalid event date");
      const key = String(
        event.occurrence_id ||
          `${event.club_info?.id}:${event.id || event.strava_event_url || event.title}:${event.start_date}`,
      );
      if (seen.has(key)) throw new Error("Duplicate event occurrence");
      seen.add(key);
      return { ...event, key };
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  return {
    events,
    clubs: Array.isArray(data.clubs) ? data.clubs : [],
    meta: data.meta || null,
  };
}
export async function readEvents(request = fetch, signal) {
  const response = await request("/events", {
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
export function filterEvents(
  events,
  { joinedOnly = false, clubs = [], sports = [] } = {},
) {
  return events.filter(
    (event) =>
      (!joinedOnly || event.joined) &&
      (!clubs.length || clubs.includes(String(event.club_info?.id))) &&
      (!sports.length || sports.includes(event.club_info?.sport_type)),
  );
}
export function indexByDate(events) {
  const index = new Map();
  for (const event of events) {
    const day = dateKey(new Date(event.start_date));
    if (!index.has(day)) index.set(day, []);
    index.get(day).push(event);
  }
  return index;
}
