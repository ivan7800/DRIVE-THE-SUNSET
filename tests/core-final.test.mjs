import assert from 'node:assert/strict';
import {advance,VEHICLES,junctionApproach,roadShape} from '../js/physics.js';
import {createFixedStepper,createRun,selectActivity,tickRun,rememberStop,validateRun} from '../js/trip.js';
import {ROUTES} from '../js/routes.js';
import {readTrip,writeTrip,readSettings,writeSettings,writeJournal,readJournal,createBackup,validateBackup,importBackup,PREIMPORT_KEY,TRIP_KEY} from '../js/save.js';

const initial={route:'coast',vehicle:'vesper',mode:'cruise',speed:0,x:0,distance:0,selected:false,postcard:false,finished:false};
let atRest=initial;for(let i=0;i<180;i++)atRest=advance(atRest,{left:true},1/60);
assert.equal(atRest.x,0,'steering cannot move a stationary vehicle');
assert.equal(atRest.distance,0);
const cadences=[10,30,60,120].map(hz=>{
 let s={...initial};const clock=createFixedStepper();
 for(let i=0;i<hz*3;i++)clock.update(1/hz,dt=>{s=advance(s,{gas:true},dt);});
 return s;
});
for(const s of cadences){assert(Math.abs(s.distance-cadences[0].distance)<1e-8);assert(Math.abs(s.speed-cadences[0].speed)<1e-8);}
let ticks=0;const bounded=createFixedStepper();bounded.update(120,()=>ticks++);assert(ticks<=16,'bounded catch-up after suspension');bounded.reset();assert.equal(bounded.remainder,0);
assert.equal(Object.keys(VEHICLES).length,7);assert(VEHICLES.meridian.topSpeed>100);assert(VEHICLES.ironclad.topSpeed>VEHICLES.longhorn.topSpeed);

let run=selectActivity(createRun(0,'trip-test'),'clean',0);
let previous={distance:0,speed:60,x:0,mode:'arcade'};
for(let i=0;i<1100;i++){const state={...previous,distance:previous.distance+1};run=tickRun(run,previous,state,{},1/60);previous=state;}
assert.equal(run.activity.status,'complete');assert.deepEqual(run.awards,['clean']);
run=selectActivity(createRun(0,'trip-flow'),'flow',0);
for(let i=0;i<2701;i++)run=tickRun(run,{distance:0},{distance:1,speed:65,x:0,mode:'arcade'},{},1/60);
assert.equal(run.activity.status,'complete');
run=selectActivity(createRun(0,'trip-explore'),'explore',0);
for(const key of ['coast:salmar','coast:faro','coast:tunel'])run=rememberStop(run,key);
assert.equal(run.activity.status,'complete');assert(validateRun(run));
assert.equal(validateRun({...run,elapsed:Infinity}),null);
let restarted=selectActivity(createRun(0,'trip-clean'),'clean',0);
restarted=tickRun(restarted,{distance:600},{distance:601,speed:60,x:0,contact:true,mode:'arcade'},{},1/60);
assert.equal(restarted.activity.progress,0);assert.equal(restarted.contacts,1);

for(const type of ['clean','flow']){
 const waiting=selectActivity(createRun(0,'trip-cruise-'+type),type,0);
 const cruised=tickRun(waiting,{distance:0},{distance:2000,speed:65,x:0,mode:'cruise'},{},.05);
 assert.equal(cruised.activity.progress,0);assert.equal(cruised.activity.status,'active');assert.equal(cruised.travelled,2000,'Cruise still tracks journey metrics');
}
let cruiseExplore=selectActivity(createRun(0,'trip-cruise-explore'),'explore',0);
for(const key of ['coast:salmar','coast:faro','coast:tunel'])cruiseExplore=rememberStop(cruiseExplore,key,'cruise');
assert.equal(cruiseExplore.memories.length,3);assert.equal(cruiseExplore.activity.progress,0);assert.equal(cruiseExplore.activity.status,'active');
for(const key of ['coast:salmar','coast:faro','coast:tunel'])cruiseExplore=rememberStop(cruiseExplore,key,'arcade');
assert.equal(cruiseExplore.activity.status,'complete','previous Cruise memories can be revisited in Arcade');

const data=new Map();const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
assert(writeTrip(storage,{...initial,distance:123,choices:[],run:createRun(0,'trip-save')}));
assert.equal(readTrip(storage).distance,123);
assert(writeSettings(storage,{vehicle:'meridian',traffic:'normal',mood:'night',schemaVersion:2}));
assert.equal(readSettings(storage).vehicle,'meridian');assert.equal(readSettings(storage).mood,'night');
assert(writeJournal(storage,{schemaVersion:1,memories:['coast:faro']}));
const backup=createBackup(storage);assert(validateBackup(backup));
const clone=JSON.parse(JSON.stringify(backup));clone.data.trip.distance=1e9;assert.equal(validateBackup(clone),null);
const unknown=JSON.parse(JSON.stringify(backup));unknown.data.journal.memories.push('fake:unknown');assert.equal(validateBackup(unknown),null);
const malformed=JSON.parse(JSON.stringify(backup));malformed.data.settings.engineVolume='NaN';assert.equal(validateBackup(malformed),null);
storage.setItem(TRIP_KEY,'broken-json');assert(importBackup(storage,backup).ok);assert.equal(readTrip(storage).distance,123);assert(data.has(PREIMPORT_KEY));assert.deepEqual(readJournal(storage).memories,['coast:faro']);

const before=new Map(data);let writes=0;const failing={...storage,setItem(key,value){writes++;if(writes===3)throw new Error('quota');data.set(key,value);}};
const alternative=JSON.parse(JSON.stringify(backup));alternative.data.trip.distance=200;
const failure=importBackup(failing,alternative);assert(!failure.ok);assert(failure.rollbackOk);
for(const [key,value] of before)if(key!==PREIMPORT_KEY)assert.equal(data.get(key),value,'rollback key '+key);

// Every connection keeps the road centre continuous and remains saveable.
for(const [route,details] of Object.entries(ROUTES))if(details.junction){
 const target=details.junction.choices.find(value=>value!==route),at=details.junction.at;
 const branch={...initial,route:target,branchFrom:route,branchAt:0,branchSourceDistance:at,distance:0,selected:true,choices:[route]};
 assert.deepEqual(junctionApproach({...initial,route,choices:[]},at).options,details.junction.choices);
 assert(Math.abs(roadShape(branch,0).curve-roadShape({route},at).curve)<1e-10);
 assert(Math.abs(roadShape(branch,420).curve-roadShape({route:target},420).curve)<1e-10);
 assert(writeTrip(storage,branch),'validated connection '+route+' -> '+target);
}
console.log('PASS core-final: rest, fixed-step 10/30/60/120 Hz, bounded suspension, 7 cars, 3 activities, migration, backup validation/rollback and route connections');
