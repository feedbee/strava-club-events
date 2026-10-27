import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { connect, savedCredential, clearCredential } from './src/data/auth';
import { request } from './src/data/api';
import { clearSnapshot, loadPreferences } from './src/data/storage';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { Button } from './src/components/Controls';
import { ui } from './src/theme';
import type { Credential, Preferences } from './src/types';
const defaults: Preferences = { mode: 'list', clubs: [], sports: [], joinedOnly: false };
export default function App() {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [demo, setDemo] = useState(false); const [starting, setStarting] = useState(true);
  const [connecting, setConnecting] = useState(false); const [message, setMessage] = useState('');
  const [cleaning, setCleaning] = useState(false); const [cleanupFailed, setCleanupFailed] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const saved = await savedCredential();
      if (!saved) await clearSnapshot().catch(() => {});
      const prefs = saved ? await loadPreferences(saved.user.id).catch(() => defaults) : defaults;
      if (alive) { setCredential(saved); setPreferences(prefs); setStarting(false); }
    })();
    return () => { alive = false; };
  }, []);
  async function cleanupLocalSession() {
    setCleaning(true); setCleanupFailed(false);
    try { await Promise.all([clearCredential(), clearSnapshot()]); }
    catch {
      setCleanupFailed(true);
    } finally { setCleaning(false); }
  }
  const signOut = useCallback((expired = false) => {
    const token = credential?.token;
    // Clear UI immediately and fence late cache writes before any network operation.
    setCredential(null); setDemo(false); setMessage(expired ? 'Your session expired. Connect with Strava again.' : '');
    void cleanupLocalSession();
    if (token && !expired) void request('/logout', token, {}).catch(() => {
      setMessage('Signed out on this device. Server revocation could not be confirmed; the old session expires automatically.');
    });
  }, [credential]);
  async function signIn() {
    if (cleaning || cleanupFailed || connecting) return;
    setConnecting(true); setMessage('');
    try {
      const value = await connect();
      if (value) {
        await clearSnapshot().catch(() => {});
        const prefs = await loadPreferences(value.user.id).catch(() => defaults);
        setPreferences(prefs); setCredential(value);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to connect. Please try again.'); }
    finally { setConnecting(false); }
  }
  return <SafeAreaProvider><StatusBar barStyle="light-content" /><LinearGradient colors={['#667eea', '#764ba2']} style={ui.screen}>
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      {starting ? <View style={[ui.screen, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color="white" /><Text style={{ color: 'white', marginTop: 12 }}>Opening Club Events…</Text></View> :
        credential || demo ? <CalendarScreen key={credential?.token || 'demo'} credential={credential} initialPreferences={preferences} signOut={signOut} /> :
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28, gap: 24 }}>
            <Image source={require('./assets/icon.png')} style={{ width: 56, height: 56 }} accessibilityIgnoresInvertColors />
            <View style={{ gap: 12 }}><Text accessibilityRole="header" style={{ color: 'white', fontSize: 38, lineHeight: 43, fontWeight: '800', letterSpacing: -1 }}>Your clubs.{ '\n' }Your next adventure.</Text>
              <Text style={{ color: '#f1ecff', fontSize: 17, lineHeight: 25 }}>All your Strava club events, together in one calendar.</Text></View>
            <View style={[ui.card, { gap: 18 }]}>
              <Text style={ui.heading}>Make time to get out</Text><Text style={ui.text}>Browse rides, runs and meetups. Find your next event, share it, and keep a copy in your calendar.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Connect with Strava" disabled={connecting || cleaning || cleanupFailed} accessibilityState={{ disabled: connecting || cleaning || cleanupFailed }} onPress={() => void signIn()} style={{ alignSelf: 'center', opacity: connecting || cleaning || cleanupFailed ? 0.5 : 1 }}>
                <Image source={require('./assets/connect-with-strava.png')} resizeMode="contain" style={{ width: 237, height: 48 }} />
              </Pressable>
              {connecting && <ActivityIndicator />}
              {(cleanupFailed || !!message) && <Text accessibilityRole="alert" style={ui.text}>{cleanupFailed ? 'Sign-out could not be saved on this device. Retry before reconnecting or sharing the device.' : message}</Text>}
              {cleanupFailed && <Button title="Retry sign-out" onPress={() => void cleanupLocalSession()} />}
              <Button title="Explore the demo" disabled={connecting || cleaning || cleanupFailed} onPress={() => { setPreferences(defaults); setDemo(true); }} />
              <Text style={ui.muted}>Connect securely through Strava. Your Strava password stays with Strava.</Text>
            </View>
            <Image source={require('./assets/powered-by-strava.png')} resizeMode="contain" style={{ width: 180, height: 32, alignSelf: 'center' }} accessibilityLabel="Powered by Strava" />
          </ScrollView>}
    </SafeAreaView>
  </LinearGradient></SafeAreaProvider>;
}
