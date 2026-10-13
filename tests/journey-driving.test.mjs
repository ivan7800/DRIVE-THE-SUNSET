import assert from 'node:assert/strict';
import {ENCOUNTERS,CHAPTERS,chooseEncounter,endingFor,encounterApproach,validJourney} from '../js/journey.js';
import {advance,resolveTrafficContact,VEHICLES} from '../js/physics.js';
import {ROUTES} from '../js/routes.js';
import {createRun,validateRun} from '../js/trip.js';
import {safeJournal} from '../js/stories.js';
import {writeTrip,readTrip,writeJournal,createBackup,validateBackup,importBackup,readJournal} from '../js/save.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const endings=[];
for(const [route,events] of Object.entries(ENCOUNTERS)){
 assert.equal(events.length,3);assert.equal(CHAPTERS[route].length,ROUTES[route].sections.length);
 for(const event of events){assert(event.at>0&&event.at<ROUTES[route].length);assert.equal(event.options.length,2);}
 const first=events[0];assert.equal(encounterApproach(route,first.at-400,{}).id,first.id,'encounter cue is visible before braking distance');assert.equal(encounterApproach(route,first.at+160,{}).id,first.id,'passed encounter remains recoverable briefly');
 for(const kind of ['quiet','promise','together','home']){
  let journey={};if(kind==='promise')journey=chooseEncounter(journey,events[0].id,0);
  if(kind==='together')journey=chooseEncounter(journey,events[0].id,1);
  if(kind!=='quiet')journey=chooseEncounter(journey,events[1].id,kind==='home'?1:0);
  assert.equal(endingFor(route,journey).id,route+':'+kind);endings.push(route+':'+kind);
  const run={...createRun(),journey};assert.deepEqual(validateRun(run),run);
  const db=storage(),trip={route,vehicle:'vesper',distance:events[1].at,x:0,selected:false,postcard:false,finished:false,mode:'cruise',run};
  assert(writeTrip(db,trip));assert.deepEqual(readTrip(db).run.journey,journey);
 }
}
assert.equal(validJourney({'coast-letter':'<script>'}),null);assert.equal(validJourney({'missing':'home'}),null);
const source=storage();writeJournal(source,{schemaVersion:1,memories:['coast:faro'],endings});const backup=createBackup(source);assert(validateBackup(backup));assert.equal(backup.schemaVersion,2,'new backups prevent older clients from silently dropping endings');const legacy=structuredClone(backup);legacy.schemaVersion=1;delete legacy.data.journal.endings;assert(validateBackup(legacy),'legacy backups migrate');const dest=storage();assert(importBackup(dest,backup).ok);assert.deepEqual(readJournal(dest).endings,endings);
backup.data.journal.endings.push('coast:invented');assert.equal(validateBackup(backup),null);assert.equal(safeJournal({schemaVersion:1,memories:[]}).endings.length,0,'old journal migrates');
const base={route:'coast',vehicle:'vesper',mode:'arcade',distance:100,speed:90,x:0};
for(const vehicle of Object.keys(VEHICLES)){
 let s={...base,vehicle};for(let i=0;i<12;i++)s=advance(s,{right:true,handbrake:true},1/60);assert(s.slide>0,'controlled drift '+vehicle);
 const slide=s.slide;for(let i=0;i<120;i++)s=advance(s,{},1/60);assert(Math.abs(s.slide)<slide*.01,'grip recovers '+vehicle);
 const brake=advance({...base,vehicle},{gas:true,brake:true},1/60);assert(brake.speed<base.speed,'brake wins over gas');
 let stationary={...base,vehicle,speed:0,x:0};for(let i=0;i<60;i++)stationary=advance(stationary,{right:true},1/60);assert.equal(stationary.x,0);
}
let hit=advance({...base,route:'carmelo',x:1.36,steerMomentum:1},{right:true,gas:true},1/60);assert(hit.wallContact);assert(hit.x<=1.36);hit=resolveTrafficContact(hit,[],1/60);assert(hit.contact,'border contact survives traffic step');
const analogue=advance(base,{steerAxis:.4,throttle:.4},1/60),digital=advance(base,{right:true,gas:true},1/60);assert(analogue.steerMomentum<digital.steerMomentum&&analogue.speed<digital.speed);
console.log('PASS: twelve encounters, sixteen endings, migration/backup validation, four handling profiles, drift recovery, pedal priority, analogue control and borders');
// Traverse complete road distances with continuous integration, without teleporting.
const tours=[];
for(const route of Object.keys(ROUTES))for(const vehicle of Object.keys(VEHICLES)){
 let s={...base,route,vehicle,distance:0,speed:0,x:0},steps=0;
 while(s.distance<ROUTES[route].length&&steps<100000){
  const steerAxis=Math.max(-1,Math.min(1,-s.x*3-(s.steerMomentum||0)*.4));
  s=advance(s,{steerAxis,gas:s.speed<105},1/60);steps++;
  assert(Number.isFinite(s.distance)&&Math.abs(s.x)<=1.48);assert(!s.wallContact,'centre-line controller clears road edge');
 }
 assert(s.distance>=ROUTES[route].length,'complete route '+route+'/'+vehicle);
 tours.push({route,vehicle,simulatedSeconds:Math.round(steps/60),km:ROUTES[route].length/1000});
}
console.log('PASS: 16 full-distance continuous physics journeys, 122 simulated km; no browser or human driving claim');
