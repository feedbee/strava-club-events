// -- Global variables --
let allEvents = [];
let allClubs = [];
let eventsMeta = null;

const CLUB_FILTER_LIMIT = 10; // max clubs selectable in the per-club filter


// -- Error handling --

function handleAuthRequired() {
  // Clear any invalid session
  document.cookie = 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  // Show the auth div
  const authDiv = document.getElementById("auth");
  if (authDiv) {
    authDiv.style.display = 'block';
  }
}

class AuthenticationError extends Error {
  constructor(response) {
    super('Authentication required');
    this.name = 'AuthenticationError';
    this.isAuthError = true;
    this.response = response;
  }
}

class ApiError extends Error {
  constructor(message, response, responseData) {
    super(`API Error (${response.status}): ${message}`);
    this.name = 'ApiError';
    this.response = response;
    this.responseData = responseData;
  }
}

function displayErrorMessage(errorMessage) {
  const errorElement = document.getElementById("error-message") || (() => {
    const title = document.querySelector('h1');
    const el = document.createElement('div');
    el.id = 'error-message';
    el.className = 'error-message';
    // Insert after the title and before the auth div
    title.parentNode.insertBefore(el, title.nextSibling);
    return el;
  })();
    
  errorElement.textContent = errorMessage;
}


// -- API calls ---

// Get current user data
async function getCurrentUser() {
  const response = await handleApiResponse(await fetch("/me"));
  return await response.json();
}

// Retrieve events from the server
async function getEvents() {
  const clubs = filterState.selectedClubs;
  const url = clubs.length > 0 ? `/events?clubs=${clubs.join(',')}` : '/events';
  const response = await handleApiResponse(await fetch(url));
  const data = await response.json();
  // Support both legacy array response and new { events, clubs, meta } shape
  if (Array.isArray(data)) return { events: data, clubs: [], meta: null };
  return { events: data.events, clubs: data.clubs || [], meta: data.meta };
}

// Handle API errors consistently
async function handleApiResponse(resp) {
  if (resp.ok) return resp;
  
  const error = await resp.json().catch(() => ({}));
  const errorMessage = error.message || error.error || 'An error occurred';
  
  if (resp.status === 401) {
    throw new AuthenticationError(resp);
  } else {
    throw new ApiError(`API Error (${resp.status}): ${errorMessage}`, resp, error);
  }
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
}

// Update user profile in the navigation bar
function updateUserProfile(user) {
  const userNameElement = document.getElementById('user-name');
  const userAvatarElement = document.getElementById('user-avatar');
  
  if (user) {
    // Create a link to the user's Strava profile
    const profileLink = document.createElement('a');
    profileLink.href = `https://www.strava.com/athletes/${user.athleteId}`;
    profileLink.target = '_blank';
    profileLink.textContent = `${user.firstname} ${user.lastname}`.trim();
      
    // Clear existing content and append the link
    userNameElement.innerHTML = '';
    userNameElement.appendChild(profileLink);
    
    if (user.profile_pic) {
      userAvatarElement.src = user.profile_pic;
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
let calendarInstance = null; // Module-level variable for the FullCalendar instance
function buildCalendar(events) {
  // Transform filtered events for FullCalendar
  const calendarEvents = transformEventsForCalendar(events);

  calendarInstance = new FullCalendar.Calendar(calendarElement, {
    initialView: "dayGridMonth",
    firstDay: 1, // Monday
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    events: calendarEvents,
    dayCellDidMount: function(arg) {
      // Add 'weekend-day' class to Saturday (6) and Sunday (0) cells
      if (arg.date.getDay() === 0 || arg.date.getDay() === 6) {
        arg.el.classList.add('weekend-day');
      }
    },
    buttonText: {
      today: 'Today',
      month: 'Month',
      week: 'Week',
      day: 'Day'
    },
    views: {
      timeGrid: {
        dayMaxEventRows: 4 // adjust to 6 only for timeGridWeek/timeGridDay
      },
      dayGridMonth: {
        dayMaxEvents: 5, // Maximum number of events to show per day
        dayMaxEventRows: 5 // Maximum number of event rows to show per day
      }
    },
    eventTimeFormat: {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    },
    eventDidMount: function(info) {
      const event = info.event;
      const view = info.view;
      
      // Add appropriate class based on view type
      if (view.type === 'dayGridMonth') {
        info.el.classList.add('fc-month-event');
      } else {
        info.el.classList.add('fc-list-event');
      }
      
      // Add joined class if user is attending
      if (event.extendedProps.joined) {
        info.el.classList.add('fc-event-joined');
      }
      
      // Format the date and time
      const eventDate = new Date(event.start);
      const options = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      const formattedDateTime = eventDate.toLocaleString('en-US', options);
      
      // Build tooltip content
      let tooltipContent = `🚀 ${event.title}\n📅 ${formattedDateTime}`;

      // Add address if available
      if (event.extendedProps.address) {
        tooltipContent += `\n📍 ${event.extendedProps.address}`;
      }

      // Add terrain and skill level if available
      const terrainLabel = event.extendedProps.terrain_label;
      const skillLevelLabel = event.extendedProps.skill_level_label;
      
      if (terrainLabel || skillLevelLabel) {
        const terrainText = terrainLabel ? `🌄 ${terrainLabel}` : '';
        const skillText = skillLevelLabel ? `⚡ ${skillLevelLabel}` : '';
        const separator = terrainLabel && skillLevelLabel ? ' • ' : '';
        tooltipContent += `\n${terrainText}${separator}${skillText}`;
      }
      
      // Add club info if available
      if (event.extendedProps.club_info?.name) {
        tooltipContent += `\n♣️ ${event.extendedProps.club_info.name}`;
      }
      
      // Add route info to tooltip if available
      const routeInfo = info.event.extendedProps.route_info;
      if (routeInfo) {
        tooltipContent += `\n\n🗺️ ${routeInfo.name}`;
        
        // Always show distance and elevation if they are available
        if (routeInfo.distance !== 'N/A' || routeInfo.elevation_gain !== 'N/A') {
          const distanceText = routeInfo.distance !== 'N/A' ? `📏 ${routeInfo.distance}` : '';
          const elevationText = routeInfo.elevation_gain !== 'N/A' ? `🏔️ ${routeInfo.elevation_gain}` : '';
          const separator = routeInfo.distance !== 'N/A' && routeInfo.elevation_gain !== 'N/A' ? ' • ' : '';
          tooltipContent += `\n${distanceText}${separator}${elevationText}`;
        }
        
        // Show activity type if available
        if (routeInfo.activity_type && routeInfo.activity_type !== 'N/A') {
          tooltipContent += `\n🚴 ${routeInfo.activity_type}`;
        }

        if (routeInfo.is_full) {
          // Add additional route details if available
          if (routeInfo.estimated_moving_time !== 'N/A') {
            tooltipContent += `\n⏱️ ${routeInfo.estimated_moving_time}`;
          }
        
          // Add max slope if available
          if (routeInfo.max_slope !== 'N/A') {
            tooltipContent += `\n📐 Max Slope: ${routeInfo.max_slope}%`;
          }
          
          // Add elevation range if available
          if (routeInfo.elevation_low !== 'N/A' && routeInfo.elevation_high !== 'N/A') {
            tooltipContent += `\n📈 Elevation: ${routeInfo.elevation_low} → ${routeInfo.elevation_high}`;
          }
        } else if (routeInfo.name !== 'Route is not attached') {
          tooltipContent += `\n(Extended route info is not available)`;
        }
      }
      
      // Add joined status to tooltip (always at the end)
      if (event.extendedProps.joined) {
        tooltipContent += '\n\n✅ You decided to join the event! 🎉';
      }
      
      // Set the tooltip content
      info.el.title = tooltipContent;
      info.el.setAttribute('data-tooltip', tooltipContent);
      
      // Create custom event content with club logo
      const titleEl = info.el.querySelector('.fc-event-title');
      if (titleEl) {
        const clubLogo = info.event.extendedProps.club_info.logo;
        if (clubLogo) {
          const logoHtml = `<img src="${clubLogo}" class="club-logo" alt="Club Logo">`;
          titleEl.insertAdjacentHTML('afterbegin', logoHtml);
        }
      }
      
      // Override click to open in new tab
      info.el.addEventListener('click', function(e) {
        e.preventDefault();
        if (info.event.url) {
          window.open(info.event.url, '_blank');
        }
      });
    }
  });
  
  // Hide preloader and show calendar
  showCalendar();
  
  // Render the calendar with the initial filtered events
  calendarInstance.render();
}

// Update calendar with filtered events
function updateCalendarWithFilteredEvents() {
  if (!calendarInstance) return;

  // Apply filters to raw events
  const filteredEvents = applyFilters(allEvents);

  // Transform filtered events for FullCalendar
  const calendarEvents = transformEventsForCalendar(filteredEvents);

  // Batch all mutations into a single render cycle to prevent intermediate empty-state flash
  calendarInstance.batchRendering(() => {
    calendarInstance.getEventSources().forEach(source => source.remove());
    if (calendarEvents.length > 0) {
      calendarInstance.addEventSource(calendarEvents);
    }
  });

  // Update stats to reflect filtered count
  displayEventsMeta(eventsMeta, filteredEvents.length);
}

// Show the calendar
function showCalendar() {
  calendarElement.style.display = "block";
}

// Hide the calendar
function hideCalendar() {
  calendarElement.style.display = "none";
}


// -- Event loading --

// Load events and build the calendar
async function loadEvents() {
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
  const { events, clubs, meta } = await getEvents(); // Throws AuthenticationError if auth is needed
  allEvents = events;
  allClubs = clubs;
  eventsMeta = meta;

  if (isFirstLoad) {
    const filteredEvents = applyFilters(allEvents);
    buildCalendar(filteredEvents);
    showNavBar();
    hidePreloader();
    displayEventsMeta(meta, filteredEvents.length);
  } else {
    calendarElement.classList.remove('calendar-loading');
    updateCalendarWithFilteredEvents(); // reads updated allEvents / eventsMeta
  }

  // Refresh club picker avatars now that club data is available
  renderClubFilterAvatars();
}

// Transform raw events for FullCalendar
function transformEventsForCalendar(events) {
  if (!events) return [];
  
  return events.map(event => ({
    title: event.title,
    start: event.start_date,
    url: event.strava_event_url,
    extendedProps: {
      club_info: event.club_info || { name: '', logo: '' },
      route_info: event.route_info || null,
      joined: event.joined || false,
      terrain_label: event.terrain_label,
      skill_level_label: event.skill_level_label,
      address: event.address || null,
    }
  }));
}


// -- Filtering --

// Default filter state values
const DEFAULT_FILTER_STATE = {
  joinedOnly: false,
  selectedClubs: []
};

// Store all events and filter state
const filterState = { ...DEFAULT_FILTER_STATE };

// Load filter state from localStorage
function loadFilterState() {
  try {
    const savedState = localStorage.getItem('stravaEventsFilterState');
    if (savedState) {
      const state = JSON.parse(savedState);
      applyFilterState(state);
    }
  } catch (e) {
    console.error('Error loading filter state:', e);
  }
}

function applyFilterState(newState) {
  // Ensure all default keys exist (handles new keys added in future versions)
  for (const key of Object.keys(DEFAULT_FILTER_STATE)) {
    if (!(key in filterState)) {
      filterState[key] = Array.isArray(DEFAULT_FILTER_STATE[key])
        ? [...DEFAULT_FILTER_STATE[key]]
        : DEFAULT_FILTER_STATE[key];
    }
  }

  // Shallow-copy arrays to avoid sharing references with DEFAULT_FILTER_STATE.
  // Safe because all state values are primitives (strings, booleans).
  for (const [key, value] of Object.entries(newState)) {
    filterState[key] = Array.isArray(value) ? [...value] : value;
  }

  // Validate selectedClubs in case of corrupted localStorage data
  if (!Array.isArray(filterState.selectedClubs)) {
    filterState.selectedClubs = [];
  }

  // Update UI to reflect saved state
  const filterCheckbox = document.getElementById('filter-joined');
  filterCheckbox.checked = filterState.joinedOnly;

  // Show/hide clear filters button
  updateClearFiltersButton();

  // Update filter count
  updateFilterCount();

  // Update club picker trigger
  renderClubFilterAvatars();
}

// Save filter state to localStorage
function saveFilterState() {
  try {
    localStorage.setItem('stravaEventsFilterState', JSON.stringify(filterState));
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
  const hasFilters = filterState.joinedOnly || filterState.selectedClubs.length > 0;
  clearFiltersBtn.style.display = hasFilters ? 'flex' : 'none';
}

// Update active filter count
function updateFilterCount() {
  const activeFilterCount = document.getElementById('active-filter-count');

  let activeFilters = 0;
  if (filterState.joinedOnly !== DEFAULT_FILTER_STATE.joinedOnly) activeFilters++;
  if (filterState.selectedClubs.length > 0) activeFilters++;

  activeFilterCount.textContent = activeFilters > 0 ? activeFilters : '';
  activeFilterCount.style.display = activeFilters > 0 ? 'inline-block' : 'none';
}

// Set up event listeners for filter controls
function setupFilterEventListeners() {
  // Toggle joined filter
  const filterJoined = document.getElementById('filter-joined');
  filterJoined.addEventListener('change', (e) => {
    setFilterState({ joinedOnly: e.target.checked });
    updateCalendarWithFilteredEvents();
  });

  // Clear filters button
  const clearFiltersBtn = document.getElementById('clear-filters');
  clearFiltersBtn.addEventListener('click', () => {
    const hadClubFilter = filterState.selectedClubs.length > 0;
    filterState.joinedOnly = false;
    filterState.selectedClubs = [];
    saveFilterState();
    document.getElementById('filter-joined').checked = false;
    updateClearFiltersButton();
    updateFilterCount();
    renderClubFilterAvatars();
    if (hadClubFilter) {
      loadEvents().catch(err => displayErrorMessage('Unable to load events. Please try to reload the page.'));
    } else {
      updateCalendarWithFilteredEvents();
    }
  });

  // Club filter trigger clear button — clears selection and closes the filter panel in one click
  const clubFilterClearBtn = document.getElementById('clubFilterClear');
  if (clubFilterClearBtn) {
    clubFilterClearBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent the trigger from opening the dropdown
      filterState.selectedClubs = [];
      saveFilterState();
      updateClearFiltersButton();
      updateFilterCount();
      renderClubFilterAvatars();
      // Close the entire filter panel
      const eventFiltersEl = document.getElementById('event-filters');
      const toggleFiltersBtnEl = document.getElementById('toggle-filters');
      if (eventFiltersEl) {
        eventFiltersEl.classList.remove('is-open');
        if (toggleFiltersBtnEl) toggleFiltersBtnEl.setAttribute('aria-expanded', false);
      }
      loadEvents().catch(() => displayErrorMessage('Unable to load events. Please try to reload the page.'));
    });
  }

  // Club filter trigger — open/close dropdown
  const trigger = document.getElementById('clubFilterTrigger');
  if (trigger) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById('clubFilterDropdown');
      if (dropdown?.style.display === 'block') {
        closeClubDropdown();
      } else {
        openClubDropdown();
      }
    });

    // Keyboard support: Enter/Space open or close the dropdown
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        const dropdown = document.getElementById('clubFilterDropdown');
        if (dropdown?.style.display === 'block') {
          closeClubDropdown();
        } else {
          openClubDropdown();
        }
      }
    });
  }

  // Club filter dropdown — checkbox changes (event delegation)
  const listEl = document.getElementById('clubFilterList');
  if (listEl) {
    listEl.addEventListener('change', (e) => {
      if (e.target.classList.contains('club-filter-checkbox')) {
        toggleClubFilter(e.target.value);
      }
    });
  }

  // Club filter search
  const searchEl = document.getElementById('clubFilterSearch');
  if (searchEl) {
    searchEl.addEventListener('input', () => renderClubFilterDropdown());
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const group = document.getElementById('clubFilterTrigger')?.closest('.filter-group-clubs');
    if (group && !group.contains(e.target)) {
      closeClubDropdown();
    }
  });

  // Close dropdown on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeClubDropdown();
  });
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


// -- Club filter --

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Shared helper — returns an <img> or initial <span> for a club.
// Pass the CSS class names appropriate for the call site (trigger avatars vs dropdown items).
function clubMarkupHtml(club, imgClass, initialClass) {
  if (club?.logo) {
    return `<img src="${club.logo}" class="${imgClass}" alt="${escapeHtml(club.name)}" title="${escapeHtml(club.name)}">`;
  }
  const letter = club ? escapeHtml(club.name.charAt(0).toUpperCase()) : '?';
  const title = club ? ` title="${escapeHtml(club.name)}"` : '';
  return `<span class="${initialClass}"${title}>${letter}</span>`;
}

// Render the selected club avatars in the filter trigger
function renderClubFilterAvatars() {
  const avatarsEl = document.getElementById('clubFilterAvatars');
  const placeholderEl = document.getElementById('clubFilterPlaceholder');
  const clearEl = document.getElementById('clubFilterClear');
  if (!avatarsEl || !placeholderEl) return;

  const selected = filterState.selectedClubs;

  if (selected.length === 0) {
    avatarsEl.innerHTML = '';
    placeholderEl.textContent = 'All clubs';
    placeholderEl.style.display = '';
    if (clearEl) clearEl.style.display = 'none';
    return;
  }

  // Show the clear button whenever clubs are selected
  if (clearEl) clearEl.style.display = '';

  // allClubs not populated yet (initial load with saved filter) — show a count label
  // instead of attempting to resolve logos; real avatars arrive once loadEvents() completes.
  if (allClubs.length === 0) {
    avatarsEl.innerHTML = '';
    placeholderEl.textContent = `${selected.length} ${selected.length === 1 ? 'club' : 'clubs'} selected`;
    placeholderEl.style.display = '';
    return;
  }

  placeholderEl.style.display = 'none';

  const maxShow = 5;
  const shown = selected.slice(0, maxShow);
  const overflow = selected.length - maxShow;

  avatarsEl.innerHTML = shown.map(id => {
    const club = allClubs.find(c => String(c.id) === String(id));
    return clubMarkupHtml(club, 'club-avatar-img', 'club-avatar-initial');
  }).join('') + (overflow > 0 ? `<span class="club-avatar-overflow">+${overflow}</span>` : '');
}

// Render the club dropdown list
function renderClubFilterDropdown() {
  const listEl = document.getElementById('clubFilterList');
  const footerEl = document.getElementById('clubFilterFooter');
  const searchEl = document.getElementById('clubFilterSearch');
  if (!listEl) return;

  const query = searchEl ? searchEl.value.toLowerCase() : '';
  const selected = filterState.selectedClubs;
  const atLimit = selected.length >= CLUB_FILTER_LIMIT;

  // Alphabetical order — items stay in place when selected for a stable UX
  const sorted = [...allClubs].sort((a, b) => a.name.localeCompare(b.name));

  const filtered = query ? sorted.filter(c => c.name.toLowerCase().includes(query)) : sorted;

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="club-filter-empty">No clubs found</div>`;
  } else {
    listEl.innerHTML = filtered.map(club => {
      const clubId = String(club.id);
      const isSelected = selected.includes(clubId);
      const isDisabled = atLimit && !isSelected;
      return `
        <label class="club-filter-list-item${isDisabled ? ' disabled' : ''}${isSelected ? ' selected' : ''}">
          <input type="checkbox" class="club-filter-checkbox" value="${clubId}"
            ${isSelected ? 'checked' : ''}
            ${isDisabled ? 'disabled' : ''}>
          ${clubMarkupHtml(club, 'club-list-logo', 'club-list-initial')}
          <span class="club-list-name">${escapeHtml(club.name)}</span>
        </label>`;
    }).join('');
  }

  if (footerEl) {
    footerEl.textContent = selected.length > 0
      ? `${selected.length} of ${CLUB_FILTER_LIMIT} selected`
      : `Select up to ${CLUB_FILTER_LIMIT} clubs`;
  }
}

function openClubDropdown() {
  const dropdown = document.getElementById('clubFilterDropdown');
  const searchEl = document.getElementById('clubFilterSearch');
  if (!dropdown) return;
  dropdown.style.display = 'block';
  document.getElementById('clubFilterTrigger')?.setAttribute('aria-expanded', 'true');
  renderClubFilterDropdown();
  if (searchEl) { searchEl.value = ''; searchEl.focus(); }
}

function closeClubDropdown() {
  const dropdown = document.getElementById('clubFilterDropdown');
  if (dropdown) dropdown.style.display = 'none';
  document.getElementById('clubFilterTrigger')?.setAttribute('aria-expanded', 'false');
}

// Debounce timer for club filter changes — batches rapid toggles into one request
let clubFilterDebounceTimer = null;

function scheduleEventsReload() {
  if (clubFilterDebounceTimer) clearTimeout(clubFilterDebounceTimer);
  clubFilterDebounceTimer = setTimeout(() => {
    clubFilterDebounceTimer = null;
    loadEvents().catch(() => displayErrorMessage('Unable to load events. Please try to reload the page.'));
  }, 400);
}

function toggleClubFilter(clubId) {
  const id = String(clubId);
  const idx = filterState.selectedClubs.indexOf(id); // id is always a string; no .map(String) needed
  if (idx >= 0) {
    filterState.selectedClubs.splice(idx, 1);
  } else if (filterState.selectedClubs.length < CLUB_FILTER_LIMIT) {
    filterState.selectedClubs.push(id);
  }
  saveFilterState();
  updateClearFiltersButton();
  updateFilterCount();
  renderClubFilterAvatars();
  renderClubFilterDropdown();
  scheduleEventsReload();
}

// Single DOMContentLoaded handler for all initialization.
// Using DOMContentLoaded (rather than an IIFE) guarantees DOM availability
// regardless of where the <script> tag lives (bottom of body, head with defer, etc.).
document.addEventListener('DOMContentLoaded', async function () {
  // -- Sync setup: filter state must be restored before loadEvents() builds the URL --
  loadFilterState();
  updateFilterCount();
  setupFilterEventListeners();

  // Toggle filters panel
  const toggleFiltersBtn = document.getElementById('toggle-filters');
  const eventFilters = document.getElementById('event-filters');
  toggleFiltersBtn.addEventListener('click', function (e) {
    e.preventDefault();
    const isVisible = eventFilters.classList.contains('is-open');
    eventFilters.classList.toggle('is-open', !isVisible);
    toggleFiltersBtn.setAttribute('aria-expanded', !isVisible);
  });

  // Close filter panel when clicking outside it (but not on the toggle button itself)
  document.addEventListener('click', (e) => {
    if (
      eventFilters.classList.contains('is-open') &&
      !eventFilters.contains(e.target) &&
      !toggleFiltersBtn.contains(e.target)
    ) {
      eventFilters.classList.remove('is-open');
      toggleFiltersBtn.setAttribute('aria-expanded', false);
    }
  });

  // -- Async init --
  try {
    showPreloader();
    loadUserProfile();
    await loadEvents();
  } catch (error) {
    if (error.isAuthError) {
      console.info('Authentication is required');
      handleAuthRequired();
      return;
    }
    console.error('Error loading events:', error);
    displayErrorMessage('Unable to load events. Please try to reload the page.');
  } finally {
    hidePreloader();
  }
});
