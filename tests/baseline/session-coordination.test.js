import test from 'node:test';
import assert from 'node:assert/strict';
import { backend, memoryStore } from '../helpers/runtime.js';
async function fixture() {
  const { coordinateSessionStore } = await (await backend())('src/utils/session-coordination.js');
  return coordinateSessionStore(memoryStore());
}
const call = (store, method, ...args) => new Promise((resolve,reject)=>store[method](...args,(error,value)=>error?reject(error):resolve(value)));
test('A stale session write cannot overwrite refreshed credentials', async () => {
  const store = await fixture(); const initial = {tokens:{access_token:'old'}};
  await call(store,'set','id',initial);
  const stale = await call(store,'get','id');
  assert.equal(await store.acquireRefresh('id',initial._revision,'owner'),true);
  await store.commitRefresh('id',initial._revision,'owner',{access_token:'new'});
  await assert.rejects(call(store,'set','id',stale), error=>error.code==='SESSION_CONFLICT');
  assert.equal((await call(store,'get','id')).tokens.access_token,'new');
});
test('Two coordinators cannot acquire a refresh lease and logout fences a late refresh', async () => {
  const store = await fixture(); const initial = {tokens:{access_token:'old'}};
  await call(store,'set','id',initial);
  const result = await Promise.all([store.acquireRefresh('id',initial._revision,'a'),store.acquireRefresh('id',initial._revision,'b')]);
  assert.equal(result.filter(Boolean).length,1);
  await call(store,'destroy','id');
  assert.equal(await store.commitRefresh('id',initial._revision,'a',{access_token:'new'}),false);
  await assert.rejects(call(store,'set','id',initial),error=>error.code==='SESSION_CONFLICT');
  assert.equal(await call(store,'get','id'),null);
});
test('Identical refreshed snapshots can finish concurrently without stale writes', async () => {
  const store = await fixture(); const initial = {user:{id:'user'},tokens:{access_token:'old'}};
  await call(store,'set','id',initial);
  await store.acquireRefresh('id',initial._revision,'owner');
  await store.commitRefresh('id',initial._revision,'owner',{access_token:'new'});
  const a = await call(store,'get','id'); const b = await call(store,'get','id');
  await Promise.all([call(store,'set','id',a),call(store,'set','id',b)]);
  assert.equal((await call(store,'get','id')).tokens.access_token,'new');
});
test('Temporary refresh failures release the lease and retain credentials for a later retry',async()=>{
  const store=await fixture();const initial={user:{id:'user'},tokens:{access_token:'old',refresh_token:'refresh',expires_at:0}};
  await call(store,'set','id',initial);
  const {refreshSession}=await (await backend())('src/services/session-refresh.js');
  await assert.rejects(refreshSession(store,'id',async()=>{throw Object.assign(new Error('Unavailable'),{status:503});}),error=>error.status===503);
  assert.equal((await store.refreshState('id')).lease,undefined);
  assert.equal((await call(store,'get','id')).tokens.access_token,'old');
  const current=await refreshSession(store,'id',async()=>({access_token:'new',expires_in:3600}));
  assert.equal(current.tokens.access_token,'new');
});
test('Uncertain refresh timeout invalidates the session rather than replaying its old token',async()=>{
  const store=await fixture();const initial={user:{id:'user'},tokens:{access_token:'old',refresh_token:'refresh',expires_at:0}};
  await call(store,'set','id',initial);
  const {refreshSession}=await (await backend())('src/services/session-refresh.js');
  await assert.rejects(refreshSession(store,'id',async()=>{throw Object.assign(new Error('Timed out'),{status:504});}),error=>error.status===401);
  assert.equal(await call(store,'get','id'),null);
});
test('A request waiting for another owner returns 503 without clearing its session',async()=>{
  const store=await fixture();const initial={user:{id:'user'},tokens:{access_token:'old',refresh_token:'refresh',expires_at:0}};
  await call(store,'set','id',initial);await store.acquireRefresh('id',initial._revision,'owner');
  const {refreshSession}=await (await backend())('src/services/session-refresh.js');
  await assert.rejects(refreshSession(store,'id',async()=>assert.fail('another owner must refresh'),{waitMs:0}),error=>error.status===503);
  assert.equal((await call(store,'get','id')).tokens.access_token,'old');
});
