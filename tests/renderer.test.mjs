import assert from 'node:assert/strict';
import {createWebGLRenderer} from '../webgl/renderer.js';
import {ROUTES} from '../js/routes.js';
import {VEHICLES} from '../js/physics.js';
let allocated=0,upload=null,matrix=null,id=0;const events=new Map(),strides=[];
// Contract mock: compilation and pixel validity are covered separately by the
// native GLES replay. This mock only checks finite geometry/API/state/lifecycle.
const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,HIGH_FLOAT:5,ARRAY_BUFFER:6,STATIC_DRAW:7,DYNAMIC_DRAW:8,DEPTH_TEST:9,BLEND:10,LEQUAL:11,COLOR_BUFFER_BIT:16,DEPTH_BUFFER_BIT:32,FLOAT:12,TRIANGLES:13,SRC_ALPHA:14,ONE_MINUS_SRC_ALPHA:15,
 createShader:()=>({id:++id}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>'',createProgram:()=>({id:++id}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,getProgramInfoLog:()=>'',createBuffer:()=>({id:++id}),bindBuffer(){},
 bufferData(_t,data){if(typeof data==='number')allocated=data;},bufferSubData(_t,_o,data){upload=data.slice();assert(data.every(Number.isFinite),'finite geometry');assert(data.byteLength<=allocated,'upload fits allocated buffer');},getShaderPrecisionFormat:()=>({precision:23}),
 getAttribLocation(_p,n){return {position:0,color:1,normal:2,emissive:3}[n];},getUniformLocation:(_p,n)=>n,uniformMatrix4fv(_u,_t,m){matrix=m.slice();assert(m.every(Number.isFinite),'finite projection');},uniform1f(){},uniform2f(){},uniform3f(){},uniform3fv(){},viewport(){},useProgram(){},enableVertexAttribArray(){},vertexAttribPointer(_a,_b,_c,_d,stride){strides.push(stride);},
 drawArrays(_t,_o,n){assert(Number.isInteger(n),'integer vertex count');},clearColor(){},clear(){},disable(){},enable(){},depthMask(){},depthFunc(){},blendFunc(){},deleteBuffer(){},deleteShader(){},deleteProgram(){},isContextLost:()=>false};
const canvas={width:1280,height:720,getContext(type,opt){assert.equal(type,'webgl');assert.equal(opt.preserveDrawingBuffer,true);return gl;},addEventListener(n,h){events.set(n,h);},removeEventListener(n){events.delete(n);}};
let notified=0;const renderer=createWebGLRenderer(canvas,{onContextLost(){notified++;}});
renderer.resize(1920,1080);assert.equal(canvas.width,1920);assert.equal(canvas.height,1080);
let samples=0,maxVertices=0;
for(const [route,data] of Object.entries(ROUTES))for(const mood of ['sunset','night','rain','dawn'])for(const vehicle of Object.keys(VEHICLES))for(const distance of [0,...data.landmarks.map(mark=>Math.max(0,mark.at-85)),data.length]){
 const state=Object.freeze({vehicle,route,distance,x:0,speed:80,mode:'cruise',trafficClock:200,steerMomentum:0});
 renderer.render(state,Object.freeze({mood,quality:'low',traffic:'normal',paint:'#7733aa',wheels:'sport',camera:'rear',reducedMotion:false}),1/60,120);
 const metrics=renderer.metrics();maxVertices=Math.max(maxVertices,metrics.vertices);assert(metrics.vertices>0);assert(matrix&&upload);samples++;
}
assert(strides.includes(40),'40-byte position/color/normal/emissive geometry');assert(strides.every(stride=>stride===0||stride===40));
let prevented=false;events.get('webglcontextlost')({preventDefault(){prevented=true;}});assert.equal(notified,1);assert(prevented);assert.throws(()=>renderer.render({distance:0,x:0,speed:0}),/perdido/);renderer.dispose();assert.equal(events.size,0);renderer.dispose();assert.throws(()=>renderer.render({distance:0,x:0,speed:0}),/cerrado/);

const descriptor=Object.getOwnPropertyDescriptor(globalThis,'performance');let now=1000;
Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
try{
 const metricsRenderer=createWebGLRenderer(canvas),state=Object.freeze({vehicle:'vesper',route:'coast',distance:0,x:0,speed:60,mode:'cruise',trafficClock:0,steerMomentum:0}),settings=Object.freeze({mood:'sunset',quality:'low',traffic:'off',paint:'#a54548',camera:'rear'});
 metricsRenderer.render(state,settings,1/60,4);now=1200;metricsRenderer.render(state,settings,1/60,4.0166666667);
 assert.equal(metricsRenderer.metrics().avgMs,200);assert.equal(metricsRenderer.metrics().fps,5,'long frame measured without simulation dt cap');
 const frozenUpload=upload.slice(),frozenMatrix=matrix.slice();metricsRenderer.render(state,settings,0,4.0166666667);
 assert.deepEqual(upload,frozenUpload,'photo rerender does not advance car body animation');assert.deepEqual(matrix,frozenMatrix,'photo rerender does not move camera');
 const allocations=metricsRenderer.metrics().reallocations;metricsRenderer.render(state,settings,0,4.0166666667);assert.equal(metricsRenderer.metrics().reallocations,allocations,'same geometry reuses GPU allocation');metricsRenderer.dispose();
}finally{Object.defineProperty(globalThis,'performance',descriptor);}
console.log(JSON.stringify({result:'PASS',samples,maxVertices,contracts:['finite geometry/projection','frozen shared state','stride40','reuse/resize/dispose/context callback','200ms frame = 5fps','photo does not advance animation'],scope:'GL API contract mock; no shader or pixel claim'}));
