import test from 'node:test';
import assert from 'node:assert/strict';
import {backend,apiResponse} from '../helpers/runtime.js';
const future=new Date(Date.now()+86400000).toISOString();
const secret='PRIVATE_PROVIDER_VALUE';
const club={id:1,name:'Club',sport_type:'cycling',localized_sport_type:'Cycling',profile_medium:'https://example.com/club.png',owner:{bio:secret},city:secret};
const event={id:'90071992547409999',title:'Ride',joined:true,address:'Meeting point',terrain:1,skill_levels:1,activity_type:'Ride',upcoming_occurrences:[future],route:{id:'route',name:'Basic',map:{polyline:secret}},organizing_athlete:{bio:secret,weight:80},description:secret,start_latlng:[12,34],viewer_permissions:{edit:true},future_field:secret};
const route={id:'route',name:'Route',resource_state:3,distance:12345,elevation_gain:300,type:1,sub_type:1,estimated_moving_time:3600,maximum_grade:4,elevation_high:500,elevation_low:100,athlete:{bio:secret},map:{polyline:secret},segments:[{name:secret}]};
async function fixture() {
  const load=await backend({modules:{'node-fetch':{default:async url=>apiResponse(url.includes('/athlete/clubs')?[club]:url.includes('/routes/')?route:[event])}}});
  const service=await load('src/services/strava.service.js');const cache=await service.initializeCache();
  return {load,service,cache};
}
test('Explicit event DTO and all provider cache entries exclude unused personal data',async()=>{
  const {service,cache}=await fixture();const result=await service.getAllUserClubsEvents('token','user');
  assert.equal(result.events.length,1);const shown=result.events[0];
  assert.equal(shown.title,'Ride');assert.equal(shown.joined,true);assert.equal(shown.address,'Meeting point');
  assert.equal(shown.id,event.id);assert.equal(shown.route_info.distance,'12.3 km');assert.match(shown.occurrence_id,/90071992547409999/);
  assert.deepEqual(Object.keys(shown).sort(),['address','club_info','id','joined','occurrence_id','route_info','skill_level_label','start_date','strava_event_url','terrain_label','title'].sort());
  assert.equal(JSON.stringify(result).includes(secret),false);
  for(const key of ['user:clubs','user:club_events:1','user:route:route']) {
    const stored=await cache.get(key);assert.ok(stored);assert.equal(JSON.stringify(stored).includes(secret),false,key);
  }
});
test('Rich existing cache entries are projected and rewritten without fetching Strava',async()=>{
  let calls=0;const load=await backend({modules:{'node-fetch':{default:async()=>{calls++;throw new Error('Unexpected provider call');}}}});
  const service=await load('src/services/strava.service.js');const cache=await service.initializeCache();
  await cache.set('user:clubs',[club]);await cache.set('user:club_events:1',[event]);await cache.set('user:route:route',route);
  const result=await service.getAllUserClubsEvents('token','user');assert.equal(calls,0);assert.equal(result.events.length,1);
  assert.equal(JSON.stringify(result).includes(secret),false);
  for(const key of ['user:clubs','user:club_events:1','user:route:route'])assert.equal(JSON.stringify(await cache.get(key)).includes(secret),false);
  let writes=0;const set=cache.set.bind(cache);cache.set=(...args)=>{writes++;return set(...args);};
  await service.getAllUserClubsEvents('token','user');assert.equal(writes,0);
});
test('Malformed objects in optional fields cannot carry private data into cache or output',async()=>{
  const load=await backend({modules:{'node-fetch':{default:async()=>apiResponse([{...event,title:{private:secret},address:{private:secret},joined:{private:secret},terrain:{private:secret},skill_levels:{private:secret},activity_type:{private:secret},route:null}])}}});
  const service=await load('src/services/strava.service.js');const cache=await service.initializeCache();
  const result=await service.getClubEvents('token',club,'user');
  assert.equal(JSON.stringify(result).includes(secret),false);assert.equal(JSON.stringify(await cache.get('user:club_events:1')).includes(secret),false);
});

test('Rejected legacy cache rewrites never fall back to exposing the full cached object',async()=>{
  const {service,cache}=await fixture();
  await cache.set('user:clubs',[club]);await cache.set('user:club_events:1',[event]);await cache.set('user:route:route',route);
  cache.set=async()=>false;
  const result=await service.getAllUserClubsEvents('token','user');
  assert.equal(result.events.length,1);assert.equal(JSON.stringify(result).includes(secret),false);
});
test('Invalid top-level provider resources return an explicit failure',async()=>{
  const load=await backend({modules:{'node-fetch':{default:async url=>apiResponse(url.includes('/athlete/clubs')?[club]:[null])}}});
  const {getAllUserClubsEvents}=await load('src/services/strava.service.js');
  await assert.rejects(getAllUserClubsEvents('token','user'),error=>error.status===502);
});


test('Zero route metrics remain available, while absent metrics stay N/A', async () => {
  for (const metrics of [{distance:0,elevation_gain:0,maximum_grade:0,elevation_high:0,elevation_low:0,estimated_moving_time:0}, {}]) {
    const load=await backend({modules:{'node-fetch':{default:async url=>apiResponse(url.includes('/routes/')?{id:'route',resource_state:3,...metrics}:[event])}}});
    const {getClubEvents}=await load('src/services/strava.service.js');
    const {events:[shown]}=await getClubEvents('token',club,'user');
    assert.equal(shown.route_info.distance, 'distance' in metrics ? '0.0 km' : 'N/A');
    for (const key of ['elevation_gain','elevation_high','elevation_low']) assert.equal(shown.route_info[key], key in metrics ? '0m' : 'N/A');
    assert.equal(shown.route_info.estimated_moving_time, 'estimated_moving_time' in metrics ? '0m' : 'N/A');
    assert.equal(shown.route_info.max_slope, 'maximum_grade' in metrics ? '0%' : 'N/A');
  }
});
