import "../coordinator.js";

const profile = document.querySelector('.experiment-header .user-profile');
const trigger = profile.querySelector('.user-avatar');
const details = profile.querySelector('.profile-details');
let hovered = false;
let pinned = false;
function updateProfile() {
  const open = hovered || pinned || profile.contains(document.activeElement);
  profile.classList.toggle('is-open', open);
  trigger.setAttribute('aria-expanded', String(open));
  details.inert = !open;
}
profile.addEventListener('pointerenter', event => {
  if (event.pointerType !== 'touch') { hovered = true; updateProfile(); }
});
profile.addEventListener('pointerleave', () => { hovered = false; updateProfile(); });
profile.addEventListener('focusin', updateProfile);
profile.addEventListener('focusout', () => queueMicrotask(updateProfile));
trigger.addEventListener('click', () => {
  pinned = !pinned;
  if (!pinned) trigger.blur();
  updateProfile();
});
profile.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    pinned = false; hovered = false;
    trigger.blur(); updateProfile();
  }
});
document.addEventListener('pointerdown', event => {
  if (!profile.contains(event.target)) {
    pinned = false; hovered = false;
    if (profile.contains(document.activeElement)) document.activeElement.blur();
    updateProfile();
  }
});
