import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Typography';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { dateKey, filterEvents } from '../../../shared/events.js';
import { calendarBounds, clampCalendarDate } from '../../../shared/calendar-window.js';
import { eventWarnings } from '../../../shared/event-warnings.js';
import { movePeriod, periodDays } from '../../../shared/mobile-state.js';
import { DayStrip } from '../components/DayStrip';
import { AgendaList, Month, TimeGrid } from '../components/CalendarViews';
import { Avatar, BrandHeader, StravaAttribution } from '../components/Brand';
import { Button, ModalHeader } from '../components/Controls';
import { useEvents } from '../data/useEvents';
import { savePreferences } from '../data/storage';
import { API_URL } from '../data/api';
import { colors, ui } from '../theme';
import { EventDetails } from './EventDetails';
import { Filters } from './Filters';
import type { Credential, EventOccurrence, Mode, Preferences } from '../types';
const manropeLicense: string = require('../../assets/fonts/Manrope-OFL.json');

const modeIcons = {
  month: require('../../assets/icon-month.png'),
  week: require('../../assets/icon-week.png'),
  day: require('../../assets/icon-day.png'),
  list: require('../../assets/icon-list.png'),
};

function weekTitle(date: Date) {
  const days = periodDays(date, 'week');
  const start = days[0];
  const end = days[6];
  const first = start.toLocaleDateString('en-GB', start.getFullYear() !== end.getFullYear()
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : start.getMonth() !== end.getMonth() ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
  return `${first}–${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function CalendarScreen({ credential, initialPreferences, signOut }: {
  credential: Credential; initialPreferences: Preferences; signOut: (expired?: boolean) => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [date, setDate] = useState(() => { const date = new Date(); date.setHours(12, 0, 0, 0); return date; });
  const [details, setDetails] = useState<EventOccurrence | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false); const [profileOpen, setProfileOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const expired = useCallback(() => signOut(true), [signOut]);
  const result = useEvents(credential, preferences, expired);
  const events = useMemo(() => filterEvents(result.data.events, preferences, result.data.clubs) as EventOccurrence[], [result.data, preferences]);
  function update(value: Preferences) {
    setPreferences(value);
    void savePreferences(credential.user.id, value).catch(() => setStorageMessage('Preferences could not be saved on this device.'));
  }
  const bounds = calendarBounds();
  const mode = preferences.mode;
  const navigationMode = mode === 'day' ? 'week' : mode;
  const previous = clampCalendarDate(movePeriod(date, navigationMode, -1), bounds);
  const next = clampCalendarDate(movePeriod(date, navigationMode, 1), bounds);
  const firstDay = (value: Date) => +periodDays(value, navigationMode)[0];
  const canGoBack = firstDay(previous) < firstDay(date);
  const canGoForward = firstDay(next) > firstDay(date);
  function navigate(direction: -1 | 1) {
    if (direction === -1 && canGoBack) setDate(previous);
    if (direction === 1 && canGoForward) setDate(next);
  }
  const filterCount = preferences.clubs.length + preferences.sports.length + Number(preferences.joinedOnly);
  const periodTitle = mode === 'list' ? 'Upcoming events' : mode === 'week' ? weekTitle(date) :
    date.toLocaleDateString('en-GB', mode === 'month' ? { month: 'long', year: 'numeric' } : { dateStyle: 'full' });
  const unavailable = result.syncedAt === null;
  const periodDaysKeys = new Set(periodDays(date, mode).filter(day => mode !== 'month' || day.getMonth() === date.getMonth()).map(dateKey));
  const eventCount = mode === 'list' ? events.length :
    events.filter(event => periodDaysKeys.has(dateKey(new Date(event.start_date)))).length;
  const eventStatus = unavailable ? (result.busy ? 'Loading events' : 'No data loaded')
    : `${eventCount} ${eventCount === 1 ? 'event' : 'events'}${result.saved ? ' · Saved data' : ''}`;
  const refresh = () => void result.refresh();
  const pullRefresh = () => void result.refresh('pull');
  const showLoadingOverlay = result.busy && !result.pullRefreshing;
  const periodHeading = <View style={mode === 'list' ? styles.listHeading : styles.period}>
    <Text accessibilityRole="header" style={[ui.heading, mode !== 'list' && styles.centered]}>{periodTitle}</Text>
    <Text style={[ui.muted, mode !== 'list' && styles.centered]}>{eventStatus}</Text>
  </View>;
  const warnings = eventWarnings(result.data.meta, result.sourceFilters.clubs);
  const user = credential.user;
  const name = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.username || 'Strava athlete';
  const hasNotices = !!result.message || !!storageMessage || !result.covered || warnings.length > 0;
  const notices = hasNotices ? <View style={{ gap: 12, marginBottom: 12 }}>
        {!!result.message && <View accessibilityRole="alert" style={ui.notice}><Text style={ui.text}>{result.message}</Text></View>}
        {!!storageMessage && <Text style={ui.muted}>{storageMessage}</Text>}
        {!result.covered && <View style={ui.notice}><Text style={ui.text}>{result.saved ? 'Saved' : 'Loaded'} data does not cover all selected clubs or sports. Connect and refresh to load this selection.</Text></View>}
        {warnings.map(message => <View key={message} style={ui.notice}><Text style={ui.muted}>{message}</Text></View>)}
  </View> : null;
  return <View style={ui.screen}>
    <BrandHeader avatar={user.profile_pic} name={name} openAccount={() => setProfileOpen(true)} />
    <View style={ui.surface}>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {(Object.keys(modeIcons) as Mode[]).map(mode => {
          const selected = preferences.mode === mode;
          return <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected }}
            onPress={() => { if (!selected) update({ ...preferences, mode }); }}
            style={({ pressed }) => [styles.tab, selected && styles.selectedTab, pressed && { opacity: 0.7 }]}>
            <Image source={modeIcons[mode]} style={[styles.tabIcon, selected && styles.selectedIcon]} />
            <Text style={[styles.tabText, selected && styles.selectedText]}>{mode[0].toUpperCase() + mode.slice(1)}</Text>
          </Pressable>;
        })}
      </View>
      <View style={styles.toolbar}>
        {mode === 'list' ? periodHeading : <View style={styles.toolbarGroup}>
          <Button title="‹" label={mode === 'month' ? 'Previous month' : 'Previous week'} disabled={!canGoBack} onPress={() => navigate(-1)} />
          <Button title="Today" onPress={() => setDate(clampCalendarDate(new Date(), bounds))} />
          <Button title="›" label={mode === 'month' ? 'Next month' : 'Next week'} disabled={!canGoForward} onPress={() => navigate(1)} />
        </View>}
        <View style={[styles.toolbarGroup, styles.toolbarActions]}>
          <Button title={`Filters${filterCount ? ` · ${filterCount}` : ''}`} onPress={() => setFiltersOpen(true)} />
          <Button title="↻" label="Refresh events" disabled={result.busy} onPress={refresh} />
        </View>
      </View>
      {mode === 'day' && <DayStrip date={date} bounds={bounds} select={setDate} moveWeek={navigate} />}
      {mode !== 'list' && periodHeading}
      <View style={ui.screen}>
        {mode === 'list' ? <AgendaList events={events} open={setDetails} header={notices} busy={result.busy}
          refresh={pullRefresh} refreshing={result.pullRefreshing} unavailable={unavailable} bottomInset={bottom} /> :
          mode === 'month' ? <ScrollView contentContainerStyle={[ui.content, styles.monthContent, { paddingBottom: 32 + bottom }]}
            refreshControl={<RefreshControl refreshing={result.pullRefreshing} onRefresh={pullRefresh} tintColor={colors.purple} />}>
            {notices}
            {unavailable ? <View style={ui.card}>
              <Text style={ui.heading}>{result.busy ? 'Loading events' : 'Events unavailable'}</Text>
              <Text style={ui.muted}>{result.busy ? 'Connecting to your clubs…' : 'Refresh to try again.'}</Text>
            </View> : <Month date={date} select={setDate} events={events} open={setDetails} />}
          </ScrollView> : <>
            {notices && <ScrollView style={styles.timelineNotices} contentContainerStyle={{ paddingHorizontal: 16 }}>{notices}</ScrollView>}
            <TimeGrid key={mode} date={date} mode={mode} events={events} open={setDetails} refresh={pullRefresh} refreshing={result.pullRefreshing} bottomInset={bottom} />
          </>}
        {showLoadingOverlay && <View pointerEvents="none" style={styles.loadingOverlay}>
          <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading events"
            accessibilityLiveRegion="polite" style={[ui.row, styles.loadingPill]}>
            <ActivityIndicator color={colors.purple} />
            <Text style={ui.muted}>Loading events…</Text>
          </View>
        </View>}
      </View>
    </View>
    {details && <EventDetails event={details} close={() => setDetails(null)} />}
    {filtersOpen && <Filters value={preferences} clubs={result.data.clubs} apply={update} close={() => setFiltersOpen(false)} />}
    <Modal visible={profileOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setProfileOpen(false)}>
      <SafeAreaView style={ui.modal} edges={['top', 'bottom']}><ModalHeader title="Account" close={() => setProfileOpen(false)} />
        <ScrollView contentContainerStyle={ui.content}>
          <View style={styles.profile}>
            <Avatar uri={user.profile_pic} name={name} size={64} />
            <Text style={ui.title}>{name}</Text>
            <Text style={ui.muted}>Connected with Strava</Text>
          </View>
          {result.syncedAt !== null && <Text style={styles.sync}>
            Last synced {new Date(result.syncedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
          </Text>}
          <Button title="About this service" onPress={() => void Linking.openURL(`${API_URL}/about.html`).catch(() => setStorageMessage('The service information page could not be opened.'))} />
          <Button title="Sign out" onPress={() => { setProfileOpen(false); signOut(); }} />
          <StravaAttribution />
          <Pressable accessibilityRole="button" accessibilityLabel="Manrope font license"
            accessibilityState={{ expanded: licenseOpen }} onPress={() => setLicenseOpen(open => !open)}
            style={({ pressed }) => [styles.licenseLink, pressed && { opacity: 0.65 }]}>
            <Text style={[ui.muted, styles.centered]}>Manrope font license {licenseOpen ? '▴' : '▾'}</Text>
          </Pressable>
          {licenseOpen && <Text selectable style={ui.muted}>{manropeLicense}</Text>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, minHeight: 48, paddingVertical: 6, gap: 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.lavender, borderColor: colors.border, borderWidth: 1, borderRadius: 10 },
  selectedTab: { backgroundColor: colors.purple, borderColor: colors.purple },
  tabIcon: { width: 17, height: 17, tintColor: colors.purple },
  selectedIcon: { tintColor: 'white' },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.purple, textAlign: 'center' },
  selectedText: { color: 'white' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  toolbarGroup: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  toolbarActions: { marginLeft: 'auto' },
  listHeading: { flex: 1, gap: 2 },
  centered: { textAlign: 'center' },
  monthContent: { paddingTop: 0 },
  period: { gap: 2, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  loadingOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, zIndex: 1 },
  loadingPill: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, boxShadow: '0px 3px 12px #20234426' },
  timelineNotices: { flexGrow: 0, maxHeight: 86 },
  profile: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  licenseLink: { alignSelf: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  sync: { ...ui.muted, textAlign: 'center', marginBottom: 6 },
});
