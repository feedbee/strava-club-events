import { StyleSheet } from 'react-native';
export const colors = { ink: '#202344', muted: '#666b80', accent: '#fc4c02', purple: '#5424c7',
  lavender: '#f4efff', border: '#e6e0ef', surface: '#ffffff', background: '#f8f7fb', error: '#9b241c' };
// Match the web calendar's .event-card and .event-card.joined colors.
export const eventCardPalette = {
  standard: { backgroundColor: '#f0eaff', borderColor: '#d9c9fa', borderLeftColor: '#764ba2', color: '#202344', pressed: '#e3d6ff' },
  joined: { backgroundColor: '#eaf3e7', borderColor: '#bdd7b3', borderLeftColor: '#56823b', color: '#244d20', pressed: '#dbead6' },
};
export const ui = StyleSheet.create({
  screen: { flex: 1 }, surface: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  heading: { fontSize: 18, fontWeight: '700', color: colors.ink },
  text: { fontSize: 15, lineHeight: 22, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 19, color: colors.muted },
  label: { fontSize: 12, fontWeight: '700', color: colors.purple, letterSpacing: 0.7, textTransform: 'uppercase' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  notice: { padding: 12, borderRadius: 12, backgroundColor: '#fff4de' },
  modal: { flex: 1, backgroundColor: colors.background },
});
