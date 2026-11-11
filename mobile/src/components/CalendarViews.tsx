import React, { useRef } from 'react';
import { Animated, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Typography';
import { dateKey } from '../../../shared/events.js';
import { calendarBounds } from '../../../shared/calendar-window.js';
import { periodDays, timeSlots } from '../../../shared/mobile-state.js';
import { colors, eventCardPalette, ui } from '../theme';
import { EventCard } from './EventCard';
import type { EventOccurrence, Mode } from '../types';
const dateLabel = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export function AgendaList({ events, open, header, busy, refresh, refreshing, unavailable, bottomInset }: {
  events: EventOccurrence[]; open: (event: EventOccurrence) => void; header: React.ReactElement | null;
  busy: boolean; refresh?: () => void; refreshing: boolean; unavailable: boolean; bottomInset: number;
}) {
  return <FlatList data={events} keyExtractor={event => event.key} contentContainerStyle={[ui.content, { paddingBottom: 32 + bottomInset }]}
    initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7}
    ListHeaderComponent={header ?? undefined} refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.purple} /> : undefined}
    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    ListEmptyComponent={<View style={ui.card}><Text style={ui.heading}>{unavailable ? (busy ? 'Loading events' : 'Events unavailable') : 'Nothing scheduled'}</Text><Text style={ui.muted}>{unavailable ? (busy ? 'Connecting to your clubs…' : 'Refresh to try again.') : 'Try another date or adjust your filters.'}</Text></View>}
    renderItem={({ item, index }) => <View style={{ gap: 10 }}>
      {(index === 0 || dateKey(new Date(events[index - 1].start_date)) !== dateKey(new Date(item.start_date))) &&
        <Text accessibilityRole="header" style={[ui.label, { marginTop: 10 }]}>{dateLabel(new Date(item.start_date))}</Text>}
      <EventCard event={item} open={open} />
    </View>} />;
}
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
  const todayKey = dateKey(new Date());
  const days = periodDays(date, 'month'); const bounds = calendarBounds();
  const counts = new Map<string, number>(); for (const event of events) {
    const key = dateKey(new Date(event.start_date)); counts.set(key, (counts.get(key) || 0) + 1);
  }
  return <View style={{ gap: 16 }}>
    <View style={ui.card}>
      <View style={styles.weekRow}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => <Text key={i} style={styles.weekday}>{label}</Text>)}</View>
      {Array.from({ length: 6 }, (_, row) => <View key={row} style={styles.weekRow}>
        {days.slice(row * 7, row * 7 + 7).map(day => {
          const key = dateKey(day); const selected = key === dateKey(date); const today = key === todayKey; const count = counts.get(key) || 0;
          const disabled = +day < +bounds.start || +day > +bounds.end;
          return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
            accessibilityLabel={`${today ? 'Today, ' : ''}${dateLabel(day)}, ${count} events`} onPress={() => select(day)}
            style={[styles.cell, today && styles.todayCell, selected && styles.selectedDay, disabled && { opacity: 0.25 }]}>
            <Text style={[styles.dayNumber, day.getMonth() !== date.getMonth() && { color: colors.muted }, selected && { color: 'white' }, today && !selected && styles.todayText]}>{day.getDate()}</Text>
            <Text style={[styles.count, selected && { color: 'white' }]}>{count ? `${count} ${count === 1 ? 'event' : 'events'}` : ' '}</Text>
          </Pressable>;
        })}
      </View>)}
    </View>
    <Agenda events={events.filter(event => dateKey(new Date(event.start_date)) === dateKey(date))} open={open} />
  </View>;
}
const hourHeight = 72;
const hourGutter = 42;
const weekColumnWidth = 156;
const gridHeight = 24 * hourHeight + 60;

export function TimeGrid({ date, mode, events, open, refresh, refreshing, bottomInset }: {
  date: Date; mode: Extract<Mode, 'week' | 'day'>; events: EventOccurrence[];
  open: (event: EventOccurrence) => void; refresh?: () => void; refreshing: boolean; bottomInset: number;
}) {
  const offset = useRef(new Animated.Value(0)).current;
  const days = periodDays(date, mode);
  const week = mode === 'week';
  const todayKey = dateKey(new Date());
  const bounds = calendarBounds();
  const columns = days.map(day => {
    const key = dateKey(day);
    const available = day >= bounds.start && day <= bounds.end;
    const items = available ? events.filter(event => dateKey(new Date(event.start_date)) === key) : [];
    return { day, key, today: week && key === todayKey, available, items };
  });

  const grid = <View style={styles.gridColumns}>{columns.map(({ day, key, today, available, items }) =>
    <View key={key} style={[styles.gridColumn, week ? { width: weekColumnWidth } : ui.screen,
      today && styles.todayColumn, !available && styles.unavailable]}>
      {Array.from({ length: 24 }, (_, hour) => <View key={hour} style={[styles.hourLine, { top: hour * hourHeight }]} />)}
      {timeSlots(items).map(({ event, minute, column, columns: laneCount }) => {
        const { backgroundColor, borderColor, borderLeftColor, color, pressed: pressedColor } =
          event.joined ? eventCardPalette.joined : eventCardPalette.standard;
        const time = new Date(event.start_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return <Pressable key={event.key} accessibilityRole="button"
          accessibilityLabel={`${dateLabel(day)}, ${time}, ${event.title}, ${event.club_info.name}${event.joined ? ', Joined' : ''}`}
          onPress={() => open(event)} style={({ pressed }) => [styles.slot, { backgroundColor: pressed ? pressedColor : backgroundColor, borderColor, borderLeftColor, top: minute * hourHeight / 60,
            left: `${column / laneCount * 100}%`, width: `${100 / laneCount}%` }]}>
          <Text numberOfLines={1} style={[styles.slotTime, event.joined && { color }]}>{time}</Text>
          <Text numberOfLines={2} style={[styles.slotTitle, { color }]}>{event.title}</Text>
        </Pressable>;
      })}
    </View>)}</View>;

  return <View style={styles.timeline}>
    {week && <View style={styles.gridHeader}>
      <View style={styles.hourGutter} />
      <View style={styles.headerViewport}>
        <Animated.View style={[styles.gridColumns, { transform: [{ translateX: Animated.multiply(offset, -1) }] }]}>
          {columns.map(({ day, key, today, available, items }) =>
            <View key={key} style={[styles.dayHeader, today && styles.todayHeader, !available && styles.unavailable]}>
              <Text accessibilityRole="header" style={[ui.label, today && styles.todayText]}>
                {day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
              </Text>
              <Text style={ui.muted}>{today ? 'Today · ' : ''}{items.length} events</Text>
            </View>)}
        </Animated.View>
      </View>
    </View>}
    <ScrollView style={ui.screen} contentContainerStyle={{ paddingBottom: bottomInset }} nestedScrollEnabled
      refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.purple} /> : undefined}>
      <View style={styles.gridColumns}>
        <View style={styles.hourGutter}>{Array.from({ length: 24 }, (_, hour) =>
          <Text key={hour} style={[ui.muted, styles.hourLabel]}>{String(hour).padStart(2, '0')}:00</Text>)}</View>
        {week ? <Animated.ScrollView style={ui.screen} horizontal nestedScrollEnabled bounces={false}
          scrollEventThrottle={16} onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: offset } } }], { useNativeDriver: true })}>
          {grid}
        </Animated.ScrollView> : grid}
      </View>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekday: { width: '14.285%', textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.muted, paddingBottom: 10 },
  cell: { width: '14.285%', minHeight: 53, borderRadius: 10, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  selectedDay: { backgroundColor: colors.purple },
  todayCell: { borderWidth: 2, borderColor: colors.accent, backgroundColor: '#fff1e7' },
  todayText: { color: '#a3390b' },
  todayHeader: { backgroundColor: '#fff1e7', borderTopWidth: 2, borderTopColor: colors.accent },
  dayNumber: { fontSize: 16, fontWeight: '700', color: colors.ink }, count: { fontSize: 8, color: colors.purple, marginTop: 4 },
  timeline: { flex: 1, marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  gridHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  headerViewport: { flex: 1, overflow: 'hidden' },
  gridColumns: { flexDirection: 'row', flexGrow: 1 },
  gridColumn: { height: gridHeight, borderLeftWidth: 1, borderColor: colors.border },
  hourGutter: { width: hourGutter, backgroundColor: colors.surface },
  hourLabel: { height: hourHeight, fontSize: 10, paddingHorizontal: 4 },
  dayHeader: { width: weekColumnWidth, minHeight: 50, justifyContent: 'center', paddingHorizontal: 8,
    borderLeftWidth: 1, borderColor: colors.border },
  todayColumn: { backgroundColor: '#fff8f0' },
  unavailable: { opacity: 0.4 },
  hourLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border },
  slot: { position: 'absolute', minHeight: 50, padding: 4, borderRadius: 6, borderWidth: 1, borderLeftWidth: 4 },
  slotTime: { fontSize: 9, color: colors.purple, fontWeight: '800' }, slotTitle: { fontSize: 10, fontWeight: '600', lineHeight: 12 },
});
