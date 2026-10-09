import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createCipheriv,randomBytes } from 'node:crypto';
import { fork } from 'node:child_process';
import { MongoClient } from 'mongodb';
import MongoStore from 'connect-mongo';
import { coordinateSessionStore } from '../../src/utils/session-coordination.js';
import { refreshSession } from '../../src/services/session-refresh.js';
import { backend,deferred } from '../helpers/runtime.js';
const uri=process.env.TEST_MONGODB_URI;
if(!uri) throw new Error('Set TEST_MONGODB_URI to an isolated MongoDB');
const key='ab'.repeat(32);
const call=(store,method,...args)=>new Promise((resolve,reject)=>store[method](...args,(error,value)=>error?reject(error):resolve(value)));
async function fixture(t) {
  const dbName='strava_refresh_'+randomUUID().replaceAll('-','');
  const client=new MongoClient(uri);await client.connect();
  const {encryptSessionStore}=await (await backend({env:{ENCRYPTION_KEY:key}}))('src/utils/encryption.util.js');
  const store=encryptSessionStore(coordinateSessionStore(MongoStore.create({mongoUrl:uri,dbName,stringify:false,ttl:86400})));
  t.after(async()=>{await store.close();await client.db(dbName).dropDatabase();await client.close();});
  await store.collectionP;
  const initial={cookie:{expires:new Date(Date.now()+60000)},user:{id:'strava_1'},tokens:{access_token:'old',refresh_token:'old-refresh',expires_at:0}};
  await call(store,'set','session',initial);
  return {store,client,dbName,initial,collection:client.db(dbName).collection('sessions')};
}

test('Two independent Node processes perform one shared MongoDB refresh', {timeout:20000}, async t=>{
  const {store,dbName,collection}=await fixture(t);
  const workers=[];let started=0;let exchanges=0;let exchangingWorker;
  const results=[];const ready=[];
  for(let i=0;i<2;i++) {
    const readyGate=deferred();ready.push(readyGate.promise);
    let doneResolve,doneReject;
    results.push(new Promise((resolve,reject)=>{doneResolve=resolve;doneReject=reject;}));
    const worker=fork(new URL('../helpers/refresh-worker.mjs',import.meta.url),[],{
      env:{...process.env,CLIENT_ID:'test',CLIENT_SECRET:'test',NODE_ENV:'test',ENCRYPTION_KEY:key,
        TEST_MONGODB_URI:uri,MONGODB_DB:dbName},stdio:['ignore','ignore','inherit','ipc']});
    workers.push(worker);
    worker.on('error',doneReject);
    worker.on('message',message=>{
      if(message.type==='ready')readyGate.resolve();
      if(message.type==='started')started++;
      if(message.type==='exchange'){exchanges++;exchangingWorker=worker;}
      if(started===2&&exchangingWorker){exchangingWorker.send({type:'release'});exchangingWorker=null;}
      if(message.type==='done')doneResolve(message.valid);
      if(message.type==='failed')doneReject(new Error(message.message));
    });
  }
  t.after(()=>{for(const worker of workers)worker.kill();});
  await Promise.all(ready);for(const worker of workers)worker.send({type:'start',id:'session'});
  assert.deepEqual(await Promise.all(results),[true,true]);assert.equal(exchanges,1);
  assert.equal((await call(store,'get','session')).tokens.refresh_token,'rotated-refresh');
  const saved=await collection.findOne({_id:'session'});
  assert.match(saved.session.tokens.access_token,/^:encrypted::v2:/);assert.equal(saved.refreshLease,undefined);
});
test('MongoDB logout during an exchange prevents resurrection and stale writes',async t=>{
  const {store,initial}=await fixture(t);const gate=deferred();const entered=deferred();
  const task=refreshSession(store,'session',async()=>{entered.resolve();await gate.promise;return {access_token:'new',expires_in:3600};});
  await entered.promise;await call(store,'destroy','session');gate.resolve();
  await assert.rejects(task,error=>error.status===401);
  await assert.rejects(call(store,'set','session',initial),error=>error.code==='SESSION_CONFLICT');
  assert.equal(await call(store,'get','session'),null);
});
test('An abandoned MongoDB refresh lease invalidates the session without replaying its token',async t=>{
  const {store,initial}=await fixture(t);
  await store.acquireRefresh('session',initial._revision,'dead-owner',-1);
  let calls=0;
  await assert.rejects(refreshSession(store,'session',async()=>{calls++;}),error=>error.status===401);
  assert.equal(calls,0);assert.equal(await call(store,'get','session'),null);
});
test('A real legacy MongoDB CBC session migrates with the unchanged key',async t=>{
  const {store,collection}=await fixture(t);
  function legacy(text){const iv=randomBytes(16);const cipher=createCipheriv('aes-256-cbc',Buffer.from(key,'hex'),iv);
    return ':encrypted::'+iv.toString('hex')+':'+Buffer.concat([cipher.update(text),cipher.final()]).toString('hex');}
  await collection.updateOne({_id:'session'},{$set:{'session.tokens.access_token':legacy('legacy-access'),'session.tokens.refresh_token':legacy('legacy-refresh')},$unset:{'session._revision':''}});
  const current=await call(store,'get','session');assert.equal(current.tokens.access_token,'legacy-access');
  await call(store,'set','session',current);
  assert.match((await collection.findOne({_id:'session'})).session.tokens.access_token,/^:encrypted::v2:/);
});
test('Two Express instances share refreshed credentials; HTTP logout cancels a pending refresh', {timeout:20000}, async t=>{
  const {dbName,collection}=await fixture(t);
  const stores=[];const listeners=[];let calls=0;let gate=deferred();let entered=deferred();
  t.after(async()=>{
    for(const listener of listeners)await new Promise(resolve=>{listener.close(resolve);listener.closeAllConnections();});
    for(const store of stores)await store.close();
  });
  async function instance(){
    const load=await backend({env:{SESSION_DRIVER:'mongodb',MONGODB_URI:uri,MONGODB_DB:dbName,ENCRYPTION_KEY:key,SESSION_SECRET:'s'.repeat(64)},modules:{
      'connect-mongo':{default:{create(options){const store=MongoStore.create(options);stores.push(store);return store;}}},
      'node-fetch':{default:async(url,options)=>{
        if(!url.includes('/oauth/token'))return {ok:true,text:async()=> '[]'};
        const body=JSON.parse(options.body);
        if(body.grant_type==='refresh_token'){calls++;entered.resolve();await gate.promise;}
        return {ok:true,text:async()=>JSON.stringify({access_token:body.grant_type==='refresh_token'?'http-new':'http-old',refresh_token:'http-refresh',expires_in:3600,athlete:{id:1}})};
      }}
    }});
    const {app}=await load('src/app.js');const {default:routes}=await load('src/routes/index.js');app.use(routes);
    const listener=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});listeners.push(listener);
    return `http://127.0.0.1:${listener.address().port}`;
  }
  const a=await instance();const b=await instance();
  const login=await fetch(`${a}/login`,{redirect:'manual'});const cookie=login.headers.get('set-cookie').split(';')[0];
  const state=new URL(login.headers.get('location')).searchParams.get('state');
  const callback=await fetch(`${a}/callback?code=test&state=${state}`,{redirect:'manual',headers:{cookie}});
  const authenticated=callback.headers.get('set-cookie').split(';')[0];
  const profile=await fetch(`${a}/me`,{headers:{cookie:authenticated}});const {csrfToken}=await profile.json();
  const document=await collection.findOne({_id:{$ne:'session'}});
  await collection.updateOne({_id:document._id},{$set:{'session.tokens.expires_at':0}});
  const requests=Promise.all([fetch(`${a}/events`,{headers:{cookie:authenticated}}),fetch(`${b}/events`,{headers:{cookie:authenticated}})]);
  await entered.promise;gate.resolve();
  assert.deepEqual((await requests).map(response=>response.status),[200,200]);assert.equal(calls,1);
  gate=deferred();entered=deferred();
  await collection.updateOne({_id:document._id},{$set:{'session.tokens.expires_at':0}});
  const pending=fetch(`${b}/events`,{headers:{cookie:authenticated}});await entered.promise;
  const logout=await fetch(`${a}/logout`,{method:'POST',redirect:'manual',headers:{cookie:authenticated,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken})});
  assert.equal(logout.status,303);gate.resolve();assert.equal((await pending).status,401);
  assert.equal(await collection.findOne({_id:document._id}),null);
});
