import { StyleSheet } from 'react-native';
export const colors = { ink: '#202344', muted: '#666b80', accent: '#fc4c02', purple: '#5424c7',
  lavender: '#f4efff', border: '#e6e0ef', surface: '#ffffff', background: '#f8f7fb', error: '#9b241c' };
export const ui = StyleSheet.create({
  screen: { flex: 1 }, surface: { flex: 1, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  heading: { fontSize: 18, fontWeight: '700', color: colors.ink },
  text: { fontSize: 15, lineHeight: 22, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 19, color: colors.muted },
  label: { fontSize: 12, fontWeight: '700', color: colors.purple, letterSpacing: 0.7, textTransform: 'uppercase' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  notice: { padding: 12, borderRadius: 12, backgroundColor: '#fff4de' },
  header: { paddingHorizontal: 20, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 23, fontWeight: '800', color: 'white', letterSpacing: -0.5 },
  modal: { flex: 1, backgroundColor: colors.background },
});
