import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Typography';
import { colors } from '../theme';

export function BrandHeader({ avatar, name, openAccount }: {
  avatar?: string; name?: string; openAccount?: () => void;
}) {
  return <View style={styles.header}>
    <View style={styles.side} />
    <View style={styles.brand}>
      <Image source={require('../../assets/icon.png')} style={styles.logo} />
      <Text accessibilityRole="header" style={styles.title}>Strava Club Events</Text>
    </View>
    <View style={styles.side}>
      {openAccount && <Pressable accessibilityRole="button" accessibilityLabel="Open account" onPress={openAccount}
        style={({ pressed }) => [styles.account, pressed && { opacity: 0.7 }]}>
        <Avatar uri={avatar} name={name} size={36} />
      </Pressable>}
    </View>
  </View>;
}

export function Avatar({ uri, name, size }: { uri?: string; name?: string; size: number }) {
  const [failedUri, setFailedUri] = React.useState<string>();
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    {uri?.startsWith('https://') && failedUri !== uri
      ? <Image source={{ uri }} onError={() => setFailedUri(uri)} style={StyleSheet.absoluteFill} />
      : <Text style={styles.initial}>{name?.trim().charAt(0).toUpperCase() || '?'}</Text>}
  </View>;
}

export function StravaAttribution({ onGradient = false }: { onGradient?: boolean }) {
  const source = onGradient
    ? require('../../assets/powered-by-strava.png')
    : require('../../assets/powered-by-strava-black.png');
  return <View style={styles.attribution}>
    <Image accessible accessibilityLabel="Powered by Strava" source={source}
      resizeMode="contain" style={styles.strava} />
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  side: { width: 44 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logo: { width: 26, height: 26, borderRadius: 4 },
  title: { fontSize: 20, fontWeight: '800', color: 'white', flexShrink: 1, textAlign: 'center' },
  account: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  avatar: { backgroundColor: colors.lavender, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.purple, fontWeight: '800', fontSize: 16 },
  attribution: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  strava: { width: 160, aspectRatio: 365 / 37 },
});
