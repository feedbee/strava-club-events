async function loadEvents() {
  const preloaderElement = document.getElementById("preloader");
  const calendarElement = document.getElementById("calendar");
  
  try {
    // Show preloader
    preloaderElement.classList.remove("hidden");
    calendarElement.style.display = "none";
    
    let resp = await fetch("/events");
    if (resp.status === 401) {
      document.getElementById("auth").innerHTML = '<a href="/login">Login with Strava</a>';
      preloader.classList.add("hidden");
      return;
    }
    let events = await resp.json();

    let calendarEvents = events.map(ev => ({
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
  } catch (e) {
    console.error(e);
    // Hide preloader even on error
    preloaderElement.classList.add("hidden");
    calendarElement.style.display = "block";
  }
}

// Initialize the app when the page loads
loadEvents();
