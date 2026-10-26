import type { EventData, EventOccurrence } from '../types';
export function demoData(): EventData {
  const clubs = [ { id: '1', name: 'Warsaw Cycling Club', sport_type: 'cycling' },
    { id: '2', name: 'Weekend Wanderers', sport_type: 'hiking' },
    { id: '3', name: 'Morning Miles', sport_type: 'running' } ];
  const titles = ['Sunday coffee loop', 'Into the forest', 'The long way home', 'Gravel after work', 'Morning miles', 'Sunset social'];
  const events = Array.from({ length: 72 }, (_, i): EventOccurrence => {
    const date = new Date(); date.setDate(date.getDate() + Math.floor(i / 6) * 2);
    date.setHours([7, 9, 9, 9, 16, 18][i % 6], 30, 0, 0);
    const club = clubs[i % 3];
    return { key: `demo-${i}`, occurrence_id: `demo-${i}`, title: titles[i % 6], start_date: date.toISOString(),
      joined: i % 3 === 0, club_info: { id: club.id, name: club.name },
      strava_event_url: 'https://www.strava.com', address: 'Warsaw · Club meeting point',
      terrain_label: i % 2 ? 'Rolling Hills' : 'Mostly Flat', skill_level_label: 'Casual (No Drop)',
      route_info: { name: 'Club route', distance: `${30 + i} km`, elevation_gain: '320m',
        estimated_moving_time: '2h 15m', activity_type: i % 3 === 1 ? 'Hike' : 'Ride / Road' } };
  });
  return { events, clubs, meta: { clubs_total: 3, clubs_processed: 3 } };
}
