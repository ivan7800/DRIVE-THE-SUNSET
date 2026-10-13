import assert from 'node:assert/strict';
import {TRIP_KEY,SETTINGS_KEY,JOURNAL_KEY,ACTIVITY_KEY,POSTCARD_KEY,PREIMPORT_KEY,DEFAULT_SETTINGS,writeTrip,readTrip,writeSettings,readSettings,writeJournal,readJournal,createBackup,validateBackup,importBackup,writePostcard} from '../js/save.js';
import {createRun} from '../js/trip.js';
const createStorage=()=>{const entries=new Map();return {entries,getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)}};
const source=createStorage();
const trip={route:'carmelo',vehicle:'meridian',mode:'arcade',distance:4200,x:-.1,selected:true,postcard:true,finished:false,choices:['coast','mountain','vineyards'],run:createRun(0,'trip-backup-test')};
assert(writeTrip(source,trip));assert(writeSettings(source,{...DEFAULT_SETTINGS,vehicle:'meridian',renderer:'canvas',mood:'rain',reducedMotion:true}));
assert.equal(Object.hasOwn(readSettings(source),'renderer'),false,'legacy renderer choice is ignored after 2D mode retirement');
assert(writeJournal(source,{schemaVersion:1,memories:['coast:faro','carmelo:cine']}));assert(writePostcard(source));
const backup=createBackup(source);assert(validateBackup(backup));
assert.equal(Object.hasOwn(backup.data.settings,'renderer'),false,'new backups do not store an obsolete renderer choice');
const restored=createStorage();assert(importBackup(restored,backup).ok);assert.deepEqual(readTrip(restored),trip);assert.equal(readSettings(restored).mood,'rain');assert.deepEqual(readJournal(restored).memories,['coast:faro','carmelo:cine']);assert.equal(restored.getItem(POSTCARD_KEY),'true');
assert(restored.getItem(PREIMPORT_KEY),'pre-import safety backup exists');
for(const modify of [b=>b.app='OTHER',b=>b.schemaVersion=99,b=>b.data.trip.route='bogus',b=>b.data.trip.distance=Infinity,b=>b.data.settings.renderer='script',b=>b.data.settings.paint='url(https://bad)',b=>b.data.journal.memories.push('<img onerror=alert(1)>'),b=>b.data.activities.records.push({})]){
 const invalid=structuredClone(backup);modify(invalid);const before=[...restored.entries];assert(!importBackup(restored,invalid).ok);assert.deepEqual([...restored.entries],before,'invalid import preserves all data');
}
const rollback=createStorage();rollback.setItem(TRIP_KEY,source.getItem(TRIP_KEY));rollback.setItem(JOURNAL_KEY,JSON.stringify({schemaVersion:1,memories:['coast:salmar']}));
const before=new Map(rollback.entries),original=rollback.setItem;let failOnce=true;
rollback.setItem=(key,value)=>{if(key===JOURNAL_KEY&&failOnce){failOnce=false;throw Error('quota simulated once')}original(key,value)};
const failure=importBackup(rollback,backup);assert.equal(failure.ok,false);assert.equal(failure.rollbackOk,true);
for(const key of [TRIP_KEY,SETTINGS_KEY,JOURNAL_KEY,ACTIVITY_KEY,POSTCARD_KEY])assert.equal(rollback.getItem(key),before.get(key)??null,'rollback '+key);
const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')},removeItem(){throw Error('denied')}};
assert.equal(writeTrip(denied,trip),false);assert.equal(writePostcard(denied),false);assert.equal(readTrip(denied),null);assert.equal(importBackup(denied,backup).ok,false);
console.log('PASS: full backup/restore, pre-import copy, invalid inputs preserve data, failed write rollback, blocked storage');
