/* Export the actual renderer command stream for native GLES replay.
 * Recording alone does not validate GL: tools/gles-smoke.py compiles, links,
 * uploads, draws and reads pixels using Mesa/EGL. No browser is simulated.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createWebGLRenderer} from '../webgl/renderer.js';
import {DEFAULT_SETTINGS} from '../js/save.js';
import {ROUTES} from '../js/routes.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.env.CHASE_QA_EVIDENCE||resolve(root,'../final-evidence'),'gles');mkdirSync(output,{recursive:true});
const constants={ARRAY_BUFFER:0x8892,BLEND:0x0BE2,COLOR_BUFFER_BIT:0x4000,COMPILE_STATUS:0x8B81,DEPTH_BUFFER_BIT:0x0100,DEPTH_TEST:0x0B71,DYNAMIC_DRAW:0x88E8,FLOAT:0x1406,FRAGMENT_SHADER:0x8B30,HIGH_FLOAT:0x8DF2,LEQUAL:0x0203,LINK_STATUS:0x8B82,ONE_MINUS_SRC_ALPHA:0x0303,SRC_ALPHA:0x0302,STATIC_DRAW:0x88E4,TRIANGLES:0x0004,VERTEX_SHADER:0x8B31};
const commands=[],stats=[];let serial=0,binary=0;
function serialize(value){
 if(ArrayBuffer.isView(value)){
  const filename=`buffer-${++binary}.bin`;writeFileSync(resolve(output,filename),Buffer.from(value.buffer,value.byteOffset,value.byteLength));
  return {binary:filename,type:value.constructor.name,length:value.length};
 }
 return value;
}
const gl=new Proxy(constants,{get(target,name){
 if(name in target)return target[name];
 if(name==='getShaderParameter'||name==='getProgramParameter')return ()=>true; // Deferred real validation occurs during native replay.
 if(name==='getShaderPrecisionFormat')return ()=>({precision:23});
 if(name==='isContextLost')return ()=>false;
 if(name==='getShaderInfoLog'||name==='getProgramInfoLog')return ()=>'';
 if(['createBuffer','createProgram','createShader','getAttribLocation','getUniformLocation'].includes(name))return (...args)=>{
  const result={ref:++serial,kind:name};commands.push({fn:name,args:args.map(serialize),result});return result;
 };
 return (...args)=>commands.push({fn:name,args:args.map(serialize)});
}});
const canvas={width:1280,height:720,clientWidth:1280,clientHeight:720,getContext:type=>type==='webgl'?gl:null,addEventListener(){},removeEventListener(){}};
const renderer=createWebGLRenderer(canvas);
for(const [route,data] of Object.entries(ROUTES))for(const [index,landmark] of data.landmarks.entries()){
 const mood=['sunset','night','rain','dawn'][index],vehicle=['vesper','solstice','phantom','meridian'][index];
 const distance=Math.max(0,landmark.at-85),state={route,vehicle,distance,x:0,speed:65,mode:'cruise',selected:false,choices:[],trafficClock:37,steerMomentum:0};
 renderer.render(state,{...DEFAULT_SETTINGS,vehicle,mood,quality:'low',paint:['#a54548','#e7c58e','#588c9c','#516c66'][index],renderer:'webgl'},1/60,4);
 const frame={name:`${route}-${landmark.kind}-${mood}`,route,landmark:landmark.kind,mood,vehicle,distance};commands.push({fn:'__frame',args:[frame]});stats.push({...frame,vertices:renderer.metrics().vertices});
}
renderer.dispose();
// Direction is a visual contract as well as a physics sign: D/right (+x) must
// move the rendered car to the right of the screen in each renderer.
for(const x of [-.5,.5]){
 const lateral=createWebGLRenderer(canvas);
 const state={route:'coast',vehicle:'vesper',distance:0,x,speed:0,mode:'cruise',selected:false,choices:[],trafficClock:0,steerMomentum:0};
 lateral.render(state,{...DEFAULT_SETTINGS,renderer:'webgl',quality:'low',paint:'#ff0000',traffic:'off',mood:'dawn'},0,0);
 const frame={name:`lateral-${x<0?'left':'right'}`,route:'coast',vehicle:'vesper',distance:0,x,expectedCarSide:x<0?'left':'right'};
 commands.push({fn:'__frame',args:[frame]});stats.push({...frame,vertices:lateral.metrics().vertices});lateral.dispose();
}
for(const camera of ['rear','cinematic','hood']){
 const view=createWebGLRenderer(canvas),state={route:'coast',vehicle:'vesper',distance:500,x:0,speed:60,mode:'cruise',selected:false,choices:[],trafficClock:0,steerMomentum:0};
 view.render(state,{...DEFAULT_SETTINGS,renderer:'webgl',quality:'low',paint:'#a54548',traffic:'light',mood:'sunset',camera},1/60,4);
 const frame={name:`camera-${camera}`,route:'coast',vehicle:'vesper',distance:500,camera};commands.push({fn:'__frame',args:[frame]});stats.push({...frame,vertices:view.metrics().vertices});view.dispose();
}
for(const [route,data] of Object.entries(ROUTES)){
 if(!data.junction)continue;
 const view=createWebGLRenderer(canvas),state={route,vehicle:'vesper',distance:data.junction.at-110,x:0,speed:35,mode:'cruise',selected:false,choices:[],trafficClock:0,steerMomentum:0};
 view.render(state,{...DEFAULT_SETTINGS,renderer:'webgl',quality:'low',traffic:'off',mood:'sunset'},1/60,4);
 const frame={name:`junction-${route}`,route,vehicle:'vesper',distance:state.distance,choices:data.junction.choices};commands.push({fn:'__frame',args:[frame]});stats.push({...frame,vertices:view.metrics().vertices});view.dispose();
}
writeFileSync(resolve(output,'commands.json'),JSON.stringify({width:1280,height:720,commands,stats},null,2));console.log('Captured',stats.length,'actual renderer scenes. Compilation/drawing still requires native GLES replay.');
