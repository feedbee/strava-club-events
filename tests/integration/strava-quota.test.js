import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MongoClient} from 'mongodb';
import {backend,apiResponse} from '../helpers/runtime.js';
const uri=process.env.TEST_MONGODB_URI;
if(!uri)throw new Error('Set TEST_MONGODB_URI to an isolated MongoDB');

test('Independent MongoDB connections share reservations, cooldown and reset',async t=>{
  const dbName='strava_quota_'+randomUUID().replaceAll('-','');
  const clients=[new MongoClient(uri),new MongoClient(uri)];await Promise.all(clients.map(c=>c.connect()));
  t.after(async()=>{await clients[0].db(dbName).dropDatabase();await Promise.all(clients.map(c=>c.close()));});
  const {createRateLimiter,mongoQuotaStore}=await (await backend())('src/services/strava-rate-limits.js');
  const stores=clients.map(c=>mongoQuotaStore(c.db(dbName).collection('quotas'),'shared-app'));
  await Promise.all(stores.map(s=>s.init()));
  let now=Date.parse('2026-10-09T12:03:00Z');
  const limiters=stores.map(store=>createRateLimiter({store,now:()=>now}));
  const started=await limiters[0].before('api');
  await limiters[0].observe(apiResponse([],200,{'x-readratelimit-limit':'3,1000','x-readratelimit-usage':'1,1'}),'api',started);
  const results=await Promise.allSettled(Array.from({length:8},(_,i)=>limiters[i%2].before('api')));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
  assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===429).length,6);
  await limiters[1].observe(apiResponse({},429,{'retry-after':'900'}),'api',started);
  await assert.rejects(limiters[0].before('api'),e=>e.status===429&&e.retryAfter===900);
  await limiters[0].before('oauth');
  now+=901000;await limiters[1].before('api');
  await limiters[1].observe(apiResponse({},429,{'retry-after':'60'}),'oauth',now);
  await assert.rejects(limiters[0].before('oauth'),e=>e.status===429&&e.retryAfter===60);
});
