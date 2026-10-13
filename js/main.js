import {readTrip,writeTrip,clearTrip,readSettings,writeSettings,readJournal,writeJournal,readActivityLog,writeActivityLog,readPostcard,writePostcard,createBackup,validateBackup,importBackup,validateTrip,validateSettings,DEFAULT_SETTINGS,SETTINGS_KEY,PREIMPORT_KEY} from './save.js';
import {STORIES,storyKey,storyNear,safeJournal} from './stories.js';
import {drawMiniMap} from './visuals.js';
import {CHAPTERS,ENCOUNTERS,ENDINGS,encounterNear,encounterApproach,chooseEncounter,endingFor} from './journey.js';
import {ROUTES,getRoute,nearestLandmark,routeSection} from './routes.js';
import {advance,clamp,junctionApproach,VEHICLES,HANDLING,trafficCars,resolveTrafficContact} from './physics.js';
import {ACTIVITIES,createRun,validateRun,selectActivity,tickRun,rememberStop,createFixedStepper} from './trip.js';
import {createAudio} from './audio.js';
import {createWebGLRenderer} from '../webgl/renderer.js';

const $=id=>document.getElementById(id);
const canvas=$('game'),canvas3d=$('game3d'),mini=$('mini'),mctx=mini.getContext('2d');
const rendererFactory=new URLSearchParams(window.location.search).has('qa')?window.__CHASE_QA__?.rendererFactory:null;
const makeWebGLRenderer=rendererFactory||createWebGLRenderer;
let storage;
try{storage=window.localStorage;}catch{storage={getItem(){return null;},setItem(){throw new Error('Storage blocked');},removeItem(){throw new Error('Storage blocked');}};}
let settings=readSettings(storage),journalData=readJournal(storage),activityLog=readActivityLog(storage),savedTrip=readTrip(storage);
try{if(!storage.getItem(SETTINGS_KEY)&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)settings.reducedMotion=true;}catch{}
let s=initialState('coast','cruise'),started=false,paused=true,modal='intro',pausedBeforeModal=true;
let raf=0,last=0,lastSaveTime=0,lastSavedDistance=-1,trafficClock=0,animationClock=0,activeStory=null;
let audioEnabled=false,webgl=null,renderer='unavailable',rendererFailed=true,storageWarning=false,toastTimer=0;
let renderScale=1,performanceSamples=[],fastWindows=0;
const audio=createAudio(),stepper=createFixedStepper();
const keyCodes=new Set(),touchKeys=new Set(),pointerKeys=new Set();
let currentEncounter=null;
let currentEncounterNotice='';
const keys={gas:false,brake:false,left:false,right:false,handbrake:false};
const aliases={KeyW:'gas',ArrowUp:'gas',KeyS:'brake',ArrowDown:'brake',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'handbrake'};
const routeOrder=['coast','mountain','vineyards','carmelo'];
const panelIds={intro:'intro',garage:'garagePane',routes:'routePane',journal:'journalPane',help:'helpPane',photo:'photoPane',finish:'finish',encounter:'encounterPane'};
const panelFirst={intro:'start',garage:'closeGarage',routes:'closeRoutes',journal:'closeJournal',help:'closeHelp',photo:'capturePhoto',finish:'nextRoute',encounter:'encounterFirst'};
const bind=(id,handler,event='click')=>{const el=$(id);if(el)el.addEventListener(event,handler);};
const text=(id,value)=>{const element=$(id);if(element&&element.textContent!==String(value))element.textContent=value;};
const hide=(id,hidden)=>{if($(id))$(id).classList.toggle('hidden',hidden);};

function initialState(route='coast',mode='cruise'){
 return {vehicle:settings.vehicle,speed:0,x:0,distance:0,mode,route,selected:false,choices:[],postcard:false,finished:false,steerMomentum:0,trafficClock:0,run:createRun()};
}
function announce(message){
 text('toast',message);if(message)text('a11yStatus',message);
 if(toastTimer)window.clearTimeout(toastTimer);
 if(message)toastTimer=window.setTimeout(()=>text('toast',''),5000);
}
function warnStorage(){if(!storageWarning){storageWarning=true;announce('GUARDADO NO DISPONIBLE · EXPORTA UNA COPIA ANTES DE CERRAR');}text('saveStatus','SIN GUARDADO LOCAL');}
function focusRoad(){canvas.focus({preventScroll:true});}
function clearKeys(){keyCodes.clear();touchKeys.clear();pointerKeys.clear();for(const name in keys)keys[name]=false;document.querySelectorAll('[data-control]').forEach(button=>button.classList.remove('pressed'));stepper.reset();}
function syncKey(name){keys[name]=touchKeys.has(name)||pointerKeys.has(name)||[...keyCodes].some(code=>aliases[code]===name);}
function saveTrip(force=false){
 if(!started||s.finished)return false;
 if(!force&&Math.abs(s.distance-lastSavedDistance)<20)return true;
 const ok=writeTrip(storage,s);
 if(ok){lastSavedDistance=s.distance;savedTrip=readTrip(storage);text('saveStatus','GUARDADO LOCAL');}else warnStorage();
 return ok;
}
function refreshContinue(){savedTrip=readTrip(storage);if($('continue'))$('continue').hidden=!savedTrip;}
function closeModal(focus=true,restoreIntro=true){
 if(!modal)return;
 const old=modal;hide(panelIds[old],true);modal=null;
 if(old==='photo')$('app')?.classList.remove('photo-mode');
 paused=started&&!s.finished?pausedBeforeModal:true;
 clearKeys();updateHud();
 if(restoreIntro&&!started&&old!=='intro'){modal='intro';hide('intro',false);}
 if(focus){if(started)focusRoad();else $('start')?.focus();}
}
function openModal(name){
 if(!panelIds[name]||!$(panelIds[name]))return;
 const before=modal?pausedBeforeModal:paused;
 if(modal)closeModal(false,false);
 pausedBeforeModal=before;paused=true;modal=name;clearKeys();
 if(name==='garage')syncSettingsControls();
 if(name==='journal')renderJournal();
 if(name==='photo')$('app')?.classList.add('photo-mode');
 hide(panelIds[name],false);$(panelFirst[name])?.focus({preventScroll:true});updateHud();
}
function beginTrip(resume=false){
 if(renderer!=='webgl'||!webgl){announce('WEBGL NO DISPONIBLE · ACTIVA LA ACELERACIÓN GRÁFICA Y REINTENTA');return;}
 if(resume){
  savedTrip=readTrip(storage);if(!savedTrip){announce('NO HAY UN VIAJE VÁLIDO PARA RECUPERAR');refreshContinue();return;}
  const legacyChoices=savedTrip.choices||(savedTrip.selected?[savedTrip.branchFrom||savedTrip.route]:[]);
  s={...initialState(savedTrip.route,savedTrip.mode),...savedTrip,choices:legacyChoices,speed:0,steerMomentum:0,run:validateRun(savedTrip.run)||createRun(savedTrip.distance)};
  settings.vehicle=s.vehicle;if(!writeSettings(storage,settings))warnStorage();
 }else{const activity=s.run.activity.type;s=initialState(s.route,s.mode);s.run=selectActivity(s.run,activity,0);}
 if(modal)closeModal(false);
 started=true;paused=false;modal=null;last=0;trafficClock=0;s.trafficClock=0;activeStory=null;lastSavedDistance=-1;clearKeys();
 hide('finish',true);hide('intro',true);syncSettingsControls();focusRoad();updateHud();saveTrip(true);
 announce(resume?'VIAJE RECUPERADO · MOTOR DETENIDO':'DISFRUTA DEL CAMINO');
}
function pause(force){
 if(!started||s.finished||modal)return;
 paused=force===undefined?!paused:!!force;clearKeys();saveTrip(true);last=0;updateHud();
 announce(paused?'VIAJE EN PAUSA':'BUEN VIAJE');if(!paused)focusRoad();
}
function reset(route=s.route){
 if(renderer!=='webgl'||!webgl||!Object.hasOwn(ROUTES,route))return;
 const activity=s.run.activity.type;s.route=route;if(modal)closeModal(false,false);
 s=initialState(route,s.mode);s.run=selectActivity(s.run,activity,0);started=true;paused=false;activeStory=null;trafficClock=0;last=0;lastSavedDistance=-1;clearKeys();
 hide('finish',true);hide('choice',true);hide('stop',true);hide('storyStop',true);text('postcardState','');
 saveTrip(true);syncSettingsControls();updateHud();focusRoad();announce('NUEVO VIAJE · '+getRoute(route).name);
}
function returnHome(){
 if(started&&!s.finished)saveTrip(true);
 if(modal)closeModal(false);
 const activity=s.run.activity.type;started=false;paused=true;s=initialState(s.route,s.mode);s.run=selectActivity(s.run,activity,0);clearKeys();last=0;refreshContinue();syncSettingsControls();
 openModal('intro');$('start')?.focus();announce('');
}
function choose(route){
 const junction=junctionApproach(s,s.distance);
 if(!started||paused||modal||!junction||Math.abs(junction.remaining)>165||!junction.options.includes(route))return;
 const previous=s.route;
 s.choices=[...new Set([...(s.choices||[]),previous])];s.selected=true;
 if(route!==previous){s.branchFrom=previous;s.branchSourceDistance=s.distance;s.branchAt=0;s.route=route;s.distance=0;}
 hide('choice',true);saveTrip(true);updateHud();focusRoad();announce('RUMBO A '+getRoute(route).name);
}
function toggleMode(){s.mode=s.mode==='cruise'?'arcade':'cruise';saveTrip(true);updateHud();announce(s.mode==='cruise'?'CRUCERO · TU RITMO':'ARCADE · ACTIVIDADES OPCIONALES');}

function applySettings(){
 document.documentElement.classList.toggle('reduced-motion',settings.reducedMotion);
 document.documentElement.classList.toggle('high-contrast',settings.highContrast);
 document.documentElement.classList.toggle('large-hud',settings.hudScale==='large');
 if($('app'))$('app').dataset.mood=settings.mood;
 audio.setMix(settings);syncSettingsControls();
}
function syncSettingsControls(){
 for(const [key,value] of Object.entries(settings)){
  const control=$(key+'Pick');if(!control)continue;
  if(control.type==='checkbox')control.checked=value;else control.value=String(value);
 }
 if($('activityPick'))$('activityPick').value=s.run.activity.type;
 if($('introRoutePick'))$('introRoutePick').value=s.route;
 if($('introModePick'))$('introModePick').value=s.mode;
 text('garageSummary',VEHICLES[s.vehicle].name+' · '+HANDLING[s.vehicle].label);
}
for(const key of Object.keys(DEFAULT_SETTINGS)){
 bind(key+'Pick',event=>{
  const control=event.currentTarget;
  const value=control.type==='checkbox'?control.checked:['musicVolume','engineVolume','ambientVolume'].includes(key)?Number(control.value):control.value;
  const candidate=validateSettings({schemaVersion:2,...settings,[key]:value});
  if(!candidate||candidate[key]!==value){syncSettingsControls();return;}
  settings=candidate;if(key==='vehicle'){s.vehicle=settings.vehicle;settings.paint=VEHICLES[s.vehicle].color;}
  if(!writeSettings(storage,settings))warnStorage();
  applySettings();if(key==='quality'){renderScale=1;performanceSamples=[];fastWindows=0;size();}
  updateHud();saveTrip(true);
 },['musicVolume','engineVolume','ambientVolume'].includes(key)?'input':'change');
}
function setAudio(enabled){
 Promise.resolve(audio.enable(enabled)).then(ok=>{
  if(ok===false){audioEnabled=false;text('audio','♪ AUDIO OFF');$('audio')?.setAttribute('aria-pressed','false');announce('AUDIO BLOQUEADO · TOCA AUDIO O REVISA EL MODO SILENCIO');return;}
  audioEnabled=enabled;text('audio',enabled?'♪ AUDIO ON':'♪ AUDIO OFF');$('audio')?.setAttribute('aria-pressed',String(enabled));updateRadio();
 }).catch(()=>announce('AUDIO NO DISPONIBLE EN ESTE NAVEGADOR'));
}
function updateRadio(){text('radioStation',typeof audio.stationName==='function'?audio.stationName():audio.stationName);}
bind('audio',()=>setAudio(!audioEnabled));
bind('radioNext',()=>{audio.nextStation();updateRadio();announce('EMISORA · '+(typeof audio.stationName==='function'?audio.stationName():audio.stationName));});

function renderJournal(){
 const all=Object.entries(STORIES).flatMap(([route,items])=>items.map(item=>({...item,route})));
 text('journalCount',journalData.memories.length+' DE '+all.length+' RECUERDOS DESCUBIERTOS');
 const container=$('journalEntries');if(container){container.replaceChildren();for(const item of all){
  const found=journalData.memories.includes(storyKey(item.route,item.id)),card=document.createElement('article');card.className='memory-card'+(found?'':' locked');
  const region=document.createElement('small'),title=document.createElement('strong'),desc=document.createElement('p');
  region.textContent=getRoute(item.route).name;title.textContent=found?item.title:'RECUERDO POR DESCUBRIR';desc.textContent=found?item.memento:'Parada en el km '+(item.at/1000).toFixed(1);
  card.append(region,title,desc);container.append(card);
 }}
 const endings=$('endingEntries');if(endings){endings.replaceChildren();for(const [route,variants] of Object.entries(ENDINGS))for(const [kind,[title,description]] of Object.entries(variants)){const found=journalData.endings.includes(route+':'+kind);const item=document.createElement('article');item.className='memory-card'+(found?'':' locked');const heading=document.createElement('strong'),body=document.createElement('p');heading.textContent=found?title:getRoute(route).name+' · FINAL POR DESCUBRIR';body.textContent=found?description:'Termina esta carretera; tus encuentros cambian la despedida.';item.append(heading,body);endings.append(item);}}
 text('endingCount',journalData.endings.length+' / 16 DESENLACES');
 const log=$('activityLog');if(log){log.replaceChildren();
  if(!activityLog.records.length){const p=document.createElement('p');p.textContent='Elige una actividad opcional en el garaje para registrar tu próximo viaje.';log.append(p);}
  for(const entry of [...activityLog.records].reverse()){
   const p=document.createElement('p');p.textContent=ACTIVITIES[entry.type].name+' · '+getRoute(entry.route).name+' · '+Math.round(entry.elapsed)+' S';log.append(p);
  }
 }
}
function updateActivity(previousStatus){
 const a=s.run.activity,target=ACTIVITIES[a.type].target;
 text('activityHud',a.type==='none'?'VIAJE LIBRE':ACTIVITIES[a.type].name+' · '+(a.status==='complete'?'COMPLETADO':s.mode==='cruise'?'EN ESPERA':a.type==='clean'?Math.min(100,Math.floor(a.progress/target*100))+'%':a.type==='flow'?Math.min(target,Math.floor(a.progress))+' / '+target+' S':a.progress+' / '+target));
 if(a.status==='complete'){
  const id=s.run.id+':'+a.type;
  if(!activityLog.records.some(record=>record.id===id)){
   const updated={schemaVersion:1,records:[...activityLog.records,{id,type:a.type,route:s.route,vehicle:s.vehicle,elapsed:s.run.elapsed,completedAt:Date.now()}].slice(-60)};
   if(writeActivityLog(storage,updated)){activityLog=updated;if(previousStatus!=='complete')announce('ACTIVIDAD COMPLETADA · '+ACTIVITIES[a.type].name);}
   else if(previousStatus!=='complete'){warnStorage();announce('ACTIVIDAD COMPLETADA · REGISTRO NO GUARDADO');}
  }
 }
}
bind('activityPick',event=>{const type=event.currentTarget.value;if(!Object.hasOwn(ACTIVITIES,type))return;s.run=selectActivity(s.run,type,s.distance);saveTrip(true);updateHud();announce(ACTIVITIES[type].hint);},'change');
bind('collectMemory',()=>{
 const entry=storyNear(s.route,s.distance,115);
 if(!entry||Math.abs(s.speed)>=5||!started||paused||modal){announce('DETÉN EL COCHE CERCA DE LA PARADA');return;}
 const key=storyKey(s.route,entry.id),found=journalData.memories.includes(key);
 const updated=safeJournal({schemaVersion:1,memories:[...journalData.memories,key],endings:journalData.endings});
 if(!writeJournal(storage,updated)){warnStorage();announce('EL RECUERDO NO SE HA GUARDADO · PUEDES REINTENTAR');return;}
 journalData=updated;const old=s.run.activity.status;s.run=rememberStop(s.run,key,s.mode);updateActivity(old);saveTrip(true);
 announce(found?'PARADA RECORDADA EN ESTE VIAJE':'RECUERDO GUARDADO EN TU DIARIO');updateStory();updateHud();
});
function openEncounter(){
 const event=encounterNear(s.route,s.distance,s.run.journey);
 if(!event||!started||paused||modal||Math.abs(s.speed)>=5)return;
 currentEncounter=event;text('encounterTitle',event.title);text('encounterText',event.text);
 text('encounterFirst',event.options[0][0]);text('encounterSecond',event.options[1][0]);openModal('encounter');
}
bind('meet',openEncounter);bind('closeEncounter',()=>closeModal());
for(const [button,index] of [['encounterFirst',0],['encounterSecond',1]])bind(button,()=>{
 if(modal!=='encounter'||!currentEncounter)return;
 const event=currentEncounter;s.run.journey=chooseEncounter(s.run.journey,event.id,index);currentEncounter=null;
 saveTrip(true);closeModal();announce(event.options[index][2]);syncRoadEvents();
});
function updateEncounter(){
 const event=encounterApproach(s.route,s.distance,s.run.journey);
 const visible=!!event&&started&&!paused&&!modal&&!s.finished;
 hide('encounterStop',!visible);if(!visible){currentEncounterNotice='';return;}
 const remaining=event.at-s.distance,near=!!encounterNear(s.route,s.distance,s.run.journey);
 text('encounterTeaser',event.title);
 text('encounterHint',remaining>125?`Encuentro en ${(remaining/1000).toFixed(1)} km · Levanta el pie y frena antes de la parada`:remaining< -125?'Has pasado la parada · reduce y da marcha atrás para acercarte':Math.abs(s.speed)<5?'Parada cercana · toca ESCUCHAR para conocer la historia':'Parada cercana · frena por debajo de 5 km/h y toca ESCUCHAR');
 if($('meet'))$('meet').disabled=!near||Math.abs(s.speed)>=5;
 if(currentEncounterNotice!==event.id){currentEncounterNotice=event.id;announce(`PRÓXIMA HISTORIA · ${event.title} · PREPARA LA FRENADA`);}
}
function updateStory(){
 const entry=storyNear(s.route,s.distance,115),key=entry?storyKey(s.route,entry.id):'';
 const collected=journalData.memories.includes(key),visited=(s.run.activity.stops||[]).includes(key);
 const exploration=s.mode==='arcade'&&s.run.activity.type==='explore'&&s.run.activity.status==='active';
 const visible=!!entry&&(!collected||(exploration&&!visited))&&started&&!paused&&!modal&&!s.finished;
 hide('storyStop',!visible);if(!visible)return;
 if(activeStory!==key){activeStory=key;text('storySpeaker',entry.speaker);text('storyTitle',entry.title);text('storyText',entry.text);}
 const canSave=Math.abs(s.speed)<5;if($('collectMemory')){$('collectMemory').disabled=!canSave;$('collectMemory').textContent=collected?'RECORDAR ESTA PARADA':'GUARDAR RECUERDO';}
 text('storyHint',canSave?'Motor en reposo. Tómate este momento.':'Frena y detente a menos de 115 m de la parada');
}
bind('postcard',()=>{
 if(s.route!=='coast'||s.distance<2800||s.distance>3300||Math.abs(s.speed)>=5){announce('DETÉN EL VEHÍCULO JUNTO AL MIRADOR');return;}
 if(!writePostcard(storage)){warnStorage();text('postcardState','POSTAL NO GUARDADA · REINTENTA');announce('LA POSTAL NO SE HA GUARDADO');return;}
 s.postcard=true;text('postcardState','POSTAL GUARDADA LOCALMENTE');saveTrip(true);announce('RECUERDO DEL FARO DESCUBIERTO');
});

const routeCards=$('routeCards');
if(routeCards)for(const [id,route] of Object.entries(ROUTES)){
 const button=document.createElement('button');button.className='route-card';button.dataset.route=id;
 const title=document.createElement('strong'),region=document.createElement('span'),detail=document.createElement('small');
 title.textContent=route.name;region.textContent=route.region;detail.textContent=(route.length/1000).toFixed(1)+' KM · '+route.landmarks.length+' PARADAS';button.append(title,region,detail);
 button.addEventListener('click',()=>reset(id));routeCards.append(button);
}
for(const [button,name] of [['garage','garage'],['routeMenu','routes'],['journal','journal'],['help','help'],['photo','photo']])bind(button,()=>{if(name!=='photo'||started)openModal(name);});
for(const id of ['closeGarage','closeRoutes','closeJournal','closeHelp','closePhoto'])bind(id,()=>closeModal());
bind('start',()=>beginTrip(false));bind('continue',()=>beginTrip(true));bind('pause',()=>pause());bind('reset',()=>{if(started)reset();});bind('mode',toggleMode);
bind('introGarage',()=>openModal('garage'));
bind('introRoutePick',event=>{if(started||!Object.hasOwn(ROUTES,event.currentTarget.value))return;const activity=s.run.activity.type;s=initialState(event.currentTarget.value,s.mode);s.run=selectActivity(s.run,activity,0);syncSettingsControls();updateHud();render();},'change');
bind('introModePick',event=>{if(started||!['cruise','arcade'].includes(event.currentTarget.value))return;s.mode=event.currentTarget.value;updateHud();},'change');
bind('coast',()=>{const j=junctionApproach(s,s.distance);if(j)choose(j.options[0]);});bind('mountain',()=>{const j=junctionApproach(s,s.distance);if(j)choose(j.options[1]);});
bind('driveAgain',()=>reset());bind('nextRoute',()=>reset(routeOrder[(routeOrder.indexOf(s.route)+1)%routeOrder.length]));bind('returnHome',returnHome);bind('home',returnHome);

function downloadBlob(blob,filename){
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}
bind('backupExport',()=>{
 saveTrip(true);
 try{
  const backup=createBackup(storage);
  // If storage is unavailable, export the current in-memory data as a usable rescue copy.
  backup.data.settings={schemaVersion:2,...settings};backup.data.journal=journalData;backup.data.activities=activityLog;
  if(started&&!s.finished){const trip=validateTrip({schemaVersion:2,...s});if(trip)backup.data.trip={schemaVersion:2,...trip};}
  downloadBlob(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),'CHASE-404_COPIA_'+new Date().toISOString().slice(0,10)+'.json');announce('COPIA DESCARGADA');
 }catch{announce('NO SE HA PODIDO DESCARGAR LA COPIA');}
});
bind('backupPreviousExport',()=>{
 try{
  const previous=storage.getItem(PREIMPORT_KEY);
  if(!previous){announce('NO HAY COPIA PREVIA A UNA RESTAURACIÓN');return;}
  const backup=validateBackup(JSON.parse(previous));
  if(!backup){announce('LA COPIA ANTERIOR NO ES VÁLIDA');return;}
  downloadBlob(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),'CHASE-404_COPIA-ANTERIOR_'+backup.exportedAt.slice(0,10)+'.json');announce('COPIA ANTERIOR DESCARGADA');
 }catch{announce('NO SE HA PODIDO DESCARGAR LA COPIA ANTERIOR');}
});
bind('backupImport',async event=>{
 const input=event.currentTarget,file=input.files?.[0];if(!file)return;
 try{
  if(file.size>524288)throw new Error('La copia supera 512 KB');
  const raw=JSON.parse(await file.text());if(!validateBackup(raw))throw new Error('Copia inválida o de otra versión');
  saveTrip(true);
  const result=importBackup(storage,raw);if(!result.ok)throw new Error(result.rollbackOk===false?'No se ha restaurado: revisa el almacenamiento y conserva tu copia':result.error);
  settings=readSettings(storage);journalData=readJournal(storage);activityLog=readActivityLog(storage);started=false;s=initialState();
  applySettings();configureRenderer();returnHome();refreshContinue();announce('COPIA RESTAURADA · PUEDES CONTINUAR EL VIAJE');
 }catch(error){announce('IMPORTACIÓN CANCELADA · '+error.message);}finally{input.value='';}
},'change');
bind('capturePhoto',()=>{
 try{
  if(renderer!=='webgl'||!webgl)throw new Error('WebGL no disponible');
  render();const source=canvas3d,photo=document.createElement('canvas');photo.width=source.width;photo.height=source.height;
  photo.getContext('2d').drawImage(source,0,0);
  photo.toBlob(blob=>{if(!blob){announce('NO SE HA PODIDO CAPTURAR LA FOTO');return;}downloadBlob(blob,'CHASE-404_'+s.route+'_'+new Date().toISOString().replace(/[:.]/g,'-')+'.png');announce('FOTO DESCARGADA · SIN INTERFAZ');},'image/png');
 }catch{announce('FOTO NO DISPONIBLE · REINTENTA CUANDO WEBGL ESTÉ ACTIVO');}
});

function updateHud(){
 const section=routeSection(s.route,s.distance),chapter=CHAPTERS[s.route][getRoute(s.route).sections.indexOf(section)];
 text('chapterTitle',chapter[0]);text('chapterDetail',chapter[1]);text('roadAdvice',chapter[2]+' · RECOMENDADA');
 text('driveHint',Math.abs(s.slide||0)>.22?'DERRAPE · SUELTA EL FRENO Y CORRIGE':s.wallContact?'BORDE · RECUPERA LA TRAZADA':s.braking?'FRENANDO':HANDLING[s.vehicle].label);
 text('carHud',VEHICLES[s.vehicle].name);text('speed',String(Math.round(Math.abs(s.speed))).padStart(3,'0'));
 text('gear',(s.speed<-.5?'R':s.speed>.5?'D':'N')+' · '+(s.mode==='cruise'?'CRUCERO':'ARCADE'));
 text('mode',s.mode==='cruise'?'CRUCERO':'ARCADE');$('mode')?.setAttribute('aria-pressed',String(s.mode==='arcade'));
 text('distance',(s.distance/1000).toFixed(1).padStart(4,'0')+' KM');text('location',getRoute(s.route).name);
 const landmark=nearestLandmark(s.route,s.distance,160);text('landmarkHud',landmark?landmark.name:getRoute(s.route).region);
 text('pause',paused?'▶ SEGUIR':'Ⅱ PAUSA');$('pause')?.setAttribute('aria-pressed',String(paused));
 if($('routeProgress')){$('routeProgress').value=s.distance;$('routeProgress').max=getRoute(s.route).length;}
 updateActivity();
}
function finishTrip(){
 if(s.finished)return;s.distance=getRoute(s.route).length;s.speed=0;s.steerMomentum=0;s.finished=true;paused=true;clearKeys();
 const ending=endingFor(s.route,s.run.journey);text('finishTitle',ending.title);text('finishStory',ending.text);
 journalData=safeJournal({...journalData,endings:[...journalData.endings,ending.id]});
 const endingSaved=writeJournal(storage,journalData);
 if(endingSaved&&clearTrip(storage))savedTrip=null;else warnStorage();
 const run=s.run,memories=journalData.memories.filter(key=>key.startsWith(s.route+':')).length;
 text('finishStats',getRoute(s.route).name+' · '+(run.travelled/1000).toFixed(1)+' KM · '+Math.round(run.elapsed/60)+' MIN · '+run.contacts+' CONTACTOS · '+memories+'/'+STORIES[s.route].length+' RECUERDOS');
 text('nextRoute','SIGUIENTE · '+getRoute(routeOrder[(routeOrder.indexOf(s.route)+1)%routeOrder.length]).name);
 hide('storyStop',true);hide('stop',true);hide('choice',true);openModal('finish');announce('HAS LLEGADO · EL CAMINO SIGUE CUANDO TÚ QUIERAS');
}
function syncRoadEvents(){
 const junction=junctionApproach(s,s.distance),active=!!junction&&Math.abs(junction.remaining)<=165&&started&&!paused&&!modal;
 hide('choice',!active);
 if(active){text('coast','1 · '+getRoute(junction.options[0]).name);text('mountain','2 · '+getRoute(junction.options[1]).name);}
 const routeJunction=getRoute(s.route).junction;
 if(routeJunction&&!s.choices.includes(s.route)&&s.distance>routeJunction.at+165){s.choices.push(s.route);s.selected=true;announce('SIGUIENDO '+getRoute(s.route).name);}
 hide('stop',!(s.route==='coast'&&s.distance>=2800&&s.distance<=3300&&!s.postcard&&started&&!paused&&!modal));
 if(s.distance>=getRoute(s.route).length&&!s.finished)finishTrip();
 updateStory();updateEncounter();updateHud();
}
function simulate(dt,input){
 const previous=s,oldStatus=s.run.activity.status;
 const steeringFactor=settings.steering==='soft'?.76:settings.steering==='sharp'?1.25:1;
 s=advance(s,{...input,steeringFactor},dt);trafficClock+=dt;s.trafficClock=trafficClock;
 s=resolveTrafficContact(s,trafficCars(s.distance,settings.traffic,trafficClock),dt);
 s.run=tickRun(previous.run,previous,s,input,dt);
 if(s.contact)announce(s.wallContact?'BORDE DE CARRETERA · CORRIGE LA TRAYECTORIA':'CONTACTO LEVE · SIGUE TU VIAJE');
 updateActivity(oldStatus);
 if(s.distance>=getRoute(s.route).length)finishTrip();
}

function configureRenderer(){
 try{
  if(!canvas3d)throw new Error('No existe el lienzo WebGL');
  if(!webgl)webgl=makeWebGLRenderer(canvas3d,{onContextLost:()=>{rendererFailed=true;renderer='unavailable';paused=true;clearKeys();saveTrip(true);showRenderer();announce('CONTEXTO WEBGL PERDIDO · EL VIAJE ESTÁ EN PAUSA');}});
  renderer='webgl';rendererFailed=false;
 }catch(error){renderer='unavailable';rendererFailed=true;webgl=null;console.info('CHASE-404: WebGL unavailable',error.message);}
 showRenderer();size();
}
bind('retryRenderer',()=>{try{webgl?.dispose();}catch{}webgl=null;configureRenderer();announce(renderer==='webgl'?'WEBGL ACTIVO · YA PUEDES CONDUCIR':'WEBGL SIGUE SIN ESTAR DISPONIBLE · REVISA LA ACELERACIÓN GRÁFICA');});
function showRenderer(){
 const ready=renderer==='webgl'&&!!webgl;
 canvas.style.visibility='visible';canvas.style.opacity='0';if(canvas3d){canvas3d.style.visibility=ready?'visible':'hidden';canvas3d.style.pointerEvents='none';}
 for(const id of ['cameraPick','headlightsPick'])if($(id)){$(id).disabled=!ready;$(id).title=ready?'':'Requiere WebGL activo';}
 for(const id of ['start','continue'])if($(id))$(id).disabled=!ready;
 hide('rendererWarning',ready);
 text('renderStatus',ready?'WEBGL · 3D':'WEBGL NO DISPONIBLE');
}
function size(){
 const ratio=settings.quality==='low'?1:settings.quality==='high'?2:(window.innerWidth<700?1:1.5),dpr=Math.min(window.devicePixelRatio||1,ratio)*(settings.quality==='auto'?renderScale:1);
 const w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
 canvas.width=w;canvas.height=h;
 if(canvas3d){canvas3d.width=w;canvas3d.height=h;if(webgl)webgl.resize(w,h);}
}
function render(dt=0){
 if(renderer==='webgl'&&webgl){
  try{webgl.render(s,settings,dt,animationClock);}catch(error){rendererFailed=true;renderer='unavailable';paused=true;clearKeys();showRenderer();console.info('CHASE-404: WebGL rendering failed',error.message);saveTrip(true);announce('ERROR DE RENDERIZADO WEBGL · EL VIAJE ESTÁ EN PAUSA');}
 }
 drawMiniMap(mctx,s);
}
let gamepadStart=false,gamepadConnected=false;
function gamepadInput(){
 const input={};let pad=null;
 try{pad=Array.from(navigator.getGamepads?.()||[]).find(value=>value&&value.connected);}catch{}
 if(!pad){if(gamepadConnected){gamepadConnected=false;text('gamepadStatus','SIN MANDO');}gamepadStart=false;return input;}
 if(!gamepadConnected){gamepadConnected=true;text('gamepadStatus','MANDO DETECTADO');}
 const axis=Number.isFinite(pad.axes[0])?pad.axes[0]:0;input.steerAxis=Math.abs(axis)<.16?0:Math.sign(axis)*Math.min(1,(Math.abs(axis)-.16)/.84);
 input.left=input.steerAxis<0;input.right=input.steerAxis>0;
 input.gas=(pad.buttons[7]?.value||0)>.15||!!pad.buttons[0]?.pressed;
 input.brake=(pad.buttons[6]?.value||0)>.15||!!pad.buttons[1]?.pressed;
 input.throttle=pad.buttons[0]?.pressed?1:Math.max(0,Math.min(1,pad.buttons[7]?.value||0));
 input.braking=pad.buttons[1]?.pressed?1:Math.max(0,Math.min(1,pad.buttons[6]?.value||0));
 input.handbrake=!!pad.buttons[2]?.pressed;
 const start=!!pad.buttons[9]?.pressed;if(start&&!gamepadStart&&started&&!modal)pause();gamepadStart=start;
 return input;
}
function frame(time){
 raf=0;if(document.hidden){last=0;return;}
 const elapsed=last?Math.max(0,(time-last)/1000):0;last=time;
 const pad=gamepadInput();
 if(started&&!paused&&!modal&&!s.finished){
  if(settings.quality==='auto'&&elapsed>0&&elapsed<.5){
   performanceSamples.push(elapsed);
   if(performanceSamples.length>=90){const mean=performanceSamples.reduce((sum,n)=>sum+n,0)/performanceSamples.length;performanceSamples=[];
    const before=renderScale;if(mean>.038){renderScale=Math.max(.6,renderScale*.85);fastWindows=0;}else if(mean<.021){if(++fastWindows>=3){renderScale=Math.min(1,renderScale/.85);fastWindows=0;}}else fastWindows=0;
    if(before!==renderScale)size();
   }
  }
  const input={};for(const key of Object.keys(keys))input[key]=keys[key]||pad[key];
  input.steerAxis=keys.left||keys.right?(keys.right?1:0)-(keys.left?1:0):(pad.steerAxis||0);
  input.throttle=keys.gas?1:(pad.throttle||0);input.braking=keys.brake?1:(pad.braking||0);
  stepper.update(elapsed,dt=>{if(!paused&&!s.finished)simulate(dt,input);});
  if(time-lastSaveTime>5000){saveTrip();lastSaveTime=time;}
 }else stepper.reset();
 if((!started||(!paused&&!modal))&&!settings.reducedMotion)animationClock+=Math.min(elapsed,.25);
 syncRoadEvents();audio.update(s,settings,paused||!started);render(paused||modal?0:Math.min(elapsed,.25));
 raf=requestAnimationFrame(frame);
}
function editing(target){return !!target?.closest?.('input,select,textarea,[contenteditable="true"]');}
window.addEventListener('keydown',event=>{
 if(modal){
  if(event.code==='Escape'&&modal!=='intro'&&modal!=='finish'){event.preventDefault();closeModal();}
  return;
 }
 if(editing(event.target))return;
 if(aliases[event.code]&&started&&!paused&&!s.finished){event.preventDefault();keyCodes.add(event.code);syncKey(aliases[event.code]);}
 if(event.repeat)return;
 if(event.code==='KeyP'||event.code==='Escape'){event.preventDefault();pause();}
 if(event.code==='KeyR'&&started)reset();
 if(event.code==='KeyE'){event.preventDefault();openEncounter();}
 if(event.code==='KeyH'){event.preventDefault();openModal('help');}
 if(event.code==='KeyF'&&started){event.preventDefault();openModal('photo');}
 if(event.code==='Digit1'||event.code==='Digit2'){const junction=junctionApproach(s,s.distance);if(junction)choose(junction.options[event.code==='Digit1'?0:1]);}
});
window.addEventListener('keyup',event=>{if(aliases[event.code]){keyCodes.delete(event.code);syncKey(aliases[event.code]);}});
window.addEventListener('blur',()=>{clearKeys();stepper.reset();last=0;if(started&&!s.finished){if(!modal)pause(true);else pausedBeforeModal=true;saveTrip(true);}});
window.addEventListener('pagehide',()=>saveTrip(true));
window.addEventListener('resize',size);
canvas3d?.addEventListener('webglcontextrestored',()=>{webgl?.dispose();webgl=null;rendererFailed=false;configureRenderer();announce('RENDER 3D RESTAURADO');});
document.addEventListener('visibilitychange',()=>{
 clearKeys();stepper.reset();last=0;
 if(document.hidden){if(started&&!s.finished){if(!modal)pause(true);else pausedBeforeModal=true;saveTrip(true);}if(raf){cancelAnimationFrame(raf);raf=0;}}
 else if(!raf)raf=requestAnimationFrame(frame);
});
for(const button of document.querySelectorAll('[data-control]')){
 const name=button.dataset.control,activate=(event,source)=>{event.preventDefault();if(!started||paused||modal)return;if(source==='pointer')try{button.setPointerCapture(event.pointerId);}catch{}(source==='pointer'?pointerKeys:touchKeys).add(name);button.classList.add('pressed');syncKey(name);focusRoad();},release=source=>{(source==='pointer'?pointerKeys:touchKeys).delete(name);syncKey(name);button.classList.toggle('pressed',pointerKeys.has(name)||touchKeys.has(name));};
 if('PointerEvent' in window){button.addEventListener('pointerdown',event=>activate(event,'pointer'));for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>release('pointer'));}
 // iOS and embedded browsers can dispatch touch events even when pointer support
 // exists. Both event paths write to the same held-key Set, so releasing either
 // compatibility event cannot leave a control stuck.
 button.addEventListener('touchstart',event=>activate(event,'touch'),{passive:false});for(const type of ['touchend','touchcancel'])button.addEventListener(type,()=>release('touch'),{passive:true});
 button.addEventListener('contextmenu',event=>event.preventDefault());
}
document.addEventListener('keydown',event=>{
 if(event.key!=='Tab'||!modal)return;
 const dialog=$(panelIds[modal]),items=Array.from(dialog?.querySelectorAll('button:not(:disabled):not([hidden]),select:not(:disabled),input:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')||[]).filter(el=>el.getClientRects().length);
 if(!items.length)return;
 const first=items[0],lastItem=items.at(-1);
 if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();lastItem.focus();}
 else if(!event.shiftKey&&(document.activeElement===lastItem||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
});

// Opt-in local QA hooks. Absent during normal play and never exposed by default.
if(new URLSearchParams(window.location.search).get('qa')==='1'){
 window.__CHASE_QA__={
  snapshot:()=>JSON.parse(JSON.stringify({state:s,settings,paused,started,modal,journal:journalData,activityLog,renderer})),
  teleport(partial){
   const route=Object.hasOwn(ROUTES,partial.route)?partial.route:s.route,vehicle=Object.hasOwn(VEHICLES,partial.vehicle)?partial.vehicle:s.vehicle;
   s={...s,...partial,route,vehicle,distance:clamp(Number.isFinite(partial.distance)?partial.distance:s.distance,0,getRoute(route).length),x:clamp(Number.isFinite(partial.x)?partial.x:s.x,-1.52,1.52),speed:clamp(Number.isFinite(partial.speed)?partial.speed:s.speed,-24,172)};
   if(!validateRun(s.run))s.run=createRun(s.distance);syncRoadEvents();render();
  },
  tick(seconds,input={}){if(!Number.isFinite(seconds)||seconds<0||seconds>600)return;const count=Math.floor(seconds*60);for(let i=0;i<count&&started&&!paused&&!s.finished&&!modal;i++)simulate(1/60,input);syncRoadEvents();render();return this.snapshot();},
  metrics:()=>({...webgl?.metrics(),renderer,renderScale,pixelWidth:canvas.width,pixelHeight:canvas.height}),
  render:()=>render()
 };
}
refreshContinue();applySettings();updateRadio();configureRenderer();updateHud();if(readPostcard(storage))text('postcardState','POSTAL YA DESCUBIERTA');render();
$('start')?.focus({preventScroll:true});
if(!document.hidden)raf=requestAnimationFrame(frame);
