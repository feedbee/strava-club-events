import React, { useState } from 'react';
import { Alert, Linking, Modal, ScrollView, Share, View } from 'react-native';
import { Text } from '../components/Typography';
import { SafeAreaView } from 'react-native-safe-area-context';
// The permissionless system composer remains in the SDK's supported legacy module.
import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import { calendarEvent, stravaUrl } from '../../../shared/mobile-state.js';
import { Button, ModalHeader } from '../components/Controls';
import { ui } from '../theme';
import type { EventOccurrence } from '../types';
export function EventDetails({ event, close }: { event: EventOccurrence; close: () => void }) {
  const [busy, setBusy] = useState(false);
  const date = new Date(event.start_date).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  async function action(task: () => Promise<unknown>) {
    setBusy(true);
    try { await task(); } catch { Alert.alert('Unable to complete action', 'Please check that a compatible app is available and try again.'); }
    finally { setBusy(false); }
  }
  const url = stravaUrl(event.strava_event_url);
  const routeUrl = event.route_info?.id && /^\d+$/.test(event.route_info.id) ? `https://www.strava.com/routes/${event.route_info.id}` : null;
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
    <SafeAreaView style={ui.modal} edges={['top', 'bottom']}>
      <ModalHeader title="Event details" close={close} />
      <ScrollView contentContainerStyle={ui.content}>
        <Text style={ui.label}>{date}</Text><Text accessibilityRole="header" style={ui.title}>{event.title}</Text>
        <Text style={ui.text}>{event.club_info.name}{event.joined ? ' · ✓ Joined' : ''}</Text>
        {event.address && <View style={ui.card}><Text style={ui.label}>Meeting point</Text><Text style={ui.text}>{event.address}</Text></View>}
        <View style={ui.row}>{[event.terrain_label, event.skill_level_label].filter(Boolean).map(text => <Text key={text} style={[ui.muted, { flex: 1 }]}>{text}</Text>)}</View>
        {event.route_info && <View style={[ui.card, { gap: 10 }]}>
          <Text style={ui.label}>Route</Text><Text style={ui.heading}>{event.route_info.name}</Text>
          {([['Distance', event.route_info.distance], ['Elevation gain', event.route_info.elevation_gain],
            ['Moving time', event.route_info.estimated_moving_time], ['Type', event.route_info.activity_type],
            ['Maximum slope', event.route_info.max_slope]]).filter(([, value]) => value && value !== 'N/A').map(([label, value]) =>
              <View key={label} style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.muted}>{label}</Text><Text style={ui.text}>{value}</Text></View>)}
          {event.route_details_failed && <Text style={ui.muted}>Some route details could not be loaded.</Text>}
          {routeUrl && <Button title="Open route in Strava" disabled={busy} onPress={() => void action(() => Linking.openURL(routeUrl))} />}
        </View>}
        <Button title="Open in Strava" primary disabled={busy || !url} onPress={() => url && void action(() => Linking.openURL(url))} />
        <Button title="Share event" disabled={busy || !url} onPress={() => url && void action(() => Share.share({ message: `${event.title}\n${date}\n${url}`, title: event.title }))} />
        <Button title="Add to calendar" disabled={busy || !url} onPress={() => void action(() => createEventInCalendarAsync(calendarEvent(event)))} />
        <Text style={ui.muted}>You choose whether to save in the calendar editor. The one-hour duration is a placeholder; adjust the end time. This copy will not update automatically.</Text>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
