// Handle API errors consistently
async function handleApiResponse(resp) {
  if (resp.ok) return resp;
  
  const error = await resp.json().catch(() => ({}));
  
  if (resp.status === 401) {
    // Clear any invalid session
    document.cookie = 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    // Only show login button, don't throw an error
    document.getElementById("auth").innerHTML = '<a href="/login">Login with Strava</a>';
    return null; // Return null to indicate auth required
  }
  
  const errorMessage = error.message || 'An error occurred';
  throw new Error(`API Error: ${errorMessage}`);
}

async function loadEvents() {
  const preloaderElement = document.getElementById("preloader");
  const calendarElement = document.getElementById("calendar");
  const errorElement = document.getElementById("error-message");
  
  try {
    // Reset UI state
    preloaderElement.classList.remove("hidden");
    calendarElement.style.display = "none";
    if (errorElement) errorElement.textContent = '';
    
    // Make the API request
    const resp = await fetch("/events");
    const handledResponse = await handleApiResponse(resp);
    
    // If handleApiResponse returns null, it means we need to authenticate
    if (!handledResponse) return;
    
    const events = await handledResponse.json();

    // Transform events for FullCalendar
    const calendarEvents = events.map(ev => ({
      title: ev.title,
      start: ev.start_date,
      url: ev.strava_event_url,
      extendedProps: {
        club_info: ev.club_info || { name: '', logo: '' },
        route_info: ev.route_info || null
      }
    }));

    let calendar = new FullCalendar.Calendar(document.getElementById("calendar"), {
      initialView: "dayGridMonth",
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
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
        }
      },
      events: calendarEvents,
      eventTimeFormat: {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      },
      eventDidMount: function(info) {
        // Build tooltip content
        let tooltipContent = `🚀 ${info.event.title}`;
        
        // Add club info if available
        if (info.event.extendedProps.club_info && info.event.extendedProps.club_info.name) {
          tooltipContent += `\n\n♣️ ${info.event.extendedProps.club_info.name}`;
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
    preloaderElement.classList.add("hidden");
    calendarElement.style.display = "block";

    calendar.render();
  } catch (error) {
    console.error("Error loading events:", error);
    
    // Only show error message for non-auth related errors
    if (!error.message.includes('Session expired') && !error.message.includes('401')) {
      const errorElement = document.getElementById("error-message") || (() => {
        const el = document.createElement('div');
        el.id = 'error-message';
        el.className = 'error-message';
        document.body.prepend(el);
        return el;
      })();
      
      errorElement.textContent = 'Failed to load events. Please try again.';
    }
  } finally {
    preloaderElement.classList.add("hidden");
    calendarElement.style.display = "block";
  }
}

// Initialize the app when the page loads
loadEvents();
