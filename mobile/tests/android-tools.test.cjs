const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { storeEnvironment } = require('../scripts/android-tools.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'club-events-signing-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'upload.p12'), 'synthetic fixture, not a key');
  const env = { ANDROID_UPLOAD_STORE_FILE: 'upload.p12', ANDROID_UPLOAD_STORE_PASSWORD: 'synthetic-password',
    ANDROID_UPLOAD_KEY_ALIAS: 'test', ANDROID_UPLOAD_KEY_PASSWORD: 'synthetic-password', MOBILE_ANDROID_VERSION_CODE: '2' };
  return { root, env };
}
test('Store packaging requires explicit upload credentials and a valid explicit version code', t => {
  const { root, env } = fixture(t);
  assert.throws(() => storeEnvironment({}, root), /Set these values/);
  for (const version of ['0', '2.5', 'NaN', '2100000001']) assert.throws(() => storeEnvironment({ ...env, MOBILE_ANDROID_VERSION_CODE: version }, root), /VERSION_CODE/);
  assert.throws(() => storeEnvironment({ ...env, ANDROID_UPLOAD_STORE_FILE: 'missing' }, root), /does not exist/);
});
test('Store build rejects local HTTP and maps signing credentials into Gradle environment only', t => {
  const { root, env } = fixture(t);
  for (const url of ['http://127.0.0.1:3000', 'https://example.test/path', 'https://user:password@example.test', 'https://example.test?secret=value']) {
    assert.throws(() => storeEnvironment({ ...env, EXPO_PUBLIC_API_URL: url }, root), /HTTPS backend origin/);
  }
  const result = storeEnvironment({ ...env, EXPO_PUBLIC_API_URL: 'https://str.valera.ws' }, root);
  assert.equal(result['ORG_GRADLE_PROJECT_android.injected.signing.store.file'], path.join(root, 'upload.p12'));
  assert.equal(result['ORG_GRADLE_PROJECT_android.injected.signing.store.password'], env.ANDROID_UPLOAD_STORE_PASSWORD);
  assert.equal(result.EXPO_PUBLIC_API_URL, 'https://str.valera.ws');
});
