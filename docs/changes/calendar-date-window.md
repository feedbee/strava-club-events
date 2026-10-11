# Upcoming event and calendar navigation windows

The backend includes concrete upcoming occurrences from now through 90 days ahead, inclusively.
It continues to request upcoming events from Strava and does not reconstruct historical dates.

The React calendar permits the complete previous month, current month and three following months.
These are local calendar-month boundaries rather than a rolling 90-day navigation limit. The last
month can therefore contain empty dates beyond the event availability window. Month scrolling
renders this bounded range, with blank weekday alignment cells outside the boundaries on desktop
and no padding cells on narrow screens. Month, Week and Day navigation clamps dates and disables
arrows at the boundaries. Partial boundary weeks only show permitted dates. List remains an event
feed without calendar navigation.

The bounded five-month range replaces dynamic week-window growth and trimming. This keeps scroll
and button navigation under the same limits without removing focused weeks during scrolling.

Verification: 148 default tests, production build and the calendar-window browser smoke passed.
Coverage includes the inclusive 90-day event cutoff, year-crossing month boundaries, Month/Day/Week
arrows and narrow-screen scroll boundaries.
