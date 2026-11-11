import React, { useMemo } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Typography';
import { dateKey } from '../../../shared/events.js';
import { periodDays } from '../../../shared/mobile-state.js';
import { colors, ui } from '../theme';

export function DayStrip({ date, bounds, select, moveWeek }: {
  date: Date; bounds: { start: Date; end: Date }; select: (date: Date) => void;
  moveWeek: (direction: -1 | 1) => void;
}) {
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5,
    onPanResponderRelease: (_, { dx, dy }) => {
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) moveWeek(dx < 0 ? 1 : -1);
    },
  }), [moveWeek]);
  const todayKey = dateKey(new Date());
  const selectedKey = dateKey(date);
  return <View style={styles.strip} {...responder.panHandlers}>
    {periodDays(date, 'week').map(day => {
      const key = dateKey(day);
      const today = key === todayKey;
      const selected = key === selectedKey;
      const disabled = day < bounds.start || day > bounds.end;
      return <Pressable key={key} onPress={() => select(day)} disabled={disabled} accessibilityRole="button"
        accessibilityLabel={`${today ? 'Today, ' : ''}${day.toLocaleDateString('en-GB', { dateStyle: 'full' })}`}
        accessibilityState={{ selected, disabled }}
        style={({ pressed }) => [styles.day, (pressed || disabled) && styles.dimmed]}>
        <Text style={[styles.weekday, today && styles.today]}>{day.toLocaleDateString('en-GB', { weekday: 'short' })}</Text>
        <View style={[styles.circle, today && styles.todayCircle, selected && styles.selected]}>
          <Text style={[styles.number, today && styles.today, selected && styles.selectedText]}>{day.getDate()}</Text>
        </View>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', marginHorizontal: 16, paddingVertical: 4, borderBottomWidth: 1, borderColor: colors.border },
  day: { flex: 1, alignItems: 'center', gap: 3, minHeight: 52 },
  weekday: { ...ui.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  circle: { minWidth: 30, minHeight: 30, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { backgroundColor: '#fff1e7' },
  selected: { backgroundColor: colors.purple },
  number: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  today: { color: '#a3390b' },
  selectedText: { color: 'white' },
  dimmed: { opacity: 0.4 },
});
