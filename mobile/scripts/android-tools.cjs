const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
function sdkPath(env = process.env) {
  const candidates = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT,
    process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Android/sdk') : path.join(os.homedir(), 'Android/Sdk')];
  const sdk = candidates.find(value => value && fs.existsSync(path.join(value, 'platform-tools')));
  if (!sdk) throw new Error('Android SDK not found. Install it in Android Studio or set ANDROID_HOME in mobile/.env.');
  return sdk;
}
function storeEnvironment(env, root) {
  if (!/^[1-9]\d*$/.test(env.MOBILE_ANDROID_VERSION_CODE) || Number(env.MOBILE_ANDROID_VERSION_CODE) > 2100000000) throw new Error('Set MOBILE_ANDROID_VERSION_CODE in mobile/.env to an integer from 1 to 2100000000.');
  let url;
  try { url = new URL(env.EXPO_PUBLIC_API_URL || 'https://str.valera.ws'); } catch { throw new Error('Invalid EXPO_PUBLIC_API_URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Store builds require an HTTPS backend origin in EXPO_PUBLIC_API_URL.');
  const configPath = path.join(root, '.local', 'android.json');
  let signing = {
    storeFile: env.ANDROID_UPLOAD_STORE_FILE,
    storePassword: env.ANDROID_UPLOAD_STORE_PASSWORD,
    keyAlias: env.ANDROID_UPLOAD_KEY_ALIAS,
    keyPassword: env.ANDROID_UPLOAD_KEY_PASSWORD,
  };
  let signingDir = root;
  if (fs.existsSync(configPath)) {
    try { signing = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {
      throw new Error('Could not read mobile/.local/android.json.');
    }
    signingDir = path.dirname(configPath);
  }
  if (typeof signing?.storeFile !== 'string' || !signing.storeFile ||
      typeof signing.keyAlias !== 'string' || !signing.keyAlias ||
      typeof signing.storePassword !== 'string' || typeof signing.keyPassword !== 'string') {
    throw new Error('Set storeFile, storePassword, keyAlias and keyPassword in mobile/.local/android.json.');
  }
  const file = path.resolve(signingDir, signing.storeFile);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('The configured Android upload keystore does not exist.');
  const result = { ...env };
  for (const [suffix, value] of Object.entries({ 'store.file': file, 'store.password': signing.storePassword,
    'key.alias': signing.keyAlias, 'key.password': signing.keyPassword })) {
    result[`ORG_GRADLE_PROJECT_android.injected.signing.${suffix}`] = value;
  }
  return result;
}
function loadLocalEnv(root) {
  const file = path.join(root, '.env');
  if (fs.existsSync(file)) {
    try { process.loadEnvFile(file); } catch { throw new Error('Could not load mobile/.env.'); }
  }
}
module.exports = { sdkPath, storeEnvironment, loadLocalEnv };
