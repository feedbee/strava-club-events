const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const runner = path.resolve(__dirname, '../../scripts/mobile.cjs');

function run(...args) {
  return spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8' });
}

test('Mobile runner documents the local and store commands', () => {
  const result = run('--help');
  assert.equal(result.status, 0, result.stderr);
  for (const command of ['backend', 'run ios simulator', 'run android device', 'build ios', 'upload android']) {
    assert.ok(result.stdout.includes(command));
  }
});

test('Android upload shows the manual internal testing instructions', () => {
  const result = run('upload', 'android');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Internal testing/);
  assert.match(result.stdout, /app-release\.aab/);
});

test('Invalid target and invalid build number fail before launching platform tools', () => {
  const target = run('run', 'android', 'simulator');
  assert.equal(target.status, 1);
  assert.match(target.stderr, /Invalid command or target/);
  const build = run('build', 'ios', '--build-number', '0');
  assert.equal(build.status, 1);
  assert.match(build.stderr, /MOBILE_IOS_BUILD_NUMBER/);
});

test('Android store builds persist and increment numbers and pin the hosted backend', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-runner-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const bin = path.join(fixture, 'bin');
  const scripts = path.join(fixture, 'scripts');
  const mobileScripts = path.join(fixture, 'mobile', 'scripts');
  for (const dir of [bin, scripts, mobileScripts]) fs.mkdirSync(dir, { recursive: true });
  const isolatedRunner = path.join(scripts, 'mobile.cjs');
  fs.copyFileSync(runner, isolatedRunner);
  fs.copyFileSync(path.resolve(__dirname, '../scripts/android-tools.cjs'), path.join(mobileScripts, 'android-tools.cjs'));
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh
printf '%s\\n' "$*" "$EXPO_PUBLIC_API_URL" "$MOBILE_ANDROID_VERSION_CODE" "$NODE_ENV"
`, { mode: 0o700 });
  for (const [args, expected] of [[[], '2'], [[], '3'], [['--build-number', '42'], '42'], [[], '43']]) {
    const result = spawnSync(process.execPath, [isolatedRunner, 'build', 'android', ...args], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3000', MOBILE_ANDROID_VERSION_CODE: '1' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split('\n').slice(1), [
      'run build:android:store', 'https://str.valera.ws', expected, 'production',
    ]);
  }
});
