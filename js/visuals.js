import {getRoute,worldProp,routeSection} from './routes.js';
import {clamp,roadShape,junctionApproach,trafficCars,VEHICLES} from './physics.js';

// All artwork is original, deterministic Canvas geometry. The driving model is shared with WebGL.
const TAU=Math.PI*2;
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
function polygon(g,points,color){g.fillStyle=color;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();}
function line(g,points,color,width=1){g.strokeStyle=color;g.lineWidth=width;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();}
function ellipse(g,x,y,rx,ry,col){g.fillStyle=col;g.beginPath();g.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);g.fill();}
function palette(route,mood){const r=getRoute(route);if(mood==='night')return {sky:['#0c1730','#263458','#6e5a74'],ground:route==='carmelo'?'#494754':'#354947',sea:'#293d5f',road:'#343d4e',haze:'#a996ab',night:true};if(mood==='rain')return {sky:['#273646','#687c88','#a8afb1'],ground:'#596f65',sea:'#5c7d8d',road:'#445a64',haze:'#bdc9c7',rain:true};if(mood==='dawn')return {sky:['#3c557d','#da9baf','#fbdab4'],ground:r.ground,sea:'#88a7b5',road:r.road,haze:'#ffe1b1',dawn:true};return {sky:r.sky,ground:r.ground,sea:'#668fa3',road:r.road,haze:'#ffc89e'};}

export function drawSkyDetails(g,w,h,hor,dist,route,mood='sunset'){
 const p=palette(route,mood);g.save();
 if(p.night){for(let i=0;i<75;i++){const x=hash(i+13)*w,y=hash(i+103)*hor*.78;g.fillStyle=i%5?'#dfdce799':'#fff4ca';g.fillRect(x,y,i%9?1:2,i%9?1:2);}ellipse(g,w*.76,hor*.33,h*.025,h*.025,'#f3e3c5');ellipse(g,w*.773,hor*.325,h*.023,h*.023,p.sky[0]);}
 else if(!p.rain){const sy=hor*(p.dawn?.78:.66),sx=w*.74,r=h*.044;const glow=g.createRadialGradient(sx,sy,r*.1,sx,sy,r*6);glow.addColorStop(0,'#ffedb84f');glow.addColorStop(1,'#ffad8b00');g.fillStyle=glow;g.fillRect(0,0,w,hor+60);ellipse(g,sx,sy,r,r,'#ffe2ae');}
 for(let i=0;i<6;i++){const x=(hash(i+100)*w+dist*.002*(i%2?1:-1)+w)%w,y=hor*(.14+hash(i+77)*.45),size=w*(.045+hash(i+121)*.07);ellipse(g,x,y,size,size*.07,p.rain?'#d1d9de22':'#f4dab622');ellipse(g,x+size*.27,y-size*.04,size*.7,size*.09,p.rain?'#d1d9de22':'#f4dab622');}
 // An original horizon silhouette: layers change with the road, not a tiled backdrop.
 for(let layer=0;layer<4;layer++){const pts=[[-10,hor+75]];for(let i=0;i<=48;i++){const x=i*w/48,phase=i*.33+layer*2.2+dist*.0001;let ridge=16+Math.sin(phase)*22+Math.sin(phase*2.7)*11;
 if(route==='mountain')ridge=32+Math.abs(Math.sin(phase*.66))*hor*.34+Math.sin(phase*2.3)*18;
 if(route==='vineyards')ridge=9+Math.sin(phase*.55)*19;
 if(route==='carmelo')ridge=15+Math.abs(Math.sin(phase))*30;
 pts.push([x,hor-ridge+(layer-1)*12]);}pts.push([w+10,hor+80]);polygon(g,pts,p.night?['#29364d','#354056','#444960','#4e5162'][layer]:p.rain?['#6e7f88','#78878e','#879497','#8e9c99'][layer]:['#666b89','#85809a','#a190a2','#b7a39f'][layer]);}
 if(route==='carmelo'){
  const base=hor+55;for(let i=0;i<90;i++){const bw=w/70,xx=i*w/90-10,hh=12+hash(i+6)*50;g.fillStyle=p.night?'#293548':i%3===0?'#8d7c87':'#9c8a92';g.fillRect(xx,base-hh,bw,hh);if(p.night)for(let row=0;row<5;row++)if(hash(i*33+row)>.3){g.fillStyle='#ffd58a99';g.fillRect(xx+2,base-hh+4+row*7,2,2);}}
  const x=w*.22;g.fillStyle=p.night?'#30394d':'#94818d';g.fillRect(x,base-55,w*.035,55);for(let j=0;j<4;j++)polygon(g,[[x+j*w*.009,base-55],[x+j*w*.009+w*.004,base-95-j%2*13],[x+j*w*.009+w*.008,base-55]],g.fillStyle);
 }
 g.restore();
}

function drawTree(g,x,y,size,type,seed,night){
 const trunk=night?'#343e44':'#6c5a49';g.fillStyle=trunk;g.fillRect(x-size*.035,y-size*.77,size*.07,size*.77);
 if(type==='palm'){
  line(g,[[x,y],[x-size*.04,y-size*.80],[x+size*.01,y-size]],trunk,size*.055);
  for(let a=0;a<7;a++){const t=a*TAU/7;polygon(g,[[x,y-size],[x+Math.cos(t)*size*.42,y-size+Math.sin(t)*size*.17],[x+Math.cos(t+.24)*size*.3,y-size+Math.sin(t+.24)*size*.2]],night?'#344c4c':a%2?'#577966':'#355e56');}
 }else if(type==='pine'||type==='cypress'){
  const wide=type==='cypress'?.13:.31;for(let k=0;k<3;k++)polygon(g,[[x,y-size*(1.18-k*.22)],[x-size*wide*(.7+k*.12),y-size*(.55-k*.18)],[x+size*wide*(.7+k*.12),y-size*(.55-k*.18)]],night?'#344b4c':k%2?'#47685e':'#34574f');
 }else{for(let j=0;j<5;j++)ellipse(g,x+Math.cos(j*2)*size*.20,y-size*.88+Math.sin(j*2)*size*.12,size*.26,size*.25,night?'#354e4a':j%2?'#788958':'#556e4d');}
}
function drawBuilding(g,x,y,size,seed,urban,night){
 const bw=size*(urban?.72:1.04),bh=size*(urban?1.25+hash(seed)*.55:.72),front=x-bw*.5;const cols=['#d2b49a','#c19788','#d8c9ac','#ad9290','#c3a36f'];
 polygon(g,[[front,y-bh],[front+bw,y-bh-size*.06],[front+bw+size*.23,y-bh+size*.04],[front+bw+size*.23,y],[front,y]],night?'#736676':'#8f7b76');
 g.fillStyle=night?['#8a7882','#7d7b84','#8f837e'][seed%3]:cols[seed%cols.length];g.fillRect(front,y-bh,bw,bh);
 if(!urban)polygon(g,[[front-size*.09,y-bh],[x,y-bh-size*.22],[front+bw+size*.09,y-bh]],'#9b6860');
 else{g.fillStyle=night?'#585467':'#a88c83';g.fillRect(front-size*.025,y-bh-size*.04,bw+size*.05,size*.045);}
 const floors=urban?4:2;for(let row=0;row<floors;row++)for(let col=0;col<3;col++){
  const xx=front+bw*(.12+col*.28),yy=y-bh+bh*(.12+row*.20),ww=bw*.14,hh=bh*.12,lit=night&&hash(seed*93+row*7+col)>.42;
  g.fillStyle=lit?'#ffcf86':'#454f61';g.fillRect(xx,yy,ww,hh);g.fillStyle=night?'#645d73':'#a16f62';g.fillRect(xx-size*.011,yy-size*.008,ww+size*.022,size*.018);
  if(urban){g.fillStyle='#404652';g.fillRect(xx-size*.025,yy+hh-size*.015,ww+size*.05,size*.032);for(let k=0;k<5;k++)g.fillRect(xx-size*.021+k*ww*.31,yy+hh-size*.09,size*.007,size*.08);}
 }
 g.fillStyle='#494451';g.fillRect(front+bw*.44,y-bh*.18,bw*.19,bh*.18);
 if(urban){const shop=seed%4===0;g.fillStyle=shop?'#daaa7d':'#414750';g.fillRect(front+bw*.10,y-bh*.18,bw*.22,bh*.14);g.fillStyle=seed%2?'#a6575d':'#51716d';g.fillRect(front,y-bh*.23,bw,bh*.045);
 if(size>27){g.fillStyle='#f5e5bf';g.textAlign='center';g.font=`bold ${Math.max(5,size*.05)}px sans-serif`;g.fillText(['CAFÉ SOL','PANADERÍA','RADIO 404','TALLER'][seed%4],x,y-bh*.19,bw*.90);}
 if(seed%3===0){line(g,[[front+bw*.07,y-bh*.42],[front+bw*.88,y-bh*.36]],'#c9b5a3',Math.max(1,size*.01));for(let j=0;j<4;j++){g.fillStyle=['#ddd3b3','#d4988e','#87a1ac'][j%3];g.fillRect(front+bw*(.15+j*.16),y-bh*.415+j*size*.012,size*.08,size*.13);}}
 }
}
function drawLandmark(g,mark,q,h,night,route){
 const z=q.scale,size=h*.52*z,x=q.x+q.half*(mark.kind==='bridge'?0:1.7),y=q.y;
 g.save();
 if(mark.kind==='lighthouse'){
  polygon(g,[[x-size*.16,y],[x-size*.08,y-size],[x+size*.08,y-size],[x+size*.16,y]],'#e9d3b0');g.fillStyle='#b9635d';g.fillRect(x-size*.12,y-size*1.08,size*.24,size*.13);polygon(g,[[x-size*.15,y-size*1.08],[x,y-size*1.2],[x+size*.15,y-size*1.08]],'#774654');
  g.fillStyle='#ffda96';g.fillRect(x-size*.06,y-size*1.06,size*.12,size*.06);if(night)polygon(g,[[x,y-size*1.04],[x-size*2.8,y-size*1.30],[x-size*2.8,y-size*.89]],'#ffe4a011');
 }else if(mark.kind==='tunnel'){
  // Portal stays aligned with the road. It is a visual road landmark, with no hidden gameplay wall.
  const rad=q.half*1.3,cx=q.x;g.fillStyle='#827d80';g.beginPath();g.moveTo(cx-rad,y+2);g.lineTo(cx-rad,y-size*.44);g.arc(cx,y-size*.44,rad,Math.PI,0);g.lineTo(cx+rad,y+2);g.fill();g.fillStyle=night?'#222c43':'#374653';g.beginPath();g.moveTo(cx-q.half*1.02,y+3);g.lineTo(cx-q.half*1.02,y-size*.40);g.arc(cx,y-size*.40,q.half*1.02,Math.PI,0);g.lineTo(cx+q.half*1.02,y+3);g.fill();
  polygon(g,[[cx-q.half*.98,y+3],[cx-q.half*.28,y-size*.35],[cx+q.half*.28,y-size*.35],[cx+q.half*.98,y+3]],'#56606a');for(const s of [-1,1]){g.fillStyle='#ffce86';g.fillRect(cx+s*q.half*1.07,y-size*.39,Math.max(2,size*.04),size*.13);}
 }else if(mark.kind==='bridge'){
  for(let j=0;j<8;j++){const xx=q.x+(j-3.5)*q.half*.30;g.fillStyle=night?'#696978':'#c0aca0';g.fillRect(xx,y+size*.02,q.half*.06,size*.60);}line(g,[[q.x-q.half*1.20,y-size*.06],[q.x+q.half*1.20,y-size*.06]],'#dac7ac',Math.max(1,size*.035));
 }else if(mark.kind==='station'){
  g.fillStyle='#ada194';g.fillRect(x-size*.55,y-size*.70,size*1.2,size*.08);g.fillStyle='#af665d';g.fillRect(x-size*.6,y-size*.77,size*1.3,size*.12);for(let s of [-.43,.43]){g.fillStyle='#e2d0b4';g.fillRect(x+size*s,y-size*.65,size*.04,size*.65);g.fillStyle='#d3ddd3';g.fillRect(x+size*s*.6,y-size*.37,size*.13,size*.34);g.fillStyle='#415863';g.fillRect(x+size*s*.6+size*.02,y-size*.33,size*.09,size*.1);}g.fillStyle='#ffe0a3';g.fillRect(x-size*.5,y-size*.7,size*.13,size*.028);
 }else if(mark.kind==='windmill'){
  g.fillStyle='#d6c9ab';g.fillRect(x-size*.18,y-size*.65,size*.36,size*.65);polygon(g,[[x-size*.25,y-size*.65],[x,y-size*.88],[x+size*.25,y-size*.65]],'#9f7060');for(let a=0;a<4;a++){const t=a*Math.PI/2+.3;line(g,[[x,y-size*.63],[x+Math.cos(t)*size*.55,y-size*.63+Math.sin(t)*size*.55]],'#6b5b4e',size*.047);}
 }else if(mark.kind==='cinema'){
  drawBuilding(g,x,y,size,25,true,night);g.fillStyle='#b45964';g.fillRect(x-size*.49,y-size*.51,size*.95,size*.22);g.fillStyle='#ffe4a4';g.font=`bold ${Math.max(7,size*.12)}px sans-serif`;g.textAlign='center';g.fillText('MIRALBA',x,y-size*.35,size*.8);for(let k=0;k<10;k++)ellipse(g,x+size*(-.43+k*.095),y-size*.48,size*.012,size*.012,'#ffe7ac');
 }else if(['cove','lake'].includes(mark.kind)){
  ellipse(g,x,y-size*.04,size*1.3,size*.28,night?'#354e69':'#82a6a2');line(g,[[x-size*.5,y-size*.07],[x-size*.45,y-size*.5],[x+size*.5,y-size*.5]],'#cfbba0',Math.max(1,size*.03));
 }else if(mark.kind==='lookout'||mark.kind==='viewcity'){
  line(g,[[x-size*.6,y-size*.10],[x+size*.6,y-size*.10]],'#ccb8a2',size*.04);for(let s of [-.5,0,.5])line(g,[[x+size*s,y],[x+size*s,y-size*.3]],'#b09c8d',size*.035);
 }else{for(let i=0;i<4;i++)drawBuilding(g,x+(i-1.5)*size*.55,y,size*(.55+hash(i+39)*.2),i+11,mark.kind==='plaza',night);}
 // Painted stop sign at every postcard location, readable as the car approaches.
 if(size>13){g.fillStyle='#617077';g.fillRect(x-size*.60,y-size*.37,size*.028,size*.37);g.fillStyle='#eee0bb';g.fillRect(x-size*.79,y-size*.52,size*.41,size*.16);g.fillStyle='#35585b';g.textAlign='center';g.font=`bold ${Math.max(5,size*.055)}px sans-serif`;g.fillText('MIRADOR',x-size*.585,y-size*.405,size*.38);}
 g.restore();
}

export function drawCarDetails(g,w,h,vehicle,id,speed,lateral,settings={}){
 const sedan=id==='meridian',coupe=id==='phantom',open=id==='solstice';
 const cw=clamp(w*.142,94,240)*(sedan?1.1:coupe?.96:1),ch=cw*(sedan?.58:coupe?.49:.57);
 const x=w*.5-lateral*w*.012,y=h*.869+(settings.reducedMotion?0:Math.sin(speed*.12)*Math.min(1.5,Math.abs(speed)*.011));
 g.save();g.translate(x,y);g.rotate(settings.reducedMotion?0:clamp(lateral*.017,-.026,.026));
 ellipse(g,0,ch*.18,cw*.66,ch*.21,'#151b2388');
 const color=/^#[0-9a-f]{6}$/i.test(settings.paint||'')?settings.paint:vehicle.color;
 for(const side of [-1,1]){g.fillStyle='#171c23';g.fillRect(side*cw*.40-cw*.085,-ch*.15,cw*.17,ch*.40);g.fillStyle=settings.wheels==='sport'?'#bfcad1':'#a2927c';g.fillRect(side*cw*.4-cw*.048,ch*.09,cw*.096,ch*.07);}
 const roof=open?.62:sedan?.99:.85;
 polygon(g,[[-cw*.33,-ch*.27],[-cw*.27,-ch*roof],[cw*.27,-ch*roof],[cw*.33,-ch*.27]],sedan?'#555765':'#293b4e');
 const glass=g.createLinearGradient(0,-ch*roof,0,-ch*.24);glass.addColorStop(0,'#86a3a9');glass.addColorStop(.34,'#476477');glass.addColorStop(1,'#223448');
 polygon(g,[[-cw*.25,-ch*(roof-.055)],[cw*.25,-ch*(roof-.055)],[cw*.29,-ch*.31],[-cw*.29,-ch*.31]],glass);
 line(g,[[-cw*.255,-ch*(roof-.045)],[cw*.255,-ch*(roof-.045)]],'#efe0bb',ch*.024);
 if(open){ellipse(g,-cw*.16,-ch*.47,cw*.083,ch*.15,'#c39870');ellipse(g,cw*.16,-ch*.47,cw*.083,ch*.15,'#c39870');g.fillStyle='#242c39';g.fillRect(-cw*.33,-ch*.39,cw*.66,ch*.08);}
 const shade=g.createLinearGradient(-cw*.47,-ch*.4,cw*.49,ch*.12);shade.addColorStop(0,'#e9d7b2');shade.addColorStop(.08,color);shade.addColorStop(.6,color);shade.addColorStop(1,'#222b3b');
 polygon(g,[[-cw*.45,-ch*.27],[-cw*.34,-ch*.51],[cw*.34,-ch*.51],[cw*.45,-ch*.27],[cw*.5,ch*.14],[-cw*.5,ch*.14]],shade);
 polygon(g,[[-cw*.45,-ch*.23],[-cw*.34,-ch*.50],[-cw*.30,ch*.06],[-cw*.49,ch*.10]],'#19233433');polygon(g,[[cw*.45,-ch*.23],[cw*.34,-ch*.5],[cw*.30,ch*.06],[cw*.49,ch*.1]],'#fff4d51e');
 if(coupe){polygon(g,[[-cw*.42,-ch*.51],[cw*.42,-ch*.51],[cw*.38,-ch*.62],[-cw*.38,-ch*.62]],'#2d3f52');line(g,[[-cw*.43,-ch*.52],[cw*.43,-ch*.52]],'#d7d2b5',ch*.025);}
 if(id==='vesper'){line(g,[[-cw*.49,-ch*.26],[cw*.49,-ch*.26]],'#ecdfc0',ch*.035);for(const j of [-1,1]){g.fillStyle='#1a2732aa';g.fillRect(j*cw*.08-cw*.025,-ch*.49,cw*.05,ch*.32);}}
 const units=id==='vesper'?3:sedan?2:1;
 for(const side of [-1,1])for(let i=0;i<units;i++){const ww=cw*.19/units,tx=side*cw*.337+(i-(units-1)/2)*ww*1.05;g.fillStyle='#551d2f';g.fillRect(tx-ww*.46,-ch*.12,ww*.92,ch*.13);g.fillStyle=!!settings.braking?'#fff0b4':'#ff806c';g.fillRect(tx-ww*.37,-ch*.10,ww*.74,ch*.07);}
 g.fillStyle=sedan?'#414c59':'#272f3d';g.fillRect(-cw*.45,ch*.02,cw*.90,ch*.135);g.fillStyle='#cad1c5';g.fillRect(-cw*.44,ch*.135,cw*.88,ch*.023);g.fillStyle='#ecdfb8';g.fillRect(-cw*.103,ch*.047,cw*.206,ch*.073);if(cw>120){g.fillStyle='#4c5361';g.font=`bold ${cw*.037}px sans-serif`;g.textAlign='center';g.fillText('LLD · 404',0,ch*.1);}
 for(const side of [-1,1]){g.fillStyle='#afb3ae';g.fillRect(side*cw*.35-cw*.025,ch*.158,cw*.05,ch*.026);}
 g.restore();
}
export function drawRoadAtmosphere(g,w,h,hor,distance,route,settings={},time=0){
 g.save();const p=palette(route,settings.mood);if(p.night){const light=g.createRadialGradient(w*.5,h*.77,5,w*.5,h*.73,h*.47);light.addColorStop(0,'#eed7a025');light.addColorStop(1,'#fce4b900');g.fillStyle=light;g.fillRect(0,hor,w,h-hor);}
 if(p.rain){const sheen=g.createLinearGradient(0,hor,0,h);sheen.addColorStop(0,'#dcecff18');sheen.addColorStop(.7,'#95bfd02c');sheen.addColorStop(1,'#c9d6e000');g.fillStyle=sheen;g.fillRect(0,hor,w,h-hor);g.strokeStyle='#d4e5ef55';g.lineWidth=1;for(let i=0;i<(settings.quality==='low'?28:65);i++){const xx=hash(i+58)*w,yy=((hash(i+71)*h+time*(settings.reducedMotion?0:240))%h);line(g,[[xx,yy],[xx-5,yy+14]],'#d4e5ef55',1);}}
 const vignette=g.createRadialGradient(w*.5,h*.52,w*.14,w*.5,h*.52,w*.68);vignette.addColorStop(0,'#07102000');vignette.addColorStop(1,p.night?'#07102044':'#1519281f');g.fillStyle=vignette;g.fillRect(0,0,w,h);g.restore();
}

export function drawScene(g,w,h,state,settings={},time=0){
 if(w<1||h<1)return;const r=getRoute(state.route),p=palette(state.route,settings.mood),hor=h*(state.route==='mountain'?.43:.40);g.save();
 const sky=g.createLinearGradient(0,0,0,hor+60);sky.addColorStop(0,p.sky[0]);sky.addColorStop(.67,p.sky[1]);sky.addColorStop(1,p.sky[2]);g.fillStyle=sky;g.fillRect(0,0,w,h);drawSkyDetails(g,w,h,hor,state.distance,state.route,settings.mood);
 const ground=g.createLinearGradient(0,hor,0,h);ground.addColorStop(0,p.ground);ground.addColorStop(1,p.night?'#222e38':state.route==='carmelo'?'#655d69':'#63725d');g.fillStyle=ground;g.fillRect(0,hor+22,w,h);
 const section=routeSection(state.route,state.distance);
 if(r.sea){g.fillStyle=p.sea;g.fillRect(0,hor+22,w,h*.19);for(let k=0;k<22;k++){const yy=hor+30+k*k*.37;line(g,[[0,yy],[w,yy]],p.night?'#e3d0b00d':'#ffe4be30',.8);}polygon(g,[[w*.52,hor+27],[w,hor+28],[w,h],[w*.62,h*.77],[w*.56,h*.53]],p.night?'#4b4b52':'#b19b89');
  for(let k=0;k<4;k++)line(g,[[w*.68,hor+60+k*14],[w,hor+65+k*24]],p.night?'#373e4a':'#8a8176',3);
 }else if(state.route==='vineyards'){
  for(let side of [-1,1])for(let k=1;k<10;k++){line(g,[[w*.5+side*(20+k*8),hor+24],[w*.5+side*(180+k*w*.065),h]],p.night?'#3a493b':'#6a7b42',Math.max(2,k*.8));}
 }else if(state.route==='mountain'){
  polygon(g,[[0,hor+10],[w*.16,hor+h*.11],[w*.20,h],[0,h]],p.night?'#415052':'#6c7974');polygon(g,[[w,hor],[w*.83,hor+h*.12],[w*.77,h],[w,h]],p.night?'#3a4950':'#7d8077');
 }
 const curve0=roadShape(state,state.distance);const project=offset=>{
  const gap=Math.max(0,offset),scale=1/(1+gap/95),shape=roadShape(state,state.distance+gap),x=w*.5+(shape.curve-curve0.curve)*w*.20*(1-scale)-state.x*w*.18*scale,y=hor+24+(h-hor-24)*scale-(shape.elevation-curve0.elevation)*h*.061*(1-scale);
  return {x,y,scale,half:w*.49*scale};};
 const drawDist=settings.quality==='low'?1050:1450,count=settings.quality==='low'?105:145;
 const strips=[];for(let i=count;i>=0;i--)strips.push(project(i/count*drawDist));
 // Draw the full shoulder and tarmac as continuous surfaces. Drawing the shoulder again
 // for every band used to expose pale antialias seams across the entire road.
 polygon(g,[...strips.map(q=>[q.x-q.half*1.16,q.y]),...strips.slice().reverse().map(q=>[q.x+q.half*1.16,q.y])],state.route==='carmelo'?p.night?'#70707a':'#b3a89b':p.night?'#665568':'#bba18f');
 polygon(g,[...strips.map(q=>[q.x-q.half,q.y]),...strips.slice().reverse().map(q=>[q.x+q.half,q.y])],p.road);
 let prev=project(drawDist);
 for(let i=count-1;i>=0;i--){const gap=i/count*drawDist,q=project(gap),d=state.distance+gap;const stripe=Math.floor(d/24)%2===0;
  if(stripe&&state.route!=='carmelo')for(const side of [-1,1])polygon(g,[[prev.x+side*prev.half*1.12,prev.y-.3],[prev.x+side*prev.half*1.16,prev.y-.3],[q.x+side*q.half*1.16,q.y+.3],[q.x+side*q.half*1.12,q.y+.3]],p.night?'#a29998':'#eee0b9');
  for(const side of [-1,1])polygon(g,[[prev.x+side*prev.half*.95,prev.y-.8],[prev.x+side*prev.half*.964,prev.y-.8],[q.x+side*q.half*.964,q.y+.8],[q.x+side*q.half*.95,q.y+.8]],p.night?'#c4c1b9':'#f4e4bd');
  if(Math.floor(d/12)%2===0)polygon(g,[[prev.x-prev.half*.009,prev.y-.8],[prev.x+prev.half*.009,prev.y-.8],[q.x+q.half*.009,q.y+.8],[q.x-q.half*.009,q.y+.8]],'#e9dfc6');
  prev=q;
 }
 const upcoming=junctionApproach(state,state.distance);
 if(upcoming&&upcoming.remaining>0){const q=project(upcoming.remaining);g.save();const ss=h*.5*q.scale,sx=q.x+q.half*1.4;
  // A visible side road leads into the same 420m geometry blend used by the simulation.
  if(upcoming.remaining<600)polygon(g,[[q.x+q.half*.82,q.y],[q.x+q.half*1.0,q.y+ss*.11],[w*1.12,q.y+ss*.8],[w*1.12,q.y+ss*.30]],p.road);
  g.fillStyle='#ddd2bb';g.fillRect(sx-ss*.025,q.y-ss*.6,ss*.045,ss*.6);g.fillStyle='#345d60';g.fillRect(sx-ss*.6,q.y-ss*1.03,ss*1.2,ss*.48);g.strokeStyle='#e5dac1';g.lineWidth=Math.max(1,ss*.015);g.strokeRect(sx-ss*.6,q.y-ss*1.03,ss*1.2,ss*.48);g.fillStyle='#fff0d3';g.font=`bold ${Math.max(6,ss*.095)}px sans-serif`;g.textAlign='center';g.fillText('↑ '+getRoute(upcoming.options[0]).name.split(' · ')[0].split(' ').slice(0,2).join(' '),sx,q.y-ss*.86,ss*1.08);g.fillText('↗ '+getRoute(upcoming.options[1]).name.split(' · ')[0].split(' ').slice(0,2).join(' '),sx,q.y-ss*.65,ss*1.08);g.restore();
 }
 const objects=[];const spacing=state.route==='carmelo'?32:58,start=Math.floor(state.distance/spacing)*spacing;
 for(let d=start;d<state.distance+drawDist;d+=spacing){const offset=d-state.distance;if(offset<10)continue;const q=project(offset),seed=Math.floor(d/spacing);for(const side of [-1,1]){
  let type=worldProp(state.route,seed,side);if(state.route==='coast'&&section.type==='village'&&seed%3===0)type='villa';if(state.route==='coast'&&section.type==='cliff'&&side>0)type='stone';if(state.route==='mountain'&&section.type==='forest')type='pine';
  objects.push({kind:'prop',q,side,type,seed:seed+side*13,offset});
 }}
 for(const mark of r.landmarks){const offset=mark.at-state.distance;if(offset>15&&offset<drawDist)objects.push({kind:'landmark',mark,q:project(offset),offset});}
 for(const car of trafficCars(state.distance,settings.traffic||'off',state.trafficClock??time)){if(car.offset>7&&car.offset<drawDist)objects.push({kind:'traffic',car,q:project(car.offset),offset:car.offset});}
 objects.sort((a,b)=>b.offset-a.offset);
 for(const o of objects){const q=o.q,size=h*.49*q.scale;if(o.kind==='landmark'){drawLandmark(g,o.mark,q,h,p.night,state.route);continue;}if(o.kind==='traffic'){
   const xx=q.x+o.car.lane*q.half*.84,ww=w*.145*q.scale,hh=ww*.50;ellipse(g,xx,q.y,ww*.7,hh*.25,'#10192988');g.fillStyle=['#bd7370','#e5c8a0','#698a95','#70896e'][o.car.id%4];g.fillRect(xx-ww*.5,q.y-hh,ww,hh);polygon(g,[[xx-ww*.38,q.y-hh],[xx-ww*.27,q.y-hh*1.6],[xx+ww*.27,q.y-hh*1.6],[xx+ww*.38,q.y-hh]],'#3b4f62');for(const s of [-1,1]){g.fillStyle='#ffb087';g.fillRect(xx+s*ww*.35-ww*.05,q.y-hh*.67,ww*.1,hh*.18);}continue;
  }
  const x=q.x+o.side*q.half*(state.route==='carmelo'?1.43:1.45+hash(o.seed)*.5),y=q.y;g.save();
  if(['palm','pine','cypress','tree'].includes(o.type))drawTree(g,x,y,size,o.type,o.seed,p.night);
  else if(['building','villa','farm'].includes(o.type))drawBuilding(g,x,y,size,Math.abs(o.seed),o.type==='building',p.night);
  else if(o.type==='vine'){for(let j=-1;j<=1;j++){line(g,[[x+j*size*.24,y],[x+j*size*.22,y-size*.3]],'#675d44',Math.max(1,size*.025));ellipse(g,x+j*size*.24,y-size*.3,size*.16,size*.11,p.night?'#465744':'#637e48');}}
  else if(o.type==='lamp'){
   line(g,[[x,y],[x,y-size],[x-o.side*size*.17,y-size*1.1]],p.night?'#4e5362':'#6a6c6b',Math.max(1,size*.025));ellipse(g,x-o.side*size*.17,y-size*1.1,size*.05,size*.024,'#ffe2a7');if(p.night){const glow=g.createRadialGradient(x,y-size,0,x,y-size,size*.38);glow.addColorStop(0,'#ffce8a30');glow.addColorStop(1,'#ffce8a00');g.fillStyle=glow;g.fillRect(x-size*.4,y-size*1.4,size*.8,size*.8);}
  }else if(['rock','stone'].includes(o.type))polygon(g,[[x-size*.4,y],[x-size*.27,y-size*.49],[x+size*.1,y-size*.6],[x+size*.4,y]],p.night?'#515962':'#86918a');
  g.restore();
 }
 // Small roadside reflectors retain world position and make the edge readable at night.
 for(let d=Math.floor(state.distance/45)*45+45;d<state.distance+650;d+=45){const q=project(d-state.distance);for(let side of [-1,1]){const xx=q.x+side*q.half*1.10,hh=h*.1*q.scale;g.fillStyle='#d8d2bf';g.fillRect(xx,q.y-hh,Math.max(1,hh*.10),hh);g.fillStyle=side<0?'#e0af83':'#f4edb0';g.fillRect(xx,q.y-hh*.82,Math.max(1,hh*.11),hh*.21);}}
 drawRoadAtmosphere(g,w,h,hor,state.distance,state.route,settings,time);
 if(settings.mood==='sunset'&&settings.livingLight!==false){g.fillStyle='rgba(18,25,55,'+(clamp(state.distance/r.length,0,1)*.27)+')';g.fillRect(0,0,w,h);}
 drawCarDetails(g,w,h,VEHICLES[state.vehicle]||VEHICLES.vesper,state.vehicle,state.speed,(state.steerMomentum||0)+(state.slide||0)*2,settings);
 g.restore();
}
export function drawMiniMap(g,state){
 const w=g.canvas.width,h=g.canvas.height,r=getRoute(state.route),samples=90;
 // Integrate exactly the centre-line model used for steering and WebGL. Keep the atlas compact.
 const centre=[0];for(let i=1;i<=samples;i++)centre.push(centre.at(-1)+roadShape(state,(i-.5)*r.length/samples).curve*r.length/samples);
 const lo=Math.min(...centre),hi=Math.max(...centre),span=Math.max(1,hi-lo);
 const xAt=t=>{const f=clamp(t,0,1)*samples,i=Math.min(samples-1,Math.floor(f));return w*.21+(centre[i]+(centre[i+1]-centre[i])*(f-i)-lo)/span*w*.48;};
 const yAt=t=>h*.88-clamp(t,0,1)*h*.75;
 g.clearRect(0,0,w,h);g.save();g.fillStyle='#14263e';g.fillRect(0,0,w,h);
 const points=[];for(let i=0;i<=samples;i++)points.push([xAt(i/samples),yAt(i/samples)]);
 line(g,points,'#ffffff3b',4);line(g,points,r.accent||'#f2bd80',1.5);
 if(r.junction){const t=r.junction.at/r.length,x=xAt(t),y=yAt(t),decided=(state.choices||[]).includes(state.route);line(g,[[x,y],[x+12,y-5],[w*.91,y-10]],decided?'#d8caad55':'#fff1c899',1.5);ellipse(g,x,y,2.7,2.7,'#e9b887');g.fillStyle='#dfd5c2';g.font='6px sans-serif';g.textAlign='right';g.fillText(r.junction.choices[1]==='mountain'?'SIERRA':r.junction.choices[1]==='vineyards'?'VIÑA':'CARMELO',w*.96,y-14);}
 for(const mark of r.landmarks){const t=mark.at/r.length;ellipse(g,xAt(t),yAt(t),2,2,'#f9deb4');}
 const t=clamp(state.distance/r.length,0,1);ellipse(g,xAt(t),yAt(t),4,4,'#fff3c7');g.restore();
}
