import { normalizeMobileEvents, normalizeMobileUser } from '../../../shared/mobile-events.js';
import type { EventData, Preferences, User } from '../types';

export function backendOrigin(value = process.env.EXPO_PUBLIC_API_URL || 'https://str.valera.ws'): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:'))) throw new Error('Use an HTTPS backend origin (HTTP is development-only).');
  return url.origin;
}
export const API_URL = backendOrigin();
export class ApiError extends Error {
  constructor(message: string, public status: number, public retryAfter = 0) { super(message); }
}
type OnRenewed = (expiresAt: string) => void;

export async function request<T>(path: string, token?: string, body?: unknown, signal?: AbortSignal, onRenewed?: OnRenewed): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 25000);
  try {
    const response = await fetch(`${API_URL}/mobile${path}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'omit', signal: controller.signal,
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(response.status === 401 ? 'Your session expired. Please connect again.' :
        response.status === 429 ? 'Request limit reached. Please try again later.' :
          `Unable to reach Strava Club Events (${response.status}).`, response.status,
      Number(data.retry_after || response.headers.get('Retry-After')) || 0);
    }
    const expiresAt = response.headers.get('X-Mobile-Session-Expires-At');
    if (expiresAt && Number.isFinite(Date.parse(expiresAt))) onRenewed?.(expiresAt);
    return response.status === 204 ? undefined as T : await response.json();
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export async function readUser(token: string, signal?: AbortSignal, onRenewed?: OnRenewed): Promise<User> {
  const data = await request<User>('/me', token, undefined, signal, onRenewed);
  return normalizeMobileUser(data);
}
export async function readEvents(token: string, filters: Preferences, signal?: AbortSignal, onRenewed?: OnRenewed): Promise<EventData> {
  const query = new URLSearchParams();
  if (filters.clubs.length) query.set('clubs', filters.clubs.join(','));
  if (filters.sports.length) query.set('sportTypes', filters.sports.join(','));
  const raw = await request<unknown>(`/events?${query}`, token, undefined, signal, onRenewed);
  return normalizeMobileEvents(raw) as EventData;
}
