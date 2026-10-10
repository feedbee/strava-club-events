export function createEventPreview({
  container,
  viewport,
  getEvent,
  onOpen,
  isDialogOpen,
}) {
  const lifecycle = new AbortController();
  const listen = (target, type, handler, options = {}) =>
    target.addEventListener(type, handler, {
      ...options,
      signal: lifecycle.signal,
    });
  const hint = document.createElement("div");
  hint.className = "ride-title-hint";
  hint.id = "ride-title-hint";
  hint.hidden = true;
  document.body.append(hint);
  let hintTimer, hintedCard;
  function hideHint() {
    clearTimeout(hintTimer);
    hint.hidden = true;
    hintedCard?.removeAttribute("aria-describedby");
    hintedCard = null;
  }
  function scheduleHint(card, immediate = false) {
    if (isDialogOpen()) return;
    hideHint();
    hintedCard = card;
    hintTimer = setTimeout(
      () => {
        hint.replaceChildren(card.cloneNode(true));
        hint.querySelector("button").tabIndex = -1;
        const event = getEvent(Number(card.dataset.rideIndex));
        const clubName = event?.extendedProps?.club_info?.name;
        const wideClub = hint.querySelector(".wide-card-club");
        wideClub?.remove();
        if (clubName) {
          const club = document.createElement("span");
          club.className = "preview-club-name";
          club.textContent = ` · ${clubName}`;
          hint.querySelector(".ride-top time").append(club);
        }
        hint.hidden = false;
        card.setAttribute("aria-describedby", hint.id);
        const r = card.getBoundingClientRect();
        hint.style.width = `${Math.min(window.innerWidth - 16, Math.max(r.width, 560))}px`;
        const left =
          r.left + hint.offsetWidth <= window.innerWidth - 8
            ? r.left
            : r.right - hint.offsetWidth;
        hint.style.left = `${Math.max(8, Math.min(left, window.innerWidth - hint.offsetWidth - 8))}px`;
        hint.style.top = `${Math.max(8, Math.min(r.top, window.innerHeight - hint.offsetHeight - 8))}px`;
      },
      immediate ? 0 : 850,
    );
  }
  function insidePreview(e) {
    const r = hint.getBoundingClientRect();
    return (
      !hint.hidden &&
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom
    );
  }
  function trackPreview(e) {
    if (!hint.hidden && !insidePreview(e)) hideHint();
  }
  listen(document, "pointermove", trackPreview);
  listen(container, "pointerover", (e) => {
    const card = e.target.closest(".ride");
    if (
      card &&
      !insidePreview(e) &&
      !card.contains(e.relatedTarget) &&
      e.pointerType !== "touch"
    )
      scheduleHint(card);
  });
  listen(container, "pointerout", (e) => {
    const card = e.target.closest(".ride");
    if (
      card &&
      !card.contains(e.relatedTarget) &&
      !hint.contains(e.relatedTarget) &&
      !insidePreview(e)
    )
      hideHint();
  });
  listen(hint, "pointerout", (e) => {
    if (
      !hint.contains(e.relatedTarget) &&
      !hintedCard?.contains(e.relatedTarget)
    )
      hideHint();
  });
  function clickPreview(e) {
    if (hint.hidden || !hintedCard || e.detail === 0) return;
    const r = hint.getBoundingClientRect();
    if (
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom
    ) {
      e.preventDefault();
      e.stopPropagation();
      onOpen(hintedCard);
    }
  }
  listen(document, "click", clickPreview, { capture: true });
  listen(container, "focusin", (e) => {
    const card = e.target.closest(".ride");
    if (card?.matches(":focus-visible")) scheduleHint(card, true);
  });
  listen(container, "pointerdown", () => clearTimeout(hintTimer));
  listen(hint, "pointerdown", () => clearTimeout(hintTimer));
  listen(container, "focusout", (e) => {
    if (!hint.contains(e.relatedTarget) && !insidePreview(e)) hideHint();
  });
  listen(container, "keydown", (e) => {
    if (e.key === "Escape") hideHint();
  });
  listen(viewport, "scroll", hideHint);
  return {
    hide: hideHint,
    get sourceCard() {
      return hintedCard;
    },
    destroy() {
      hideHint();
      lifecycle.abort();
      hint.remove();
    },
  };
}
