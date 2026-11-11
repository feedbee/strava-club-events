#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { parseArgs, parseEnv } = require('node:util');
const { createInterface } = require('node:readline/promises');
const { setTimeout: delay } = require('node:timers/promises');
const { sdkPath, loadLocalEnv } = require('../mobile/scripts/android-tools.cjs');

const root = path.resolve(__dirname, '..');
const mobile = path.join(root, 'mobile');
const hosted = 'https://str.valera.ws';

const help = `Usage: npm run mobile -- <command>

  backend                          Build web assets and run the local API in watch mode.
  run ios simulator [device]       Install and run a debug build on an iOS simulator.
  run ios device [device]          Install over USB and use the Mac's LAN for API and Metro.
  run android emulator [serial]    Run on a booted emulator using ADB port forwarding.
  run android device [serial]      Run on an authorized USB device using ADB port forwarding.
  build ios                        Export a signed TestFlight IPA.
  build android                    Build a signed Google Play AAB.
  upload ios <file.ipa>            Upload to App Store Connect for TestFlight.
  upload android                  Show the manual Google Play Internal testing steps.

Local runs reuse or start the API (default port 4317). Build numbers increment automatically.
All store builds use ${hosted}.
See docs/mobile-distribution.md for .env, LAN and signing setup.
`;

function run(command, args, { cwd = mobile, env = process.env, capture = false } = {}) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
  if (result.error) throw new Error(`Could not start ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} failed (${result.signal || result.status}).`);
  return result.stdout;
}

function expo(args, env) {
  run(process.execPath, [require.resolve('expo/bin/cli', { paths: [mobile] }), ...args], { env });
}

function devEnvironment(url) {
  return { ...process.env, NODE_ENV: 'development', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_URL: url };
}

function androidTarget(target, requested, apiPort) {
  const adb = path.join(sdkPath(), 'platform-tools', 'adb');
  const devices = run(adb, ['devices', '-l'], { capture: true }).split(/\r?\n/)
    .map(line => /^(\S+)\s+device\b(.*)$/.exec(line))
    .filter(Boolean)
    .filter(([, serial, details]) => target === 'emulator' ? serial.startsWith('emulator-') : /\busb:/.test(details))
    .map(([, serial]) => serial);
  const serial = requested || (devices.length === 1 ? devices[0] : undefined);
  if (!devices.includes(serial)) {
    throw new Error(`Select one authorized Android ${target} by serial. Available: ${devices.join(', ') || 'none'}.`);
  }
  for (const port of [apiPort, 8081]) run(adb, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
  return serial;
}

function localPort() {
  const port = Number(process.env.MOBILE_LOCAL_API_PORT ?? 4317);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 8081) {
    throw new Error('Set MOBILE_LOCAL_API_PORT in mobile/.env to a port between 1024 and 65535 other than 8081.');
  }
  return port;
}

function backendEnvironment(port, origin) {
  const file = path.join(root, '.env');
  const local = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
  const lan = origin.startsWith('http:') && new URL(origin).hostname !== '127.0.0.1';
  return { ...local, ...process.env, NODE_ENV: 'development', PORT: String(port),
    HOST: lan ? '0.0.0.0' : '127.0.0.1', PUBLIC_URL: origin,
    SESSION_SECURE_COOKIE: String(origin.startsWith('https:')) };
}

async function probeBackend(port, origin) {
  let response;
  try {
    response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
      signal: AbortSignal.timeout(2200), redirect: 'manual',
    });
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return 'missing';
    throw new Error(`Could not verify the backend on port ${port}. Check which service is listening there.`);
  }
  const actual = response.headers.get('x-club-events-local-origin');
  await response.body?.cancel();
  if (!actual) throw new Error(`Port ${port} is occupied. Set MOBILE_LOCAL_API_PORT in mobile/.env or free the port.`);
  if (actual !== origin) throw new Error(`The backend on port ${port} has a different PUBLIC_URL. Stop it and rerun this command for the selected target.`);
  return response.ok ? 'ready' : 'starting';
}

async function waitForBackend(port, origin, child) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (child && (child.exitCode !== null || child.signalCode)) break;
    if (await probeBackend(port, origin) === 'ready') return;
    await delay(500);
  }
  throw new Error(`The local backend on port ${port} did not become ready. Check its startup output.`);
}

async function ensureBackend(port, origin) {
  const status = await probeBackend(port, origin);
  if (status !== 'missing') {
    if (status !== 'ready') await waitForBackend(port, origin);
    console.log(`Reusing the local backend on port ${port}.`);
    return;
  }
  if (process.stdin.isTTY && process.stdout.isTTY) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await prompt.question(`Start the local backend on port ${port}? [Y/n] `);
      if (answer.trim() && !/^y(es)?$/i.test(answer.trim())) throw new Error('Start the backend and rerun the mobile command.');
    } finally {
      prompt.close();
    }
  }
  const env = backendEnvironment(port, origin);
  run('npm', ['run', 'build'], { cwd: root, env });
  const child = spawn(process.execPath, ['src/server.js'], { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit'] });
  try {
    await waitForBackend(port, origin, child);
    return child;
  } catch (error) {
    child.kill();
    throw error;
  }
}

async function runLocal(platform, target, requested) {
  const lan = platform === 'ios' && target === 'device';
  const port = localPort();
  let origin = `http://127.0.0.1:${port}`;
  if (lan) {
    const raw = process.env.MOBILE_IOS_DEVICE_API_URL;
    if (!raw) throw new Error('Set MOBILE_IOS_DEVICE_API_URL in mobile/.env to the Mac LAN origin or an HTTPS tunnel to the local backend.');
    const url = new URL(raw);
    if (url.protocol === 'http:' && !url.port) url.port = String(port);
    const privateIp = /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))(\.\d{1,3})+$/.test(url.hostname);
    const localOrigin = (url.protocol === 'http:' && privateIp && Number(url.port) === port) ||
      (url.protocol === 'https:' && url.hostname !== new URL(hosted).hostname);
    if (!localOrigin ||
        url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Use a private IPv4 HTTP origin or an HTTPS tunnel to the local backend.');
    }
    origin = url.origin;
  }
  const env = devEnvironment(origin);
  const child = await ensureBackend(port, origin);
  try {
    const device = platform === 'android' ? androidTarget(target, requested, port) : requested;
    console.log(`Local API: ${origin}`);
    if (platform === 'android') expo(['prebuild', '--platform', 'android', '--no-install'], env);
    if (platform === 'ios' && target === 'simulator') run('open', ['-a', 'Simulator']);
    expo([`run:${platform}`, '--no-bundler',
      ...(device || target === 'device' ? ['--device', ...(device ? [device] : [])] : [])], env);
    expo(['start', '--dev-client', lan ? '--lan' : '--localhost', '--port', '8081',
      ...(platform === 'ios' && target === 'simulator' && !device ? ['--ios'] : [])], env);
  } finally {
    child?.kill();
  }
}

function reserveBuildNumber(platform, configured, numberKey) {
  const maximum = platform === 'android' ? 2100000000 : Number.MAX_SAFE_INTEGER;
  if (configured !== undefined &&
      (!/^[1-9]\d*$/.test(configured) || !Number.isSafeInteger(Number(configured)) || Number(configured) > maximum)) {
    throw new Error(`Invalid ${numberKey}: expected a positive build number up to ${maximum}.`);
  }
  const state = path.join(mobile, '.local', 'build-numbers', platform);
  fs.mkdirSync(state, { recursive: true, mode: 0o700 });
  const previous = platform === 'ios' ? path.join(mobile, 'artifacts', 'ios') : state;
  const numbers = [...fs.readdirSync(state), ...(fs.existsSync(previous) ? fs.readdirSync(previous) : [])]
    .filter(name => /^[1-9]\d*$/.test(name)).map(Number);
  // Android build 1 was generated before the runner tracked build numbers.
  let build = Math.max(platform === 'android' ? 1 : 0, ...numbers) + 1;
  if (configured !== undefined) build = Math.max(build, Number(configured));
  for (; build <= maximum; build++) {
    try {
      fs.mkdirSync(path.join(state, String(build)), { mode: 0o700 });
      return build;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error(`No ${platform} build numbers remain.`);
}

function buildStore(platform, number) {
  const env = { ...process.env, NODE_ENV: 'production', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_URL: hosted };
  const numberKey = platform === 'ios' ? 'MOBILE_IOS_BUILD_NUMBER' : 'MOBILE_ANDROID_VERSION_CODE';
  const build = reserveBuildNumber(platform, number ?? env[numberKey], numberKey);
  env[numberKey] = String(build);
  console.log(`Building ${platform} #${build}.`);
  if (platform === 'android') {
    run('npm', ['run', 'build:android:store'], { env });
    return;
  }
  const team = env.MOBILE_IOS_TEAM_ID;
  if (!/^[A-Z0-9]{10}$/.test(team || '')) throw new Error('Set MOBILE_IOS_TEAM_ID in mobile/.env to your Apple Team ID.');
  const output = path.join(mobile, 'artifacts', 'ios', String(build));
  if (fs.existsSync(output)) throw new Error(`Build directory already exists: ${output}. Move it aside or choose a new build number.`);
  expo(['prebuild', '--platform', 'ios'], env);
  const workspaces = fs.readdirSync(path.join(mobile, 'ios')).filter(name => name.endsWith('.xcworkspace'));
  if (workspaces.length !== 1) throw new Error('Expected one Expo-generated iOS workspace in mobile/ios.');
  const workspace = path.join('ios', workspaces[0]);
  const scheme = path.basename(workspace, '.xcworkspace');
  fs.mkdirSync(output, { recursive: true });
  const archive = path.join(output, `${scheme}.xcarchive`);
  const exportDir = path.join(output, 'export');
  const options = path.join(output, 'ExportOptions.plist');
  fs.writeFileSync(options, `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>signingStyle</key><string>automatic</string>
<key>teamID</key><string>${team}</string>
<key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
`);
  run('xcodebuild', ['-workspace', workspace, '-scheme', scheme, '-configuration', 'Release',
    '-destination', 'generic/platform=iOS', '-archivePath', archive, '-allowProvisioningUpdates',
    `DEVELOPMENT_TEAM=${team}`, 'CODE_SIGN_STYLE=Automatic', 'archive'], { env });
  run('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportPath', exportDir,
    '-exportOptionsPlist', options, '-allowProvisioningUpdates'], { env });
  console.log(`TestFlight IPA directory: ${exportDir}`);
}

function uploadIos(input) {
  const file = path.resolve(root, input);
  if (path.extname(file) !== '.ipa' || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
    throw new Error('Pass the path to an existing store .ipa from the repository root.');
  }
  const { APP_STORE_CONNECT_KEY_ID: key, APP_STORE_CONNECT_ISSUER_ID: issuer } = process.env;
  if (!key || !issuer) throw new Error('Set APP_STORE_CONNECT_KEY_ID and APP_STORE_CONNECT_ISSUER_ID in mobile/.env.');
  run('xcrun', ['altool', '--upload-app', '--type', 'ios', '--file', file, '--apiKey', key, '--apiIssuer', issuer]);
}

async function main(args) {
  if (!args.length || args.includes('--help') || args.includes('-h') || args[0] === 'help') {
    console.log(help);
    return;
  }
  const { positionals: [command, platform, target, device, ...extra], values } = parseArgs({
    args, allowPositionals: true, options: { 'build-number': { type: 'string' } },
  });
  const buildNumber = values['build-number'];
  if (extra.length || (buildNumber !== undefined && command !== 'build')) throw new Error('Invalid arguments. See --help.');
  if (command === 'backend' && !platform) {
    loadLocalEnv(mobile);
    const port = localPort();
    const origin = `http://127.0.0.1:${port}`;
    const env = backendEnvironment(port, origin);
    run('npm', ['run', 'build'], { cwd: root, env });
    run('npm', ['run', 'dev'], { cwd: root, env });
    return;
  }
  if (command === 'upload' && platform === 'android' && !target) {
    console.log('Manual upload: Google Play Console → Testing → Internal testing → Create new release.');
    console.log('Bundle: mobile/android/app/build/outputs/bundle/release/app-release.aab');
    return;
  }
  if (!['ios', 'android'].includes(platform)) throw new Error('Choose ios or android. See --help.');
  loadLocalEnv(mobile);
  if (command === 'run' && (target === 'device' || target === (platform === 'ios' ? 'simulator' : 'emulator'))) {
    await runLocal(platform, target, device);
  } else if (command === 'build' && !target) {
    buildStore(platform, buildNumber);
  } else if (command === 'upload' && platform === 'ios' && target && !device) {
    uploadIos(target);
  } else {
    throw new Error('Invalid command or target. See --help.');
  }
}

main(process.argv.slice(2)).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
