import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { dateKey } from '../../../shared/events.js';
import { calendarBounds } from '../../../shared/calendar-window.js';
import { periodDays, timeSlots } from '../../../shared/mobile-state.js';
import { colors, ui } from '../theme';
import { EventCard } from './EventCard';
import type { EventOccurrence, Mode } from '../types';
const dateLabel = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export function Agenda({ events, open, empty = 'No events here. Try another date or adjust your filters.' }: {
  events: EventOccurrence[]; open: (event: EventOccurrence) => void; empty?: string;
}) {
  let previous = '';
  return <View style={{ gap: 12 }}>{events.length ? events.map(event => {
    const key = dateKey(new Date(event.start_date)); const heading = previous !== key; previous = key;
    return <View key={event.key} style={{ gap: 10 }}>
      {heading && <Text accessibilityRole="header" style={[ui.label, { marginTop: 10 }]}>{dateLabel(new Date(event.start_date))}</Text>}
      <EventCard event={event} open={open} />
    </View>;
  }) : <View style={ui.card}><Text style={ui.heading}>Nothing scheduled</Text><Text style={[ui.muted, { marginTop: 8 }]}>{empty}</Text></View>}</View>;
}
export function Month({ date, select, events, open }: { date: Date; select: (date: Date) => void; events: EventOccurrence[]; open: (event: EventOccurrence) => void }) {
  const days = periodDays(date, 'month'); const bounds = calendarBounds();
  const counts = new Map<string, number>(); for (const event of events) {
    const key = dateKey(new Date(event.start_date)); counts.set(key, (counts.get(key) || 0) + 1);
  }
  return <View style={{ gap: 16 }}>
    <View style={ui.card}>
      <View style={styles.weekRow}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => <Text key={i} style={styles.weekday}>{label}</Text>)}</View>
      {Array.from({ length: 6 }, (_, row) => <View key={row} style={styles.weekRow}>
        {days.slice(row * 7, row * 7 + 7).map(day => {
          const key = dateKey(day); const selected = key === dateKey(date); const count = counts.get(key) || 0;
          const disabled = +day < +bounds.start || +day > +bounds.end;
          return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
            accessibilityLabel={`${dateLabel(day)}, ${count} events`} onPress={() => select(day)}
            style={[styles.cell, selected && { backgroundColor: colors.purple }, disabled && { opacity: 0.25 }]}>
            <Text style={[styles.dayNumber, day.getMonth() !== date.getMonth() && { color: colors.muted }, selected && { color: 'white' }]}>{day.getDate()}</Text>
            <Text style={[styles.count, selected && { color: 'white' }]}>{count ? `${count} ${count === 1 ? 'event' : 'events'}` : ' '}</Text>
          </Pressable>;
        })}
      </View>)}
    </View>
    <Agenda events={events.filter(event => dateKey(new Date(event.start_date)) === dateKey(date))} open={open} />
  </View>;
}
export function TimeGrid({ date, mode, events, open }: { date: Date; mode: Extract<Mode, 'week' | 'day'>; events: EventOccurrence[]; open: (event: EventOccurrence) => void }) {
  const { width } = useWindowDimensions(); const days = periodDays(date, mode);
  const columnWidth = mode === 'day' ? Math.max(240, width - 100) : 156;
  const bounds = calendarBounds();
  return <View style={{ gap: 10 }}>
    <Text style={ui.muted}>{mode === 'week' ? 'Swipe sideways for the week. ' : ''}Card heights do not represent event duration.</Text>
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
      <View style={ui.row}>
        <View style={{ width: 38, alignSelf: 'stretch' }}><View style={{ height: 50 }} />{Array.from({ length: 24 }, (_, hour) => <Text key={hour} style={[ui.muted, { height: 72, fontSize: 11 }]}>{String(hour).padStart(2, '0')}:00</Text>)}</View>
        <View style={{ flexDirection: 'row' }}>{days.map(day => {
          const available = +day >= +bounds.start && +day <= +bounds.end;
          const items = available ? events.filter(event => dateKey(new Date(event.start_date)) === dateKey(day)) : [];
          return <View key={dateKey(day)} style={{ width: columnWidth, opacity: available ? 1 : 0.4 }}>
            <View style={styles.dayHeader}><Text style={ui.label}>{day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</Text><Text style={ui.muted}>{items.length} events</Text></View>
            <View style={{ height: 24 * 72, borderLeftWidth: 1, borderColor: colors.border }}>
              {Array.from({ length: 24 }, (_, hour) => <View key={hour} style={[styles.hourLine, { top: hour * 72 }]} />)}
              {timeSlots(items).map(({ event, minute, column, columns }) => <Pressable key={event.key} accessibilityRole="button"
                accessibilityLabel={`${dateLabel(day)}, ${new Date(event.start_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, ${event.title}, ${event.club_info.name}`}
                onPress={() => open(event)} style={[styles.slot, { top: minute * 1.2, left: `${column / columns * 100}%`, width: `${100 / columns}%` }]}>
                <Text numberOfLines={1} style={styles.slotTime}>{new Date(event.start_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
                <Text numberOfLines={2} style={styles.slotTitle}>{event.title}</Text>
              </Pressable>)}
            </View>
          </View>;
        })}</View>
      </View>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekday: { width: '14.285%', textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.muted, paddingBottom: 10 },
  cell: { width: '14.285%', minHeight: 53, borderRadius: 10, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 16, fontWeight: '700', color: colors.ink }, count: { fontSize: 8, color: colors.purple, marginTop: 4 },
  dayHeader: { height: 50, gap: 2, paddingLeft: 8 },
  hourLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border },
  slot: { position: 'absolute', minHeight: 50, padding: 4, borderRadius: 6, backgroundColor: '#eee5ff', borderLeftWidth: 2, borderLeftColor: colors.accent, borderRightWidth: 2, borderRightColor: 'white' },
  slotTime: { fontSize: 9, color: colors.purple, fontWeight: '800' }, slotTitle: { fontSize: 10, color: colors.ink, fontWeight: '600', lineHeight: 12 },
});
