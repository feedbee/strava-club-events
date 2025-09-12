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
      url: ev.strava_event_url
    }));

    let calendar = new FullCalendar.Calendar(document.getElementById("calendar"), {
      initialView: "dayGridMonth",
      events: calendarEvents,
      eventTimeFormat: {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      },
      eventDidMount: function(info) {
        // Add tooltip for event title
        info.el.title = info.event.title;
        
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
