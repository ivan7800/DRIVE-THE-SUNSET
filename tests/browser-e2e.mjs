/* Optional development-only native-browser checks. The game has no browser-test
 * dependency at runtime. A real Chromium binary and Playwright must be supplied.
 * WebGL on SwiftShader is a software implementation, never a physical GPU test.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let playwright;
try{playwright=require(require.resolve('playwright',{paths:[root,process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean)}));}catch{throw Error('Playwright is required only for this development check. Install it in a separate QA environment.');}
const executablePath=process.env.CHASE_BROWSER_BINARY;if(!executablePath)throw Error('Set CHASE_BROWSER_BINARY to an actual Chromium executable.');
const evidence=process.env.CHASE_QA_EVIDENCE||resolve(root,'../final-evidence');await mkdir(evidence,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!pathname.startsWith('/CHASE-404/')){res.writeHead(404);res.end();return;}
  let file=resolve(root,pathname.slice('/CHASE-404/'.length)||'index.html');
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  if((await stat(file)).isDirectory())file=resolve(file,'index.html');
  const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/CHASE-404/`,results=[],errors=[],requests=[],benchmarks=[],consoleErrors=[];
let browser;
try{
 const args=['--disable-dev-shm-usage','--enable-unsafe-swiftshader'];if(process.getuid?.()===0)args.push('--no-sandbox');
 browser=await playwright.chromium.launch({executablePath,headless:true,args});
 const context=await browser.newContext({viewport:{width:1280,height:720},acceptDownloads:true});
 const page=await context.newPage();page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)requests.push({url:response.url(),status:response.status()});});
 const snapshot=()=>page.evaluate(()=>window.__CHASE_QA__.snapshot());
 await page.goto(base+'index.html?qa=1');await page.waitForFunction(()=>!!window.__CHASE_QA__);await page.screenshot({path:resolve(evidence,'browser-desktop-intro.png')});
 await page.locator('#start').click();assert((await snapshot()).started);await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');assert((await snapshot()).state.distance>0);results.push('native browser entry, first frame and W');
 await page.locator('#garage').click();await page.locator('#rendererPick').selectOption('canvas');await page.locator('#vehiclePick').selectOption('meridian');await page.locator('#moodPick').selectOption('rain');await page.locator('#closeGarage').click();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'game');assert.equal((await snapshot()).state.vehicle,'meridian');await page.keyboard.down('KeyW');await page.waitForTimeout(150);await page.keyboard.up('KeyW');results.push('garage state and native focus return');
 for(const [open,close] of [['help','closeHelp'],['journal','closeJournal'],['routeMenu','closeRoutes']]){
  await page.locator('#'+open).click();assert((await snapshot()).modal);await page.keyboard.press('Escape');assert.equal((await snapshot()).modal,null);assert.equal(await page.evaluate(()=>document.activeElement.id),'game');
 }
 results.push('help, journal and routes native Escape/focus');
 await page.locator('#garage').click();await page.locator('#rendererPick').selectOption('webgl');await page.locator('#closeGarage').click();
 const renderer=(await snapshot()).renderer;
 const gpu=await page.evaluate(()=>{const canvas=document.getElementById('game3d'),gl=canvas?.getContext('webgl');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)}});
 await page.screenshot({path:resolve(evidence,'browser-desktop-driving.png')});results.push('selected renderer '+renderer+'; '+JSON.stringify(gpu));
 const {ROUTES}=await import('../js/routes.js'),{STORIES}=await import('../js/stories.js');
 for(const [from,to] of [['coast','mountain'],['mountain','vineyards'],['vineyards','carmelo']]){
  await page.evaluate(({from,at})=>window.__CHASE_QA__.teleport({route:from,distance:at,speed:40,finished:false,choices:[]}),{from,at:ROUTES[from].junction.at});await page.locator('#mountain').click();const state=(await snapshot()).state;assert.equal(state.route,to);assert(state.distance<ROUTES[to].length);
 }
 results.push('three junctions with valid destination progress');
 for(const [route,items] of Object.entries(STORIES)){
  for(const story of items){await page.evaluate(({route,at})=>window.__CHASE_QA__.teleport({route,distance:at,speed:0,finished:false}),{route,at:story.at});await page.locator('#collectMemory').click();}
  await page.evaluate(({route,length})=>{window.__CHASE_QA__.teleport({route,distance:length-.1,speed:20,finished:false});window.__CHASE_QA__.tick(.1,{gas:true})},{route,length:ROUTES[route].length});assert.equal((await snapshot()).modal,'finish');await page.locator('#nextRoute').click();
 }
 assert.equal((await snapshot()).journal.memories.length,16);results.push('16 memories and four complete routes');
 await page.locator('#photo').click();const photoDownload=page.waitForEvent('download');await page.locator('#capturePhoto').click();const photo=await photoDownload;assert.match(photo.suggestedFilename(),/\.png$/);const png=await readFile(await photo.path());assert.equal(png.subarray(1,4).toString(),'PNG');await page.locator('#closePhoto').click();results.push('native PNG photo download');
 await page.locator('#journal').click();const backupDownload=page.waitForEvent('download');await page.locator('#backupExport').click();const download=await backupDownload;const backup=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(backup.app,'CHASE-404');assert.equal(backup.data.journal.memories.length,16);await page.locator('#closeJournal').click();results.push('native backup download');
 await page.reload();await page.waitForFunction(()=>!!window.__CHASE_QA__);assert.equal((await snapshot()).journal.memories.length,16);await page.locator('#continue').click();results.push('local storage after reload and resume');
 const {ENCOUNTERS}=await import('../js/journey.js');
 for(const [route,events] of Object.entries(ENCOUNTERS)){
  await page.locator('#routeMenu').click();await page.locator('[data-route="'+route+'"]').click();
  for(const event of events){
   await page.evaluate(({route,at})=>window.__CHASE_QA__.teleport({route,distance:at,speed:0,x:0}),{route,at:event.at});
   await page.locator('#meet').click();assert.equal((await snapshot()).modal,'encounter');
   await page.locator('#encounterFirst').click();assert.equal((await snapshot()).modal,null);assert.equal(await page.evaluate(()=>document.activeElement.id),'game');
  }
  await page.evaluate(({length})=>{window.__CHASE_QA__.teleport({distance:length-.1,speed:20});window.__CHASE_QA__.tick(.1,{gas:true})},{length:ROUTES[route].length});
  assert((await snapshot()).journal.endings.includes(route+':promise'));await page.screenshot({path:resolve(evidence,'ending-'+route+'.png')});await page.locator('#nextRoute').click();
 }
 results.push('eight optional encounter dialogs, four native route endings and focus recovery');
 await page.reload();await page.waitForFunction(()=>!!window.__CHASE_QA__);const recoveredEndings=(await snapshot()).journal.endings;assert(Object.keys(ENCOUNTERS).every(route=>recoveredEndings.includes(route+':promise')));await page.locator('#continue').click();results.push('story endings survive native reload');
 // Sample real RAF intervals. SwiftShader and this host are explicitly reported.
 await page.locator('#garage').click();await page.locator('#rendererPick').selectOption('webgl');await page.locator('#qualityPick').selectOption('low');await page.locator('#moodPick').selectOption('sunset');await page.locator('#closeGarage').click();
 for(const [route,distance] of [['coast',620],['mountain',2500],['vineyards',3400],['carmelo',2250]]){
  await page.locator('#routeMenu').click();await page.locator('[data-route="'+route+'"]').click();
  await page.evaluate(({route,distance})=>window.__CHASE_QA__.teleport({route,distance,speed:70,x:0}),{route,distance});
  const sample=await page.evaluate(async()=>{const intervals=[];let previous=null;await new Promise(resolve=>{let warm=8;function tick(t){if(warm>0){warm--;previous=t;}else{intervals.push(t-previous);previous=t;}if(intervals.length>=45)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});const sorted=[...intervals].sort((a,b)=>a-b);const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;return {fps:1000/mean,meanMs:mean,p95Ms:sorted[Math.floor(sorted.length*.95)],frames:intervals.length,heapBytes:performance.memory?.usedJSHeapSize||null,renderer:window.__CHASE_QA__.metrics()};});
  benchmarks.push({route,quality:'low',...sample});await page.screenshot({path:resolve(evidence,'road-'+route+'.png')});
 }
 results.push('real RAF/heap samples on four routes; metrics are host-specific, not hardware certification');
 await page.locator('#garage').click();await page.locator('#qualityPick').selectOption('auto');await page.locator('#closeGarage').click();await page.keyboard.down('KeyW');
 const autoSample=await page.evaluate(async()=>{const times=[];let last=null;await new Promise(resolve=>{let count=0;function tick(t){if(last!==null&&count>180)times.push(t-last);last=t;if(++count>=226)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});return {fps:1000/(times.reduce((a,b)=>a+b,0)/times.length),frames:times.length,renderer:window.__CHASE_QA__.metrics()};});await page.keyboard.up('KeyW');benchmarks.push({route:'carmelo',quality:'auto',...autoSample});
 assert.equal(await page.evaluate(()=>document.getElementById('game3d').getContext('webgl').getError()),0,'browser WebGL no GL error after driving');
 // Exercise context loss/restoration using the browser extension, including fallback.
 const canLose=await page.evaluate(()=>{const gl=document.getElementById('game3d').getContext('webgl'),ext=gl?.getExtension('WEBGL_lose_context');if(!ext)return false;window.__qaLose=ext;ext.loseContext();return true;});
 if(canLose){await page.waitForFunction(()=>window.__CHASE_QA__.snapshot().renderer==='canvas');await page.evaluate(()=>window.__qaLose.restoreContext());await page.waitForFunction(()=>window.__CHASE_QA__.snapshot().renderer==='webgl');results.push('native WebGL context loss switches to Canvas and restores 3D');}
 // Verify Web Audio produces a signal, without claiming a human listening test.
 await page.evaluate(()=>{const AC=window.AudioContext||window.webkitAudioContext,create=AC.prototype.createDynamicsCompressor;AC.prototype.createDynamicsCompressor=function(){const node=create.call(this),analyser=this.createAnalyser();analyser.fftSize=2048;node.connect(analyser);window.__qaAudio={context:this,analyser};return node;};});
 await page.locator('#audio').click();await page.waitForFunction(()=>window.__qaAudio?.context.state==='running');await page.waitForTimeout(350);
 const rms=await page.evaluate(()=>{const values=new Float32Array(2048);window.__qaAudio.analyser.getFloatTimeDomainData(values);return Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length);});assert(rms>0,'real Web Audio outputs nonzero signal');await page.locator('#audio').click();results.push('Web Audio graph starts and produces signal; audible mix not listened to');
 await page.goto(base+'index.html');assert.equal(await page.evaluate(()=>typeof window.__CHASE_QA__),'undefined');results.push('QA hook absent by default');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,acceptDownloads:true}),m=await mobile.newPage();m.on('pageerror',error=>errors.push('mobile: '+error.message));
 await m.goto(base+'index.html?qa=1');await m.waitForFunction(()=>!!window.__CHASE_QA__);await m.screenshot({path:resolve(evidence,'browser-mobile-intro.png')});
 const overflow=await m.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);assert.equal(overflow,false,'no horizontal mobile overflow');await m.locator('#start').click();
 const gas=m.locator('[data-control="gas"]');const bounds=await gas.boundingBox();assert(bounds&&bounds.width>=44&&bounds.height>=44,'touch target');await m.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await m.mouse.down();await m.waitForTimeout(300);await m.mouse.up();assert((await m.evaluate(()=>window.__CHASE_QA__.snapshot())).state.distance>0);await m.screenshot({path:resolve(evidence,'browser-mobile-driving.png')});results.push('390x844 native mobile layout and pointer-held accelerator (no physical mobile claim)');
 await m.setViewportSize({width:844,height:390});await m.locator('#garage').click();assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await m.screenshot({path:resolve(evidence,'mobile-landscape-garage.png')});await m.locator('#closeGarage').click();await m.setViewportSize({width:390,height:844});await m.evaluate(()=>window.__CHASE_QA__.teleport({route:'coast',distance:620,speed:0}));await m.locator('#meet').click();await m.screenshot({path:resolve(evidence,'mobile-encounter.png')});await m.locator('#encounterFirst').click();assert.equal(await m.evaluate(()=>window.__CHASE_QA__.snapshot().modal),null);results.push('native mobile portrait encounter and landscape garage');
 assert.deepEqual(errors,[],'no uncaught JavaScript exceptions');assert.deepEqual(requests,[],'no failed resource requests');assert.deepEqual(consoleErrors,[],'no browser console errors');
 await writeFile(resolve(evidence,'browser-results.json'),JSON.stringify({result:'PASS',browser:await browser.version(),viewport:[1280,720],benchmarks,mobileViewport:[390,844],gpu,renderer,results,errors,requests,consoleErrors,scope:'Native headless Chromium. Software WebGL where reported; no physical GPU/Windows/Mint/mobile/gamepad or gameplay-feel certification.'},null,2));
 console.log('PASS:',results.length,'native browser flows; see evidence for actual renderer and platform scope.');
}catch(error){await writeFile(resolve(evidence,'browser-failure.txt'),error.stack);throw error;}
finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
