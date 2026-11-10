const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const file = path.resolve(__dirname, '../app.config.js');
function config(env) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { require: createRequire(file), module, process: { env }, URL });
  return module.exports.expo;
}
test('Release configuration rejects accidental local HTTP before generating a store bundle', () => {
  assert.throws(() => config({ NODE_ENV: 'production', EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3000' }), /HTTPS backend origin/);
  assert.doesNotThrow(() => config({ NODE_ENV: 'development', EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3000' }));
  assert.doesNotThrow(() => config({ NODE_ENV: 'production', EXPO_PUBLIC_API_URL: 'https://str.valera.ws' }));
});
