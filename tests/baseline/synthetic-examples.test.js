import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

test('Synthetic examples replace personal values, IDs, geometry and unknown fields consistently',async()=>{
  const {createExampleSanitizer}=await import('../../scripts/lib/synthetic-example.js');
  const sanitize=createExampleSanitizer();
  const original={id:'3468204764614160646',club_id:1752189,club:{id:1752189,name:'PRIVATE_NAME'},
    route_id:'3465434395661532938',route:{id:'3465434395661532938',name:'PRIVATE_ROUTE'},
    organizing_athlete:{id:42,firstname:'PRIVATE_NAME',bio:'PRIVATE_BIO',weight:83,profile:'https://private.example/avatar'},
    map:{polyline:'PRIVATE_GEOMETRY'},start_latlng:[52.11,21.22],description:'PRIVATE_TEXT',
    resource_state:3,upcoming_occurrences:['2026-03-01T09:00:00Z','2026-03-02T09:00:00Z'],access_token:'PRIVATE_TOKEN',unrecognized:'PRIVATE_FUTURE'};
  const result=sanitize(original);const text=JSON.stringify(result);
  assert.equal(text.includes('PRIVATE_'),false);assert.equal(text.includes('3468204764614160646'),false);
  assert.equal(text.includes('private.example'),false);assert.equal(text.includes('52.11'),false);
  assert.equal(result.club.id,result.club_id);assert.equal(result.route.id,result.route_id);
  assert.equal(result.resource_state,3);assert.equal(typeof result.id,'string');assert.ok(BigInt(result.id)>BigInt(Number.MAX_SAFE_INTEGER));
  assert.equal(result.upcoming_occurrences.length,2);assert.notEqual(result.upcoming_occurrences[0],result.upcoming_occurrences[1]);
  assert.equal('access_token' in result,false);assert.equal('unrecognized' in result,false);
  assert.equal(sanitize({id:original.id}).id,result.id);
  assert.equal(original.organizing_athlete.bio,'PRIVATE_BIO');
});
test('Checked-in examples use only synthetic URLs, dates and IDs',async()=>{
  const paths=await readdir(new URL('../../docs/examples/',import.meta.url));
  for(const path of paths.filter(p=>p.endsWith('.json'))) {
    const text=await readFile(new URL(`../../docs/examples/${path}`,import.meta.url),'utf8');
    assert.equal(/1752189|3468204764614160646|3465434395661532938|3405220741554168870/.test(text+path),false,path);
    const data=JSON.parse(text);
    function walk(value,key='') {
      if(Array.isArray(value))return value.forEach(item=>walk(item,key));
      if(value&&typeof value==='object')return Object.entries(value).forEach(([name,item])=>walk(item,name));
      if(typeof value==='string'&&/^https?:/.test(value))assert.equal(new URL(value).hostname,'example.com',path);
      if(key==='polyline'||key==='summary_polyline')assert.equal(value,'',path);
    }
    walk(data);
  }
});

test('Example parsing preserves large reference IDs as well as resource IDs',async()=>{
  const {parseExampleJson}=await import('../../scripts/lib/synthetic-example.js');
  const input=parseExampleJson('{"id":3468204764614160646,"route_id":3465434395661532938,"route":{"id":3465434395661532938}}');
  assert.equal(input.route_id,'3465434395661532938');assert.equal(input.route.id,input.route_id);
});

test('Fetch-model saves only a synthetic example using a synthetic filename',async()=>{
  const {backend,apiResponse}=await import('../helpers/runtime.js');const writes=[];
  const load=await backend({argv:['--type','event','--id','3468204764614160646'],env:{STRAVA_ACCESS_TOKEN:'fixture-token'},modules:{
    'node-fetch':{default:async()=>apiResponse({id:'3468204764614160646',title:'PRIVATE_TITLE',organizing_athlete:{id:12,bio:'PRIVATE_BIO'},access_token:'PRIVATE_TOKEN'})},
    'fs/promises':{writeFile:async(path,body)=>{writes.push({path,body});}}
  }});
  await load('scripts/fetch-model.js');assert.equal(writes.length,1);
  assert.match(writes[0].path,/docs\/examples\/event-9000000000000000001-example.json$/);
  assert.equal(writes[0].body.includes('PRIVATE_'),false);
});
test('Fetch-model never exposes a raw upstream error body',async()=>{
  const {backend,apiResponse}=await import('../helpers/runtime.js');
  const load=await backend({argv:['--type','event','--id','1'],env:{STRAVA_ACCESS_TOKEN:'fixture-token'},modules:{
    'node-fetch':{default:async()=>apiResponse({error:'PRIVATE_PROVIDER_ERROR'},403)}
  }});
  await assert.rejects(load('scripts/fetch-model.js'),error=>error.message==='Strava model request failed (403)');
});

test('Crawl mode preserves synthetic references across separately saved resources and states',async()=>{
  const {backend,apiResponse}=await import('../helpers/runtime.js');const writes=[];
  const eventId='3468204764614160646',routeId='3465434395661532938';
  const club={id:1,name:'PRIVATE_CLUB',resource_state:2};
  const event={id:eventId,title:'PRIVATE_EVENT',resource_state:2,club:{...club,resource_state:1},route:{id:routeId,name:'PRIVATE_ROUTE',resource_state:1}};
  const load=await backend({argv:['--mode','crawl','--club','1','--event',eventId,'--route',routeId],env:{STRAVA_ACCESS_TOKEN:'fixture-token'},modules:{
    'node-fetch':{default:async url=>{
      if(url.includes('/athlete/clubs'))return apiResponse([club]);
      if(url.includes('/routes/'))return apiResponse({...event.route,resource_state:3});
      if(url.includes('/group_events?'))return apiResponse([event]);
      if(url.includes('/group_events/'))return apiResponse({...event,resource_state:3,club});
      return apiResponse({...club,resource_state:3});
    }},
    'fs/promises':{writeFile:async(path,body)=>writes.push({path,data:JSON.parse(body)})}
  }});
  await load('scripts/fetch-model.js');assert.equal(writes.length,7);
  assert.equal(JSON.stringify(writes).includes('PRIVATE_'),false);
  const savedEvent=writes.find(w=>w.path.includes('event-')&&w.path.includes('-state-2-')).data;
  const savedRoute=writes.find(w=>w.path.includes('route-')&&w.path.includes('-state-3-')).data;
  const savedClub=writes.find(w=>w.path.includes('club-')&&w.path.includes('-state-3-')).data;
  assert.equal(savedEvent.route.id,savedRoute.id);assert.equal(savedEvent.club.id,savedClub.id);
  for(const saved of writes)assert.ok(saved.path.includes(`-${saved.data.id}-state-`));
});
