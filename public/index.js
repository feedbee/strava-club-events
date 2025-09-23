// -- Global variables --
let allEvents = [];


// -- API calls ---

// Get current user data
async function getCurrentUser() {
  const resp = await fetch("/me");
  const handledResponse = await handleApiResponse(resp);
  
  // If handleApiResponse returns null, it means we need to authenticate
  if (!handledResponse) return null;
  
  return await handledResponse.json();
}

// Retrieve events from the server
async function getEvents() {
  const resp = await fetch("/events");
  const handledResponse = await handleApiResponse(resp);
  
  // If handleApiResponse returns null, it means we need to authenticate
  if (!handledResponse) return;
  
  const events = await handledResponse.json();
  return events;
}

// Handle API errors consistently
async function handleApiResponse(resp) {
  if (resp.ok) return resp;
  
  const error = await resp.json().catch(() => ({}));
  
  if (resp.status === 401) {
    // Clear any invalid session
    document.cookie = 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    // Show the auth div
    const authDiv = document.getElementById("auth");
    if (authDiv) {
      authDiv.style.display = 'block';
    }
    return null; // Return null to indicate auth required
  }
  
  const errorMessage = error.message || 'An error occurred';
  throw new Error(`API Error: ${errorMessage}`);
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

// Load user profile
async function loadUserProfile() {
  try {
    showPreloader();
    // Get the current user data
    const user = await getCurrentUser();
    if (!user) return; // Return if auth is needed

    // Update the user profile in the navigation bar
    updateUserProfile(user);
  } finally {
    hidePreloader();
  }
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
        tooltipContent += `\n📏 ${routeInfo.distance} • 🏔️ ${routeInfo.elevation_gain}`;
        tooltipContent += `\n🚴 ${routeInfo.activity_type}`;
        
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
  
  // Remove all existing events
  const eventSources = calendarInstance.getEventSources();
  eventSources.forEach(source => source.remove());
  
  // Add filtered and transformed events
  if (calendarEvents.length > 0) {
    calendarInstance.addEventSource(calendarEvents);
  }
  
  // Only render if the calendar is already rendered
  if (calendarInstance.view) {
    calendarInstance.render();
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


// -- Event loading --

// Load events and build the calendar
async function loadEvents() {
  const errorElement = document.getElementById("error-message");
  
  try {
    // Reset UI state
    showPreloader();
    hideNavBar();
    hideCalendar();
    if (errorElement) errorElement.textContent = '';
    
    // Make the API request
    allEvents = await getEvents();
    if (!allEvents) return; // Return if auth is needed
    
    // Apply filters to get the filtered set of events
    const filteredEvents = applyFilters(allEvents);

    buildCalendar(filteredEvents);
    
    // Show the navigation bar now that the calendar is loaded
    showNavBar();
  } catch (error) {
    console.error("Error loading events:", error);
    
    // Only show error message for non-auth related errors
    if (!error.message.includes('Session expired') && !error.message.includes('401')) {
      const errorElement = document.getElementById("error-message") || (() => {
        const title = document.querySelector('h1');
        const el = document.createElement('div');
        el.id = 'error-message';
        el.className = 'error-message';
        // Insert after the title and before the auth div
        title.parentNode.insertBefore(el, title.nextSibling);
        return el;
      })();
      
      errorElement.textContent = 'Unable to load events. Please try to reload the page.';
    }
  } finally {
    hidePreloader();
  }
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
      skill_level_label: event.skill_level_label
    }
  }));
}


// -- Filtering --

// Default filter state values
const DEFAULT_FILTER_STATE = {
  joinedOnly: false
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
  // Apply saved state with defaults for any missing properties
  Object.assign(filterState, DEFAULT_FILTER_STATE, newState);
      
  // Update UI to reflect saved state
  const filterCheckbox = document.getElementById('filter-joined');
  filterCheckbox.checked = filterState.joinedOnly;
  
  // Show/hide clear filters button
  updateClearFiltersButton();

  // Update filter count
  updateFilterCount();
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
  clearFiltersBtn.style.display = filterState.joinedOnly ? 'flex' : 'none';
}

// Update active filter count
function updateFilterCount() {
  const activeFilterCount = document.getElementById('active-filter-count');
  
  // Count how many filters differ from their default values
  let activeFilters = 0;
  for (const key in filterState) {
    if (filterState[key] !== DEFAULT_FILTER_STATE[key]) {
      activeFilters++;
    }
  }
  
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
    setFilterState(DEFAULT_FILTER_STATE);
    updateCalendarWithFilteredEvents();
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

// Initialize filter state and event listeners when the script loads
document.addEventListener('DOMContentLoaded', () => {
  loadFilterState();
  updateFilterCount();
  setupFilterEventListeners();
});

// Toggle filters when clicking the filter link or count
document.addEventListener('DOMContentLoaded', function() {
  const toggleFiltersBtn = document.getElementById('toggle-filters');
  const eventFilters = document.getElementById('event-filters');
  
  // Toggle filters when clicking the filter link or count
  toggleFiltersBtn.addEventListener('click', function(e) {
    e.preventDefault();
    const isVisible = eventFilters.style.display === 'block';
    eventFilters.style.display = isVisible ? 'none' : 'block';
    
    // Update ARIA attributes for accessibility
    const toggleButton = document.getElementById('toggle-filters');
    toggleButton.setAttribute('aria-expanded', !isVisible);
  });
});


// Initialize the app when the page loads
(async function () {
  // Update the user profile in the navigation bar
  loadUserProfile();

  // Load the events
  loadEvents();
})();
