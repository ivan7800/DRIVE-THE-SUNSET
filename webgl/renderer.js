/** Procedural WebGL view of the shared trip. No simulation, input, HUD or RAF. */
import {roadShape,trafficCars,VEHICLES,clamp,junctionApproach} from '../js/physics.js';
import {getRoute,routeSection} from '../js/routes.js';
import {roadCrossSection,followCamera} from './terrain.js';
import {smoothWeight} from './render-utils.js';
import {motionStep,orientCarVertex} from './vehicle-motion.js';

const CAMERAS=Object.freeze({
 rear:{distance:12.5,height:4.2,look:29,follow:.085},near:{distance:12.5,height:4.2,look:29,follow:.085},
 far:{distance:18,height:6.0,look:36,follow:.07},cinematic:{distance:19,height:6.2,look:39,follow:.045},
 hood:{distance:-1.35,height:1.25,look:48,follow:.18}
});
const MOODS=Object.freeze({
 sunset:{top:[.16,.17,.33],middle:[.69,.40,.46],haze:[.98,.70,.49],fog:[.72,.55,.53],sun:[1,.84,.55],night:0,ambient:.54},
 dawn:{top:[.19,.31,.49],middle:[.65,.66,.73],haze:[1,.79,.65],fog:[.65,.68,.73],sun:[1,.90,.73],night:0,ambient:.66},
 night:{top:[.025,.035,.09],middle:[.075,.11,.21],haze:[.20,.24,.34],fog:[.11,.15,.24],sun:[.79,.87,1],night:1,ambient:.20},
 rain:{top:[.10,.13,.23],middle:[.26,.29,.37],haze:[.47,.46,.53],fog:[.34,.38,.46],sun:[.63,.66,.75],night:.65,ambient:.38}
});
const CAR_SHAPES=Object.freeze({
 vesper:{length:4.8,width:1.98,body:.76,roof:1.33,roofFront:.37,roofBack:-1.33,roofWidth:1.42,frontRoofWidth:1.36},
 solstice:{length:4.55,width:1.89,body:.79,roof:1.42,roofFront:.48,roofBack:-1.18,roofWidth:1.49,frontRoofWidth:1.40},
 phantom:{length:4.22,width:1.92,body:.63,roof:1.17,roofFront:.32,roofBack:-1.43,roofWidth:1.47,frontRoofWidth:1.35},
 meridian:{length:4.98,width:2.01,body:.83,roof:1.48,roofFront:.65,roofBack:-1.42,roofWidth:1.53,frontRoofWidth:1.40}
});
const GLYPHS=Object.freeze({
 A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],
 C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],
 E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],
 I:['11111','00100','00100','00100','00100','00100','11111'],L:['10000','10000','10000','10000','10000','10000','11111'],
 M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],
 Z:['11111','00001','00010','00100','01000','10000','11111'],
 ' ':['00000','00000','00000','00000','00000','00000','00000']
});
const shade=(rgb,n)=>rgb.map(v=>clamp(v*n,0,1));
const rgb=hex=>/^#[0-9a-f]{6}$/i.test(hex||'')?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255):[.63,.23,.26];
const noise=n=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);};
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0];}
function lookAt(eye,target){
 let z=eye.map((v,i)=>v-target[i]);const zn=Math.hypot(...z)||1;z=z.map(v=>v/zn);
 // The shared road advances along +Z. Preserve +X as screen-right and +Y as up.
 let x=[-z[2],0,z[0]];const xn=Math.hypot(...x)||1;x=x.map(v=>v/xn);
 const y=[x[1]*z[2]-x[2]*z[1],x[2]*z[0]-x[0]*z[2],x[0]*z[1]-x[1]*z[0]];
 return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,
  -x.reduce((s,v,i)=>s+v*eye[i],0),-y.reduce((s,v,i)=>s+v*eye[i],0),-z.reduce((s,v,i)=>s+v*eye[i],0),1];
}
function multiply(a,b){const c=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)c[col*4+row]+=a[k*4+row]*b[col*4+k];return c;}

export function createWebGLRenderer(canvas,options={}){
 if(!canvas||typeof canvas.getContext!=='function')throw new TypeError('Canvas WebGL no disponible');
 const gl=canvas.getContext('webgl',{antialias:true,alpha:false,depth:true,preserveDrawingBuffer:true});
 if(!gl)throw new Error('WebGL no disponible');
 let disposed=false,contextLost=false;const shaders=[],programs=[],buffers=[];
 function compile(kind,source){
  const s=gl.createShader(kind);if(!s)throw new Error('No se ha podido reservar un shader');
  shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Shader WebGL: '+gl.getShaderInfoLog(s));return s;
 }
 function program(vs,fs){
  const p=gl.createProgram();if(!p)throw new Error('No se ha podido reservar un programa gráfico');
  programs.push(p);gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Programa WebGL: '+gl.getProgramInfoLog(p));return p;
 }
 const highp=gl.getShaderPrecisionFormat?.(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT)?.precision>0?'highp':'mediump';
 let scene,sky,geometryBuffer,skyBuffer;
 try{
  scene=program(`attribute vec3 position;attribute vec3 color;attribute vec3 normal;attribute float emissive;
   uniform mat4 viewProjection;varying vec3 worldPosition;varying vec3 tint;varying vec3 surfaceNormal;varying float glow;
   void main(){worldPosition=position;tint=color;surfaceNormal=normal;glow=emissive;gl_Position=viewProjection*vec4(position,1.);}`,
  `precision ${highp} float;varying vec3 worldPosition;varying vec3 tint;varying vec3 surfaceNormal;varying float glow;
   uniform vec3 eye;uniform vec3 fogColor;uniform vec3 sunColor;uniform vec3 headOrigin;uniform vec2 headForward;
   uniform float ambient;uniform float nightMode;uniform float headlightsEnabled;uniform float fogNear;uniform float fogFar;uniform float wet;
   void main(){
    vec3 n=normalize(surfaceNormal);float diffuse=max(dot(n,normalize(vec3(-.42,.83,.35))),0.);
    vec3 base=tint*(ambient+diffuse*(.47-nightMode*.18));base*=mix(vec3(1.),sunColor,.15);
    vec2 rel=worldPosition.xz-headOrigin.xz;float forward=dot(rel,headForward);
    float lateral=abs(rel.x*headForward.y-rel.y*headForward.x);float beamWidth=1.0+max(forward,0.)*.20;
    float cone=1.-smoothstep(beamWidth*.36,beamWidth,lateral);
    float reach=smoothstep(0.,2.,forward)*(1.-smoothstep(35.,86.,forward));
    float ground=1.-smoothstep(1.4,4.5,abs(worldPosition.y-headOrigin.y));
    float beam=headlightsEnabled*(.13+nightMode*.63)*cone*reach*ground/(1.+max(forward,0.)*.016);
    base+=vec3(.97,.86,.61)*beam*(.36+max(n.y,0.)*.26);base+=tint*glow;
    float shimmer=wet*max(n.y,0.)*beam*.18;base+=vec3(.50,.58,.72)*shimmer;
    float fog=smoothstep(fogNear,fogFar,length(worldPosition-eye));base=mix(base,fogColor,fog);
    gl_FragColor=vec4(clamp(base,0.,1.),1.);
   }`);
  sky=program(`attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,.9999,1.);}`,
  `precision mediump float;varying vec2 uv;uniform vec3 topColor;uniform vec3 midColor;uniform vec3 hazeColor;uniform vec3 sunColor;
   uniform float horizon;uniform float nightMode;uniform float landscape;uniform float aspect;uniform float phase;uniform float rain;uniform float overlay;uniform float heading;
   float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
   void main(){
    if(overlay>.5){
     vec2 r=vec2((uv.x+uv.y*.12)*94.,uv.y*10.+phase*3.0);vec2 cell=floor(r);
     float line=(1.-smoothstep(.025,.075,abs(fract(r.x)-.5)))*step(.78,hash(vec2(cell.x,floor(r.y*.12))))*(1.-smoothstep(.13,.68,fract(r.y)));
     gl_FragColor=vec4(.70,.79,.91,line*.35*rain);return;
    }
    float h=clamp((uv.y-horizon)/max(.1,1.-horizon),0.,1.);
    vec3 color=mix(hazeColor,midColor,smoothstep(0.,.40,h));color=mix(color,topColor,smoothstep(.3,1.,h));
    vec2 sunDelta=(uv-vec2(.76,.77))*vec2(aspect,1.);float sunDistance=length(sunDelta);
    color+=sunColor*(1.-smoothstep(.035,.043,sunDistance))*(1.-rain*.9);
    color+=sunColor*exp(-sunDistance*14.)*(.20-nightMode*.12)*(1.-rain);
    vec2 starCell=floor(uv*vec2(250.,140.));float star=step(.996,hash(starCell));
    star*=1.-smoothstep(.06,.27,length(fract(uv*vec2(250.,140.))-.5));color+=vec3(star*nightMode*.7*smoothstep(horizon+.09,1.,uv.y));
    float cloud=sin(uv.x*16.+heading*4.)*.3+sin(uv.x*31.+uv.y*18.)*.15;
    color=mix(color,midColor*.78,rain*.35*smoothstep(.50,.80,cloud+uv.y));
    float mountain=sin(uv.x*13.+heading*2.)*.019+sin(uv.x*31.-heading)*.011;
    float height=horizon+.045+mountain*(landscape==1.?2.5:1.);
    if(uv.y<height)color=mix(topColor,hazeColor,.33);
    if(uv.y<horizon+.012+sin(uv.x*19.+heading)*.014)color=mix(topColor,hazeColor,.45);
    if(landscape>2.5){float block=floor((uv.x+heading*.035)*63.);float rooftop=horizon+.032+hash(vec2(block,3.))*.064;
     if(uv.y<rooftop){color=mix(topColor,hazeColor,.22);vec2 win=fract(vec2(uv.x*380.,uv.y*270.));
      color+=vec3(.85,.46,.16)*nightMode*step(.88,win.x)*step(.79,win.y)*step(.36,hash(vec2(block,floor(uv.y*270.))));}}
    gl_FragColor=vec4(color,1.);
   }`);
  geometryBuffer=gl.createBuffer();skyBuffer=gl.createBuffer();if(!geometryBuffer||!skyBuffer)throw new Error('No se ha podido reservar la geometría WebGL');
  buffers.push(geometryBuffer,skyBuffer);gl.bindBuffer(gl.ARRAY_BUFFER,skyBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
 }catch(error){for(const b of buffers)gl.deleteBuffer(b);for(const p of programs)gl.deleteProgram(p);for(const s of shaders)gl.deleteShader(s);throw error;}
 const attr=Object.fromEntries(['position','color','normal','emissive'].map(n=>[n,gl.getAttribLocation(scene,n)]));
 const uniforms=Object.fromEntries(['viewProjection','eye','fogColor','sunColor','headOrigin','headForward','ambient','nightMode','headlightsEnabled','fogNear','fogFar','wet'].map(n=>[n,gl.getUniformLocation(scene,n)]));
 const skyPosition=gl.getAttribLocation(sky,'position');
 const skyUniforms=Object.fromEntries(['topColor','midColor','hazeColor','sunColor','horizon','nightMode','landscape','aspect','phase','rain','overlay','heading'].map(n=>[n,gl.getUniformLocation(sky,n)]));
 let staticGeometry=new Float32Array(0),staticKey='',geometryBuilds=0,cacheHits=0,totalVertices=0;
 let tris=[],drawBuffer=new Float32Array(131072),gpuCapacityBytes=0,uploads=0,reallocations=0;
 let transform=null,centers=null,shapeKey='',heightAt=()=>0,centerAt=()=>0,headingAt=()=>0;
 let camera={x:0,y:null,yaw:0},motion={phase:0,roll:0,pitch:0,bob:0,cameraBob:0};
 let lastDistance=null,lastRoute=null,lastSpeed=0,lastRender=0,lastAnimationTime=null,frameTimes=[];
 let state={},settings={},mood=MOODS.sunset,viewDistance=340,detailDistance=100,animationTime=0;
 function onLost(event){event.preventDefault();contextLost=true;options.onContextLost?.(new Error('Contexto WebGL perdido'));}
 function onRestored(){contextLost=true;options.onContextLost?.(new Error('Contexto restaurado: vuelve a intentar WebGL'));}
 canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
 function resize(width,height){
  if(disposed)return;const w=Math.max(1,Math.floor(width||canvas.clientWidth||1)),h=Math.max(1,Math.floor(height||canvas.clientHeight||1));
  if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;gl.viewport(0,0,w,h);
 }
 function transformPoint(point){
  if(!transform)return point;const p=transform.motion?orientCarVertex(point,[0,0,0],transform.motion):point,c=Math.cos(transform.yaw),s=Math.sin(transform.yaw);
  return [transform.origin[0]+p[0]*c+p[2]*s,transform.origin[1]+p[1],transform.origin[2]-p[0]*s+p[2]*c];
 }
 function tri(a,b,c,tint,emission=0){
  a=transformPoint(a);b=transformPoint(b);c=transformPoint(c);const u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]);
  let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;
  n=n.map(v=>v/l);if(n[1]<-.1)n=n.map(v=>-v);for(const p of [a,b,c])tris.push(...p,...tint,...n,emission);
 }
 function quad(a,b,c,d,color,emission=0){tri(a,b,c,color,emission);tri(a,c,d,color,emission);}
 function withTransform(origin,yaw,bodyMotion,draw){const previous=transform;transform={origin,yaw,motion:bodyMotion};draw();transform=previous;}
 function box(x,y,z,w,h,l,color,emission=0){
  const p=(xx,yy,zz)=>[x+xx,y+yy,z+zz];
  quad(p(-w/2,0,-l/2),p(w/2,0,-l/2),p(w/2,h,-l/2),p(-w/2,h,-l/2),shade(color,.80),emission);
  quad(p(-w/2,0,l/2),p(-w/2,h,l/2),p(w/2,h,l/2),p(w/2,0,l/2),color,emission);
  quad(p(-w/2,h,-l/2),p(w/2,h,-l/2),p(w/2,h,l/2),p(-w/2,h,l/2),shade(color,1.08),emission);
  quad(p(-w/2,0,-l/2),p(-w/2,h,-l/2),p(-w/2,h,l/2),p(-w/2,0,l/2),shade(color,.88),emission);
  quad(p(w/2,0,-l/2),p(w/2,0,l/2),p(w/2,h,l/2),p(w/2,h,-l/2),shade(color,.93),emission);
 }
 function roof(x,y,z,w,h,l,color){
  const a=[x-w/2,y,z-l/2],b=[x+w/2,y,z-l/2],c=[x+w/2,y,z+l/2],d=[x-w/2,y,z+l/2],e=[x,y+h,z-l/2],f=[x,y+h,z+l/2];
  tri(a,b,e,color);tri(d,f,c,color);quad(a,e,f,d,shade(color,.84));quad(e,b,c,f,shade(color,1.10));
 }
 function cone(x,y,z,r,h,color,sides=6){for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;tri([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x,y+h,z],shade(color,.84+.16*(i%2)));}}
 function cylinderX(x,y,z,r,width,color,sides=10){
  for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2,p=(xx,t)=>[xx,y+Math.cos(t)*r,z+Math.sin(t)*r];
   quad(p(x-width/2,a),p(x+width/2,a),p(x+width/2,b),p(x-width/2,b),shade(color,.75+.25*(i%2)));
   tri([x-width/2,y,z],p(x-width/2,b),p(x-width/2,a),color);tri([x+width/2,y,z],p(x+width/2,a),p(x+width/2,b),color);
  }
 }
 function tree(x,y,z,scale=1,kind='pine'){
  box(x,y,z,.22*scale,2.8*scale,.22*scale,[.26,.22,.16]);
  if(kind==='palm')for(let i=0;i<7;i++){const a=i/7*Math.PI*2,tip=[x+Math.cos(a)*2.3*scale,y+2.3*scale,z+Math.sin(a)*2.3*scale];
   tri([x-.28*scale,y+3.4*scale,z],[x+.28*scale,y+3.4*scale,z],tip,[.18,.36,.26]);tri([x,y+3.4*scale,z-.28*scale],[x,y+3.4*scale,z+.28*scale],tip,[.21,.40,.27]);}
  else if(kind==='cypress')cone(x,y+.5*scale,z,.68*scale,4.4*scale,[.16,.26,.18],6);
  else if(kind==='pine'){cone(x,y+1.1*scale,z,1.7*scale,2.8*scale,[.14,.29,.24]);cone(x,y+2.3*scale,z,1.15*scale,2.5*scale,[.19,.34,.27]);}
  else{cone(x,y+1.7*scale,z,1.7*scale,1.5*scale,[.29,.42,.26],7);cone(x,y+2.8*scale,z,1.4*scale,1.2*scale,[.34,.46,.27],7);}
 }
 function panelText(text,x,y,z,width,height,color,emission=0){
  const units=text.length*6-1,px=width/units,py=height/7;
  for(let k=0;k<text.length;k++){const glyph=GLYPHS[text[k]]||GLYPHS[' '];for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(glyph[row][col]==='1'){
   const xx=x-width/2+(k*6+col)*px,yy=y+height-row*py;quad([xx,yy-py*.84,z],[xx+px*.80,yy-py*.84,z],[xx+px*.80,yy,z],[xx,yy,z],color,emission);
  }}
 }
 function lamp(x,y,z,side=1){
  box(x,y,z,.13,5,.13,[.21,.25,.29]);box(x-side*.37,y+4.9,z,.85,.12,.14,[.32,.33,.32]);box(x-side*.68,y+4.81,z,.52,.12,.40,[1,.72,.32],mood.night?1.3:.20);
  if(mood.night>.1)quad([x-2.5,y+.035,z-2.4],[x+2.5,y+.035,z-2.4],[x+2.5,y+.035,z+2.4],[x-2.5,y+.035,z+2.4],[.26,.20,.12],.16);
 }
 function building(x,y,z,width=7,height=10,length=8,index=0,urban=true,yaw=0,side=1,gap=100){
  withTransform([x,y,z],yaw,null,()=>{
   const facade=urban?[[.73,.56,.49],[.81,.68,.56],[.59,.54,.51],[.77,.69,.57],[.69,.60,.55],[.59,.64,.62],[.84,.71,.61]][index%7]:[.86,.76,.58];box(0,0,0,width,height,length,facade);
   if(urban){
    box(0,height,0,width+.12,.30,length+.12,[.42,.39,.40]);
    if(index%4===0)box(-width*.21,height+.3,0,1.3,.7,1.2,[.64,.57,.5]);
    if(index%7===2){box(0,height+.30,0,width*.75,.18,length*.72,[.66,.60,.53]);box(width*.22,height+.55,0,.75,.42,.72,[.32,.34,.33]);}
    if(gap<detailDistance&&index%5===1){const trim=-side*(width/2+.07);for(const yy of [2.75,5.40])if(yy<height-.5)box(trim,yy,0,.11,.13,length*.92,[.88,.78,.64]);}
   }else roof(0,height,0,width+.7,1.9,length+.7,[.48,.24,.20]);
   const face=-side*width/2-.016*side,floors=Math.max(1,Math.floor(height/2.7));
   for(let floor=0;floor<floors;floor++)for(let col=0;col<(length>8?3:2);col++){
    const zz=-length*.30+col*(length>8?length*.29:length*.59),yy=1.65+floor*2.65,lit=noise(index*37+floor*3+col)>.45,glass=mood.night>.3&&lit?[.95,.66,.34]:[.15,.23,.26];
    quad([face,yy,zz-.5],[face,yy,zz+.5],[face,yy+1.4,zz+.5],[face,yy+1.4,zz-.5],glass,mood.night>.3&&lit?.90:0);
    if(gap<detailDistance){box(face,yy-.09,zz,.1,.1,1.28,[.86,.76,.62]);if(urban&&floor>0){box(face-side*.3,yy-.10,zz,.70,.11,1.55,[.48,.44,.40]);box(face-side*.60,yy,zz,.06,.70,1.53,[.17,.19,.20]);for(let bar=0;bar<4;bar++)box(face-side*.61,yy,zz-.60+bar*.4,.035,.75,.035,[.21,.22,.23]);}
     else if(!urban){box(face,yy,zz-.65,.09,1.42,.25,[.34,.41,.27]);box(face,yy,zz+.65,.09,1.42,.25,[.34,.41,.27]);}}
   }
   if(urban&&gap<120){
    const facing=-side*width/2-.03*side;quad([facing,0,-1.0],[facing,0,1.0],[facing,2.1,1.0],[facing,2.1,-1.0],[.10,.14,.17]);
    box(facing-side*.26,2.1,0,.68,.17,3.7,index%3?[.38,.19,.19]:[.26,.41,.35]);box(facing-side*.07,2.58,0,.10,.43,3.30,[.15,.21,.23]);
    if(gap<70){const old=transform;transform={origin:transformPoint([facing-side*.13,2.63,0]),yaw:yaw-side*Math.PI/2,motion:null};panelText(index%3?'BAR':'CASA',0,0,.008,2.4,.33,index%3?[1,.47,.25]:[.58,.85,.83],mood.night?.9:.10);transform=old;}
    if(index%5===0&&gap<detailDistance){box(0,height+.65,0,width*.67,.045,.045,[.36,.34,.31]);for(let k=0;k<3;k++)box(-width*.21+k*.70,height+.08,.05,.47,.56,.025,k%2?[.69,.80,.72]:[.93,.84,.71]);}
   }
  });
 }
 function car(x,y,z,model,yaw=0,paint=null,wheels='classic',bodyMotion=null){
  if(model==='meridian1992')model='meridian';
  const p=CAR_SHAPES[model]||CAR_SHAPES.vesper,color=rgb(paint||VEHICLES[model]?.color||'#a54548');
  withTransform([x,y,z],yaw,bodyMotion,()=>{
   const w=p.width,l=p.length,b=p.body,chrome=[.73,.75,.73],glass=[.13,.22,.27],tire=[.045,.050,.061];
   // Contact shadow is local geometry; there are no texture or shadow-map dependencies.
   quad([-w*.58,.015,-l*.55],[w*.58,.015,-l*.55],[w*.58,.015,l*.55],[-w*.58,.015,l*.55],[.09,.10,.12]);
   const corner=model==='solstice'?.045:model==='vesper'?.12:model==='phantom'?.23:.30,hw=w/2,hl=l/2;
   const outline=[[-hw+corner,-hl],[hw-corner,-hl],[hw,-hl+corner],[hw,hl-corner],[hw-corner,hl],[-hw+corner,hl],[-hw,hl-corner],[-hw,-hl+corner]];
   for(let i=0;i<outline.length;i++){const a=outline[i],q=outline[(i+1)%outline.length];
    quad([a[0],.32,a[1]],[q[0],.32,q[1]],[q[0]*.97,b,q[1]],[a[0]*.97,b,a[1]],shade(color,.88+(i%3)*.06));
    tri([0,b,0],[a[0]*.97,b,a[1]],[q[0]*.97,b,q[1]],shade(color,1.04));
   }
   const front=model==='phantom'?b-.09:b,back=model==='phantom'?b+.06:b;
   quad([-w*.46,b,-l*.49],[w*.46,b,-l*.49],[w*.46,back,p.roofBack-.3],[-w*.46,back,p.roofBack-.3],shade(color,1.08));
   quad([-w*.46,front,l*.49],[w*.46,front,l*.49],[w*.40,b,p.roofFront+.58],[-w*.40,b,p.roofFront+.58],shade(color,1.16));
   const rf=p.roofFront,rb=p.roofBack,top=p.roof,rw=p.roofWidth/2,fw=p.frontRoofWidth/2;
   const convertible=model==='solstice';
   if(!convertible)quad([-rw,top,rb],[rw,top,rb],[fw,top,rf],[-fw,top,rf],model==='vesper'?[.16,.17,.18]:shade(color,.96));
   quad([-w*.42,b,rf+.58],[w*.42,b,rf+.58],[fw,top,rf],[-fw,top,rf],glass);
   const rearWindowZ=rb-.63;
   if(!convertible){
    quad([-w*.42,b,rearWindowZ],[-rw,top,rb],[rw,top,rb],[w*.42,b,rearWindowZ],chrome);
    quad([-w*.398,b+.045,rearWindowZ+.01],[-rw*.958,top-.046,rb-.01],[rw*.958,top-.046,rb-.01],[w*.398,b+.045,rearWindowZ+.01],shade(glass,.86));
    for(const t of [.26,.48,.70]){const yy=b+(top-b)*t,zz=rearWindowZ+(rb-rearWindowZ)*t-.01,ww=w*.40+(rw-w*.40)*t;
     quad([-ww,yy,zz],[ww,yy,zz],[ww,yy+.008,zz+.002],[-ww,yy+.008,zz+.002],[.24,.31,.33]);}
   }else{
    // An open cabin and two separate leather seats distinguish the convertible.
    quad([-w*.39,b+.019,-1.08],[w*.39,b+.019,-1.08],[w*.39,b+.019,.87],[-w*.39,b+.019,.87],[.12,.13,.12]);
    box(0,b+.03,.81,1.35,.12,.21,[.32,.25,.18]);
    for(const sx of [-.40,.40]){
     box(sx,b+.035,-.22,.55,.12,.62,[.67,.49,.29]);box(sx,b+.14,-.50,.55,.38,.16,[.74,.57,.35]);box(sx,b+.51,-.50,.32,.12,.13,[.79,.62,.40]);
     box(sx,b+.165,-.18,.045,.015,.54,[.84,.68,.47]);
    }
    box(0,b+.035,-1.14,1.42,.12,.29,[.26,.23,.19]);box(0,top-.025,rf,1.48,.055,.075,chrome);
    for(const side of [-1,1])quad([side*w*.44,b,rf+.59],[side*(w*.44-.055),b,rf+.59],[side*(fw-.045),top,rf],[side*fw,top,rf],chrome);
   }
   for(const side of [-1,1]){
    if(!convertible){quad([side*w*.43,b,rf+.50],[side*fw,top,rf],[side*rw,top,rb],[side*w*.43,b,rearWindowZ],glass);box(side*rw,b+.035,rf-.54,.046,top-b,.075,shade(color,.85));}
    box(side*w*.46,b-.04,0,.035,.055,l*.87,chrome);box(side*w*.51,b-.01,rf+.30,.15,.12,.28,chrome);
    const wheelR=model==='phantom'?.36:.38;for(const zz of [-l*.31,l*.30]){cylinderX(side*w*.46,.39,zz,wheelR,.29,tire,settings.quality==='low'?8:12);cylinderX(side*w*.54,.39,zz,wheels==='sport'?wheelR*.61:wheelR*.55,.026,wheels==='sport'?[.48,.50,.55]:chrome,8);cylinderX(side*w*.553,.39,zz,.09,.029,[.21,.23,.25],6);}
    box(side*.59,.49,-l*.502,.43,model==='solstice'?.28:.15,.035,[.92,.18,.10],.38);box(side*.63,.52,l*.501,model==='vesper'?.43:.52,.17,.034,[.98,.88,.64],mood.night?.8:.15);box(side*w*.43,b-.13,-.25,.13,.038,.26,chrome);
   }
   box(0,.28,-l*.516,w*.86,.13,.12,model==='phantom'?[.14,.17,.20]:chrome);box(0,.30,l*.516,w*.88,.11,.11,model==='phantom'?[.14,.17,.20]:chrome);
   box(0,.46,-l*.520,.43,.11,.016,[.91,.87,.75]);box(0,.47,l*.510,.82,.19,.03,[.16,.19,.21]);for(let k=0;k<6;k++)box(-.36+k*.14,.49,l*.532,.018,.14,.01,chrome);
   if(model==='vesper'){box(0,b+.03,1.45,.9,.075,.62,shade(color,.88));box(0,b+.02,-1.82,1.5,.035,.40,shade(color,.9));for(const side of [-1,1])box(side*.32,.37,-l*.54,.10,.09,.17,[.27,.27,.26]);}
   else if(model==='phantom'){box(0,b+.13,-1.85,1.64,.09,.24,[.14,.18,.20]);for(const side of [-1,1])box(side*.55,b,-1.85,.10,.15,.12,shade(color,.72));box(0,.49,-l*.51,1.47,.08,.042,[.92,.25,.14],.24);}
   else if(model==='solstice'){box(0,b+.01,-1.68,1.49,.035,.49,shade(color,1.07));}
   else{box(0,b+.005,-1.90,1.68,.035,.32,shade(color,1.06));box(0,.48,-l*.51,1.58,.105,.042,[.73,.14,.12],.25);box(0,b+.018,1.48,1.14,.026,.77,shade(color,1.06));}
  });
 }
 function prepareShape(s){
  const key=[s.route||'coast',s.branchFrom||'',s.branchAt??'',s.branchSourceDistance??'',getRoute(s.route).length].join(':');if(key===shapeKey)return;shapeKey=key;
  const max=Math.max(11000,getRoute(s.route).length+1200);centers=new Float32Array(Math.ceil(max/5)+2);
  for(let i=1;i<centers.length;i++)centers[i]=centers[i-1]+roadShape(s,i*5-2.5).curve*1.10;
  centerAt=d=>{const q=clamp(d/5,0,centers.length-1.001),i=Math.floor(q);return centers[i]+(centers[i+1]-centers[i])*(q-i);};
  heightAt=d=>roadShape(s,Math.max(0,d)).elevation*(s.route==='carmelo'?15:s.route==='mountain'?12:7);
  headingAt=d=>Math.atan2(centerAt(d+3)-centerAt(Math.max(0,d-3)),d<3?d+3:6);
 }
 function crossSection(z){
  const route=state.route||'coast',cross=roadCrossSection(centerAt(z),heightAt(z));
  if(route==='coast'){cross[0].y-=12;cross[1].y-=5;cross[6].y+=3;cross[7].y+=12;}
  if(route==='mountain'){cross[0].y-=15;cross[7].y+=22;}
  if(route==='carmelo'){cross[2].y+=.12;cross[5].y+=.12;}
  for(const mark of getRoute(route).landmarks){
   if(mark.kind==='lake'&&Math.abs(mark.at-z)<88){cross[0].y-=12;cross[1].y-=5;}
   if(mark.kind==='bridge'&&Math.abs(mark.at-z)<68){
    const valley=17*(1-Math.pow(Math.abs(mark.at-z)/68,2));
    for(const i of [0,1,2,5,6,7])cross[i].y-=valley;
   }
  }
  return cross;
 }
 function groundAt(z,offset){
  const cross=crossSection(z),x=centerAt(z)+offset;
  for(let i=0;i<cross.length-1;i++)if(x>=cross[i].x&&x<=cross[i+1].x){const t=(x-cross[i].x)/(cross[i+1].x-cross[i].x);return cross[i].y+(cross[i+1].y-cross[i].y)*t;}
  return heightAt(z)-2;
 }
 function terrain(d,end){
  const route=state.route||'coast',urban=route==='carmelo',step=settings.quality==='low'?12:8,ground=rgb(getRoute(route).ground),road=rgb(getRoute(route).road);
  for(let z=Math.floor((d-28)/step)*step;z<end;z+=step){
   // Extend the starting asphalt behind the rear camera; the trip coordinate still stops at zero.
   const a=z,b=z+step;const xa=centerAt(a),xb=centerAt(b),ya=heightAt(a),yb=heightAt(b),sections=[crossSection(a),crossSection(b)];
   for(let k=0;k<7;k++){if(k===3)continue;const u=sections[0][k],v=sections[0][k+1],w=sections[1][k+1],q=sections[1][k],color=route==='coast'&&k===0?[.12,.31,.40]:urban?[.47,.43,.42]:shade(ground,k%2?1.02:.95);quad([u.x,u.y,a],[v.x,v.y,a],[w.x,w.y,b],[q.x,q.y,b],color);}
   const rside=urban?7.25:6.1,shoulder=urban?[.56,.51,.45]:[.60,.51,.39];quad([xa-8.2,ya-.024,a],[xa+8.2,ya-.024,a],[xb+8.2,yb-.024,b],[xb-8.2,yb-.024,b],shoulder);quad([xa-rside,ya,a],[xa+rside,ya,a],[xb+rside,yb,b],[xb-rside,yb,b],shade(road,Math.floor(a/32)%2?1:.96));
   for(const side of [-1,1]){const edge=side*(rside-.32);quad([xa+edge-.08,ya+.014,a],[xa+edge+.08,ya+.014,a],[xb+edge+.08,yb+.014,b],[xb+edge-.08,yb+.014,b],[.88,.79,.62]);if(urban){const xx=side*7.48;quad([xa+xx-.20,ya+.13,a],[xa+xx+.20,ya+.13,a],[xb+xx+.20,yb+.13,b],[xb+xx-.20,yb+.13,b],[.70,.62,.52]);}}
   if(Math.floor(a/16)%2===0)quad([xa-.075,ya+.016,a],[xa+.075,ya+.016,a],[xb+.075,yb+.016,b],[xb-.075,yb+.016,b],[.92,.82,.63]);
  }
 }
 function scenery(d,end){
  const route=state.route||'coast';
  if(route==='carmelo')for(let index=Math.floor((d-20)/13);index*13<end;index++){
   const z=index*13;if(z<0)continue;const y=heightAt(z),x=centerAt(z),yaw=headingAt(z),gap=z-d,plaza=getRoute(route).landmarks.some(mark=>mark.kind==='plaza'&&Math.abs(mark.at-z)<45);
   for(const side of [-1,1]){
    const district=routeSection(route,z).type,viewSide=district==='viewcity'&&side===-1;
    if((!plaza||side===1)&&!viewSide){
     const variation=noise(index*17+side*11),height=(district==='bridge'?4.2:district==='cinema'?9.8:7.2)+Math.floor(noise(index*7+side)*3)*2.7;
     const offset=side*(11.5+variation*1.35),width=6.1+noise(index*23+side)*1.05;
     building(x+offset,groundAt(z,offset),z,width,height,11.3+noise(index*13+side)*1.25,index+(side+1)*9,true,yaw,side,gap);
     if(index%9===4&&gap<detailDistance){const streetX=x+side*8.8;tree(streetX,y,z+4,0.78,'tree');}
    }
    if(viewSide){box(x+side*8.4,y,z,.28,1.1,13,[.54,.49,.43]);if(index%4===0&&gap<detailDistance){box(x+side*9.8,y+.4,z,1,.15,2.8,[.40,.29,.22]);tree(x+side*10.3,y,z+4,1.05,'tree');}}
    if(index%3===0)lamp(x+side*8.9,y,z,side);
    if(index%7===0&&gap<detailDistance){for(let step=0;step<6;step++)box(x+side*(9.2+step*.48),y+step*.20,z,1,.2,2.2,[.56,.51,.45]);box(x+side*11,y+.9,z+1.15,.08,1.4,2.7,[.21,.25,.26]);}
   }
   if(index%2===0&&gap>140&&routeSection(route,z).type!=='viewcity'){building(x+31,y-4,z,9,10+noise(index)*13,13,index,true,yaw,1,gap);building(x-38,y-7,z,13,8+noise(index+13)*11,11,index+3,true,yaw,-1,gap);}
  }
  else if(route==='vineyards')for(let index=Math.floor(d/30)-1;index*30<end;index++){
   const z=index*30;if(z<0)continue;const c=centerAt(z),y=heightAt(z);for(const side of [-1,1]){
    const district=routeSection(route,z).type;
    if(district==='village'){building(c+side*13,groundAt(z,side*13),z,7.5,5.5+(index%3)*2,11,index,false,headingAt(z),side,z-d);if(index%2===0)lamp(c+side*8.6,y,z,side);}
    for(let row=0;row<(district==='village'?1:settings.quality==='low'?3:6);row++){const x=c+side*(16+row*4.8);box(x,y-.2,z,.18,1.16,.18,[.40,.32,.21]);box(x,y+.55,z,1.15,.59,22,[.29+noise(index+row)*.10,.36+noise(row)*.07,.20]);}
    if(index%5===0)tree(c+side*10.9,groundAt(z,side*10.9),z,1.15,'cypress');if(index%11===0)building(c+side*35,groundAt(z,side*35),z,8,3.8,10,index,false,headingAt(z),side,z-d);
   }
  }
  else{
   const step=settings.quality==='low'?24:17;
   for(let index=Math.floor(d/step)-1;index*step<end;index++){
    const z=index*step;if(z<0)continue;const c=centerAt(z),y=heightAt(z);for(const side of [-1,1]){
     if(route==='mountain'){const district=routeSection(route,z).type,offset=side*(13+noise(index+side)*12);if(district!=='lake'||index%3===0)tree(c+offset,groundAt(z,offset),z,1.05+noise(index*3)*.85,'pine');if(district==='forest'&&settings.quality!=='low')tree(c+side*34,groundAt(z,side*34),z+7,1.6,'pine');if(index%2===0&&district!=='lake')cone(c+side*(district==='tunnel'?18:31),groundAt(z,side*31)-2,z,8+noise(index)*8,9+noise(index*4)*10,[.35,.39,.36],5);if(district==='lake'&&side===-1){quad([c-110,y-4,z],[c-18,y-4,z],[c-18,y-4,z+step],[c-110,y-4,z+step],[.17,.38,.43]);}}
     else{const district=routeSection(route,z).type;const offset=side*(11+noise(index+side)*9);if((side===1||index%3===0)&&district!=='tunnel')tree(c+offset,groundAt(z,offset),z,.85+noise(index)*.55,index%3?'palm':'cypress');if(side===1&&(district==='village'?index%2===0:index%9===0))building(c+(district==='village'?14:27),groundAt(z,district==='village'?14:27),z,7,3.6+(district==='village'?index%3*1.8:0),9,index,false,headingAt(z),side,z-d);if(side===1&&district==='tunnel'&&index%2===0)cone(c+19,groundAt(z,19),z,8,12,[.50,.46,.43],5);}
     if(index%2===0){box(c+side*7.4,y,z,.16,.85,.16,[.80,.75,.62]);box(c+side*7.4,y+.6,z,.21,.16,.22,[1,.70,.30],mood.night?.7:0);}
    }
   }
   for(let z=Math.floor((d-10)/12)*12;z<end;z+=12){if(z<0)continue;withTransform([centerAt(z)-7.25,heightAt(z),z],headingAt(z),null,()=>{box(0,0,0,.15,.95,.15,[.63,.61,.52]);box(0,.68,6,.13,.23,12,[.68,.65,.54]);});}
   if(route==='coast'){
    const seaY=heightAt(d)-17;quad([centerAt(d)-950,seaY,d-100],[centerAt(d)-16,seaY,d-100],[centerAt(end)-16,seaY,end+900],[centerAt(end)-950,seaY,end+900],[.14,.36,.45]);
    for(let z=Math.floor(d/34)*34;z<end+160;z+=34){const x=centerAt(z)-48;quad([x-70,seaY+.045,z],[x+2,seaY+.045,z],[x+2,seaY+.045,z+.24],[x-70,seaY+.045,z+.24],[.42,.57,.57],.14);}
   }
  }
 }
 function landmark(mark,d){
  const gap=mark.at-d;if(gap< -70||gap>viewDistance+90)return;const z=mark.at,x=centerAt(z),y=heightAt(z),yaw=headingAt(z),route=state.route;
  if(mark.kind==='village'){
   for(let k=0;k<7;k++){const zz=z+(k-3)*12;building(centerAt(zz)+18+(k%2)*8,heightAt(zz),zz,8,4.5+(k%3)*1.8,10,k,false,headingAt(zz),1,gap);}
   withTransform([x+27,y,z],yaw,null,()=>{box(0,0,0,3,11,3,[.77,.68,.53]);cone(0,11,0,2.2,2,[.56,.30,.23],4);box(0,9.1,-1.52,1.1,1.3,.04,[.17,.22,.24]);});
  }else if(mark.kind==='lighthouse')withTransform([x-24,groundAt(z,-24),z],yaw,null,()=>{
   cone(0,0,0,3.6,18,[.87,.82,.64],10);box(0,10.2,0,3.3,1.5,3.3,[.61,.25,.23]);box(0,14.5,0,3.3,1.3,3.3,[.20,.28,.32]);box(0,15.8,0,4,.25,4,[.78,.33,.24]);cone(0,16,0,2.5,1.6,[.60,.25,.22],8);box(0,15,0,.7,.35,.7,[1,.86,.43],1.5);box(5.2,0,0,5,2.9,6,[.76,.64,.46]);roof(5.2,2.9,0,5.7,1.5,6.5,[.59,.28,.22]);for(let j=0;j<6;j++)box(-8+j*2.8,0,-7,.12,1.05,.12,[.66,.60,.49]);box(0,.9,-7,16,.12,.12,[.74,.68,.55]);
  });
  else if(mark.kind==='tunnel'){
   for(let zz=z;zz<z+82;zz+=10)withTransform([centerAt(zz),heightAt(zz),zz],headingAt(zz),null,()=>{box(-8.2,0,0,2.1,6.4,10,[.34,.35,.36]);box(8.2,0,0,2.1,6.4,10,[.34,.35,.36]);box(0,6.15,0,18.4,2.2,10,[.35,.36,.35]);if(Math.floor(zz/10)%2===0){box(-6.8,3.9,0,.12,.18,.65,[1,.70,.29],1.0);box(6.8,3.9,0,.12,.18,.65,[1,.70,.29],1.0);}});
   withTransform([x,y,z-1],yaw,null,()=>{for(const side of [-1,1])box(side*8,0,0,3,7,1.2,[.59,.57,.50]);box(0,6.5,0,19,1.4,1.2,[.59,.57,.50]);box(0,6.6,-.65,10,.47,.045,[.16,.30,.28]);if(gap<140)panelText('TUNEL',0,6.7,-.68,5.4,.30,[.89,.84,.68],.1);});
  }else if(mark.kind==='bridge')for(let zz=z-36;zz<z+65;zz+=12)withTransform([centerAt(zz),heightAt(zz),zz],headingAt(zz),null,()=>{box(0,-.7,0,17,.6,12,[.52,.51,.47]);for(const side of [-1,1]){box(side*7.45,0,0,.32,1.02,12,[.69,.64,.55]);box(side*6.7,-19,0,1.4,18.8,1.3,[.49,.49,.48]);}});
  else if(mark.kind==='station')withTransform([x+19,y,z],yaw,null,()=>{
   box(0,4.3,0,15,.42,10,[.67,.28,.23]);box(0,4.19,0,14.5,.11,9.7,[.91,.81,.62]);for(const sx of [-5.8,5.8])for(const zz of [-3.2,3.2])box(sx,0,zz,.25,4.2,.25,[.76,.74,.63]);for(const sx of [-3,3]){box(sx,0,0,.75,1.6,.60,[.86,.75,.56]);box(sx,1.07,-.32,.53,.30,.03,[.15,.29,.30]);}box(0,4.37,-5.025,12,.24,.03,[.25,.31,.31]);if(gap<140)panelText('SOLANA',0,4.40,-5.045,4.1,.20,[1,.85,.44],.3);box(0,0,8,11,3.2,5,[.74,.66,.53]);box(0,1,-6.5,1.1,.15,.3,[.95,.76,.37],1);
  });
  else if(mark.kind==='farm'){
   building(x+28,y,z,14,5.2,10,21,false,yaw,1,gap);tree(x+15,y,z+10,1.7,'tree');tree(x+37,y,z-10,1.2,'cypress');withTransform([x+29,y,z-8],yaw,null,()=>{box(0,0,0,8,1.1,.48,[.59,.54,.43]);box(-3,0,-.25,.20,3,.2,[.49,.45,.34]);box(3,0,-.25,.20,3,.2,[.49,.45,.34]);box(0,2.85,-.25,6.4,.25,.28,[.54,.49,.35]);});
  }else if(mark.kind==='plaza')withTransform([x-20,y,z],yaw,null,()=>{
   box(0,-.04,0,24,.15,24,[.57,.52,.45]);box(0,.12,0,4.8,.55,4.8,[.71,.66,.54]);cone(0,.68,0,1.5,2.7,[.79,.76,.61],8);box(0,3.4,0,.22,.6,.22,[.39,.52,.57]);for(const zz of [-8,8])for(const sx of [-8,8]){tree(sx,.12,zz,1.35,'tree');box(sx*.8,.35,zz*.8,2.4,.18,.50,[.43,.33,.23]);box(sx*.8,.56,zz*.8+.21,2.4,.55,.11,[.48,.37,.25]);}
  });
  else if(mark.kind==='viewcity'||mark.kind==='lookout'){
   const side=mark.kind==='viewcity'?-1:1;withTransform([x+side*17,y,z],yaw,null,()=>{box(0,-.1,0,17,.20,15,[.63,.58,.49]);for(let k=0;k<8;k++)box(-7+k*2,0,-6,.09,1.2,.09,[.23,.29,.29]);box(0,1.12,-6,15,.09,.09,[.28,.33,.32]);box(0,.4,2,3,.15,.60,[.51,.35,.23]);box(0,.7,2.2,3,.56,.1,[.51,.35,.23]);});if(route==='carmelo')for(let k=0;k<12;k++)building(x-55-(k%3)*15,y-12,z+(k-6)*15,9,7+noise(k)*20,11,k,true,yaw,-1,190);
  }else if(mark.kind==='cove'){
   // A beach terrace, telephone booth and painted fishing boats close the coastal road.
   withTransform([x-28,y-2.3,z],yaw,null,()=>{
    box(0,-5.2,0,30,5.2,42,[.57,.51,.37]);box(0,-.30,0,30,.32,42,[.76,.65,.44]);box(3,.02,4,6,3,7,[.82,.73,.57]);roof(3,3.02,4,6.5,1.6,7.5,[.51,.25,.19]);
    box(7,.02,-5,1.55,2.8,1.35,[.50,.22,.18]);box(7,.45,-5.70,1.19,1.92,.035,[.26,.40,.39]);box(7,.75,-5.73,.56,.38,.032,[.77,.79,.66]);
    for(const bx of [-8,-3]){box(bx,.02,-7,1.8,.45,4.8,bx===-8?[.31,.47,.49]:[.60,.27,.21]);box(bx,.46,-7,1.5,.09,4.3,[.83,.76,.58]);box(bx,.55,-7,.80,.18,3.4,[.17,.25,.25]);}
    for(let k=0;k<4;k++){tree(-10+k*7,0,16,1.10,'palm');box(-8+k*5,.35,11,1.75,.10,.62,[.46,.36,.24]);}
    for(let k=0;k<7;k++)box(14-k*.6,.0+k*.32,-11,1.2,.32,3.0,[.61,.53,.41]);
   });
  }else if(mark.kind==='lake'){
   withTransform([x-31,y-1.8,z],yaw,null,()=>{
    quad([-25,.05,-42],[18,.05,-42],[24,.05,42],[-28,.05,42],[.18,.36,.41]);
    for(let k=0;k<8;k++)quad([-21,.06,-33+k*9],[15,.06,-33+k*9],[15,.06,-32.8+k*9],[-21,.06,-32.8+k*9],[.36,.49,.48],.13);
    box(16,.12,-4,2.4,.15,15,[.48,.35,.24]);for(let k=0;k<5;k++)box(15,.0,-10+k*3,.13,1.2,.13,[.34,.29,.22]);
    box(12,.30,8,2.4,.16,.70,[.53,.38,.24]);box(12,.60,8.22,2.4,.53,.09,[.53,.38,.24]);
    box(20,.0,18,5,3.0,5,[.68,.58,.43]);roof(20,3,18,5.8,1.3,5.6,[.40,.28,.22]);
    for(let k=0;k<6;k++)tree(-23+k*8,-.2,37,1.4,'pine');
   });
  }else if(mark.kind==='windmill'){
   withTransform([x+22,y,z],yaw,null,()=>{
    box(0,0,0,4.0,10.2,4.0,[.79,.72,.56]);cone(0,10.2,0,3,3.1,[.44,.27,.20],8);
    box(0,1.0,-2.03,1.1,2.0,.03,[.27,.32,.29]);box(0,7.8,-2.09,.4,.65,.15,[.37,.32,.24]);
    const phase=settings.reducedMotion?.45:animationTime*.12;
    for(let blade=0;blade<4;blade++){
     const a=phase+blade*Math.PI/2,c=Math.cos(a),s=Math.sin(a),p=(u,v)=>[u*c-v*s,8.1+u*s+v*c,-2.15];
     quad(p(.7,-.2),p(6.5,-.2),p(6.5,.9),p(.7,.35),[.45,.34,.24]);
     quad(p(.7,.4),p(6.5,.93),p(6.5,1.07),p(.7,.54),[.82,.75,.60]);
    }
    for(let k=0;k<5;k++)box(-8+k*4.0,0,9,3.6,1.05,.5,[.61,.54,.40]);tree(8,0,5,1.2,'cypress');
   });
  }else if(mark.kind==='cinema'){
   withTransform([x-17,y,z],yaw+Math.PI/2,null,()=>{
    box(0,0,0,14,10.4,10,[.67,.56,.52]);box(0,8.5,-5.13,15.2,1.2,.20,[.19,.26,.32]);box(0,5.0,-5.2,15,.30,2.0,[.52,.20,.20]);
    box(0,0,-5.12,5.4,3.5,.09,[.13,.23,.26]);for(const sx of [-2,0,2])box(sx,.0,-5.24,.08,3.5,.09,[.68,.62,.50]);
    for(const sx of [-5.6,5.6]){box(sx,.9,-5.15,2,3.7,.09,[.25,.25,.26]);box(sx,1.1,-5.21,1.62,3.2,.04,sx<0?[.71,.42,.24]:[.22,.42,.49]);box(sx,1.4,-5.25,1.38,.10,.035,[.93,.80,.57]);}
    for(let k=0;k<13;k++)box(-6.5+k*1.08,4.86,-6.18,.08,.09,.09,[1,.72,.38],1.0);
    if(gap<180){panelText('CINE MIRALBA',0,8.78,-5.25,11.1,.65,[1,.67,.34],mood.night?1.1:.25);panelText('LA ULTIMA LUZ',0,5.7,-5.12,9.4,.42,[.96,.83,.60],.10);}
   });
  }
 }
 function chapterGates(d){
  const route=getRoute(state.route);
  for(let i=0;i<route.sections.length;i++){
   const z=route.sections[i].from+35,gap=z-d;if(gap< -30||gap>viewDistance)continue;
   const x=centerAt(z),y=heightAt(z);
   withTransform([x,y,z],headingAt(z),null,()=>{
    for(const side of [-1,1]){box(side*8.5,0,0,.20,3.8,.20,[.41,.44,.41]);box(side*8.5,2.8,0,1.4,.9,.13,[.15,.32,.29]);
     if(gap<120)panelText(['I','II','III','IV'][i],side*8.5,2.95,-.08,.8,.48,[.95,.86,.68]);}
   });
  }
 }
 function drawJunction(d){
  const junction=junctionApproach(state,d);if(!junction||junction.remaining<0||junction.remaining>viewDistance)return;const z=junction.at-45,x=centerAt(z)+8.5,y=heightAt(z),yaw=headingAt(z);
  const names={coast:'COSTA',mountain:'SIERRA',vineyards:'VINEDOS',carmelo:'CARMELO'};
  withTransform([x,y,z],yaw,null,()=>{box(0,0,0,.19,4.0,.19,[.76,.72,.62]);box(0,3.15,0,4.7,1.4,.14,[.12,.29,.27]);
   if(z-d<135)junction.options.slice(0,2).forEach((id,index)=>panelText(names[id]||'RUTA',0,3.94-index*.52,-.078,3.55,.31,[.96,.91,.70]));
  });
 }
 function drawSky(eye,target,time,overlay=0){
  const horizon=clamp(.5+(eye[1]-target[1])/Math.hypot(eye[0]-target[0],eye[2]-target[2])*1.07,.38,.73);
  gl.useProgram(sky);gl.bindBuffer(gl.ARRAY_BUFFER,skyBuffer);gl.enableVertexAttribArray(skyPosition);gl.vertexAttribPointer(skyPosition,2,gl.FLOAT,false,0,0);
  for(const [name,c] of [['topColor',mood.top],['midColor',mood.middle],['hazeColor',mood.haze],['sunColor',mood.sun]])gl.uniform3fv(skyUniforms[name],c);
  gl.uniform1f(skyUniforms.horizon,horizon);gl.uniform1f(skyUniforms.nightMode,mood.night);gl.uniform1f(skyUniforms.aspect,canvas.width/canvas.height);gl.uniform1f(skyUniforms.landscape,{coast:0,mountain:1,vineyards:2,carmelo:3}[state.route]||0);gl.uniform1f(skyUniforms.heading,camera.yaw);gl.uniform1f(skyUniforms.phase,settings.reducedMotion?0:time);gl.uniform1f(skyUniforms.rain,settings.mood==='rain'?1:0);gl.uniform1f(skyUniforms.overlay,overlay);gl.drawArrays(gl.TRIANGLES,0,6);
 }
 function render(nextState,nextSettings={},dt=0,time=0){
  if(disposed)throw new Error('Renderizador WebGL cerrado');if(contextLost||gl.isContextLost?.())throw new Error('Contexto WebGL perdido');if(!nextState||!Number.isFinite(nextState.distance)||!Number.isFinite(nextState.x)||!Number.isFinite(nextState.speed))throw new TypeError('Estado del viaje inválido');
  state=nextState;settings=nextSettings;mood=MOODS[settings.mood]||MOODS.sunset;
  if(settings.mood==='sunset'&&settings.livingLight!==false){const t=clamp(state.distance/getRoute(state.route).length,0,1)*.65;mood={};for(const key of Object.keys(MOODS.sunset)){const a=MOODS.sunset[key],b=MOODS.night[key];mood[key]=Array.isArray(a)?a.map((v,i)=>v+(b[i]-v)*t):a+(b-a)*t;}}
  prepareShape(state);dt=clamp(Number.isFinite(dt)?dt:0,0,.1);time=Number.isFinite(time)?time:0;animationTime=time;viewDistance=settings.quality==='low'?260:settings.quality==='high'?460:350;detailDistance=settings.quality==='low'?65:110;
  const d=state.distance,route=state.route||'coast',preset=CAMERAS[settings.camera]||CAMERAS.rear;
  if(lastDistance===null||Math.abs(d-lastDistance)>120||(lastRoute!==route&&!state.branchFrom)){camera={x:centerAt(d)+state.x*2.0,y:heightAt(d)+preset.height,yaw:headingAt(d)};motion={phase:0,roll:0,pitch:0,bob:0,cameraBob:0};lastSpeed=state.speed;}
  const reduced=!!settings.reducedMotion,forward=headingAt(d),playerX=centerAt(d)+state.x*5;
  const motionDt=lastAnimationTime===null?dt:clamp(time-lastAnimationTime,0,.1);lastAnimationTime=time;
  motion=reduced?{phase:0,roll:0,pitch:0,bob:0,cameraBob:0}:motionStep(motion,{speed:Math.abs(state.speed),steer:state.steerMomentum||0,acceleration:dt>0?(state.speed-lastSpeed)/dt:0,dt:motionDt});
  const camTarget={x:preset.distance<0?playerX:centerAt(d)+state.x*2.3,y:heightAt(d)+preset.height,yaw:forward};camera=followCamera(camera,camTarget,smoothWeight(reduced?.24:preset.follow,dt));
  const eye=[camera.x-Math.sin(camera.yaw)*preset.distance,camera.y+(reduced?0:motion.cameraBob),d-Math.cos(camera.yaw)*preset.distance];
  const target=[centerAt(d+preset.look)+state.x*(preset.distance<0?4.5:1.7),heightAt(d+preset.look)+.75,d+preset.look],matrix=multiply(perspective(Math.PI/3.05,canvas.width/canvas.height,.30,1600),lookAt(eye,target));
  lastDistance=d;lastRoute=route;lastSpeed=state.speed;tris.length=0;gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(...mood.top,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.BLEND);drawSky(eye,target,time);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  const anchor=Math.floor(d/24)*24,cacheKey=[shapeKey,anchor,settings.quality,settings.mood,settings.livingLight,settings.reducedMotion].join('|');
  if(cacheKey!==staticKey){terrain(Math.max(0,anchor-24),anchor+viewDistance+24);scenery(Math.max(0,anchor-24),anchor+viewDistance+24);staticGeometry=new Float32Array(tris);staticKey=cacheKey;geometryBuilds++;tris.length=0;}else cacheHits++;
  chapterGates(d);for(const mark of getRoute(route).landmarks)landmark(mark,d);drawJunction(d);
  for(const npc of trafficCars(d,settings.traffic||'off',state.trafficClock||0)){if(npc.offset< -20||npc.offset>viewDistance)continue;const z=Math.max(0,d+npc.offset),model=['solstice','meridian','vesper','phantom'][npc.id%4];car(centerAt(z)+npc.lane*5,heightAt(z)+.025,z,model,headingAt(z),['#a8ada3','#426b77','#c5a46f','#8b5351'][npc.id%4],npc.id%2?'classic':'sport');}
  if(preset.distance>0)car(playerX,heightAt(d)+.026,d,state.vehicle,forward+(state.steerMomentum||0)*clamp(Math.abs(state.speed)/80,0,1)*.075+(state.driftAngle||0),settings.paint,settings.wheels||'classic',reduced?null:motion);
  gl.useProgram(scene);gl.uniformMatrix4fv(uniforms.viewProjection,false,matrix);gl.uniform3fv(uniforms.eye,eye);gl.uniform3fv(uniforms.fogColor,mood.fog);gl.uniform3fv(uniforms.sunColor,mood.sun);gl.uniform1f(uniforms.ambient,mood.ambient);gl.uniform1f(uniforms.nightMode,mood.night);
  const headlights=settings.headlights==='off'?0:settings.headlights==='on'?1:(mood.night>.2?1:0);gl.uniform1f(uniforms.headlightsEnabled,headlights);gl.uniform3f(uniforms.headOrigin,playerX,heightAt(d)+.65,d+2.0);gl.uniform2f(uniforms.headForward,Math.sin(forward),Math.cos(forward));gl.uniform1f(uniforms.fogNear,viewDistance*.55);gl.uniform1f(uniforms.fogFar,viewDistance+130);gl.uniform1f(uniforms.wet,settings.mood==='rain'?1:0);
  const floatCount=staticGeometry.length+tris.length;totalVertices=floatCount/10;
  if(drawBuffer.length<floatCount)drawBuffer=new Float32Array(Math.max(floatCount,drawBuffer.length*2));drawBuffer.set(staticGeometry,0);drawBuffer.set(tris,staticGeometry.length);gl.bindBuffer(gl.ARRAY_BUFFER,geometryBuffer);const neededBytes=floatCount*Float32Array.BYTES_PER_ELEMENT;
  if(neededBytes>gpuCapacityBytes){gpuCapacityBytes=Math.max(neededBytes,Math.max(131072,gpuCapacityBytes*2));gl.bufferData(gl.ARRAY_BUFFER,gpuCapacityBytes,gl.DYNAMIC_DRAW);reallocations++;}if(neededBytes){gl.bufferSubData(gl.ARRAY_BUFFER,0,drawBuffer.subarray(0,floatCount));uploads++;}
  for(const [name,count,offset] of [['position',3,0],['color',3,12],['normal',3,24],['emissive',1,36]]){gl.enableVertexAttribArray(attr[name]);gl.vertexAttribPointer(attr[name],count,gl.FLOAT,false,40,offset);}gl.drawArrays(gl.TRIANGLES,0,totalVertices);
  if(settings.mood==='rain'){gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);drawSky(eye,target,time,1);gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);}
  const now=typeof performance!=='undefined'?performance.now():time*1000;if(lastRender>0&&now>=lastRender){frameTimes.push(now-lastRender);if(frameTimes.length>120)frameTimes.shift();}lastRender=now;
 }
 function metrics(){const n=frameTimes.length,mean=n?frameTimes.reduce((a,b)=>a+b,0)/n:0,sorted=[...frameTimes].sort((a,b)=>a-b);return {fps:mean?1000/mean:0,avgMs:mean,p95Ms:n?sorted[Math.min(n-1,Math.ceil(n*.95)-1)]:0,vertices:totalVertices,geometryBuilds,cacheHits,uploadKB:Math.round(totalVertices*40/1024),gpuKB:Math.round(gpuCapacityBytes/1024),uploads,reallocations};}
 function dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);for(const b of buffers)gl.deleteBuffer(b);for(const p of programs)gl.deleteProgram(p);for(const s of shaders)gl.deleteShader(s);tris=[];staticGeometry=new Float32Array(0);drawBuffer=new Float32Array(0);centers=null;frameTimes=[];}
 resize(canvas.width||canvas.clientWidth,canvas.height||canvas.clientHeight);return {render,resize,dispose,metrics};
}
