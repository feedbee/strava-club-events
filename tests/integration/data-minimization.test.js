import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {backend,apiResponse} from '../helpers/runtime.js';
const uri=process.env.TEST_MONGODB_URI;
if(!uri)throw new Error('Set TEST_MONGODB_URI to an isolated MongoDB');

test('MongoDB persists only consumed provider fields and scrubs rich pre-upgrade cache hits',async t=>{
  const dbName='strava_minimization_'+randomUUID().replaceAll('-','');const secret='PRIVATE_PROVIDER_VALUE';
  const club={id:1,name:'Club',sport_type:'cycling',owner:{bio:secret}};
  const event={id:'90071992547409999',title:'Ride',joined:true,upcoming_occurrences:[new Date(Date.now()+86400000).toISOString()],route:{id:'route',name:'Route',map:{polyline:secret}},organizing_athlete:{bio:secret},description:secret};
  const route={id:'route',name:'Route',resource_state:3,distance:12000,athlete:{bio:secret},map:{polyline:secret}};
  let calls=0;
  const load=await backend({env:{CACHE_DRIVER:'mongodb',MONGODB_URI:uri,MONGODB_DB:dbName},modules:{
    'node-fetch':{default:async url=>{calls++;return apiResponse(url.includes('/athlete/clubs')?[club]:url.includes('/routes/')?route:[event]);}}
  }});
  const service=await load('src/services/strava.service.js');const cache=await service.initializeCache();
  t.after(async()=>{await cache.db.dropDatabase();await service.closeCache();});
  const result=await service.getAllUserClubsEvents('token','user');assert.equal(result.events.length,1);assert.equal(calls,3);
  let records=await cache.collection.find({}).toArray();assert.equal(records.length,3);assert.equal(JSON.stringify(records).includes(secret),false);
  await cache.set('user:clubs',[club]);await cache.set('user:club_events:1',[event]);await cache.set('user:route:route',route);
  await cache.set('other:route:route',{...route,name:'Other user'});
  const second=await service.getAllUserClubsEvents('token','user');assert.equal(second.events[0].route_info.name,'Route');assert.equal(calls,3);
  records=await cache.collection.find({userId:'user'}).toArray();assert.equal(JSON.stringify(records).includes(secret),false);
  assert.equal((await cache.get('other:route:route')).name,'Other user');
});
