import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { filterEvents } from '../../../shared/events.js';
import { calendarBounds, clampCalendarDate } from '../../../shared/calendar-window.js';
import { eventWarnings } from '../../../shared/event-warnings.js';
import { movePeriod } from '../../../shared/mobile-state.js';
import { Agenda, Month, TimeGrid } from '../components/CalendarViews';
import { Button, ModalHeader } from '../components/Controls';
import { useEvents } from '../data/useEvents';
import { savePreferences } from '../data/storage';
import { API_URL } from '../data/api';
import { colors, ui } from '../theme';
import { EventDetails } from './EventDetails';
import { Filters } from './Filters';
import type { Credential, EventOccurrence, Mode, Preferences } from '../types';
export function CalendarScreen({ credential, initialPreferences, signOut }: {
  credential: Credential | null; initialPreferences: Preferences; signOut: (expired?: boolean) => void;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [date, setDate] = useState(() => { const date = new Date(); date.setHours(12, 0, 0, 0); return date; });
  const [details, setDetails] = useState<EventOccurrence | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false); const [profileOpen, setProfileOpen] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const expired = useCallback(() => signOut(true), [signOut]);
  const result = useEvents(credential, preferences, expired);
  const events = useMemo(() => filterEvents(result.data.events, preferences, result.data.clubs) as EventOccurrence[], [result.data, preferences]);
  function update(value: Preferences) {
    setPreferences(value);
    void savePreferences(credential?.user.id || 'demo', value).catch(() => setStorageMessage('Preferences could not be saved on this device.'));
  }
  const bounds = calendarBounds();
  const previous = clampCalendarDate(movePeriod(date, preferences.mode, -1), bounds);
  const next = clampCalendarDate(movePeriod(date, preferences.mode, 1), bounds);
  const filterCount = preferences.clubs.length + preferences.sports.length + Number(preferences.joinedOnly);
  const periodTitle = date.toLocaleDateString('en-GB', preferences.mode === 'month' ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' });
  return <View style={ui.screen}>
    <View style={ui.header}><View><Text style={ui.headerTitle}>Club Events</Text><Text style={{ color: '#ede6ff', fontSize: 12, marginTop: 3 }}>{credential ? 'Your next adventure' : 'Demo · sample events'}</Text></View>
      <Button title={credential?.user.firstname?.charAt(0) || 'Account'} label="Open account" onPress={() => setProfileOpen(true)} /></View>
    <View style={ui.surface}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        {(['list', 'month', 'week', 'day'] as Mode[]).map(mode => <Button key={mode} title={mode[0].toUpperCase() + mode.slice(1)} selected={preferences.mode === mode} onPress={() => update({ ...preferences, mode })} />)}
      </ScrollView>
      <View style={[ui.row, { padding: 16, paddingBottom: 8 }]}>
        <View style={{ flex: 1 }}><Text accessibilityRole="header" style={ui.heading}>{preferences.mode === 'list' ? 'Upcoming events' : periodTitle}</Text><Text style={ui.muted}>{credential && result.syncedAt === null ? (result.busy ? 'Loading events' : 'No data loaded') : `${events.length} events${result.saved ? ' · Saved data' : ''}`}</Text></View>
        <Button title={`Filters${filterCount ? ` · ${filterCount}` : ''}`} onPress={() => setFiltersOpen(true)} />
        {credential && <Button title="↻" label="Refresh events" disabled={result.busy} onPress={() => void result.refresh()} />}
      </View>
      {preferences.mode !== 'list' && <View style={[ui.row, { paddingHorizontal: 16, paddingBottom: 8 }]}>
        <Button title="‹" label="Previous period" disabled={+date === +previous} onPress={() => setDate(previous)} />
        <Button title="Today" onPress={() => setDate(clampCalendarDate(new Date(), bounds))} />
        <Button title="›" label="Next period" disabled={+date === +next} onPress={() => setDate(next)} />
      </View>}
      <ScrollView contentContainerStyle={ui.content} refreshControl={credential ? <RefreshControl refreshing={result.busy} onRefresh={() => void result.refresh()} tintColor={colors.purple} /> : undefined}>
        {result.syncedAt && <Text style={ui.muted}>Last synced {new Date(result.syncedAt).toLocaleString('en-GB')}{result.saved ? ' · Saved data may be out of date' : ''}</Text>}
        {result.busy && <View style={ui.row}><ActivityIndicator color={colors.purple} /><Text style={ui.muted}>Loading your events…</Text></View>}
        {!!result.message && <View accessibilityRole="alert" style={ui.notice}><Text style={ui.text}>{result.message}</Text></View>}
        {!!storageMessage && <Text style={ui.muted}>{storageMessage}</Text>}
        {!result.covered && <View style={ui.notice}><Text style={ui.text}>Saved data does not cover all selected clubs or sports. Connect and refresh to load this selection.</Text></View>}
        {eventWarnings(result.data.meta, preferences.clubs).map(message => <View key={message} style={ui.notice}><Text style={ui.muted}>{message}</Text></View>)}
        {!events.length && credential && result.syncedAt === null ? <View style={ui.card}><Text style={ui.heading}>{result.busy ? 'Loading events' : 'Events unavailable'}</Text><Text style={ui.muted}>{result.busy ? 'Connecting to your clubs…' : 'Refresh to try again.'}</Text></View> : preferences.mode === 'list' ? <Agenda events={events} open={setDetails} /> :
          preferences.mode === 'month' ? <Month date={date} select={setDate} events={events} open={setDetails} /> :
            <TimeGrid date={date} mode={preferences.mode} events={events} open={setDetails} />}
      </ScrollView>
    </View>
    {details && <EventDetails event={details} close={() => setDetails(null)} demo={!credential} />}
    {filtersOpen && <Filters value={preferences} clubs={result.data.clubs} apply={update} close={() => setFiltersOpen(false)} />}
    <Modal visible={profileOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setProfileOpen(false)}>
      <SafeAreaView style={ui.modal} edges={['top', 'bottom']}><ModalHeader title="Account" close={() => setProfileOpen(false)} />
        <ScrollView contentContainerStyle={ui.content}>
          <Text style={ui.title}>{credential ? [credential.user.firstname, credential.user.lastname].filter(Boolean).join(' ') || credential.user.username : 'Try your next adventure'}</Text>
          <Text style={ui.text}>{credential ? 'Connected with Strava' : 'You are viewing synthetic events. Connect Strava to see your clubs.'}</Text>
          {credential && <Text style={ui.muted}>Session valid until {new Date(credential.expiresAt).toLocaleString('en-GB')}. Reconnect when it expires.</Text>}
          <View style={ui.card}><Text style={ui.label}>Calendar copies</Text><Text style={ui.text}>Events you add to your calendar stay there after sign-out. Manage those copies in your calendar app.</Text></View>
          <Button title="About this service" onPress={() => void Linking.openURL(`${API_URL}/about.html`).catch(() => setStorageMessage('The service information page could not be opened.'))} />
          <Image source={require('../../assets/powered-by-strava.png')} resizeMode="contain" style={{ width: 180, height: 36, backgroundColor: colors.purple, borderRadius: 8 }} accessibilityLabel="Powered by Strava" />
          <Button title={credential ? 'Sign out' : 'Leave demo'} onPress={() => { setProfileOpen(false); signOut(); }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}
