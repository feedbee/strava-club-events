export function safeImageUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Shared helper — returns an <img> or initial <span> for a club logo.
export function clubMarkupHtml(club, imgClass, initialClass) {
  const logo = safeImageUrl(club?.logo);
  if (logo) {
    return `<img src="${escapeHtml(logo)}" class="${imgClass}" alt="${escapeHtml(club.name)}" title="${escapeHtml(club.name)}">`;
  }
  const letter = club ? escapeHtml(club.name.charAt(0).toUpperCase()) : '?';
  const title = club ? ` title="${escapeHtml(club.name)}"` : '';
  return `<span class="${initialClass}"${title}>${letter}</span>`;
}
