import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePreferences } from '../../../shared/preferences.js';
import { makeSnapshot, restoreSnapshot } from '../../../shared/mobile-state.js';
import { API_URL } from './api';
import type { EventData, Preferences } from '../types';
const SNAPSHOT = 'club-events-snapshot';
let epoch = 0;
let tail = Promise.resolve();
export const storageEpoch = () => epoch;
function serial(task: () => Promise<void>) {
  const next = tail.catch(() => {}).then(task); tail = next; return next;
}
export function clearSnapshot() {
  epoch++;
  return serial(() => AsyncStorage.removeItem(SNAPSHOT));
}
export async function loadSnapshot(account: string) {
  const raw = await AsyncStorage.getItem(SNAPSHOT);
  const restored = restoreSnapshot(raw, { account, backend: API_URL });
  if (raw && !restored) await serial(() => AsyncStorage.removeItem(SNAPSHOT));
  return restored as { data: EventData; filters: Preferences; syncedAt: number } | null;
}
export function saveSnapshot(data: EventData, account: string, filters: Preferences, syncedAt: number, expectedEpoch: number) {
  const text = makeSnapshot(data, { account, backend: API_URL, filters }, syncedAt);
  return serial(async () => {
    if (expectedEpoch !== epoch) return;
    if (text) await AsyncStorage.setItem(SNAPSHOT, text);
    else await AsyncStorage.removeItem(SNAPSHOT);
  });
}
const preferenceKey = (account: string) => `club-events-preferences:${API_URL}:${account}`;
export async function loadPreferences(account: string): Promise<Preferences> {
  const raw = await AsyncStorage.getItem(preferenceKey(account));
  return raw ? normalizePreferences(JSON.parse(raw)) as Preferences : { mode: 'list', clubs: [], sports: [], joinedOnly: false };
}
export async function savePreferences(account: string, value: Preferences) {
  await AsyncStorage.setItem(preferenceKey(account), JSON.stringify(normalizePreferences(value)));
}
