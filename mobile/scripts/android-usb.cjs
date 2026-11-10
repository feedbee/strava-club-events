const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sdkPath, loadLocalEnv } = require('./android-tools.cjs');
const root = path.resolve(__dirname, '..');
try {
  loadLocalEnv(root);
  const adb = path.join(sdkPath(), 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  const adbEnv = { ...process.env };
  for (const key of Object.keys(adbEnv)) {
    if (key.startsWith('ANDROID_UPLOAD_') || key.startsWith('ORG_GRADLE_PROJECT_android.injected.signing.')) delete adbEnv[key];
  }
  function run(args) {
    const result = spawnSync(adb, args, { encoding: 'utf8', env: adbEnv });
    if (result.error || result.status !== 0) throw new Error('ADB failed. Check the USB cable, USB debugging and the device authorization prompt.');
    return result.stdout;
  }
  const devices = run(['devices']).split('\n').map(line => /^(\S+)\s+device$/.exec(line.trim())).filter(Boolean).map(match => match[1]);
  const serial = process.argv[2] || (devices.length === 1 ? devices[0] : null);
  if (!serial || !devices.includes(serial)) throw new Error('Connect one authorized Android device, or use npm run android:usb -- DEVICE_SERIAL.');
  for (const port of [3000, 8081]) run(['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
  console.log('USB forwarding ready: phone ports 3000 (backend) and 8081 (Metro) → Mac.');
  console.log('Set mobile/.env EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 and backend PUBLIC_URL=http://127.0.0.1:3000.');
  console.log('Start Metro with npm run start:usb, then open the development build on your phone.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
