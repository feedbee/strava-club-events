import React, { useState } from 'react';
import { Modal, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ModalHeader } from '../components/Controls';
import { colors, ui } from '../theme';
import type { Club, Preferences } from '../types';
export function Filters({ value, clubs, apply, close }: { value: Preferences; clubs: Club[]; apply: (value: Preferences) => void; close: () => void }) {
  const [draft, setDraft] = useState(value); const [search, setSearch] = useState('');
  const sports = [...new Set(clubs.map(club => club.sport_type).filter((value): value is string => !!value))];
  function toggle(key: 'clubs' | 'sports', id: string) {
    setDraft(previous => ({ ...previous, [key]: previous[key].includes(id) ? previous[key].filter(item => item !== id) : [...previous[key], id].slice(0, 10) }));
  }
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
    <SafeAreaView style={ui.modal} edges={['top', 'bottom']}>
      <ModalHeader title="Filters" close={close} />
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <View style={[ui.card, ui.row, { justifyContent: 'space-between' }]}><Text style={ui.text}>Joined events only</Text><Switch accessibilityLabel="Joined events only" value={draft.joinedOnly} onValueChange={joinedOnly => setDraft(previous => ({ ...previous, joinedOnly }))} trackColor={{ true: colors.purple }} /></View>
        <Text style={ui.label}>Sport</Text>
        <View style={[ui.row, { flexWrap: 'wrap' }]}>{sports.map(sport => <Button key={sport} title={sport} selected={draft.sports.includes(sport)} disabled={!draft.sports.includes(sport) && draft.sports.length >= 10} onPress={() => toggle('sports', sport)} />)}</View>
        {!sports.length && <Text style={ui.muted}>Connect and load your clubs to see sport choices.</Text>}
        <Text style={ui.label}>Clubs · {draft.clubs.length}/10 selected</Text>
        <TextInput accessibilityLabel="Search clubs" placeholder="Search clubs" value={search} onChangeText={setSearch} style={[ui.card, ui.text, { minHeight: 48 }]} autoCorrect={false} />
        <Text style={ui.muted}>No selection means all clubs within the server's loading limits.</Text>
        {clubs.filter(club => club.name.toLowerCase().includes(search.toLowerCase())).map(club => <Button key={String(club.id)} title={`${draft.clubs.includes(String(club.id)) ? '✓ ' : ''}${club.name}`}
          selected={draft.clubs.includes(String(club.id))} disabled={draft.clubs.length >= 10 && !draft.clubs.includes(String(club.id))} onPress={() => toggle('clubs', String(club.id))} />)}
        <Button title="Clear filters" onPress={() => setDraft(previous => ({ ...previous, clubs: [], sports: [], joinedOnly: false }))} />
        <Button title="Show events" primary onPress={() => { apply(draft); close(); }} />
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
