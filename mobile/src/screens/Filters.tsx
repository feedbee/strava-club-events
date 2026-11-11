import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../components/Typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Brand';
import { Button, ModalHeader } from '../components/Controls';
import { colors, ui } from '../theme';
import type { Club, Preferences } from '../types';

const selectionLimit = 10;

export function Filters({ value, clubs, apply, close }: {
  value: Preferences; clubs: Club[]; apply: (value: Preferences) => void; close: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState('');
  const sports = new Map<string, string>();
  for (const club of clubs) {
    if (club.sport_type) sports.set(club.sport_type, club.localized_sport_type || sports.get(club.sport_type) ||
      club.sport_type.replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase()));
  }
  const query = search.trim().toLocaleLowerCase();
  const matchingClubs = clubs.filter(club => club.name.toLocaleLowerCase().includes(query));
  const hasFilters = !!(draft.joinedOnly || draft.sports.length || draft.clubs.length);

  function toggle(key: 'clubs' | 'sports', id: string) {
    setDraft(previous => {
      const selection = previous[key];
      if (selection.includes(id)) return { ...previous, [key]: selection.filter(item => item !== id) };
      if (selection.length === selectionLimit) return previous;
      return { ...previous, [key]: [...selection, id] };
    });
  }

  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
    <SafeAreaView style={ui.modal} edges={['top', 'bottom']}>
      <ModalHeader title="Filters" close={close} closeTitle="Cancel" />
      <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList data={matchingClubs} keyExtractor={club => club.id}
          contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          ListHeaderComponent={<View style={styles.sections}>
            <View style={[ui.row, styles.joined]}>
              <Text style={[ui.text, { flex: 1 }]}>Joined events only</Text>
              <Switch accessibilityLabel="Joined events only" value={draft.joinedOnly}
                onValueChange={joinedOnly => setDraft(previous => ({ ...previous, joinedOnly }))} trackColor={{ true: colors.purple }} />
            </View>
            {sports.size > 0 && <View style={styles.section}>
              <Text accessibilityRole="header" style={ui.heading}>Sport</Text>
              <View style={[ui.row, styles.sports]}>
                {[...sports].map(([sport, label]) => <Button key={sport} title={label} selected={draft.sports.includes(sport)}
                  disabled={!draft.sports.includes(sport) && draft.sports.length >= selectionLimit}
                  onPress={() => toggle('sports', sport)} />)}
              </View>
            </View>}
            <View style={styles.section}>
              <View style={ui.row}>
                <Text accessibilityRole="header" style={[ui.heading, { flex: 1 }]}>Clubs</Text>
                <Text style={ui.muted}>{draft.clubs.length ? `${draft.clubs.length}/${selectionLimit} selected` : 'All clubs'}</Text>
              </View>
              {clubs.length > 0 && <TextInput accessibilityLabel="Search clubs" placeholder="Search clubs"
                placeholderTextColor={colors.muted} value={search} onChangeText={setSearch}
                style={[ui.text, styles.search]} autoCorrect={false} clearButtonMode="while-editing" />}
            </View>
          </View>}
          ListEmptyComponent={<Text style={ui.muted}>{query ? 'No clubs match your search.' : 'No clubs loaded yet.'}</Text>}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item: club }) => {
            const checked = draft.clubs.includes(club.id);
            const disabled = !checked && draft.clubs.length >= selectionLimit;
            return <Pressable accessibilityRole="checkbox" accessibilityLabel={club.name}
              accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => toggle('clubs', club.id)}
              style={({ pressed }) => [ui.row, styles.club, checked && styles.checkedClub, (pressed || disabled) && styles.dimmed]}>
              <Avatar uri={club.logo} name={club.name} size={34} />
              <Text style={styles.clubName}>{club.name}</Text>
              <View style={[styles.checkbox, checked && styles.checkedBox]}>
                {checked && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </Pressable>;
          }} />
        <View style={styles.footer}>
          <Button title="Clear filters" disabled={!hasFilters} onPress={() => setDraft(previous => ({ ...previous, clubs: [], sports: [], joinedOnly: false }))} />
          <Button title="Show events" selected onPress={() => { apply(draft); close(); }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  sections: { gap: 18, paddingBottom: 12 },
  section: { gap: 10 },
  joined: { minHeight: 58, padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  sports: { flexWrap: 'wrap' },
  search: { minHeight: 46, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  separator: { height: 6 },
  club: { minHeight: 54, paddingVertical: 8, paddingHorizontal: 12, gap: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  checkedClub: { backgroundColor: colors.lavender, borderColor: colors.purple },
  dimmed: { opacity: 0.55 },
  clubName: { flex: 1, color: colors.ink, fontWeight: '600', fontSize: 14 },
  checkbox: { width: 21, height: 21, borderRadius: 5, borderWidth: 1, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  checkedBox: { backgroundColor: colors.purple, borderColor: colors.purple },
  checkmark: { color: 'white', fontSize: 13, fontWeight: '800' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, padding: 12, paddingHorizontal: 16, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
