import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { filterCoverage, SNAPSHOT_AGE } from '../../../shared/mobile-state.js';
import { persistRenewedExpiry } from './auth';
import { API_URL, ApiError, readEvents, readUser } from './api';
import { loadSnapshot, saveSnapshot, storageEpoch } from './storage';
import type { Credential, EventData, Preferences } from '../types';
const AUTO_REFRESH_MS = 15 * 60 * 1000;
const EMPTY: EventData = { events: [], clubs: [], meta: null };
export function useEvents(credential: Credential, filters: Preferences, onExpired: () => void) {
  const [data, setData] = useState<EventData>(EMPTY);
  const [loading, setLoading] = useState<'inline' | 'pull' | null>('inline');
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [coverage, setCoverage] = useState<Pick<Preferences, 'clubs' | 'sports'>>({ clubs: [], sports: [] });
  const pendingFilters = useRef(false);
  const retryUntil = useRef(0); const lastAttempt = useRef(0);
  const revision = useRef(0); const active = useRef(true); const controller = useRef<AbortController | null>(null);
  const filtersRef = useRef(filters); filtersRef.current = filters;
  const dataRef = useRef({ data, syncedAt, coverage }); dataRef.current = { data, syncedAt, coverage };
  const onExpiredRef = useRef(onExpired); onExpiredRef.current = onExpired;
  const load = useCallback(async (source: 'inline' | 'pull' = 'inline') => {
    if (!active.current) return;
    if (Date.now() < retryUntil.current) {
      setMessage(`Please retry in ${Math.ceil((retryUntil.current - Date.now()) / 1000)} seconds.`); return;
    }
    pendingFilters.current = false;
    const id = ++revision.current; controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const currentFilters = { ...filtersRef.current }; const epoch = storageEpoch();
    const current = () => active.current && revision.current === id;
    setLoading(source); setMessage(''); lastAttempt.current = Date.now();
    try {
      if (dataRef.current.syncedAt === null) {
        const snapshot = await loadSnapshot(credential.user.id).catch(() => null);
        if (!current()) return;
        if (snapshot) {
          setData(snapshot.data); setSyncedAt(snapshot.syncedAt); setCoverage(snapshot.filters); setSaved(true);
        }
      }
      // Validate the session even when showing cached data after restarting the app.
      const onRenewed = (expiresAt: string) => {
        if (current()) void persistRenewedExpiry(credential.token, expiresAt).catch(() => {});
      };
      await readUser(credential.token, abort.signal, onRenewed);
      if (!current()) return;
      const result = await readEvents(credential.token, currentFilters, abort.signal, onRenewed);
      if (!current()) return;
      const time = Date.now();
      const retryAfter = result.meta?.retry_after;
      if (Number.isSafeInteger(retryAfter) && retryAfter > 0) retryUntil.current = time + retryAfter * 1000;
      setData(result); setCoverage(currentFilters); setSyncedAt(time); setSaved(false);
      await saveSnapshot(result, credential.user.id, currentFilters, time, epoch).catch(() => {
        if (current()) setMessage('Events loaded, but offline storage is unavailable.');
      });
    } catch (error) {
      if (!current()) return;
      if (error instanceof ApiError && error.status === 401) { onExpiredRef.current(); return; }
      if (error instanceof ApiError && error.retryAfter > 0) retryUntil.current = Date.now() + error.retryAfter * 1000;
      if (dataRef.current.syncedAt === null) {
        const snapshot = await loadSnapshot(credential.user.id).catch(() => null);
        if (!current()) return;
        if (snapshot) {
          setData(snapshot.data); setSyncedAt(snapshot.syncedAt); setCoverage(snapshot.filters); setSaved(true);
        }
      } else if (Date.now() - dataRef.current.syncedAt > SNAPSHOT_AGE) {
        setData(EMPTY); setSyncedAt(null); setSaved(false);
      } else setSaved(true);
      setMessage(error instanceof Error ? error.message : `Unable to connect to ${API_URL}.`);
    } finally {
      if (current()) {
        controller.current = null;
        setLoading(null);
      }
    }
  }, [credential.token, credential.user.id]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; revision.current++; controller.current?.abort(); };
  }, []);
  const filterKey = JSON.stringify([filters.clubs, filters.sports]);
  useEffect(() => {
    const delay = retryUntil.current - Date.now();
    void load();
    if (delay <= 0) return;
    pendingFilters.current = true;
    const timer = setTimeout(() => {
      if (pendingFilters.current && !controller.current && AppState.currentState === 'active' &&
          Date.now() >= retryUntil.current) void load();
    }, Math.min(delay, 2147483647));
    return () => clearTimeout(timer);
  }, [load, filterKey]);
  useEffect(() => {
    function refreshIfDue(minimumAge: number) {
      const now = Date.now();
      if (!controller.current && now >= retryUntil.current && (pendingFilters.current || now - lastAttempt.current >= minimumAge)) void load();
    }
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshIfDue(60000);
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refreshIfDue(AUTO_REFRESH_MS);
    }, 60000);
    return () => { clearInterval(timer); subscription.remove(); };
  }, [load]);
  const covered = filterCoverage(coverage, filters, data);
  return { data, busy: loading !== null, pullRefreshing: loading === 'pull', message, syncedAt, saved, covered, sourceFilters: coverage, refresh: load };
}
