const { version } = require('../package.json');
module.exports = {
  expo: {
    name: 'Club Events', slug: 'strava-club-events', version,
    scheme: 'stravaclubevents', orientation: 'portrait', userInterfaceStyle: 'light', icon: './assets/icon.png',
    ios: {
      bundleIdentifier: 'ws.valera.clubevents', supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocalNetworkUsageDescription: 'Connect to the development server on your Mac.',
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      },
    },
    android: {
      package: 'ws.valera.clubevents',
      blockedPermissions: ['android.permission.READ_CALENDAR', 'android.permission.WRITE_CALENDAR',
        'android.permission.READ_CONTACTS', 'android.permission.RECORD_AUDIO'],
    },
    plugins: ['expo-dev-client', 'expo-web-browser', ['expo-build-properties', { ios: { deploymentTarget: '17.0' } }], ['expo-secure-store', { faceIDPermission: false }],
      ['expo-calendar', { writeOnlyAccess: true, remindersPermission: false,
        calendarPermission: false, writeOnlyCalendarPermission: 'Add a club event using the calendar editor.' }]],
  },
};
