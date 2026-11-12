const { version } = require('../package.json');
// Expo's Release/export commands load this config in production mode. Fail the build
// before a local HTTP address can become a crashing TestFlight/Play installation.
if (process.env.NODE_ENV === 'production') {
  const url = new URL(process.env.EXPO_PUBLIC_API_URL || 'https://str.valera.ws');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Release builds require an HTTPS backend origin in EXPO_PUBLIC_API_URL.');
  }
}
function buildNumber(name, maximum) {
  const value = process.env[name];
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) {
    throw new Error(`${name} must be a positive build number no greater than ${maximum}.`);
  }
  return value;
}
const iosBuild = buildNumber('MOBILE_IOS_BUILD_NUMBER', Number.MAX_SAFE_INTEGER);
const androidBuild = buildNumber('MOBILE_ANDROID_VERSION_CODE', 2100000000);
const manrope = './assets/fonts/Manrope.ttf';
module.exports = {
  expo: {
    name: 'Strava Club Events', slug: 'strava-club-events', version,
    scheme: 'stravaclubevents', orientation: 'portrait', userInterfaceStyle: 'light', icon: './assets/icon.png',
    ios: {
      bundleIdentifier: 'ws.valera.sportclubevents', supportsTablet: false,
      ...(iosBuild ? { buildNumber: iosBuild } : {}),
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocalNetworkUsageDescription: 'Connect to the development server on your Mac.',
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      },
    },
    android: {
      package: 'ws.valera.sportclubevents',
      icon: './assets/icon-android-legacy.png',
      adaptiveIcon: {
        foregroundImage: './assets/icon-android-foreground.png',
        backgroundColor: '#EF4813',
      },
      ...(androidBuild ? { versionCode: Number(androidBuild) } : {}),
      blockedPermissions: ['android.permission.READ_CALENDAR', 'android.permission.WRITE_CALENDAR',
        'android.permission.READ_CONTACTS', 'android.permission.RECORD_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW'],
    },
    plugins: ['expo-dev-client', 'expo-web-browser', ['expo-build-properties', { ios: { deploymentTarget: '17.0' } }], ['expo-secure-store', { faceIDPermission: false }],
      ['expo-font', {
        ios: { fonts: [manrope] },
        android: { fonts: [{
          fontFamily: 'Manrope',
          path: manrope,
          fontDefinitions: [400, 500, 600, 700, 800].map(weight => ({ weight })),
        }] },
      }],
      ['expo-calendar', { writeOnlyAccess: true, remindersPermission: false,
        calendarPermission: 'Add club events you choose to your calendar using the iOS calendar editor.',
        writeOnlyCalendarPermission: 'Add club events you choose to your calendar using the iOS calendar editor.' }]],
  },
};
