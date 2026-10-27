import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { filterCoverage, SNAPSHOT_AGE } from '../../../shared/mobile-state.js';
import { API_URL, ApiError, readEvents, readUser } from './api';
import { loadSnapshot, saveSnapshot, storageEpoch } from './storage';
import { demoData } from './demo';
import type { Credential, EventData, Preferences } from '../types';
const EMPTY: EventData = { events: [], clubs: [], meta: null };
export function useEvents(credential: Credential | null, filters: Preferences, onExpired: () => void) {
  const demo = !credential;
  const [data, setData] = useState<EventData>(demo ? demoData : EMPTY);
  const [busy, setBusy] = useState(!demo);
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [coverage, setCoverage] = useState<Pick<Preferences, 'clubs' | 'sports'>>({ clubs: [], sports: [] });
  const retryUntil = useRef(0); const lastAttempt = useRef(0);
  const revision = useRef(0); const active = useRef(true); const controller = useRef<AbortController | null>(null);
  const filtersRef = useRef(filters); filtersRef.current = filters;
  const dataRef = useRef({ data, syncedAt, coverage }); dataRef.current = { data, syncedAt, coverage };
  const onExpiredRef = useRef(onExpired); onExpiredRef.current = onExpired;
  const load = useCallback(async () => {
    if (demo || !active.current) return;
    if (Date.now() < retryUntil.current) {
      setMessage(`Please retry in ${Math.ceil((retryUntil.current - Date.now()) / 1000)} seconds.`); return;
    }
    const id = ++revision.current; controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const currentFilters = { ...filtersRef.current }; const epoch = storageEpoch();
    const current = () => active.current && revision.current === id;
    setBusy(true); setMessage(''); lastAttempt.current = Date.now();
    try {
      if (dataRef.current.syncedAt === null) {
        const snapshot = await loadSnapshot(credential.user.id).catch(() => null);
        if (!current()) return;
        if (snapshot) {
          setData(snapshot.data); setSyncedAt(snapshot.syncedAt); setCoverage(snapshot.filters); setSaved(true);
        }
      }
      // Validate the session even when showing cached data after restarting the app.
      await readUser(credential.token, abort.signal);
      if (!current()) return;
      const result = await readEvents(credential.token, currentFilters, abort.signal);
      if (!current()) return;
      const time = Date.now();
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
    } finally { if (current()) setBusy(false); }
  }, [credential?.token, demo]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; revision.current++; controller.current?.abort(); };
  }, []);
  const filterKey = JSON.stringify([filters.clubs, filters.sports]);
  useEffect(() => { void load(); }, [load, filterKey]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && Date.now() - lastAttempt.current > 60000) void load();
    });
    return () => subscription.remove();
  }, [load]);
  const covered = demo || filterCoverage(coverage, filters, data);
  return { data, busy, message, syncedAt, saved, covered, sourceFilters: coverage, refresh: load };
}
