const assert=require('node:assert/strict');
const {createGame}=require('./runtime-harness.cjs');
(async()=>{
 const {ENCOUNTERS}=await import('../js/journey.js');const {ROUTES}=await import('../js/routes.js');
 let game=await createGame();game.click('start');
 const gasButton=game.all.find(element=>element.dataset.control==='gas');assert(gasButton,'touch accelerator exists');gasButton.dispatch('touchstart',{touches:[{identifier:1}]});game.frame(900);game.frame(1200);assert(game.qa.snapshot().state.distance>0,'touchstart accelerates on browsers without Pointer Events');gasButton.dispatch('touchend',{changedTouches:[{identifier:1}]});game.frame(1300);assert.equal(game.qa.snapshot().state.throttle,0,'touchend releases accelerator');
 const pointerGame=await createGame({}, {pointerEvents:true});pointerGame.click('start');const pointerGas=pointerGame.all.find(element=>element.dataset.control==='gas');pointerGas.dispatch('pointerdown',{pointerId:2});pointerGas.dispatch('touchstart',{touches:[{identifier:2}]});pointerGame.frame(1000);pointerGame.frame(1300);pointerGas.dispatch('pointerup',{pointerId:2});pointerGame.frame(1400);assert.equal(pointerGame.qa.snapshot().state.throttle,1,'pointer release does not cancel an active compatibility touch');pointerGas.dispatch('touchend',{changedTouches:[{identifier:2}]});pointerGame.frame(1500);assert.equal(pointerGame.qa.snapshot().state.throttle,0,'touch release clears the held input');
 game.key('KeyW');game.key('ArrowUp');game.key('KeyW','keyup');game.frame(1000);game.frame(1300);assert(game.qa.snapshot().state.speed>0,'releasing W keeps held Up active');
 game.key('ArrowUp','keyup');const speed=game.qa.snapshot().state.speed;game.frame(1400);assert(game.qa.snapshot().state.speed<speed,'both releases coast');
 for(const [route,events] of Object.entries(ENCOUNTERS)){
  for(const event of events){game.qa.teleport({route,distance:event.at-400,speed:0,finished:false});assert(!game.elements.get('encounterStop').classList.contains('hidden'),'encounter is signposted before its stop');assert(game.elements.get('meet').disabled,'cannot open an encounter before reaching it');game.qa.teleport({route,distance:event.at,speed:0,finished:false});game.click('meet');assert.equal(game.qa.snapshot().modal,'encounter');game.key('KeyW');const before=game.qa.snapshot().state.distance;game.frame(1600);game.frame(1700);assert.equal(game.qa.snapshot().state.distance,before);game.click('encounterFirst');assert.equal(game.qa.snapshot().modal,null);assert.equal(game.document.activeElement.id,'game');assert(game.qa.snapshot().state.run.journey[event.id]);}
  game.qa.teleport({route,distance:ROUTES[route].length-.1,speed:40,finished:false});game.qa.tick(.1);assert.equal(game.qa.snapshot().modal,'finish');assert(game.qa.snapshot().journal.endings.includes(route+':promise'));game.click('nextRoute');
 }
 assert.equal(game.qa.snapshot().journal.endings.length,4);const saved=Object.fromEntries(game.store);game=await createGame(saved);assert.equal(game.qa.snapshot().journal.endings.length,4);game.click('continue');game.qa.teleport({route:'coast',distance:1030,speed:0});game.click('collectMemory');assert.equal(game.qa.snapshot().journal.endings.length,4,'collecting a memory preserves endings');
 game.click('journal');game.click('backupExport');const backup=JSON.parse(await game.downloads.at(-1).blob.text());assert.equal(backup.data.journal.endings.length,4);
 console.log('PASS: actual ESM encounter UI, touch fallback with/without Pointer Events, all four story endings, focus/pause, native Canvas, alias keys, reload and JSON export; DOM events simulated');
 game.click('closeJournal');game.click('garage');game.change('qualityPick','auto');game.click('closeGarage');
 for(let i=0;i<100;i++)game.frame(3000+i*45);
 assert(game.qa.metrics().renderScale<1,'auto quality adapts after slow frame samples');
 game.click('garage');game.change('qualityPick','low');game.click('closeGarage');assert.equal(game.qa.metrics().renderScale,1,'explicit quality resets scale');
 console.log('PASS: automatic resolution adapts to slow frames; explicit quality restores chosen resolution');
})().catch(error=>{console.error(error);process.exitCode=1});
