import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { API_URL, ApiError, request, readUser } from './api';
import { normalizeMobileUser } from '../../../shared/mobile-events.js';
import type { Credential } from '../types';

export const CALLBACK = 'stravaclubevents://auth/callback';
const KEY = 'club-events-session';
const SIGNED_OUT = 'club-events-signed-out';
let credentialVersion = 0;
let loginInFlight = false;
let credentialTail = Promise.resolve();
function serializeCredential<T>(task: () => Promise<T>): Promise<T> {
  const pending = credentialTail.catch(() => {}).then(task);
  credentialTail = pending.then(() => {}, () => {});
  return pending;
}
const random = () => Array.from(Crypto.getRandomBytes(32), byte => byte.toString(16).padStart(2, '0')).join('');
export async function savedCredential(): Promise<Credential | null> {
  try {
    if (await AsyncStorage.getItem(SIGNED_OUT)) return null;
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value.backend !== API_URL || !/^[a-f0-9]{64}$/.test(value.token) ||
        !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now() ||
        typeof value.user?.id !== 'string' || !Number.isSafeInteger(value.user?.athleteId)) {
      await SecureStore.deleteItemAsync(KEY); return null;
    }
    return { token: value.token, expiresAt: value.expiresAt, user: normalizeMobileUser(value.user) };
  } catch { return null; }
}
export function clearCredential(): Promise<void> {
  credentialVersion++;
  return serializeCredential(async () => {
    // Either durable operation is enough to prevent restoration. Try both independently.
    const marked = await AsyncStorage.setItem(SIGNED_OUT, 'true').then(() => true, () => false);
    try { await SecureStore.deleteItemAsync(KEY); }
    catch (error) { if (!marked) throw error; }
  });
}
export async function connect(): Promise<Credential | null> {
  if (loginInFlight) throw new Error('Sign-in is already in progress.');
  loginInFlight = true;
  try { return await performConnect(); }
  finally { loginInFlight = false; }
}
async function performConnect(): Promise<Credential | null> {
  const version = credentialVersion;
  try {
    const capability = await request<{ version: number; callback: string }>('/capabilities');
    if (capability.version !== 1 || capability.callback !== CALLBACK) throw new Error('This server does not support this mobile app yet.');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new Error('The server needs the mobile backend update before you can connect. You can try the demo now.');
    throw error;
  }
  const verifier = random(); const state = random();
  const challenge = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier);
  const url = `${API_URL}/mobile/login?${new URLSearchParams({ challenge, state })}`;
  const result = await WebBrowser.openAuthSessionAsync(url, CALLBACK, { preferEphemeralSession: true });
  if (result.type !== 'success') return null;
  const callback = new URL(result.url);
  if (`${callback.protocol}//${callback.host}${callback.pathname}` !== CALLBACK || callback.searchParams.get('state') !== state) {
    throw new Error('The sign-in response could not be verified. Please try again.');
  }
  if (callback.searchParams.has('error')) return null;
  const code = callback.searchParams.get('code');
  if (!code || !/^[a-f0-9]{64}$/.test(code)) throw new Error('Incomplete sign-in response.');
  const session = await request<{ token: string; expiresAt: string }>('/exchange', undefined, { code, verifier });
  if (!/^[a-f0-9]{64}$/.test(session.token) || !Number.isFinite(Date.parse(session.expiresAt))) throw new Error('Invalid mobile session response.');
  try {
    const user = await readUser(session.token);
    const credential = { ...session, user };
    await serializeCredential(async () => {
      if (version !== credentialVersion) throw new Error('Sign-in was cancelled. Please try again.');
      await SecureStore.setItemAsync(KEY, JSON.stringify({ ...credential, backend: API_URL }), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      // A new session becomes restorable only after both stores confirm it.
      await AsyncStorage.removeItem(SIGNED_OUT);
    });
    if (version !== credentialVersion) throw new Error('Sign-in was cancelled. Please try again.');
    return credential;
  } catch (error) {
    await request('/logout', session.token, {}).catch(() => {});
    // Fence a partially persisted credential as well as a failed profile request.
    if (version === credentialVersion) await clearCredential().catch(() => {});
    throw error;
  }
}
