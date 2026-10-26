import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { API_URL, ApiError, request, readUser } from './api';
import type { Credential } from '../types';

export const CALLBACK = 'stravaclubevents://auth/callback';
const KEY = 'club-events-session';
const random = () => Array.from(Crypto.getRandomBytes(32), byte => byte.toString(16).padStart(2, '0')).join('');
export async function savedCredential(): Promise<Credential | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value.backend !== API_URL || !/^[a-f0-9]{64}$/.test(value.token) ||
        !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now() ||
        typeof value.user?.id !== 'string' || !Number.isSafeInteger(value.user?.athleteId)) {
      await SecureStore.deleteItemAsync(KEY); return null;
    }
    return value;
  } catch { return null; }
}
export async function clearCredential() { await SecureStore.deleteItemAsync(KEY); }
export async function connect(): Promise<Credential | null> {
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
  const user = await readUser(session.token);
  const credential = { ...session, user };
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify({ ...credential, backend: API_URL }), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    await request('/logout', session.token, {}).catch(() => {});
    throw new Error('Unable to securely save your session on this device.');
  }
  return credential;
}
