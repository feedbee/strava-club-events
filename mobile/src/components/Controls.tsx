import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, ui } from '../theme';
export function Button({ title, onPress, disabled = false, primary = false, selected = false, label }: {
  title: string; onPress: () => void; disabled?: boolean; primary?: boolean; selected?: boolean; label?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label || title}
    accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, primary && styles.primary, selected && styles.selected,
      (disabled || pressed) && { opacity: disabled ? 0.4 : 0.7 }]}>
    <Text style={[styles.text, (primary || selected) && { color: 'white' }]}>{title}</Text>
  </Pressable>;
}
export function ModalHeader({ title, close }: { title: string; close: () => void }) {
  return <View style={[ui.row, styles.modalHeader]}><Text accessibilityRole="header" style={[ui.heading, { flex: 1 }]}>{title}</Text><Button title="Done" onPress={close} /></View>;
}
const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12,
    backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 14, fontWeight: '700', color: colors.purple },
  primary: { backgroundColor: colors.accent }, selected: { backgroundColor: colors.purple },
  modalHeader: { padding: 16, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: 'white' },
});
