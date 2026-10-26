export type Mode = 'list' | 'month' | 'week' | 'day';
export interface Preferences { mode: Mode; joinedOnly: boolean; clubs: string[]; sports: string[] }
export interface User { id: string; athleteId: number; firstname?: string; lastname?: string; username?: string; profile_pic?: string }
export interface Club { id: string; name: string; sport_type?: string; localized_sport_type?: string }
export interface EventOccurrence {
  key: string; id?: string; occurrence_id: string; title: string; start_date: string; joined?: boolean;
  strava_event_url: string; club_info: { id: string; name: string; logo?: string };
  address?: string; terrain_label?: string; skill_level_label?: string; route_details_failed?: boolean;
  route_info?: { id?: string; name?: string; distance?: string; elevation_gain?: string;
    estimated_moving_time?: string; activity_type?: string; max_slope?: string };
}
export interface EventData { events: EventOccurrence[]; clubs: Club[]; meta: Record<string, any> | null }
export interface Credential { token: string; expiresAt: string; user: User }
