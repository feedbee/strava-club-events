import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Text } from './src/components/Typography';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { connect, savedCredential, clearCredential } from './src/data/auth';
import { request } from './src/data/api';
import { clearSnapshot, loadPreferences } from './src/data/storage';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { BrandHeader, StravaAttribution } from './src/components/Brand';
import { Button } from './src/components/Controls';
import { ui } from './src/theme';
import type { Credential, Preferences } from './src/types';
const defaults: Preferences = { mode: 'list', clubs: [], sports: [], joinedOnly: false };
export default function App() {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [starting, setStarting] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
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
    })().catch(() => {
      if (alive) { setRestoreFailed(true); setStarting(false); }
    });
    return () => { alive = false; };
  }, [restoreAttempt]);
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
    setCredential(null); setMessage(expired ? 'Your session expired. Connect with Strava again.' : '');
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
  const showCalendar = !starting && !!credential;
  const signInDisabled = connecting || cleaning || cleanupFailed || restoreFailed;
  return <SafeAreaProvider><StatusBar barStyle="light-content" /><LinearGradient colors={['#667eea', '#764ba2']} style={ui.screen}>
    <SafeAreaView style={ui.screen} edges={showCalendar ? ['top'] : ['top', 'bottom']}>
      {starting ? <View style={[ui.screen, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color="white" /><Text style={{ color: 'white', marginTop: 12 }}>Opening Strava Club Events…</Text></View> :
        credential ? <CalendarScreen key={credential.token} credential={credential} initialPreferences={preferences} signOut={signOut} /> :
          <ScrollView contentContainerStyle={styles.welcome}>
            <BrandHeader />
            <View style={styles.welcomeCard}>
              <Image source={require('./assets/club-ride.jpg')} resizeMode="cover" style={styles.illustration} />
              <View style={styles.welcomeContent}>
                <Text accessibilityRole="header" style={ui.title}>Your club events in one calendar</Text>
                <Text style={ui.text}>Connect with Strava to see upcoming events from the clubs you belong to on Strava.</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Connect with Strava" disabled={signInDisabled}
                  accessibilityState={{ disabled: signInDisabled, busy: connecting }} onPress={() => void signIn()}
                  style={[styles.connect, signInDisabled && styles.disabled]}>
                  <Image source={require('./assets/connect-with-strava.png')} resizeMode="contain" style={styles.connectImage} />
                </Pressable>
                {connecting && <ActivityIndicator />}
                {restoreFailed && <>
                  <Text accessibilityRole="alert" style={ui.text}>Could not verify your saved session. Check your connection and try again.</Text>
                  <Button title="Retry session check" onPress={() => {
                    setRestoreFailed(false);
                    setStarting(true);
                    setRestoreAttempt(attempt => attempt + 1);
                  }} />
                </>}
                {(cleanupFailed || !!message) && <Text accessibilityRole="alert" style={ui.text}>
                  {cleanupFailed ? 'Sign-out could not be saved on this device. Retry before reconnecting or sharing the device.' : message}
                </Text>}
                {cleanupFailed && <Button title="Retry sign-out" onPress={() => void cleanupLocalSession()} />}
              </View>
            </View>
            <StravaAttribution onGradient />
          </ScrollView>}
    </SafeAreaView>
  </LinearGradient></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  welcome: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  welcomeCard: { backgroundColor: 'white', borderRadius: 20, overflow: 'hidden' },
  illustration: { width: '100%', aspectRatio: 2, maxHeight: 240 },
  welcomeContent: { padding: 20, gap: 14 },
  connect: { alignSelf: 'center', width: 237, maxWidth: '100%', marginTop: 6 },
  connectImage: { width: '100%', height: 48 },
  disabled: { opacity: 0.5 },
});
