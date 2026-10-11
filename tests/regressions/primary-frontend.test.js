import test from 'node:test';
import assert from 'node:assert/strict';
import { backend } from '../helpers/runtime.js';

test('root serves React, old next links redirect with query, and legacy entry is gone', async () => {
  const load = await backend();
  const { app } = await load('src/app.js');
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const root = await fetch(base + '/');
    assert.equal(root.status, 200);
    const html = await root.text();
    assert.match(html, /id="root"/);
    assert.doesNotMatch(html, /fullcalendar|index\.js/);
    const old = await fetch(base + '/next/?mock=1', { redirect: 'manual' });
    assert.equal(old.status, 308);
    assert.equal(old.headers.get('location'), '/?mock=1');
    assert.equal((await fetch(base + '/index.js')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
