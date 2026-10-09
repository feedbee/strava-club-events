import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {backend} from '../helpers/runtime.js';

for(const name of ['PORT','SESSION_MAX_AGE','SESSION_TTL','CACHE_TTL_DEFAULT','CACHE_TTL_CLUBS','CACHE_TTL_EVENTS','CACHE_TTL_ROUTE']) {
  test(`Configuration validates the complete positive integer ${name}`,async()=>{
    for(const value of ['', '0','-1','1.5','15minutes','1e3',' 15','9007199254740992']) {
      await assert.rejects((await backend({env:{[name]:value}}))('src/config/index.js'),new RegExp(name));
    }
    const {config}=await (await backend({env:{[name]:'123'}}))('src/config/index.js');
    const actual={PORT:config.port,SESSION_MAX_AGE:config.session.maxAge,SESSION_TTL:config.session.ttl,
      CACHE_TTL_DEFAULT:config.cache.ttl.DEFAULT,CACHE_TTL_CLUBS:config.cache.ttl.CLUBS,
      CACHE_TTL_EVENTS:config.cache.ttl.EVENTS,CACHE_TTL_ROUTE:config.cache.ttl.ROUTE};
    assert.equal(actual[name],123);
  });
}
test('Configuration rejects ports outside the TCP range and unsupported cache drivers',async()=>{
  await assert.rejects((await backend({env:{PORT:'65536'}}))('src/config/index.js'),/PORT/);
  for(const CACHE_DRIVER of ['', 'mongo','Memory']) {
    await assert.rejects((await backend({env:{CACHE_DRIVER}}))('src/config/index.js'),/CACHE_DRIVER/);
  }
});
test('Cache CLI rejects process-local memory clearing instead of reporting success',()=>{
  const result=spawnSync(process.execPath,['scripts/drop-cache.js','strava_test'],{env:{...process.env,CACHE_DRIVER:'memory'},encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/memory.*process|process.*memory/i);
  assert.equal(result.stdout.includes('Deleted'),false);
});

test('Readiness follows initialization, dependency failure, recovery and shutdown',async()=>{
  const {createHealth}=await (await backend())('src/services/health.js');
  let available=true;let probes=0;
  const health=createHealth({checks:[async()=>{probes++;if(!available)throw new Error('private database URI');}]});
  assert.equal(await health.ready(),false);assert.equal(probes,0);
  health.start();assert.equal(await health.ready(),true);
  available=false;assert.equal(await health.ready(),false);
  available=true;assert.equal(await health.ready(),true);
  health.stop();assert.equal(await health.ready(),false);
});
test('Concurrent readiness requests share one bounded dependency check',async()=>{
  const {createHealth}=await (await backend())('src/services/health.js');
  let probes=0;let aborted=false;
  const health=createHealth({timeoutMs:15,checks:[({signal})=>{
    probes++;signal.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});
  }]});health.start();
  const results=await Promise.all([health.ready(),health.ready(),health.ready()]);
  assert.equal(results.every(value=>value===false),true);assert.equal(probes,1);assert.equal(aborted,true);
});
test('Shutdown fences a readiness check already in progress',async()=>{
  const {createHealth}=await (await backend())('src/services/health.js');
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const health=createHealth({checks:[()=>gate]});health.start();const pending=health.ready();
  health.stop();release();assert.equal(await pending,false);
});
test('Failed MongoDB cache clearing rejects instead of returning a false zero',async()=>{
  const {default:Cache}=await (await backend())('src/cache/drivers/mongodb-cache.js');
  const cache=new Cache();cache.initialized=true;cache.collection={deleteMany:async()=>{throw new Error('fixture unavailable');}};
  await assert.rejects(cache.clearUserData('user'),/fixture unavailable/);
});

test('Health HTTP endpoints bypass sessions, expose no dependency details and disable caching',async t=>{
  const {default:session}=await import('express-session');let sessionRequests=0;
  const brokenSession=()=>((req,res,next)=>{sessionRequests++;next(new Error('session database password'));});
  brokenSession.MemoryStore=session.MemoryStore;
  const load=await backend({modules:{'express-session':{default:brokenSession}}});
  const {app}=await load('src/app.js');const {health}=await load('src/services/health.js');
  const server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  let ready=await fetch(`${base}/health/ready`);assert.equal(ready.status,503);
  let available=true;health.start([async()=>{if(!available)throw new Error('session database password');}]);
  ready=await fetch(`${base}/health/ready`,{headers:{cookie:'connect.sid=fixture'}});
  assert.equal(ready.status,200);assert.equal(ready.headers.get('cache-control'),'no-store');assert.equal(ready.headers.get('set-cookie'),null);
  available=false;ready=await fetch(`${base}/health/ready`);
  assert.equal(ready.status,503);assert.equal(await ready.text(),'{"status":"not_ready"}');
  const live=await fetch(`${base}/health/live`);assert.equal(live.status,200);assert.equal(await live.text(),'{"status":"alive"}');
  health.stop();assert.equal((await fetch(`${base}/health/ready`)).status,503);assert.equal(sessionRequests,0);
});
