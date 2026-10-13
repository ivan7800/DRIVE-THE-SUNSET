/** Session metrics and optional activities. No storage, DOM or renderer dependencies. */
import {validJourney} from './journey.js';
export const ACTIVITIES=Object.freeze({
 none:{name:'VIAJE LIBRE',hint:'Disfruta del camino, sin objetivos.',target:0},
 clean:{name:'VIAJE LIMPIO',hint:'Recorre 1 km sin contactos y dentro de la carretera.',target:1000},
 flow:{name:'RUTA FLUIDA',hint:'Mantén 45–100 km/h durante 45 s, sin salir de la carretera.',target:45},
 explore:{name:'EXPLORACIÓN',hint:'Detente a recordar tres lugares durante este viaje.',target:3}
});
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
export function createRun(distance=0,id){
 return {id:id||`trip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,startDistance:distance,elapsed:0,travelled:0,contacts:0,offroadSeconds:0,maxSpeed:0,memories:[],journey:{},activity:{type:'none',status:'active',startDistance:distance,baseContacts:0,baseOffroad:0,progress:0,streak:0,stops:[]},awards:[]};
}
export function validateRun(raw){
 if(!raw||typeof raw.id!=='string'||!/^trip-[a-z0-9-]{1,80}$/.test(raw.id))return null;
 for(const [key,max] of [['startDistance',100000],['elapsed',86400],['travelled',1000000],['contacts',100000],['offroadSeconds',86400],['maxSpeed',250]])if(!finite(raw[key],0,max))return null;
 if(!Number.isInteger(raw.contacts)||!Array.isArray(raw.memories)||raw.memories.length>16||!raw.memories.every(v=>typeof v==='string'&&/^[a-z]+:[a-z0-9-]+$/.test(v)))return null;
 const journey=validJourney(raw.journey);if(!journey)return null;
 const activity=raw.activity;
 if(!activity||!Object.hasOwn(ACTIVITIES,activity.type)||!['active','complete'].includes(activity.status))return null;
 for(const [key,max] of [['startDistance',100000],['baseContacts',100000],['baseOffroad',86400],['progress',1000000],['streak',86400]])if(!finite(activity[key],0,max))return null;
 const stops=activity.stops===undefined?(activity.type==='explore'?raw.memories:[]):activity.stops;
 if(!Array.isArray(stops)||stops.length>16||!stops.every(key=>raw.memories.includes(key)))return null;
 if(!Array.isArray(raw.awards)||!raw.awards.every(v=>['clean','flow','explore'].includes(v)))return null;
 return {id:raw.id,startDistance:raw.startDistance,elapsed:raw.elapsed,travelled:raw.travelled,contacts:raw.contacts,offroadSeconds:raw.offroadSeconds,maxSpeed:raw.maxSpeed,memories:[...new Set(raw.memories)],journey,activity:{type:activity.type,status:activity.status,startDistance:activity.startDistance,baseContacts:activity.baseContacts,baseOffroad:activity.baseOffroad,progress:activity.progress,streak:activity.streak,stops:[...new Set(stops)]},awards:[...new Set(raw.awards)]};
}
export function selectActivity(run,type,distance){
 if(!Object.hasOwn(ACTIVITIES,type))return run;
 return {...run,activity:{type,status:'active',startDistance:distance,baseContacts:run.contacts,baseOffroad:run.offroadSeconds,progress:0,streak:0,stops:[]}};
}
function completeActivity(run){
 const a=run.activity;
 if(a.type==='none'||a.status==='complete'||a.progress<ACTIVITIES[a.type].target)return run;
 return {...run,activity:{...a,status:'complete'},awards:[...new Set([...run.awards,a.type])]};
}
export function rememberStop(run,key,mode='arcade'){
 const next={...run,memories:[...new Set([...run.memories,key])]};
 if(mode!=='arcade')return next;
 if(next.activity.type==='explore'&&next.activity.status==='active'){
  const stops=[...new Set([...(next.activity.stops||[]),key])];next.activity={...next.activity,stops,progress:stops.length};
 }
 return completeActivity(next);
}
export function tickRun(run,previous,state,input,dt){
 const seconds=Math.max(0,Math.min(dt,.05));
 const next={...run,elapsed:run.elapsed+seconds,travelled:run.travelled+Math.abs(state.distance-previous.distance),contacts:run.contacts+(state.contact?1:0),offroadSeconds:run.offroadSeconds+(Math.abs(state.x)>1.04?seconds:0),maxSpeed:Math.max(run.maxSpeed,Math.abs(state.speed))};
 // Cruise keeps trip metrics and the diary, while optional objectives wait.
 if(state.mode!=='arcade')return next;
 let activity={...run.activity};
 if(activity.status==='active'&&activity.type==='clean'){
  // A contact or a sustained shoulder excursion starts a fresh clean kilometre.
  if(state.contact||Math.abs(state.x)>1.04){activity.startDistance=state.distance;activity.progress=0;}
  else activity.progress+=Math.max(0,state.distance-previous.distance);
 }else if(activity.status==='active'&&activity.type==='flow'){
  const smooth=state.speed>=45&&state.speed<=100&&Math.abs(state.x)<.98&&!state.contact&&!input.handbrake;
  activity.streak=smooth?activity.streak+seconds:0;activity.progress=activity.streak;
 }else if(activity.status==='active'&&activity.type==='explore')activity.progress=(activity.stops||[]).length;
 next.activity=activity;
 return completeActivity(next);
}
/** Fixed-step accumulator: 10/30/60/120 Hz spend the same simulation time.
 * Large suspensions are bounded; call reset on visibility/focus changes. */
export function createFixedStepper(step=1/60,maxElapsed=.25){
 let remainder=0;
 return {
  update(elapsed,tick){
   if(!Number.isFinite(elapsed)||elapsed<=0)return 0;
   remainder+=Math.min(elapsed,maxElapsed);
   let count=0;const limit=Math.ceil(maxElapsed/step)+1;
   while(remainder+1e-10>=step&&count<limit){tick(step);remainder-=step;count++;}
   if(remainder<0)remainder=0;
   return count;
  },
  reset(){remainder=0;},
  get remainder(){return remainder;}
 };
}
