import { mountContinuousCalendar } from './js/continuous-calendar.js';
import { DEFAULT_FILTER_STATE, normalizePreferences } from './shared/js/preferences.js';
import { createEventFilters } from './shared/js/event-filters.js';
import { handleApiResponse } from './shared/js/api.js';
import { escapeHtml, safeImageUrl } from './shared/js/html.js';
import { buildListCardHtml, buildListDetailPanelHtml, getLocalDateKey, getTodayDateKey, formatListViewDateHeader, transformEventsForCalendar } from './shared/js/event-list.js';
import { consumeDropdownDismissal } from './shared/js/multi-select.js';

const isExperimentDemo = document.body.dataset.experiment && new URLSearchParams(location.search).get('demo') === '1';

function closeFilterPanel({ restoreFocus = false } = {}) {
  const panel = document.getElementById('event-filters');
  const containsFocus = panel.contains?.(document.activeElement);
  panel.classList.remove('is-open');
  panel.inert = true;
  document.getElementById('toggle-filters').setAttribute('aria-expanded', 'false');
  if (restoreFocus || containsFocus) document.getElementById('toggle-filters').focus();
}

// -- Global variables --
let allEvents = [];
let allClubs = [];
let allClubsById = new Map(); // id (string) → club object — rebuilt whenever allClubs changes
let eventsMeta = null;
let listViewEvents = [];    // raw events in sorted order for accordion index lookup
let lvExpandedIndex = null; // index of currently expanded card (null = none)


// -- Error handling --

function handleAuthRequired() {
  // HttpOnly cookies are managed by the server; clear private UI immediately.
  eventsRequestVersion++;
  allEvents = []; allClubs = []; allClubsById = new Map(); eventsMeta = null;
  listViewEvents = []; lvExpandedIndex = null;
  calendarInstance?.destroy?.(); calendarInstance = null;
  hideNavBar(); hideCalendar(); hidePreloader();
  calendarElement.classList.remove('calendar-loading');
  document.getElementById('list-view').innerHTML = '';
  document.getElementById('list-view').style.display = 'none';
  closeFilterPanel();
  clubFilter.close(); sportTypeFilter.close();
  const tooltip = document.getElementById('fc-tooltip');
  if (tooltip) { tooltip.textContent = ''; tooltip.classList.remove('visible'); }
  const error = document.getElementById('error-message');
  if (error) error.textContent = '';
  document.getElementById('user-name').innerHTML = '';
  document.getElementById('logout-csrf').value = '';
  document.getElementById('user-avatar').removeAttribute?.('src');
  filterState.selectedClubs = []; filterState.selectedSportTypes = [];
  saveFilterState();
  clubFilter.renderTrigger();
  sportTypeFilter.renderTrigger();
  // Show the auth div
  const authDiv = document.getElementById("auth");
  if (authDiv) {
    authDiv.style.display = 'block';
    authDiv.querySelector?.('a')?.focus();
  }
}

function displayErrorMessage(errorMessage) {
  const errorElement = document.getElementById("error-message") || (() => {
    const title = document.querySelector('h1');
    const el = document.createElement('div');
    el.id = 'error-message';
    el.className = 'error-message';
    el.setAttribute('role', 'alert');
    // Insert after the title and before the auth div
    title.parentNode.insertBefore(el, title.nextSibling);
    return el;
  })();

  errorElement.textContent = errorMessage;
}

// -- API calls ---

// Get current user data
function handleLoadError(error) {
  if (error.isAuthError) handleAuthRequired();
  else if (error.response?.status === 429) {
    const seconds = error.responseData?.retry_after;
    displayErrorMessage(`Strava request limit reached.${retryMessage(seconds)}`);
  } else displayErrorMessage('Unable to load events. Please try to reload the page.');
}

function retryMessage(seconds) {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return ' Please try again later.';
  const unit = seconds >= 3600 ? 'hour' : seconds >= 60 ? 'minute' : 'second';
  const amount = Math.ceil(seconds / (unit === 'hour' ? 3600 : unit === 'minute' ? 60 : 1));
  return ` Please try again in ${amount} ${unit}${amount === 1 ? '' : 's'}.`;
}

async function getCurrentUser() {
  if (isExperimentDemo) return {firstname:"Alex",lastname:"Rider",athleteId:0};
  const response = await handleApiResponse(await fetch("/me"));
  return await response.json();
}

// Retrieve events from the server
async function getEvents(isCurrent = () => true) {
  if (isExperimentDemo) {
    const { demoEvents } = await import('./js/experiment-fixtures.js');
    const fixture = demoEvents();
    fixture.events = fixture.events.filter(e => (!filterState.selectedClubs.length || filterState.selectedClubs.includes(String(e.club_info.id))) && (!filterState.selectedSportTypes.length || filterState.selectedSportTypes.includes(e.club_info.sport_type)));
    return fixture;
  }
  const params = new URLSearchParams();
  if (filterState.selectedClubs.length > 0)      params.set('clubs', filterState.selectedClubs.join(','));
  if (filterState.selectedSportTypes.length > 0) params.set('sportTypes', filterState.selectedSportTypes.join(','));
  const url = params.size > 0 ? `/events?${params}` : '/events';
  const rawResponse = await fetch(url);
  if (!isCurrent()) return null;
  const response = await handleApiResponse(rawResponse);
  const data = await response.json();
  // Support both legacy array response and new { events, clubs, meta } shape
  if (Array.isArray(data)) return { events: data, clubs: [], meta: null };
  return { events: data.events, clubs: data.clubs || [], meta: data.meta };
}

// -- Preloader --

const preloaderElement = document.getElementById("preloader");
function showPreloader() {
  preloaderElement.classList.remove("hidden");
}

function hidePreloader() {
  preloaderElement.classList.add("hidden");
}

// -- Navigation bar --

const navBar = document.querySelector('.nav-bar');
function showNavBar() {
  navBar.classList.remove('hidden');
}
function hideNavBar() {
  navBar.classList.add('hidden');
  if (document.body.dataset.experiment) document.querySelector('.user-profile').hidden = true;
}

// Update user profile in the navigation bar
function updateUserProfile(user) {
  const userNameElement = document.getElementById('user-name');
  const userAvatarElement = document.getElementById('user-avatar');

  if (user) {
    document.getElementById('logout-csrf').value = user.csrfToken || '';
    if (document.body.dataset.experiment) document.querySelector('.user-profile').hidden = false;
    // Create a link to the user's Strava profile
    const profileLink = document.createElement('a');
    profileLink.href = `https://www.strava.com/athletes/${user.athleteId}`;
    profileLink.target = '_blank';
    profileLink.rel = 'noopener noreferrer';
    profileLink.textContent = `${user.firstname} ${user.lastname}`.trim();
    if (document.body.dataset.experiment) {
      const externalIcon = document.createElement('span');
      externalIcon.className = 'profile-external-icon';
      externalIcon.setAttribute('aria-hidden', 'true');
      externalIcon.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 4h6v6M20 4l-9 9M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>';
      profileLink.append(externalIcon);
      profileLink.setAttribute('aria-label', `${user.firstname} ${user.lastname}`.trim() + ' — Strava profile (opens in a new tab)');
    }

    // Clear existing content and append the link
    userNameElement.innerHTML = '';
    userNameElement.appendChild(profileLink);
    if (isExperimentDemo || new URLSearchParams(location.search).get('mock') === '1') userAvatarElement.src = '/prototypes/calendar/images/demo-profile.svg';

    if (user.profile_pic) {
      userAvatarElement.src = safeImageUrl(user.profile_pic);
    }
  }
}

// Display events metadata: stats in nav bar + optional limits warning
function displayEventsMeta(meta, visibleEventCount) {
  const statsEl = document.getElementById('events-stats');
  const warningEl = document.getElementById('limits-warning');

  if (!statsEl || !meta) return;

  // Stats text: "47 events · 5 clubs" / "47 events · 20 of 27 clubs" / "47 events · 3 selected clubs"
  let clubsText;
  if (filterState.selectedClubs.length > 0) {
    const n = filterState.selectedClubs.length;
    clubsText = `${n} selected ${n === 1 ? 'club' : 'clubs'}`;
  } else if (meta.clubs_limited) {
    clubsText = `${meta.clubs_processed} of ${meta.clubs_total} clubs`;
  } else {
    clubsText = `${meta.clubs_total} ${meta.clubs_total === 1 ? 'club' : 'clubs'}`;
  }
  statsEl.textContent = `${visibleEventCount} ${visibleEventCount === 1 ? 'event' : 'events'} · ${clubsText}`;

  if (!warningEl) return;

  // Build warning messages only when limits are hit
  const warnings = [];
  if (meta.clubs_failed > 0 || (meta.partial && meta.clubs_failed === undefined && !meta.routes_failed)) {
    warnings.push('Some clubs could not be loaded. Results are incomplete.');
  }
  if (Number.isSafeInteger(meta.routes_failed) && meta.routes_failed > 0) warnings.push(`Route details could not be loaded for ${meta.routes_failed} ${meta.routes_failed === 1 ? 'route' : 'routes'}. Events are still shown.`);
  if (meta.retry_after) warnings.push(retryMessage(meta.retry_after));
  if (meta.clubs_fetch_limited) {
    warnings.push(`Only the first 200 clubs are loaded. Users with more than 200 clubs are not fully supported.`);
  } else if (meta.clubs_limited && filterState.selectedClubs.length === 0) {
    // Only show the clubs-limit nudge when the club filter is not already in use
    warnings.push(`Showing events from ${meta.clubs_processed} of ${meta.clubs_total} clubs. Use the club filter to focus on specific clubs.`);
  }
  if (meta.events_limited) {
    const cap = meta.limits?.events_per_club ?? 100;
    warnings.push(`Some clubs may have more than ${cap} upcoming events — only the first ${cap} per club are shown.`);
  }
  if (meta.routes_skipped > 0) {
    warnings.push(`Route details unavailable for ${meta.routes_skipped} ${meta.routes_skipped === 1 ? 'event' : 'events'} (API limit reached).`);
  }

  if (warnings.length > 0) {
    const learnMore = ` <a href="/limits.html" target="_blank" class="limits-learn-more">Learn more →</a>`;
    const warningSpans = warnings.map((w, i) =>
      `<span>${w}${i === warnings.length - 1 ? learnMore : ''}</span>`
    ).join('');
    warningEl.innerHTML = `<span class="limits-warning-icon">⚠</span><span class="limits-warning-messages">${warningSpans}</span>`;
    warningEl.style.display = 'flex';
  } else {
    warningEl.style.display = 'none';
  }
}

// Load user profile
async function loadUserProfile() {
  // Get the current user data
  const user = await getCurrentUser(); // Thorws AuthenticationError if auth is needed

  // Update the user profile in the navigation bar
  updateUserProfile(user);
}

// -- Calendar UI --

const calendarElement = document.getElementById("calendar");
let calendarInstance = null; // Module-level variable for the prototype calendar instance
function buildCalendar(events) {
  calendarInstance = mountContinuousCalendar(events, { transformEventsForCalendar, calendarElement, showCalendar });
}

// Update calendar with filtered events
function updateCalendarWithFilteredEvents() {
  if (!calendarInstance) return;

  // Apply filters to raw events
  const filteredEvents = applyFilters(allEvents);

  // Transform filtered events for prototype calendar
  const calendarEvents = transformEventsForCalendar(filteredEvents);

  // Only update prototype calendar when it's visible — rendering on a hidden element
  // corrupts its internal layout. The calendar will be synced in setViewMode
  // when the user switches back.
  if (calendarInstance.setEvents) {
    calendarInstance.setEvents(calendarEvents);
  } else if (filterState.viewMode !== 'list') {
    calendarInstance.batchRendering(() => {
      calendarInstance.getEventSources().forEach(source => source.remove());
      if (calendarEvents.length > 0) {
        calendarInstance.addEventSource(calendarEvents);
      }
    });
  }

  // Update stats to reflect filtered count
  displayEventsMeta(eventsMeta, filteredEvents.length);

  // Keep list view in sync when filters change
  if (filterState.viewMode === 'list') {
    renderListView(filteredEvents);
  }
}

// Show the calendar
function showCalendar() {
  calendarElement.style.display = "block";
}

// Hide the calendar
function hideCalendar() {
  calendarElement.style.display = "none";
}

// -- List View --

function collapseListCard() {
  if (lvExpandedIndex === null) return;
  const card = document.querySelector(`.lv-event-card[data-lv-index="${lvExpandedIndex}"]`);
  if (card) {
    card.classList.remove('lv-expanded');
    card.setAttribute('aria-expanded', 'false');
    const panel = card.nextElementSibling;
    if (panel?.contains(document.activeElement)) card.focus();
    if (panel?.classList.contains('lv-detail-panel')) panel.remove();
  }
  lvExpandedIndex = null;
}

function handleListCardClick(index) {
  if (index === lvExpandedIndex) { collapseListCard(); return; }
  collapseListCard();
  const card  = document.querySelector(`.lv-event-card[data-lv-index="${index}"]`);
  const event = listViewEvents[index];
  if (!card || !event) return;
  card.classList.add('lv-expanded');
  card.setAttribute('aria-expanded', 'true');
  card.insertAdjacentHTML('afterend', buildListDetailPanelHtml(event, index));
  lvExpandedIndex = index;
}

function renderListView(events) {
  const container = document.getElementById('list-view');
  if (!container) return;

  listViewEvents = [...events].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  lvExpandedIndex = null;

  if (listViewEvents.length === 0) {
    container.innerHTML = `<div class="lv-empty"><div class="lv-empty-icon">📭</div><div>No upcoming events match your filters.</div></div>`;
    return;
  }

  const todayKey = getTodayDateKey();
  const groups   = new Map();
  listViewEvents.forEach(ev => {
    const key = getLocalDateKey(new Date(ev.start_date));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ev);
  });

  let html = '';
  let idx  = 0;
  for (const [dateKey, dayEvents] of groups) {
    const isToday = dateKey === todayKey;
    html += `<div class="lv-date-header${isToday ? ' lv-today' : ''}">
      ${isToday ? '<span class="lv-today-pill">Today</span>' : ''}
      ${escapeHtml(formatListViewDateHeader(dateKey))}
    </div>
    <div class="lv-group">`;
    for (const ev of dayEvents) html += buildListCardHtml(ev, idx++);
    html += `</div>`;
  }
  container.innerHTML = html;
}

function setupListViewClickHandler() {
  const container = document.getElementById('list-view');
  if (!container) return;
  container.addEventListener('click', (e) => {
    if (e.target.closest('.lv-detail-panel')) return;
    const card = e.target.closest('.lv-event-card');
    if (!card) return;
    const idx = parseInt(card.dataset.lvIndex, 10);
    if (!isNaN(idx)) handleListCardClick(idx);
  });
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lvExpandedIndex !== null) {
      e.preventDefault();
      collapseListCard();
    }

  });
}

function setViewMode(mode) {
  filterState.viewMode = mode;
  saveFilterState();

  const btnCal  = document.getElementById('btn-calendar-view');
  const btnList = document.getElementById('btn-list-view');
  const listEl  = document.getElementById('list-view');
  const isCal   = mode === 'calendar';

  btnCal.classList.toggle('view-mode-btn--active', isCal);
  btnCal.setAttribute('aria-pressed', String(isCal));
  btnList.classList.toggle('view-mode-btn--active', !isCal);
  btnList.setAttribute('aria-pressed', String(!isCal));

  if (isCal) {
    showCalendar();
    listEl.classList.add('hidden');
    // Force prototype calendar to recalculate dimensions after being shown
    if (calendarInstance) calendarInstance.updateSize();
    // Sync calendar with any filter changes made while in list mode
    if (calendarInstance) updateCalendarWithFilteredEvents();
  } else {
    hideCalendar();
    listEl.classList.remove('hidden');
    renderListView(applyFilters(allEvents));
  }
}

// -- Event loading --

let eventsRequestVersion = 0;

// Load events and build the calendar
async function loadEvents() {
  const version = ++eventsRequestVersion;
  const isCurrent = () => version === eventsRequestVersion;
  const isFirstLoad = calendarInstance === null;
  const errorElement = document.getElementById("error-message");
  if (errorElement) errorElement.textContent = '';

  if (isFirstLoad) {
    // First load: full preloader (already shown by DOMContentLoaded handler)
    hideNavBar();
    hideCalendar();
  } else {
    // Subsequent loads (filter changes): keep layout stable, dim the calendar
    calendarElement.classList.add('calendar-loading');
  }

  // Make the API request
  try {
    const result = await getEvents(isCurrent);
    if (!isCurrent()) return;
    const { events, clubs, meta } = result;
    allEvents = events;
    allClubs = clubs;
    allClubsById = new Map(allClubs.map(c => [String(c.id), c]));
    eventsMeta = meta;

    if (isFirstLoad) {
      const filteredEvents = applyFilters(allEvents);
      buildCalendar(filteredEvents);
      showNavBar();
      hidePreloader();
      displayEventsMeta(meta, filteredEvents.length);
      // Restore saved view mode (filterState.viewMode was loaded from localStorage)
      if (filterState.viewMode === 'list') {
        setViewMode('list');
      }
    } else {
      updateCalendarWithFilteredEvents(); // reads updated allEvents / eventsMeta
    }

    // Refresh club picker avatars and sport type pills now that club data is available
    clubFilter.renderTrigger();
    sportTypeFilter.renderTrigger(); sportTypeFilter.updateGroupVisibility();
  } catch (error) {
    if (isCurrent()) throw error;
  } finally {
    if (isCurrent()) {
      calendarElement.classList.remove('calendar-loading');
      hidePreloader();
    }
  }
}

// Transform raw events for prototype calendar
// -- Filtering --

// Default filter state values
// Store all events and filter state
const filterState = { ...DEFAULT_FILTER_STATE };

// Load filter state from localStorage
function loadFilterState() {
  try {
    const savedState = localStorage.getItem(isExperimentDemo ? 'stravaEventsDemoFilterState' : 'stravaEventsFilterState');
    if (savedState) {
      const state = JSON.parse(savedState);
      applyFilterState(state);
      // If no viewMode was ever explicitly saved, default to list on mobile
      if (!state?.viewMode && window.innerWidth <= 768) {
        filterState.viewMode = 'list';
      }
    } else if (window.innerWidth <= 768) {
      // First visit on mobile — start in list view
      filterState.viewMode = 'list';
    }
  } catch (e) {
    console.error('Error loading filter state:', e);
  }
}

function applyFilterState(newState) {
  Object.assign(filterState, normalizePreferences(newState, filterState));

  // Update UI to reflect saved state
  const filterCheckbox = document.getElementById('filter-joined');
  filterCheckbox.checked = filterState.joinedOnly;

  // Show/hide clear filters button
  updateClearFiltersButton();

  // Update filter count
  updateFilterCount();

  // Update club picker trigger
  clubFilter.renderTrigger();
}

// Save filter state to localStorage
function saveFilterState() {
  try {
    localStorage.setItem(isExperimentDemo ? 'stravaEventsDemoFilterState' : 'stravaEventsFilterState', JSON.stringify(filterState));
  } catch (e) {
    console.error('Error saving filter state:', e);
  }
}

// Set new filter state
function setFilterState(newState) {
  applyFilterState(newState);

  // Save the new state
  saveFilterState();
}

// Update the visibility of the clear filters button
function updateClearFiltersButton() {
  const clearFiltersBtn = document.getElementById('clear-filters');
  const hasFilters = filterState.joinedOnly || filterState.selectedClubs.length > 0 || filterState.selectedSportTypes.length > 0;
  clearFiltersBtn.style.display = hasFilters ? 'flex' : 'none';
}

// Update active filter count
function updateFilterCount() {
  const activeFilterCount = document.getElementById('active-filter-count');

  let activeFilters = 0;
  if (filterState.joinedOnly !== DEFAULT_FILTER_STATE.joinedOnly) activeFilters++;
  if (filterState.selectedClubs.length > 0) activeFilters++;
  if (filterState.selectedSportTypes.length > 0) activeFilters++;

  activeFilterCount.textContent = activeFilters > 0 ? activeFilters : '';
  activeFilterCount.style.display = activeFilters > 0 ? 'inline-flex' : 'none';
}

// Set up event listeners for filter controls
function setupFilterEventListeners() {
  // Toggle joined filter
  const filterJoined = document.getElementById('filter-joined');
  filterJoined.addEventListener('change', (e) => {
    setFilterState({ joinedOnly: e.target.checked });
    updateCalendarWithFilteredEvents();
  });

  // Global "clear all filters" button
  const clearFiltersBtn = document.getElementById('clear-filters');
  clearFiltersBtn.addEventListener('click', () => {
    const hadBackendFilter = filterState.selectedClubs.length > 0 || filterState.selectedSportTypes.length > 0;
    filterState.joinedOnly = false;
    document.getElementById('filter-joined').checked = false;
    clubFilter.clearAll({ silent: true });
    sportTypeFilter.clearAll({ silent: true });
    saveFilterState();
    updateClearFiltersButton();
    updateFilterCount();
    document.getElementById('toggle-filters').focus();
    if (hadBackendFilter) {
      loadEvents().catch(handleLoadError);
    } else {
      updateCalendarWithFilteredEvents();
    }
  });

  // Wire up both multi-select dropdown filters
  clubFilter.setupListeners();
  sportTypeFilter.setupListeners();
}

// Apply filters to raw events
function applyFilters(events) {
  if (!events) return [];

  return events.filter(event => {
    // Apply joined filter
    if (filterState.joinedOnly && !event.joined) {
      return false;
    }
    return true;
  });
}

// -- Shared filter utilities & multi-select dropdown component --

// Debounce timer for filter changes — batches rapid toggles into one request
let _filterDebounceTimer = null;

function scheduleEventsReload() {
  if (_filterDebounceTimer) clearTimeout(_filterDebounceTimer);
  _filterDebounceTimer = setTimeout(() => {
    _filterDebounceTimer = null;
    loadEvents().catch(handleLoadError);
  }, 400);
}

const { clubFilter, sportTypeFilter } = createEventFilters({
  getClubs: () => allClubs, getClubsById: () => allClubsById, filterState,
  saveFilterState, updateClearFiltersButton, updateFilterCount, scheduleEventsReload,
});

// Single DOMContentLoaded handler for all initialization.
// Using DOMContentLoaded (rather than an IIFE) guarantees DOM availability
// regardless of where the <script> tag lives (bottom of body, head with defer, etc.).
document.addEventListener('DOMContentLoaded', async function () {
  if (isExperimentDemo) {
    document.getElementById('auth').hidden = true;
    document.querySelector('.logout-form').addEventListener('submit', event => {
      event.preventDefault();
      location.href = '/prototypes/calendar/login.html';
    });
  }
  // -- Sync setup: filter state must be restored before loadEvents() builds the URL --
  loadFilterState();
  updateFilterCount();
  setupFilterEventListeners();

  if (document.body.dataset.experiment) filterState.viewMode = 'calendar';

  // View mode switcher buttons
  document.getElementById('btn-calendar-view').addEventListener('click', () => {
    if (filterState.viewMode !== 'calendar') setViewMode('calendar');
  });
  document.getElementById('btn-list-view').addEventListener('click', () => {
    if (filterState.viewMode !== 'list') setViewMode('list');
  });
  setupListViewClickHandler();

  // Toggle filters panel
  const toggleFiltersBtn = document.getElementById('toggle-filters');
  const eventFilters = document.getElementById('event-filters');
  toggleFiltersBtn.addEventListener('click', function (e) {
    e.preventDefault();
    const isVisible = eventFilters.classList.contains('is-open');
    eventFilters.classList.toggle('is-open', !isVisible);
    eventFilters.inert = isVisible;
    if (isVisible) { clubFilter.close(); sportTypeFilter.close(); }
    toggleFiltersBtn.setAttribute('aria-expanded', !isVisible);
  });

  // Close filter panel when clicking outside it (but not on the toggle button itself).
  // If a dropdown was just dismissed on this same click, keep the panel open so the
  // user doesn't have to reopen it just to make another selection.
  document.addEventListener('click', (e) => {
    if (consumeDropdownDismissal()) {
      return;
    }
    if (
      eventFilters.classList.contains('is-open') &&
      !eventFilters.contains(e.target) &&
      !toggleFiltersBtn.contains(e.target)
    ) {
      closeFilterPanel();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && eventFilters.classList.contains('is-open')) {
      event.preventDefault();
      closeFilterPanel({ restoreFocus: true });
    }
  });

  // -- Async init --
  try {
    showPreloader();
    await loadUserProfile();
    await loadEvents();
  } catch (error) {
    if (error.isAuthError) {
      console.info('Authentication is required');
      handleAuthRequired();
      return;
    }
    console.error('Error loading events:', error);
    handleLoadError(error);
  } finally {
    hidePreloader();
  }
});
