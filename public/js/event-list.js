import { escapeHtml, safeImageUrl } from './html.js';

export function formatListViewTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function formatListViewDateHeader(dateKey) {
  // Append T00:00:00 to parse as local time and avoid UTC offset issues
  return new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export function getLocalDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getTodayDateKey() { return getLocalDateKey(new Date()); }

export function getActivityEmoji(routeInfo) {
  if (!routeInfo) return '🎯';
  const t = (routeInfo.activity_type || '').toLowerCase();
  if (t.includes('run'))                           return '🏃';
  if (t.includes('ride') || t.includes('cycling')) return '🚴';
  if (t.includes('walk'))                          return '🚶';
  if (t.includes('hike'))                          return '🥾';
  if (t.includes('swim'))                          return '🏊';
  return '🎯';
}

export function buildListCardHtml(event, index) {
  const time     = formatListViewTime(event.start_date);
  const clubName = escapeHtml(event.club_info?.name || '');
  const logoUrl = safeImageUrl(event.club_info?.logo);
  const clubLogo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" class="lv-club-logo-sm" alt="">`
    : '';
  const joined = event.joined
    ? `<span class="lv-joined-badge">✓ Joined</span>` : '';
  const emoji  = getActivityEmoji(event.route_info);
  const title  = escapeHtml(event.title);

  let statsHtml = '';
  const r = event.route_info;
  if (r && (r.distance !== 'N/A' || r.elevation_gain !== 'N/A' || r.estimated_moving_time !== 'N/A')) {
    const parts = [];
    if (r.distance !== 'N/A')              parts.push(`<span class="lv-stat">📏 ${escapeHtml(r.distance)}</span>`);
    if (r.elevation_gain !== 'N/A')        parts.push(`<span class="lv-stat">🏔️ ${escapeHtml(r.elevation_gain)}</span>`);
    if (r.estimated_moving_time !== 'N/A') parts.push(`<span class="lv-stat">⏱️ ${escapeHtml(r.estimated_moving_time)}</span>`);
    statsHtml = `<span class="lv-stats-row">${parts.join('')}</span>`;
  }

  return `
    <button type="button" class="lv-event-card" data-lv-index="${index}" aria-expanded="false" aria-controls="lv-detail-${index}">
      <span class="lv-time">${time}</span>
      <span class="lv-club-name">${clubLogo}${clubName}${joined}</span>
      <span class="lv-event-title">${emoji} ${title}</span>
      ${statsHtml}
    </button>`;
}

export function buildListDetailPanelHtml(event, index) {
  // --- Club section ---
  const clubId  = event.club_info?.id;
  const clubUrl = clubId ? `https://www.strava.com/clubs/${clubId}` : null;
  const logo    = safeImageUrl(event.club_info?.logo);
  const logoHtml = logo
    ? `<div class="lv-club-logo-md"><img src="${escapeHtml(logo)}" alt=""></div>`
    : `<div class="lv-club-logo-md">${escapeHtml((event.club_info?.name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div>`;
  const clubNameHtml = clubUrl
    ? `<a href="${escapeHtml(clubUrl)}" target="_blank" rel="noopener" class="lv-detail-link">${escapeHtml(event.club_info?.name || '')}</a>`
    : `<span>${escapeHtml(event.club_info?.name || '')}</span>`;
  const clubSection = `
    <div class="lv-detail-section" data-detail-section="club">
      <div class="lv-section-title">Club</div>
      <div class="lv-club-row">${logoHtml}${clubNameHtml}</div>
    </div>`;

  // --- Event section ---
  const when = new Date(event.start_date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  let eventRows = `<div class="lv-detail-row"><span class="lv-detail-row-label">When</span>${escapeHtml(when)}</div>`;
  if (event.address)           eventRows += `<div class="lv-detail-row"><span class="lv-detail-row-label">Where</span>${escapeHtml(event.address)}</div>`;
  if (event.terrain_label)     eventRows += `<div class="lv-detail-row"><span class="lv-detail-row-label">Terrain</span>${escapeHtml(event.terrain_label)}</div>`;
  if (event.skill_level_label) eventRows += `<div class="lv-detail-row"><span class="lv-detail-row-label">Skill</span>${escapeHtml(event.skill_level_label)}</div>`;
  if (event.joined)            eventRows += `<div class="lv-detail-joined">✅ You joined this event</div>`;
  const eventSection = `
    <div class="lv-detail-section" data-detail-section="event">
      <div class="lv-section-title">Event</div>
      <div><a href="${escapeHtml(event.strava_event_url)}" target="_blank" rel="noopener" class="lv-detail-link">${escapeHtml(event.title)}</a></div>
      ${eventRows}
    </div>`;

  // --- Route section (only if is_full) ---
  let routeSection = '';
  const r = event.route_info;
  if (r?.is_full) {
    const routeUrl  = r.id ? `https://www.strava.com/routes/${r.id}` : null;
    const routeNameHtml = routeUrl
      ? `<div class="lv-club-row"><span>🗺</span><a href="${escapeHtml(routeUrl)}" target="_blank" rel="noopener" class="lv-detail-link">${escapeHtml(r.name)}</a></div>`
      : `<div class="lv-club-row"><span>🗺</span><span>${escapeHtml(r.name)}</span></div>`;
    let routeRows = '';
    if (r.distance !== 'N/A')              routeRows += `<div class="lv-detail-row"><span class="lv-detail-row-label">Distance</span>${escapeHtml(r.distance)}</div>`;
    if (r.elevation_gain !== 'N/A')        routeRows += `<div class="lv-detail-row"><span class="lv-detail-row-label">Elevation</span>${escapeHtml(r.elevation_gain)}↑</div>`;
    if (r.activity_type)                   routeRows += `<div class="lv-detail-row"><span class="lv-detail-row-label">Type</span>${escapeHtml(r.activity_type)}</div>`;
    if (r.estimated_moving_time !== 'N/A') routeRows += `<div class="lv-detail-row"><span class="lv-detail-row-label">Est. time</span>${escapeHtml(r.estimated_moving_time)}</div>`;
    if (r.max_slope !== 'N/A')             routeRows += `<div class="lv-detail-row"><span class="lv-detail-row-label">Max slope</span>${escapeHtml(r.max_slope)}</div>`;
    if (r.elevation_low && r.elevation_high && r.elevation_low !== 'N/A' && r.elevation_high !== 'N/A')
      routeRows += `<div class="lv-detail-row"><span class="lv-detail-row-label">Elevation</span>${escapeHtml(r.elevation_low)} → ${escapeHtml(r.elevation_high)}</div>`;
    routeSection = `
      <div class="lv-detail-divider"></div>
      <div class="lv-detail-section" data-detail-section="route">
        <div class="lv-section-title">Route</div>
        ${routeNameHtml}
        ${routeRows}
      </div>`;
  }

  return `<div class="lv-detail-panel" id="lv-detail-${index}">
    ${clubSection}
    <div class="lv-detail-divider"></div>
    ${eventSection}
    ${routeSection}
  </div>`;
}


export function transformEventsForCalendar(events) {
  if (!events) return [];

  return events.map(event => ({
    id: event.occurrence_id,
    title: event.title,
    start: event.start_date,
    url: event.strava_event_url,
    extendedProps: {
      demo_logo: event.demo_logo,
      club_info: event.club_info || { name: '', logo: '' },
      route_info: event.route_info || null,
      joined: event.joined || false,
      terrain_label: event.terrain_label,
      skill_level_label: event.skill_level_label,
      address: event.address || null,
    }
  }));
}
