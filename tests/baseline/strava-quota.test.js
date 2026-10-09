import test from 'node:test';
import assert from 'node:assert/strict';
import {backend,apiResponse,deferred,response,frontend} from '../helpers/runtime.js';
const api='https://www.strava.com/api/v3/athlete/clubs';

test('429 pauses later requests according to Retry-After and then permits recovery',async()=>{
  let calls=0;let now=Date.parse('2026-10-09T12:03:00Z');
  const load=await backend({modules:{'node-fetch':{default:async()=>++calls===1?apiResponse({},429,{'retry-after':'90'}):apiResponse([])}}});
  const {createRateLimiter}=await load('src/services/strava-rate-limits.js');
  const {createStravaClient}=await load('src/services/strava-client.js');
  const request=createStravaClient({rateLimiter:createRateLimiter({now:()=>now})});
  await assert.rejects(request(api),error=>error.status===429&&error.retryAfter===90);
  await assert.rejects(request(api),error=>error.status===429);assert.equal(calls,1);
  now+=91000;await request(api);assert.equal(calls,2);
});
test('Successful response reaching the read limit blocks API until the next quarter but permits OAuth',async()=>{
  let calls=0;const now=Date.parse('2026-10-09T12:03:00Z');
  const load=await backend({modules:{'node-fetch':{default:async()=>{calls++;return apiResponse([],200,{'x-readratelimit-limit':'100,1000','x-readratelimit-usage':'100,100'});}}}});
  const {createRateLimiter}=await load('src/services/strava-rate-limits.js');
  const {createStravaClient}=await load('src/services/strava-client.js');
  const request=createStravaClient({rateLimiter:createRateLimiter({now:()=>now})});
  await request(api);
  await assert.rejects(request(api),error=>error.status===429&&error.retryAfter===720);
  await request('https://www.strava.com/oauth/token',{method:'POST'});assert.equal(calls,2);
});
test('Queued calls do not start after the first response establishes a cooldown',async()=>{
  const gate=deferred();let calls=0;
  const load=await backend({modules:{'node-fetch':{default:async()=>{calls++;await gate.promise;return apiResponse({},429,{'retry-after':'60'});}}}});
  const {createStravaClient}=await load('src/services/strava-client.js');
  const request=createStravaClient({concurrency:1});
  const a=assert.rejects(request(api),error=>error.status===429);
  const b=assert.rejects(request(api),error=>error.status===429);
  gate.resolve();await Promise.all([a,b]);assert.equal(calls,1);
});
test('Complete failure of club event loading produces HTTP 502 instead of an empty success',async()=>{
  const load=await backend({modules:{'node-fetch':{default:async url=>apiResponse(url.includes('/athlete/clubs')?[{id:1,name:'Club'}]:{},url.includes('/athlete/clubs')?200:503)}}});
  const {getEvents}=await load('src/controllers/events.controller.js');const res=response();
  await getEvents({query:{},token:'token',user:{id:'user'}},res);assert.equal(res.statusCode,502);
});
test('A failed route preserves the event and is reported in route failure metadata',async()=>{
  const future=new Date(Date.now()+86400000).toISOString();
  const load=await backend({modules:{'node-fetch':{default:async url=>{
    if(url.includes('/athlete/clubs'))return apiResponse([{id:1,name:'Club'}]);
    if(url.includes('/routes/'))return apiResponse({},503);
    return apiResponse([{id:1,title:'Ride',route:{id:'route',name:'Route'},upcoming_occurrences:[future]}]);
  }}}});
  const {getAllUserClubsEvents}=await load('src/services/strava.service.js');
  const result=await getAllUserClubsEvents('token','user');
  assert.equal(result.events.length,1);assert.equal(result.meta.routes_failed,1);
  assert.equal(result.events[0].route_info.is_full,false);
});
test('Rate-limit UI gives a retry time instead of a generic reload message',async()=>{
  const ui=await frontend({fetch:async()=>apiResponse({error:'Strava rate limit reached',retry_after:120},429)});
  ui.run('calendarInstance = {}');
  await ui.run('loadEvents().catch(handleLoadError)');
  assert.match(ui.element('error-message').textContent,/Strava|limit/i);
  assert.match(ui.element('error-message').textContent,/2 minutes/);
});

test('Daily quota waits until midnight UTC and resets on the next day',async()=>{
  let now=Date.parse('2026-10-09T23:50:00Z');
  const {createRateLimiter}=await (await backend())('src/services/strava-rate-limits.js');
  const limiter=createRateLimiter({now:()=>now});const started=await limiter.before('api');
  await limiter.observe(apiResponse([],200,{'x-ratelimit-limit':'100,1000','x-ratelimit-usage':'1,1000'}),'api',started);
  await assert.rejects(limiter.before('api'),e=>e.status===429&&e.retryAfter===600);
  now+=600000;await limiter.before('api');
});
test('Older responses cannot lower usage or exhaust a newly reset short window',async()=>{
  let now=Date.parse('2026-10-09T12:14:00Z');
  const {createRateLimiter}=await (await backend())('src/services/strava-rate-limits.js');
  const limiter=createRateLimiter({now:()=>now});const started=await limiter.before('api');
  await limiter.observe(apiResponse([],200,{'x-readratelimit-limit':'3,1000','x-readratelimit-usage':'2,2'}),'api',started);
  await limiter.observe(apiResponse([],200,{'x-readratelimit-usage':'1,1'}),'api',started);
  await limiter.before('api');await assert.rejects(limiter.before('api'),e=>e.status===429);
  now=Date.parse('2026-10-09T12:15:00Z');
  await limiter.observe(apiResponse([],200,{'x-readratelimit-usage':'3,3'}),'api',started);
  await limiter.before('api');
});
test('Retry-After HTTP date is accepted; malformed API retry uses the next quarter',async()=>{
  const now=Date.parse('2026-10-09T12:03:00Z');
  const {createRateLimiter}=await (await backend())('src/services/strava-rate-limits.js');
  for(const [header,expected] of [['Fri, 09 Oct 2026 12:05:00 GMT',120],['invalid',720]]) {
    const limiter=createRateLimiter({now:()=>now});const started=await limiter.before('api');
    assert.equal(await limiter.observe(apiResponse({},429,{'retry-after':header}),'api',started),expected);
    await assert.rejects(limiter.before('api'),e=>e.retryAfter===expected);
  }
});
test('Complete quota failure returns HTTP 429 and Retry-After without exposing upstream details',async()=>{
  const load=await backend({modules:{'node-fetch':{default:async url=>url.includes('/athlete/clubs')?apiResponse([{id:1,name:'Club'}]):apiResponse({private:'secret'},429,{'retry-after':'120'})}}});
  const {getEvents}=await load('src/controllers/events.controller.js');const res=response();
  await getEvents({query:{},token:'token',user:{id:'user'}},res);
  assert.equal(res.statusCode,429);assert.equal(res.headers['retry-after'],'120');assert.equal(res.body.retry_after,120);
  assert.equal(JSON.stringify(res.body).includes('secret'),false);
});
test('A successful empty club result remains a successful empty response',async()=>{
  const load=await backend({modules:{'node-fetch':{default:async url=>apiResponse(url.includes('/athlete/clubs')?[{id:1,name:'Club'}]:[])}}});
  const {getEvents}=await load('src/controllers/events.controller.js');const res=response();
  await getEvents({query:{},token:'token',user:{id:'user'}},res);assert.equal(res.statusCode,200);assert.equal(res.body.events.length,0);
});

test('OAuth exchange quota is returned as 429 with a retry time and consumed login state',async()=>{
  const load=await backend({modules:{'node-fetch':{default:async()=>apiResponse({},429,{'retry-after':'60'})}}});
  const {oauthCallback}=await load('src/controllers/auth.controller.js');
  const state='ab'.repeat(32);const req={query:{code:'code',state},session:{oauth:{state,expiresAt:Date.now()+60000},save:done=>done()}};
  const res=response();await oauthCallback(req,res);
  assert.equal(res.statusCode,429);assert.equal(res.headers['retry-after'],'60');assert.equal(req.session.oauth,undefined);
});
