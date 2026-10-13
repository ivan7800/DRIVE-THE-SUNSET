const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createGame,hasCanvas}=require('./runtime-harness.cjs');
const evidence=process.env.CHASE_QA_EVIDENCE;
const tests=[];
async function test(name,fn){await fn();tests.push({name,result:'PASS',scope:'Actual ESM + mocked WebGL API; simulated DOM events, no browser layout/GPU'});console.log('PASS:',name);}
if(!hasCanvas){console.log('PENDIENTE: Canvas2D nativo. Para este smoke de desarrollo se necesita @napi-rs/canvas.');process.exit(0)}
(async()=>{
 await test('actual native module entry and WebGL test-renderer frame',async()=>{
  const game=await createGame();assert(game.qa);assert.equal(game.qa.snapshot().renderer,'webgl');
  assert(game.nativeCanvas.toBuffer('image/png').length>1000,'WebGL test renderer produced pixels');
  if(evidence){fs.mkdirSync(evidence,{recursive:true});game.savePng(path.join(evidence,'coast-first-frame.png'));}
  const normal=await createGame({}, {qa:false});assert.equal(normal.qa,undefined,'diagnostic hook absent by default');
  const mirror=await createGame({}, {classic:true});mirror.click('start');mirror.qa.render();assert(mirror.nativeCanvas.toBuffer('image/png').length>1000,'classic isolated mirror renders through WebGL test seam');
  assert.deepEqual(mirror.nativeCanvas.toBuffer('image/png'),game.nativeCanvas.toBuffer('image/png'),'isolated classic mirror matches native ESM first frame');
 });
 await test('start, garage/help/journal close return driving focus',async()=>{
  const game=await createGame();game.key('KeyR');assert.equal(game.qa.snapshot().started,false);game.click('start');
  for(const [open,close] of [['garage','closeGarage'],['help','closeHelp'],['journal','closeJournal']]){
   game.click(open);assert(game.qa.snapshot().modal);game.click(close);assert.equal(game.document.activeElement.id,'game');assert.equal(game.qa.snapshot().paused,false);
  }
  const before=game.qa.snapshot().state.distance;game.key('KeyW');game.frame(1000);game.frame(1100);game.key('KeyW','keyup');assert(game.qa.snapshot().state.distance>before);
  game.click('garage');game.key('KeyW');const stopped=game.qa.snapshot().state.distance;game.frame(1200);game.frame(1400);assert.equal(game.qa.snapshot().state.distance,stopped);game.click('closeGarage');
 });
 await test('legacy resume synchronizes vehicle, mode and garage',async()=>{
  const trip={schemaVersion:1,route:'mountain',vehicle:'phantom',mode:'arcade',distance:800,x:.1,selected:true,postcard:false,finished:false};
  const game=await createGame({'last-light-trip-v1':JSON.stringify(trip)});assert.equal(game.elements.get('continue').hidden,false);game.click('continue');
  assert.equal(game.elements.get('mode').textContent,'ARCADE');game.click('garage');assert.equal(game.elements.get('vehiclePick').value,'phantom');assert.equal(game.qa.snapshot().state.mode,'arcade');
 });
 await test('pause, blur and visibility suspend simulation and clear held keys',async()=>{
  const game=await createGame();game.click('start');game.qa.tick(1,{gas:true});game.click('pause');const distance=game.qa.snapshot().state.distance;
  game.qa.tick(2,{gas:true});game.frame(1000);game.frame(1200);assert.equal(game.qa.snapshot().state.distance,distance);game.click('pause');
  const speedBeforeBlur=game.qa.snapshot().state.speed;game.key('KeyW');game.dispatch('blur');assert(game.qa.snapshot().paused);game.visible(true);assert.equal(game.frames.size,0);game.visible(false);assert.equal(game.frames.size,1);
  game.click('pause');game.frame(1300);game.frame(1400);assert(game.qa.snapshot().state.speed<speedBeforeBlur,'no held gas survived blur');
 });
 await test('all three junctions select valid continuing destination roads',async()=>{
  const game=await createGame();game.click('start');
  const {ROUTES}=await import('../js/routes.js');
  for(const [from,to] of [['coast','mountain'],['mountain','vineyards'],['vineyards','carmelo']]){
   game.qa.teleport({route:from,distance:ROUTES[from].junction.at,speed:40,finished:false,choices:[]});game.click('mountain');
   const state=game.qa.snapshot().state;assert.equal(state.route,to);assert.equal(state.branchFrom,from);assert(state.distance<ROUTES[to].length,'destination is not already finished');
   game.qa.tick(.2,{gas:true});assert.equal(game.qa.snapshot().state.finished,false,'junction continues driving');
  }
 });
 await test('failed postcard/journal storage does not report persistence',async()=>{
  const game=await createGame();game.click('start');game.qa.teleport({distance:2900,speed:0});
  game.storage.setItem=()=>{throw Error('denied')};game.click('postcard');assert.equal(game.qa.snapshot().state.postcard,false);assert.match(game.elements.get('postcardState').textContent,/NO GUARDADA/);assert.equal(game.store.has('last-light-postcard-v1'),false);
  game.qa.teleport({distance:1030,speed:0});game.click('collectMemory');assert.equal(game.qa.snapshot().journal.memories.length,0);assert.match(game.elements.get('toast').textContent,/NO SE HA GUARDADO/);
 });
 await test('24 memories, six route endings and journal reload',async()=>{
  const {ROUTES}=await import('../js/routes.js'),{STORIES}=await import('../js/stories.js');let game=await createGame();game.click('start');
  for(const [route,items] of Object.entries(STORIES)){
   for(const story of items){game.qa.teleport({route,distance:story.at,speed:0,finished:false});game.click('collectMemory');}
   game.qa.teleport({route,distance:ROUTES[route].length-.1,speed:20,finished:false});game.qa.tick(.1,{gas:true});assert.equal(game.qa.snapshot().state.finished,true);assert.equal(game.qa.snapshot().modal,'finish');assert.equal(game.qa.snapshot().state.speed,0);game.click('nextRoute');
  }
  assert.equal(game.qa.snapshot().journal.memories.length,24);assert.equal(game.store.has('last-light-trip-v1'),true,'next route created resumable trip');
  game=await createGame(Object.fromEntries(game.store));game.click('journal');assert.equal(game.qa.snapshot().journal.memories.length,24);assert.equal(game.elements.get('journalEntries').children.length,24);
 });
 await test('backup download and photo PNG use rendered WebGL canvas pixels',async()=>{
  const game=await createGame();game.click('start');game.click('backupExport');assert(game.downloads.length>0);const backup=JSON.parse(await game.downloads.at(-1).blob.text());assert.equal(backup.app,'CHASE-404');
  game.click('photo');assert.equal(game.qa.snapshot().paused,true);game.click('capturePhoto');
  const photo=game.downloads.at(-1);assert.match(photo.filename,/\.png$/);const bytes=Buffer.from(await photo.blob.arrayBuffer());assert.equal(bytes.subarray(1,4).toString(),'PNG');assert(bytes.length>1000);game.click('closePhoto');assert.equal(game.document.activeElement.id,'game');
 });
 await test('live backup import restores rather than overwrites the imported trip',async()=>{
  const source=await createGame();source.click('start');source.click('garage');source.change('vehiclePick','meridian');source.click('closeGarage');source.click('mode');source.qa.teleport({route:'carmelo',distance:4200,speed:0});source.click('backupExport');const backup=JSON.parse(await source.downloads.at(-1).blob.text());
  const target=await createGame();target.click('start');target.qa.teleport({distance:900,speed:0});const input=target.elements.get('backupImport');input.files=[{size:4000,text:async()=>JSON.stringify(backup)}];await input.dispatch('change').completion;
  assert.equal(target.qa.snapshot().started,false);assert.equal(target.qa.snapshot().modal,'intro');target.click('continue');const restored=target.qa.snapshot().state;assert.equal(restored.route,'carmelo');assert.equal(restored.distance,4200);assert.equal(restored.vehicle,'meridian');assert.equal(restored.mode,'arcade');
  target.click('journal');target.click('backupPreviousExport');const previous=JSON.parse(await target.downloads.at(-1).blob.text());assert.equal(previous.data.trip.route,'coast');assert.equal(previous.data.trip.distance,900,'previous backup remains accessible from UI');target.click('closeJournal');
  const before=JSON.stringify(target.qa.snapshot().state),stored=target.store.get('last-light-trip-v1');input.files=[{size:50,text:async()=>'{not JSON'}];await input.dispatch('change').completion;
  assert.equal(JSON.stringify(target.qa.snapshot().state),before);assert.equal(target.store.get('last-light-trip-v1'),stored,'invalid UI import preserves active save');
 });
 await test('Cruise keeps memories while Arcade alone awards exploration',async()=>{
  const {STORIES}=await import('../js/stories.js');const game=await createGame();game.click('start');game.click('garage');game.change('activityPick','explore');game.click('closeGarage');
  for(const story of STORIES.coast.slice(0,3)){game.qa.teleport({distance:story.at,speed:0});game.click('collectMemory');}
  assert.equal(game.qa.snapshot().journal.memories.length,3);assert.equal(game.qa.snapshot().state.run.activity.progress,0);assert.equal(game.qa.snapshot().activityLog.records.length,0);
  game.click('mode');
  for(const story of STORIES.coast.slice(0,3)){game.qa.teleport({distance:story.at,speed:0});assert(!game.elements.get('storyStop').classList.contains('hidden'),'Cruise memory can be revisited in Arcade');game.click('collectMemory');}
  assert.equal(game.qa.snapshot().state.run.activity.status,'complete');assert.equal(game.qa.snapshot().activityLog.records.length,1);assert.equal(game.qa.snapshot().journal.memories.length,3,'journal does not duplicate revisited memories');
 });
 await test('three radio stations and unavailable audio report a useful error',async()=>{
  const game=await createGame();const names=new Set([game.elements.get('radioStation').textContent]);game.click('radioNext');names.add(game.elements.get('radioStation').textContent);game.click('radioNext');names.add(game.elements.get('radioStation').textContent);assert.equal(names.size,3);
  game.click('audio');await Promise.resolve();await Promise.resolve();assert.match(game.elements.get('toast').textContent,/AUDIO (?:NO DISPONIBLE|BLOQUEADO)/);
 });
 await test('all routes, cars and weather remain available in WebGL-only mode',async()=>{
  const game=await createGame();game.click('start');game.click('garage');assert.equal(game.qa.snapshot().renderer,'webgl');assert.equal(game.elements.has('rendererPick'),false,'there is no selectable 2D renderer');game.click('closeGarage');const {ROUTES}=await import('../js/routes.js');
  for(const route of Object.keys(ROUTES))for(const mood of ['sunset','night','rain','dawn']){
   game.click('garage');game.change('moodPick',mood);game.click('closeGarage');game.qa.teleport({route,distance:ROUTES[route].landmarks[1].at,speed:50,finished:false});game.qa.render();
   if(evidence)game.savePng(path.join(evidence,`webgl-${route}-${mood}.png`));
  }
  for(const id of ['vesper','solstice','phantom','meridian']){game.click('garage');game.change('vehiclePick',id);game.click('closeGarage');game.qa.render();assert.equal(game.qa.snapshot().state.vehicle,id);}
  game.click('garage');assert.equal(game.elements.get('cameraPick').disabled,false,'WebGL camera selector is available');assert.equal(game.elements.get('headlightsPick').disabled,false,'WebGL headlight switch is available');game.click('closeGarage');
 });
 await test('WebGL failure blocks driving and does not start a 2D fallback',async()=>{
  const game=await createGame({}, {webgl:false});assert.equal(game.qa.snapshot().renderer,'unavailable');assert.equal(game.elements.get('start').disabled,true);assert.equal(game.elements.get('rendererWarning').classList.contains('hidden'),false);game.click('start');assert.equal(game.qa.snapshot().started,false);
 });
 if(evidence)fs.writeFileSync(path.join(evidence,'runtime-smoke.json'),JSON.stringify({runtime:process.version,renderer:'test WebGL seam; native browser/GPU tested separately',tests},null,2));
 console.log('WebGL/DOM smoke complete. Native browser focus/layout, GPU, physical input and gameplay feel remain separate checks.');
})().catch(error=>{console.error(error);if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'runtime-failure.txt'),error.stack)}process.exitCode=1});
