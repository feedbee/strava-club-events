import { escapeHtml, safeImageUrl } from "../../../js/html.js";

export function buildRideCard(event, index) {
  const p = event.extendedProps || {};
  const demoLogo = [
    "/prototypes/calendar/images/demo-club-road.svg",
    "/prototypes/calendar/images/demo-club-gravel.svg",
  ].includes(p.demo_logo)
    ? p.demo_logo
    : "";
  const logo = safeImageUrl(p.club_info?.logo) || demoLogo;
  const club = escapeHtml(p.club_info?.name || "Club");
  const mark = logo
    ? `<img class="ride-logo" src="${escapeHtml(logo)}" alt="${club}" title="${club}">`
    : `<span class="ride-logo ride-logo-fallback" title="${club}" aria-label="${club}">${escapeHtml((p.club_info?.name || "?").slice(0, 1))}</span>`;
  return `<button type="button" class="ride${p.joined ? " joined" : ""}" data-ride-index="${index}" data-full-title="${escapeHtml(event.title)}" aria-haspopup="dialog">${mark}<span class="ride-copy"><span class="ride-top"><time>${new Date(event.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}<span class="wide-card-club"> · ${club}</span></time>${p.joined ? '<span aria-label="Joined">✓</span>' : ""}</span><strong>${escapeHtml(event.title)}</strong></span></button>`;
}
