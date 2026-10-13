/** Versioned, defensive local persistence. Legacy keys remain readable. */
import {ROUTES} from './routes.js';
import {VEHICLES,TRAFFIC_LEVELS} from './physics.js';
import {safeJournal} from './stories.js';
import {validateRun} from './trip.js';
export const TRIP_KEY='last-light-trip-v1';
export const SETTINGS_KEY='last-light-settings-v3';
export const JOURNAL_KEY='last-light-journal-v1';
export const ACTIVITY_KEY='last-light-activities-v1';
export const POSTCARD_KEY='last-light-postcard-v1';
export const PREIMPORT_KEY='last-light-before-import-v1';
export const PAINTS=['#a54548','#e7c58e','#588c9c','#516c66','#222d42','#d7dbcf'];
export const DEFAULT_SETTINGS=Object.freeze({vehicle:'vesper',traffic:'light',steering:'normal',quality:'auto',renderer:'auto',mood:'sunset',paint:'#a54548',wheels:'classic',musicVolume:.38,engineVolume:.5,ambientVolume:.45,livingLight:true,reducedMotion:false,highContrast:false,hudScale:'normal',camera:'rear',headlights:'auto'});
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const choices={traffic:TRAFFIC_LEVELS,steering:['soft','normal','sharp'],quality:['auto','low','high'],renderer:['auto','canvas','webgl'],mood:['sunset','night','rain','dawn'],wheels:['classic','sport'],hudScale:['normal','large'],camera:['rear','cinematic','hood'],headlights:['auto','on','off']};
export function validateSettings(raw){
 if(!raw||![1,2].includes(raw.schemaVersion))return null;
 const valid={...DEFAULT_SETTINGS};
 if(Object.hasOwn(VEHICLES,raw.vehicle))valid.vehicle=raw.vehicle;
 for(const [key,allowed] of Object.entries(choices))if(allowed.includes(raw[key]))valid[key]=raw[key];
 if(PAINTS.includes(raw.paint))valid.paint=raw.paint;
 else if(Object.hasOwn(VEHICLES,raw.vehicle))valid.paint=VEHICLES[raw.vehicle].color;
 for(const key of ['musicVolume','engineVolume','ambientVolume'])if(finite(raw[key],0,1))valid[key]=raw[key];
 for(const key of ['reducedMotion','highContrast','livingLight'])if(typeof raw[key]==='boolean')valid[key]=raw[key];
 return valid;
}
export function validateTrip(raw){
 if(!raw||![1,2].includes(raw.schemaVersion)||!Object.hasOwn(ROUTES,raw.route)||!Object.hasOwn(VEHICLES,raw.vehicle)||!['cruise','arcade'].includes(raw.mode))return null;
 if(!finite(raw.distance,0,ROUTES[raw.route].length)||!finite(raw.x,-1.52,1.52))return null;
 if(typeof raw.selected!=='boolean'||typeof raw.postcard!=='boolean'||raw.finished!==false)return null;
 const result={route:raw.route,vehicle:raw.vehicle,mode:raw.mode,distance:raw.distance,x:raw.x,selected:raw.selected,postcard:raw.postcard,finished:false};
 if(raw.branchFrom!==undefined){
  const junction=ROUTES[raw.branchFrom]?.junction||(raw.branchFrom==='coast'?{at:1815,choices:['coast','mountain']}:null);
  if(!junction||raw.branchFrom===raw.route||!junction.choices.includes(raw.route))return null;
  if(raw.branchSourceDistance!==undefined){
   if(raw.branchAt!==0||!finite(raw.branchSourceDistance,junction.at-165,junction.at+165))return null;
   result.branchSourceDistance=raw.branchSourceDistance;
  }else if(!finite(raw.branchAt,junction.at-165,junction.at+165))return null;
  result.branchFrom=raw.branchFrom;result.branchAt=raw.branchAt;
 }
 if(raw.choices!==undefined){
  if(!Array.isArray(raw.choices)||raw.choices.length>4||!raw.choices.every(id=>Object.hasOwn(ROUTES,id)))return null;
  result.choices=[...new Set(raw.choices)];
 }
 if(raw.run!==undefined){const run=validateRun(raw.run);if(!run||safeJournal({schemaVersion:1,memories:run.memories}).memories.length!==run.memories.length)return null;result.run=run;}
 return result;
}
function readJson(storage,key){try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}}
function writeJson(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export function readTrip(storage){return validateTrip(readJson(storage,TRIP_KEY));}
export function writeTrip(storage,s){const payload=validateTrip({...s,schemaVersion:2,finished:false});return !!payload&&writeJson(storage,TRIP_KEY,{schemaVersion:2,...payload});}
export function clearTrip(storage){try{storage.removeItem(TRIP_KEY);return true;}catch{return false;}}
export function readSettings(storage){return validateSettings(readJson(storage,SETTINGS_KEY))||{...DEFAULT_SETTINGS};}
export function writeSettings(storage,s){const valid=validateSettings({...s,schemaVersion:2});return !!valid&&writeJson(storage,SETTINGS_KEY,{schemaVersion:2,...valid});}
export function readJournal(storage){return safeJournal(readJson(storage,JOURNAL_KEY));}
export function writeJournal(storage,value){return writeJson(storage,JOURNAL_KEY,safeJournal(value));}
export function validateActivityLog(raw){
 if(!raw||raw.schemaVersion!==1||!Array.isArray(raw.records))return {schemaVersion:1,records:[]};
 const records=[];const seen=new Set();
 for(const record of raw.records.slice(-60)){
  if(!record||typeof record.id!=='string'||!/^trip-[a-z0-9-]+:(clean|flow|explore)$/.test(record.id)||seen.has(record.id))continue;
  if(!['clean','flow','explore'].includes(record.type)||!Object.hasOwn(ROUTES,record.route)||!Object.hasOwn(VEHICLES,record.vehicle)||!finite(record.elapsed,0,86400)||!finite(record.completedAt,0,4102444800000))continue;
  seen.add(record.id);records.push({id:record.id,type:record.type,route:record.route,vehicle:record.vehicle,elapsed:record.elapsed,completedAt:record.completedAt});
 }
 return {schemaVersion:1,records};
}
export function readActivityLog(storage){return validateActivityLog(readJson(storage,ACTIVITY_KEY));}
export function writeActivityLog(storage,value){return writeJson(storage,ACTIVITY_KEY,validateActivityLog(value));}
export function readPostcard(storage){try{return storage.getItem(POSTCARD_KEY)==='true';}catch{return false;}}
export function writePostcard(storage){try{storage.setItem(POSTCARD_KEY,'true');return true;}catch{return false;}}
export function createBackup(storage){
 return {app:'CHASE-404',schemaVersion:2,exportedAt:new Date().toISOString(),data:{settings:{schemaVersion:2,...readSettings(storage)},trip:(()=>{const trip=readTrip(storage);return trip?{schemaVersion:2,...trip}:null;})(),journal:readJournal(storage),activities:readActivityLog(storage),postcard:readPostcard(storage)}};
}
export function validateBackup(raw){
 if(!raw||raw.app!=='CHASE-404'||![1,2].includes(raw.schemaVersion)||!raw.data||typeof raw.exportedAt!=='string'||!Number.isFinite(Date.parse(raw.exportedAt)))return null;
 const {settings,trip,journal,activities,postcard}=raw.data;
 const validSettings=validateSettings(settings),validTrip=trip===null?null:validateTrip(trip),validJournal=safeJournal(journal),validActivities=validateActivityLog(activities);
 if(!validSettings||(trip!==null&&!validTrip)||typeof postcard!=='boolean')return null;
 // Imported fields cannot be silently discarded: reject corrupt/incompatible backups.
 if(!journal||journal.schemaVersion!==1||!Array.isArray(journal.memories)||journal.memories.length>100||journal.memories.some(v=>!validJournal.memories.includes(v)))return null;
 if(journal.endings!==undefined&&(!Array.isArray(journal.endings)||journal.endings.length>16||journal.endings.some(v=>!validJournal.endings.includes(v))))return null;
 if(!activities||activities.schemaVersion!==1||!Array.isArray(activities.records)||activities.records.length>60||validActivities.records.length!==activities.records.length)return null;
 for(const key of Object.keys(DEFAULT_SETTINGS)){
  if(settings[key]!==undefined&&settings[key]!==validSettings[key])return null;
 }
 return {app:'CHASE-404',schemaVersion:2,exportedAt:raw.exportedAt,data:{settings:{schemaVersion:2,...validSettings},trip:validTrip?{schemaVersion:2,...validTrip}:null,journal:validJournal,activities:validActivities,postcard}};
}
export function importBackup(storage,raw){
 const valid=validateBackup(raw);
 if(!valid)return {ok:false,error:'COPIA NO VÁLIDA'};
 const entries=[[SETTINGS_KEY,JSON.stringify(valid.data.settings)],[TRIP_KEY,valid.data.trip?JSON.stringify(valid.data.trip):null],[JOURNAL_KEY,JSON.stringify(valid.data.journal)],[ACTIVITY_KEY,JSON.stringify(valid.data.activities)],[POSTCARD_KEY,valid.data.postcard?'true':null]];
 const previous=new Map();
 try{
  for(const [key] of entries)previous.set(key,storage.getItem(key));
  // Preserve the previous validated data before replacing any game key.
  storage.setItem(PREIMPORT_KEY,JSON.stringify(createBackup(storage)));
  for(const [key,value] of entries)value===null?storage.removeItem(key):storage.setItem(key,value);
  return {ok:true,data:valid.data};
 }catch{
  let rollbackOk=true;
  for(const [key,value] of previous){try{value===null?storage.removeItem(key):storage.setItem(key,value);}catch{rollbackOk=false;}}
  return {ok:false,error:'ALMACENAMIENTO NO DISPONIBLE',rollbackOk};
 }
}
