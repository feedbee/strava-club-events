import { escapeHtml } from "../shared/js/html.js";
import { buildListDetailPanelHtml } from "../shared/js/event-list.js";

export function createEventDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "ride-dialog";
  dialog.setAttribute("aria-labelledby", "ride-dialog-title");
  document.body.append(dialog);
  let opener;
  function open(event, card) {
    opener = card;
    const props = event.extendedProps || {};
    dialog.innerHTML = `<div class="ride-dialog-header"><span class="eyebrow">EVENT DETAILS</span><button type="button" aria-label="Close event details">✕</button></div><h2 id="ride-dialog-title">${escapeHtml(event.title)}</h2>${buildListDetailPanelHtml({ ...props, title: event.title, start_date: event.start, strava_event_url: event.url || "https://www.strava.com" }, "dialog")}`;
    const sections = dialog.querySelectorAll(".lv-detail-section");
    for (const section of sections) {
      const heading = section.dataset.detailSection;
      if (!["event", "route"].includes(heading)) continue;
      const link = section.querySelector("a.lv-detail-link");
      if (!link) continue;
      if (heading === "event") {
        const icon = document.createElement("span");
        icon.innerHTML =
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/></svg>';
        icon.className = "event-link-icon";
        icon.setAttribute("aria-hidden", "true");
        link.before(icon);
        link.parentElement.classList.add("lv-club-row");
      }
      if (heading === "route") {
        const icon = section.querySelector(".lv-club-row > span");
        if (icon) {
          icon.className = "event-link-icon";
          icon.setAttribute("aria-hidden", "true");
          icon.innerHTML =
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v3a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v1"/></svg>';
        }
      }
      const external = document.createElement("span");
      external.className = "external-link-icon";
      external.setAttribute("aria-hidden", "true");
      external.innerHTML =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 4h6v6M20 4l-9 9M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>';
      link.append(external);
      const notice = document.createElement("span");
      notice.className = "sr-only";
      notice.textContent = " (opens in a new tab)";
      link.append(notice);
    }
    const oldJoined = dialog.querySelector(".lv-detail-joined");
    if (oldJoined) {
      const badge = document.createElement("span");
      badge.className = "participation-badge";
      badge.textContent = "✓ Joined";
      oldJoined
        .closest(".lv-detail-section")
        .querySelector(".lv-section-title")
        .append(badge);
      oldJoined.remove();
    }
    dialog
      .querySelector("button")
      .addEventListener("click", () => dialog.close());
    if (!dialog.open) dialog.showModal();
  }
  dialog.addEventListener("close", () => opener?.isConnected && opener.focus());
  dialog.addEventListener("click", (e) => {
    const r = dialog.getBoundingClientRect();
    if (
      e.target === dialog &&
      (e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom)
    )
      dialog.close();
  });
  return { open, isOpen: () => dialog.open, destroy: () => dialog.remove() };
}
