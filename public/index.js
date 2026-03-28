// -- Global variables --
let allEvents = [];
let allClubs = [];
let allClubsById = new Map(); // id (string) → club object — rebuilt whenever allClubs changes
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
  const params = new URLSearchParams();
  if (filterState.selectedClubs.length > 0)      params.set('clubs', filterState.selectedClubs.join(','));
  if (filterState.selectedSportTypes.length > 0) params.set('sportTypes', filterState.selectedSportTypes.join(','));
  const url = params.size > 0 ? `/events?${params}` : '/events';
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

  // Create shared tooltip element once — reused by all events
  let tooltipEl = document.getElementById('fc-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'fc-tooltip';
    document.body.appendChild(tooltipEl);
  }

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
      
      // Set tooltip via data-tooltip (not title, to avoid native browser tooltip)
      info.el.setAttribute('data-tooltip', tooltipContent);

      // Wire up JS tooltip using position:fixed so it escapes overflow:hidden ancestors
      info.el.addEventListener('mouseenter', function() {
        const rect = info.el.getBoundingClientRect();
        tooltipEl.textContent = info.el.getAttribute('data-tooltip');
        tooltipEl.classList.add('visible');

        const tooltipWidth = tooltipEl.offsetWidth;
        const tooltipHeight = tooltipEl.offsetHeight;
        const ARROW_HEIGHT = 8;

        let left = rect.left + rect.width / 2 - tooltipWidth / 2;
        let top = rect.top - tooltipHeight - ARROW_HEIGHT;

        // Clamp horizontally within viewport
        left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));
        // Flip below if not enough space above; arrow flips too
        if (top < 8) {
          top = rect.bottom + ARROW_HEIGHT;
          tooltipEl.classList.add('flipped');
        } else {
          tooltipEl.classList.remove('flipped');
        }

        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = top + 'px';
      });

      info.el.addEventListener('mouseleave', function() {
        tooltipEl.classList.remove('visible', 'flipped');
      });

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
  allClubsById = new Map(allClubs.map(c => [String(c.id), c]));
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

  // Refresh club picker avatars and sport type pills now that club data is available
  clubFilter.renderTrigger();
  sportTypeFilter.renderTrigger(); sportTypeFilter.updateGroupVisibility();
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
  selectedClubs: [],
  selectedSportTypes: []
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

  // Validate selectedSportTypes in case of corrupted localStorage data
  if (!Array.isArray(filterState.selectedSportTypes)) {
    filterState.selectedSportTypes = [];
  }

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
    if (hadBackendFilter) {
      loadEvents().catch(() => displayErrorMessage('Unable to load events. Please try to reload the page.'));
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Shared helper — returns an <img> or initial <span> for a club logo.
function clubMarkupHtml(club, imgClass, initialClass) {
  if (club?.logo) {
    return `<img src="${club.logo}" class="${imgClass}" alt="${escapeHtml(club.name)}" title="${escapeHtml(club.name)}">`;
  }
  const letter = club ? escapeHtml(club.name.charAt(0).toUpperCase()) : '?';
  const title = club ? ` title="${escapeHtml(club.name)}"` : '';
  return `<span class="${initialClass}"${title}>${letter}</span>`;
}

// Strava sport type values → display labels (from Strava club edit UI)
const SPORT_TYPE_LABELS = {
  cycling:           'Cycling',
  running:           'Running',
  triathlon:         'Triathlon',
  alpine_skiing:     'Alpine Skiing',
  backcountry_skiing:'Backcountry Skiing',
  canoeing:          'Canoeing',
  crossfit:          'Crossfit',
  ebiking:           'E-Biking',
  elliptical:        'Elliptical',
  soccer:            'Football (Soccer)',
  golf:              'Golf',
  handcycling:       'Handcycling',
  hiking:            'Hiking',
  ice_skating:       'Ice Skating',
  inline_skating:    'Inline Skating',
  kayaking:          'Kayaking',
  kitesurfing:       'Kitesurfing',
  nordic_skiing:     'Nordic Skiing',
  rock_climbing:     'Rock Climbing',
  roller_skiing:     'Roller Skiing',
  rowing:            'Rowing',
  footsports:        'Run/Walk/Hike',
  sailing:           'Sailing',
  skateboarding:     'Skateboarding',
  ski_snowboard:     'Ski/Snowboard',
  snowboarding:      'Snowboarding',
  snowshoeing:       'Snowshoeing',
  stair_stepper:     'Stair Stepper',
  stand_up_paddling: 'Stand-up Paddling',
  surfing:           'Surfing',
  swimming:          'Swimming',
  velomobile:        'Velomobile',
  virtual_ride:      'Virtual Riding',
  virtual_run:       'Virtual Running',
  walking:           'Walking',
  weight_training:   'Weight Training',
  wheelchair:        'Wheelchair',
  windsurfing:       'Windsurfing',
  winter_sports:     'Winter Sports',
  workout:           'Workout',
  yoga:              'Yoga',
  other:             'Multisport',
};

// Registry — each instance's open() closes all others first
const _allMultiSelectFilters = [];
// Set to true by close() when an open dropdown is actually dismissed;
// checked by the panel-level outside-click handler so it doesn't also close the whole panel.
let _dropdownClosedOnThisClick = false;

/**
 * Creates a reusable multi-select dropdown filter.
 * Both the club filter and the sport type filter are instances of this.
 *
 * Config:
 *   triggerId / dropdownId / listId / searchId / footerId / clearBtnId / avatarsId / placeholderId
 *   limit          {number}   max selections
 *   placeholder    {string}   trigger text when nothing is selected
 *   noun           {string}   "club" / "sport" — used in footer & empty-state text
 *   showAvatars    {boolean}  true → logo circles (clubs); false → text chips (sport types)
 *   hideWhenEmpty  {boolean}  hide the whole filter group when getItems() returns []
 *   getItems()     () => [{id, label, logo?}]
 *   getSelected()  () => string[]
 *   setSelected(ids)
 *   onAfterToggle()  called after checkbox toggles (save state, update counters, schedule reload)
 *   onClear()        called when the inline ✕ button is clicked (save, close panel, reload)
 */
function createMultiSelectFilter(cfg) {
  const {
    triggerId, dropdownId, listId, searchId, footerId, clearBtnId, avatarsId, placeholderId,
    limit = CLUB_FILTER_LIMIT, placeholder, noun = 'item',
    showAvatars = true, hideWhenEmpty = false,
    getItems, getSelected, setSelected, onAfterToggle, onClear,
    isItemCompatible = () => true,
  } = cfg;

  // Cached element references — looked up once at init time instead of on every call
  const $trigger     = document.getElementById(triggerId);
  const $dropdown    = document.getElementById(dropdownId);
  const $list        = document.getElementById(listId);
  const $search      = document.getElementById(searchId);
  const $footer      = document.getElementById(footerId);
  const $clearBtn    = document.getElementById(clearBtnId);
  const $avatars     = document.getElementById(avatarsId);
  const $placeholder = document.getElementById(placeholderId);

  // -- Open / close --

  function open() {
    _allMultiSelectFilters.forEach(f => { if (f !== instance) f.close(); });
    if (!$dropdown) return;
    $dropdown.style.display = 'block';
    $trigger?.setAttribute('aria-expanded', 'true');
    renderDropdown();
    if ($search) { $search.value = ''; $search.focus(); }
  }

  function close() {
    if ($dropdown && $dropdown.style.display !== 'none') {
      _dropdownClosedOnThisClick = true; // tell panel handler: don't also close the panel
    }
    if ($dropdown) $dropdown.style.display = 'none';
    $trigger?.setAttribute('aria-expanded', 'false');
  }

  function toggleOpen() {
    if ($dropdown?.style.display === 'block') close(); else open();
  }

  // -- Render dropdown list --

  function renderDropdown() {
    if (!$list) return;

    const query = ($search?.value || '').toLowerCase().trim();
    const items = getItems();
    const selected = getSelected();
    const atLimit = selected.length >= limit;

    const compatible   = items.filter(i =>  isItemCompatible(i)).sort((a, b) => a.label.localeCompare(b.label));
    const incompatible = items.filter(i => !isItemCompatible(i)).sort((a, b) => a.label.localeCompare(b.label));
    const sorted = [...compatible, ...incompatible];
    const filtered = query ? sorted.filter(item => item.label.toLowerCase().includes(query)) : sorted;

    if (filtered.length === 0) {
      $list.innerHTML = `<div class="club-filter-empty">No ${noun}s found</div>`;
    } else {
      $list.innerHTML = filtered.map(item => {
        const isSelected     = selected.includes(item.id);
        const isIncompatible = !isItemCompatible(item);
        const isDisabled     = (atLimit && !isSelected) || isIncompatible;
        const visual = showAvatars
          ? clubMarkupHtml({ name: item.label, logo: item.logo }, 'club-list-logo', 'club-list-initial')
          : '';
        const tooltip = isIncompatible ? ' title="Not available for the selected sport type"' : '';
        return `<label class="club-filter-list-item${isDisabled ? ' disabled' : ''}${isIncompatible ? ' incompatible' : ''}${isSelected ? ' selected' : ''}"${tooltip}>
          <input type="checkbox" class="club-filter-checkbox" value="${escapeHtml(item.id)}"${isSelected ? ' checked' : ''}${isDisabled ? ' disabled' : ''}>
          ${visual}<span class="club-list-name">${escapeHtml(item.label)}</span>
        </label>`;
      }).join('');
    }

    if ($footer) {
      $footer.textContent = selected.length > 0
        ? `${selected.length} of ${limit} selected`
        : `Select up to ${limit}`;
    }
  }

  // -- Render trigger --

  function renderTrigger() {
    if (!$avatars || !$placeholder) return;

    const selected = getSelected();

    if (selected.length === 0) {
      $avatars.innerHTML = '';
      $placeholder.textContent = placeholder;
      $placeholder.style.display = '';
      if ($clearBtn) $clearBtn.style.display = 'none';
      return;
    }

    if ($clearBtn) $clearBtn.style.display = '';
    $placeholder.style.display = 'none';

    const maxShow = 5;
    const items = getItems();
    const selectedItems = selected.map(id => items.find(item => item.id === id)).filter(Boolean);

    if (selectedItems.length === 0) {
      // Items not loaded yet (initial page load with a saved filter state)
      $avatars.innerHTML = '';
      $placeholder.textContent = `${selected.length} ${selected.length === 1 ? noun : noun + 's'} selected`;
      $placeholder.style.display = '';
      return;
    }

    const shown = selectedItems.slice(0, maxShow);
    const overflow = selectedItems.length - maxShow;

    if (showAvatars) {
      $avatars.innerHTML = shown.map(item =>
        clubMarkupHtml({ name: item.label, logo: item.logo }, 'club-avatar-img', 'club-avatar-initial')
      ).join('') + (overflow > 0 ? `<span class="club-avatar-overflow">+${overflow}</span>` : '');
    } else {
      $avatars.innerHTML = shown.map(item =>
        `<span class="club-filter-chip">${escapeHtml(item.label)}</span>`
      ).join('') + (overflow > 0 ? `<span class="club-filter-chip club-filter-chip-more">+${overflow}</span>` : '');
    }
  }

  // -- Group visibility (sport type filter hides itself when no items available) --

  function updateGroupVisibility() {
    if (!hideWhenEmpty) return;
    if (!$trigger) return;
    const groupEl = $trigger.closest('.filter-group-sport-type');
    if (!groupEl) return;
    groupEl.style.display = getItems().length > 0 ? '' : 'none';
  }

  // -- Toggle a single item --

  function toggleItem(id) {
    const selected = getSelected();
    const idx = selected.indexOf(id);
    let newSelected;
    if (idx >= 0) {
      newSelected = selected.filter(s => s !== id);
    } else if (selected.length < limit) {
      newSelected = [...selected, id];
    } else {
      return; // at limit — ignore
    }
    setSelected(newSelected);
    onAfterToggle();
    renderTrigger();
    renderDropdown();
  }

  // -- Clear all selections --
  // silent: true skips callbacks (used by the global "clear all filters" button)

  function clearAll({ silent = false } = {}) {
    setSelected([]);
    close();
    renderTrigger();
    updateGroupVisibility();
    if (!silent) {
      if (onClear) onClear(); else onAfterToggle();
    }
  }

  // -- Wire up DOM event listeners --

  function setupListeners() {
    if ($trigger) {
      $trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleOpen();
      });
      $trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          toggleOpen();
        }
      });
    }

    if ($clearBtn) {
      $clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearAll(); // fires onClear (or onAfterToggle as fallback)
      });
    }

    if ($list) {
      $list.addEventListener('change', (e) => {
        if (e.target.classList.contains('club-filter-checkbox')) {
          toggleItem(e.target.value);
        }
      });
    }

    if ($search) {
      $search.addEventListener('input', () => renderDropdown());
    }

    // Close when clicking outside this filter's trigger + dropdown
    // (includes clicks on the filter label, other groups, or anywhere outside the panel)
    document.addEventListener('click', (e) => {
      if (!$trigger?.contains(e.target) && !$dropdown?.contains(e.target)) close();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  const instance = { open, close, renderTrigger, renderDropdown, updateGroupVisibility, toggleItem, clearAll, setupListeners };
  _allMultiSelectFilters.push(instance);
  return instance;
}

// Debounce timer for filter changes — batches rapid toggles into one request
let _filterDebounceTimer = null;

function scheduleEventsReload() {
  if (_filterDebounceTimer) clearTimeout(_filterDebounceTimer);
  _filterDebounceTimer = setTimeout(() => {
    _filterDebounceTimer = null;
    loadEvents().catch(() => displayErrorMessage('Unable to load events. Please try to reload the page.'));
  }, 400);
}

// Helper — closes the filter panel and triggers a full events reload
function closePanelAndReload() {
  const eventFiltersEl = document.getElementById('event-filters');
  const toggleFiltersBtnEl = document.getElementById('toggle-filters');
  if (eventFiltersEl) {
    eventFiltersEl.classList.remove('is-open');
    if (toggleFiltersBtnEl) toggleFiltersBtnEl.setAttribute('aria-expanded', false);
  }
  loadEvents().catch(() => displayErrorMessage('Unable to load events. Please try to reload the page.'));
}

// Shared onAfterToggle for both filters
const _onAfterFilterToggle = () => {
  saveFilterState();
  updateClearFiltersButton();
  updateFilterCount();
  scheduleEventsReload();
};

// --- Club filter instance ---
const clubFilter = createMultiSelectFilter({
  triggerId:     'clubFilterTrigger',
  dropdownId:    'clubFilterDropdown',
  listId:        'clubFilterList',
  searchId:      'clubFilterSearch',
  footerId:      'clubFilterFooter',
  clearBtnId:    'clubFilterClear',
  avatarsId:     'clubFilterAvatars',
  placeholderId: 'clubFilterPlaceholder',
  limit:         CLUB_FILTER_LIMIT,
  placeholder:   'All clubs',
  noun:          'club',
  showAvatars:   true,
  hideWhenEmpty: false,
  getItems:    () => allClubs.map(c => ({ id: String(c.id), label: c.name, logo: c.logo || null })),
  getSelected: () => filterState.selectedClubs,
  setSelected: (ids) => { filterState.selectedClubs = ids; },
  isItemCompatible: (item) => {
    if (filterState.selectedSportTypes.length === 0) return true;
    const club = allClubsById.get(item.id);
    return !!club && filterState.selectedSportTypes.includes((club.sport_type || '').toLowerCase());
  },
  onAfterToggle: _onAfterFilterToggle,
  // Intentionally leaves the filter panel open so the user can immediately
  // make a new selection (old inline code closed the panel on clear).
  onClear: () => {
    saveFilterState();
    updateClearFiltersButton();
    updateFilterCount();
    scheduleEventsReload();
  },
});

// --- Sport type filter instance ---
const sportTypeFilter = createMultiSelectFilter({
  triggerId:     'sportTypeFilterTrigger',
  dropdownId:    'sportTypeFilterDropdown',
  listId:        'sportTypeFilterList',
  searchId:      'sportTypeFilterSearch',
  footerId:      'sportTypeFilterFooter',
  clearBtnId:    'sportTypeFilterClear',
  avatarsId:     'sportTypeFilterAvatars',
  placeholderId: 'sportTypeFilterPlaceholder',
  limit:         CLUB_FILTER_LIMIT,
  placeholder:   'All sports',
  noun:          'sport',
  showAvatars:   false,
  hideWhenEmpty: true,
  // Return only sport types present in the user's actual clubs.
  // hideWhenEmpty:true keeps the group hidden until clubs load (seen.size === 0).
  getItems: () => {
    const seen = new Map();
    for (const c of allClubs) {
      if (c.sport_type && !seen.has(c.sport_type))
        seen.set(c.sport_type, c.localized_sport_type || SPORT_TYPE_LABELS[c.sport_type] || c.sport_type);
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  },
  getSelected: () => filterState.selectedSportTypes,
  setSelected: (ids) => { filterState.selectedSportTypes = ids; },
  onAfterToggle: () => { _onAfterFilterToggle(); refreshClubsDropdownIfOpen(); },
  // Intentionally leaves the filter panel open so the user can immediately
  // make a new selection (old inline code closed the panel on clear).
  onClear: () => {
    saveFilterState();
    updateClearFiltersButton();
    updateFilterCount();
    refreshClubsDropdownIfOpen();
    scheduleEventsReload();
  },
});

// Refresh the clubs dropdown in-place when sport type selection changes (so grey-out updates immediately)
function refreshClubsDropdownIfOpen() {
  const dd = document.getElementById('clubFilterDropdown');
  if (dd && dd.style.display !== 'none') clubFilter.renderDropdown();
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

  // Close filter panel when clicking outside it (but not on the toggle button itself).
  // If a dropdown was just dismissed on this same click, keep the panel open so the
  // user doesn't have to reopen it just to make another selection.
  document.addEventListener('click', (e) => {
    if (_dropdownClosedOnThisClick) {
      _dropdownClosedOnThisClick = false;
      return;
    }
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
