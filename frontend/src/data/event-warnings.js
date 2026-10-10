export function eventWarnings(meta, selectedClubs = []) {
  if (!meta) return [];
  const messages = [];
  const positive = (value) => Number.isSafeInteger(value) && value > 0;
  if (positive(meta.clubs_failed) || (meta.partial && meta.clubs_failed === undefined && !meta.routes_failed))
    messages.push('Some clubs could not be loaded. Results are incomplete.');
  if (positive(meta.routes_failed))
    messages.push(`Route details could not be loaded for ${meta.routes_failed} ${meta.routes_failed === 1 ? 'route' : 'routes'}. Events are still shown.`);
  if (positive(meta.retry_after))
    messages.push(`Please retry in ${meta.retry_after} seconds.`);
  if (meta.clubs_fetch_limited)
    messages.push(`Only the first ${positive(meta.limits?.clubs_fetch) ? meta.limits.clubs_fetch : 200} clubs are loaded.`);
  else if (meta.clubs_limited && !selectedClubs.length && positive(meta.clubs_total) && positive(meta.clubs_processed))
    messages.push(`Showing events from ${meta.clubs_processed} of ${meta.clubs_total} clubs. Use the club filter to focus on specific clubs.`);
  if (meta.events_limited)
    messages.push(`Only the first ${positive(meta.limits?.events_per_club) ? meta.limits.events_per_club : 100} upcoming events per club are shown.`);
  if (positive(meta.routes_skipped))
    messages.push(`Route details unavailable for ${meta.routes_skipped} ${meta.routes_skipped === 1 ? 'event' : 'events'} (API limit reached).`);
  return messages;
}
