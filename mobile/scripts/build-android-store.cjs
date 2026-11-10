const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sdkPath, storeEnvironment, loadLocalEnv } = require('./android-tools.cjs');
const root = path.resolve(__dirname, '..');
function run(command, args, cwd, env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Android build failed. Check the build output above.');
}
try {
  loadLocalEnv(root);
  const env = storeEnvironment(process.env, root);
  env.ANDROID_HOME = sdkPath(env);
  env.EXPO_NO_DOTENV = '1';
  // Expo's public-variable inlining receives only public settings; signing is Gradle-only.
  const prebuildEnv = { ...env };
  for (const key of Object.keys(prebuildEnv)) {
    if (key.startsWith('ORG_GRADLE_PROJECT_android.injected.signing.') || key.startsWith('ANDROID_UPLOAD_')) delete prebuildEnv[key];
  }
  run(process.execPath, [require.resolve('expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install'], root, prebuildEnv);
  run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [':app:bundleRelease', ':app:assembleRelease', '--no-daemon', '--console=plain'], path.join(root, 'android'), env);
  console.log('Signed Android bundle: mobile/android/app/build/outputs/bundle/release/app-release.aab');
  console.log('Upload this AAB to Google Play Console → Internal testing.');
  console.log('Matching direct-install APK: mobile/android/app/build/outputs/apk/release/app-release.apk');
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
