import { escapeHtml, safeImageUrl } from './html.js';

export function mountCalendar(events, { transformEventsForCalendar, calendarElement, showCalendar }) {
  // Transform filtered events for FullCalendar
  const calendarEvents = transformEventsForCalendar(events);

  // Create shared tooltip element once — reused by all events
  let tooltipEl = document.getElementById('fc-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'fc-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipEl);
  }

  const calendarInstance = new FullCalendar.Calendar(calendarElement, {
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
            tooltipContent += `\n📐 Max Slope: ${routeInfo.max_slope}`;
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
      const showTooltip = function() {
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
      };
      info.el.addEventListener('mouseenter', showTooltip);
      info.el.addEventListener('focus', showTooltip);
      info.el.setAttribute('aria-describedby', 'fc-tooltip');

      info.el.addEventListener('mouseleave', function() {
        tooltipEl.classList.remove('visible', 'flipped');
      });

      info.el.addEventListener('blur', () => tooltipEl.classList.remove('visible', 'flipped'));
      info.el.addEventListener('keydown', e => {
        if (e.key === 'Escape') tooltipEl.classList.remove('visible', 'flipped');
      });

      // Create custom event content with club logo
      const titleEl = info.el.querySelector('.fc-event-title');
      if (titleEl) {
        const clubLogo = safeImageUrl(info.event.extendedProps.club_info.logo);
        if (clubLogo) {
          const logoHtml = `<img src="${escapeHtml(clubLogo)}" class="club-logo" alt="Club Logo">`;
          titleEl.insertAdjacentHTML('afterbegin', logoHtml);
        }
      }

      // Override click to open in new tab
      info.el.addEventListener('click', function(e) {
        e.preventDefault();
        if (info.event.url) {
          window.open(info.event.url, '_blank', 'noopener');
        }
      });
    }
  });

  // Hide preloader and show calendar
  showCalendar();

  // Render the calendar with the initial filtered events
  calendarInstance.render();
  return calendarInstance;
}
