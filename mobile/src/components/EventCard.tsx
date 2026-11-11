import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Typography';
import { colors, eventCardPalette, ui } from '../theme';
import type { EventOccurrence } from '../types';
export function EventCard({ event, open }: { event: EventOccurrence; open: (event: EventOccurrence) => void }) {
  const time = new Date(event.start_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const { backgroundColor, borderColor, borderLeftColor, color, pressed: pressedColor } =
    event.joined ? eventCardPalette.joined : eventCardPalette.standard;
  const logo = event.club_info.logo;
  return <Pressable onPress={() => open(event)} accessibilityRole="button"
    accessibilityLabel={`${time}, ${event.title}, ${event.club_info.name}${event.joined ? ', Joined' : ''}`}
    style={({ pressed }) => [ui.card, styles.card, { backgroundColor: pressed ? pressedColor : backgroundColor, borderColor, borderLeftColor }]}>
    <View style={ui.row}><Text style={[styles.time, event.joined && { color }]}>{time}</Text>{event.joined && <Text style={styles.joined}>✓ Joined</Text>}</View>
    <Text style={[styles.title, { color }]}>{event.title}</Text>
    <View style={ui.row}>
      {typeof logo === 'string' && logo.startsWith('https://') ? <Image source={{ uri: logo }} style={styles.logo} /> : <View style={styles.initial}><Text style={{ color: colors.purple }}>{event.club_info.name?.charAt(0) || 'C'}</Text></View>}
      <Text style={[ui.muted, { flex: 1 }]}>{event.club_info.name}</Text>
    </View>
    {event.route_info?.distance && event.route_info.distance !== 'N/A' && <Text style={ui.muted}>{event.route_info.distance}  ·  {event.route_info.elevation_gain || 'Elevation unavailable'}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { gap: 9, borderLeftWidth: 4 },
  time: { color: colors.purple, fontSize: 14, fontWeight: '800' },
  title: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
  joined: { color: '#276241', backgroundColor: '#e7f5eb', fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  logo: { width: 24, height: 24, borderRadius: 7 },
  initial: { width: 24, height: 24, borderRadius: 7, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
});
