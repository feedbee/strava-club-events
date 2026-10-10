export function demoEvents() {
  const titles = [
    "Sunday coffee loop",
    "Into the forest",
    "The long way home · Велопрогулка по набережной и встреча клуба",
    "Gravel after work",
    "Morning miles",
    "Sunset social",
    "City spin",
  ];
  const events = Array.from({ length: 84 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + Math.floor(i / 7) * 2);
    d.setHours([7, 9, 9, 9, 13, 17, 19][i % 7], 30, 0, 0);
    return {
      occurrence_id: String(i),
      title: titles[i % 7],
      start_date: d.toISOString(),
      strava_event_url: "https://www.strava.com",
      joined: i % 3 === 0,
      demo_logo:
        i % 2 ? "/prototypes/calendar/images/demo-club-road.svg" : "/prototypes/calendar/images/demo-club-gravel.svg",
      club_info: {
        sport_type: i % 2 ? "cycling" : "hiking",
        id: i % 2 ? 1 : 2,
        name: i % 2 ? "Warsaw Cycling Club" : "Weekend Wanderers",
      },
      terrain_label: i % 2 ? "Road" : "Gravel",
      skill_level_label: "Intermediate",
      address: "Warsaw · Club meeting point",
      route_info: {
        name: "Club route",
        distance: `${42 + i} km`,
        elevation_gain: "320 m",
        estimated_moving_time: "2h 15m",
        id: "demo-route",
        activity_type: "Ride",
        max_slope: "12%",
        elevation_low: "N/A",
        elevation_high: "N/A",
        is_full: true,
      },
    };
  });
  return {
    events,
    clubs: [
      { id: 1, name: "Warsaw Cycling Club", sport_type: "cycling" },
      { id: 2, name: "Weekend Wanderers", sport_type: "hiking" },
    ],
    meta: { clubs_total: 2, clubs_processed: 2 },
  };
}
