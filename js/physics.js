import {ROUTES} from './routes.js';
export const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
export const VEHICLES={
 vesper:{name:'VESPER GT 1972',color:'#a54548',acceleration:1.18,braking:.91,steering:.83,topSpeed:158},
 solstice:{name:'SOLSTICE LX 1984',color:'#e7c58e',acceleration:.87,braking:1.05,steering:1.04,topSpeed:132},
 phantom:{name:'PHANTOM XR 1987',color:'#588c9c',acceleration:1.08,braking:1.18,steering:1.19,topSpeed:172},
 meridian:{name:'MERIDIAN S 1992',color:'#516c66',acceleration:.96,braking:1.12,steering:.92,topSpeed:146},
 ironclad:{name:'IRONCLAD V8 1970',color:'#b45a3c',acceleration:1.22,braking:.84,steering:.69,topSpeed:164},
 starlight:{name:'STARLIGHT GT 1988',color:'#724d83',acceleration:1.04,braking:1.08,steering:1.28,topSpeed:176},
 longhorn:{name:'LONGHORN LX 1995',color:'#c5c9bb',acceleration:.92,braking:1.16,steering:.89,topSpeed:151}
};
export const TRAFFIC_LEVELS=['off','light','normal'];
export const HANDLING=Object.freeze({
 vesper:{response:5.8,grip:5.2,slide:1.15,brakeDrag:90,label:'V8 · PESO Y PAR'},
 solstice:{response:6.8,grip:7.2,slide:.68,brakeDrag:103,label:'CRUCERO · SUAVE Y ESTABLE'},
 phantom:{response:9.2,grip:6.7,slide:.97,brakeDrag:98,label:'COUPÉ · ÁGIL Y DIRECTO'},
 meridian:{response:5.5,grip:8.2,slide:.54,brakeDrag:110,label:'SEDÁN · FIRME Y PROGRESIVO'},
 ironclad:{response:4.8,grip:4.9,slide:1.28,brakeDrag:86,label:'V8 CLÁSICO · PESADO Y POTENTE'},
 starlight:{response:9.8,grip:7.1,slide:.91,brakeDrag:100,label:'GT · LIGERO Y PRECISO'},
 longhorn:{response:5.9,grip:8.5,slide:.48,brakeDrag:114,label:'GRAN TURISMO · ESTABLE Y SERENO'}
});
// Posiciones reproducibles: vehículos móviles sobre un circuito virtual largo.
// La fase de tráfico es volátil; no altera los guardados existentes.
// Overtakes are deterministic and smooth. NPCs do not change lanes instantly.
// This remains lightweight arcade traffic, not full pathfinding.
export function overtakeBlend(t){
 const x=clamp(t,0,1);return x*x*(3-2*x);
}
const TRAFFIC_LOOP=7200;
function npcPosition(id,time){return (260+id*390+(id%3)*55+time*(38+(id*17)%34)/3.6)%TRAFFIC_LOOP;}
function wrappedGap(a,b){let d=(a-b+TRAFFIC_LOOP*1.5)%TRAFFIC_LOOP-TRAFFIC_LOOP/2;return d;}
// Check both the destination lane at the start of the manoeuvre and the
// original lane at the start of the return. Deterministic by NPC and cycle.
// This is a conservative lane-gap check, not a full tactical driving AI.
export function laneChangeClear(id,count,startTime){
 const source=id%2===0?-.43:.43;
 for(const [time,lane] of [[startTime,-source],[startTime+9,source]]){
  const candidate=npcPosition(id,time);
  for(let j=0;j<count;j++){
   if(j===id)continue;
   const otherLane=j%2===0?-.43:.43;
   if(otherLane!==lane)continue;
   const gap=wrappedGap(npcPosition(j,time),candidate);
   if(gap>-45&&gap<85)return false;
  }
 }
 return true;
}
export function trafficCars(distance,level,clock=0){
 if(level==='off')return [];
 const count=level==='normal'?18:8,cars=[],loop=TRAFFIC_LOOP;
 const now=Math.max(0,Number.isFinite(clock)?clock:0);
 for(let i=0;i<count;i++){
  const speed=38+(i*17)%34;
  const position=npcPosition(i,now);
  let offset=position-(distance%loop);
  if(offset < -loop/2)offset+=loop;
  if(offset > loop/2)offset-=loop;
  const home=i%2===0?-.43:.43;
  const period=28, phase=(now+i*7.3)%period;
  const manoeuvreStart=now-phase+7;
  let shift=0;
  if(i%3===0&&phase>=7&&phase<20&&laneChangeClear(i,count,manoeuvreStart)){
   if(phase<11)shift=overtakeBlend((phase-7)/4);
   else if(phase<16)shift=1;
   else shift=1-overtakeBlend((phase-16)/4);
  }
  const lane=home*(1-shift)+(-home)*shift+Math.sin(now*.19+i*2.11)*.012;
  if(offset>=-16&&offset<1100)cars.push({id:i,offset,lane,speed,overtaking:shift>.02});
 }
 return cars;
}
// Golpes indulgentes: no hay game over, ni daños permanentes.
export function resolveTrafficContact(state,cars,dt){
 const cooldown=Math.max(0,(state.contactCooldown||0)-clamp(dt,0,.05));
 const overlap=cooldown===0&&Math.abs(state.speed)>7&&cars.some(car=>Math.abs(car.offset)<5.5&&Math.abs(state.x-car.lane)<.23);
 if(!overlap)return {...state,contactCooldown:cooldown,contact:!!state.wallContact};
 return {...state,speed:state.speed*.48,contactCooldown:1.8,contact:true,steerMomentum:(state.steerMomentum||0)*.35};
}
// Deterministic road center line shared by camera projection and steering.
// Route-specific geometry stays continuous across segment boundaries.
export function roadCurve(route,distance){
 const d=Math.max(0,Number.isFinite(distance)?distance:0);
 switch(route){
  case 'mountain': return Math.sin(d/175)*.77+Math.sin(d/420)*.60+Math.sin(d/980)*.34;
  case 'carmelo': return Math.sin(d/240)*.40+Math.sin(d/560)*.26+Math.sin(d/105)*.12;
  case 'vineyards': return Math.sin(d/610)*.52+Math.sin(d/1400)*.45;
  case 'mooncoast': return Math.sin(d/255)*.72+Math.sin(d/760)*.62+Math.sin(d/1080)*.22;
  case 'olivepass': return Math.sin(d/390)*.56+Math.sin(d/1120)*.74+Math.sin(d/175)*.10;
  default: return Math.sin(d/330)*.9+Math.sin(d/1220)*.85;
 }
}
// Non-physical vertical camera offset: hills feel different without fake collision physics.
export function roadElevation(route,distance){
 const d=Math.max(0,Number.isFinite(distance)?distance:0);
 if(route==='mountain')return Math.sin(d/520)*.65+Math.sin(d/180)*.22;
 if(route==='carmelo')return Math.sin(d/460)*.42+Math.sin(d/170)*.13;
 if(route==='vineyards')return Math.sin(d/820)*.25;
 if(route==='mooncoast')return Math.sin(d/480)*.27+Math.sin(d/150)*.08;
 if(route==='olivepass')return Math.sin(d/700)*.48+Math.sin(d/255)*.15;
 return Math.sin(d/930)*.19;
}

// Signage is a pure world-space model, independent of camera and FPS.
export function junctionApproach(state,distance){
 const route=state.route||'coast',data=ROUTES[route];
 const junctionData=data?.junction||(route==='coast'?{at:1815,choices:['coast','mountain']}:null);
 if(!junctionData||(Array.isArray(state.choices)?state.choices.includes(route):state.selected))return null;
 const junction=junctionData.at,remaining=junction-distance;
 if(remaining < -165||remaining>720)return null;
 return {at:junction,remaining,warning:remaining>0,options:junctionData.choices};
}
// A junction blends the existing road into the selected destination over 420m.
// Continuous first derivative at both ends prevents camera/steering jolts.
export function roadShape(state,distance){
 const destination=state.route||'coast';
 const targetCurve=roadCurve(destination,distance);
 const targetHeight=roadElevation(destination,distance);
 if(!Object.hasOwn(ROUTES,state.branchFrom)||state.branchFrom===destination||!Number.isFinite(state.branchAt))
  return {curve:targetCurve,elevation:targetHeight};
 const t=clamp((distance-state.branchAt)/420,0,1);
 const blend=t*t*(3-2*t);
 const sourceDistance=Number.isFinite(state.branchSourceDistance)?Math.max(0,state.branchSourceDistance+(distance-state.branchAt)):distance;
 const fromCurve=roadCurve(state.branchFrom,sourceDistance),fromHeight=roadElevation(state.branchFrom,sourceDistance);
 return {curve:fromCurve+(targetCurve-fromCurve)*blend,elevation:fromHeight+(targetHeight-fromHeight)*blend};
}
export function advance(s,input,dt){
 const vehicle=VEHICLES[s.vehicle]||VEHICLES.vesper;
 const handling=HANDLING[s.vehicle]||HANDLING.vesper;
  dt=clamp(dt,0,0.05);
  const gas=!!input.gas, brake=!!input.brake, handbrake=!!input.handbrake;
  const throttle=Number.isFinite(input.throttle)?clamp(input.throttle,0,1):gas?1:0;
  const braking=Number.isFinite(input.braking)?clamp(input.braking,0,1):brake?1:0;
  let speed=s.speed;
  // Brake has priority when both pedals are held. A held brake crosses zero into reverse.
  if(braking>0){speed-=speed>0?92*vehicle.braking*braking*dt:34*braking*dt;}else if(throttle>0){speed+=(speed<0?95:43*vehicle.acceleration)*throttle*dt;}else{const drag=(10+speed*speed*.00065)*dt; speed=Math.abs(speed)<drag?0:speed-Math.sign(speed)*drag;}
  if(handbrake){const drag=handling.brakeDrag*dt;speed=Math.abs(speed)<drag?0:speed-Math.sign(speed)*drag;}
  speed=clamp(speed,-24,s.mode==='arcade'?vehicle.topSpeed:Math.min(vehicle.topSpeed,135));
  const steer=Number.isFinite(input.steerAxis)?clamp(input.steerAxis,-1,1):(input.right?1:0)-(input.left?1:0);
  // Steering interpolation prevents an instantaneous lateral impulse at high speed.
  const response=1-Math.exp(-handling.response*dt);
  const steerMomentum=(s.steerMomentum||0)+(steer-(s.steerMomentum||0))*response;
  // At rest the tyres can turn, but the vehicle cannot translate sideways.
  const traction=clamp(Math.abs(speed)/36,0,1); const direction=speed<0?-1:1;
  const sensitivity=clamp(Number.isFinite(input.steeringFactor)?input.steeringFactor:1,.5,1.5);
  const steerSpeed=1.25*vehicle.steering*sensitivity*(1-.32*clamp(Math.abs(speed)/175,0,1));
  const targetSlip=handbrake&&Math.abs(speed)>25?steerMomentum*handling.slide*clamp(Math.abs(speed)/100,0,1):0;
  const slide=(s.slide||0)+(targetSlip-(s.slide||0))*(1-Math.exp(-(handbrake?3.8:handling.grip)*dt));
  let x=s.x+(steerMomentum*steerSpeed+slide*.46)*traction*dt*direction;
  const route=s.route||'coast';
  // Drift towards the road edge follows the route's actual center-line change.
  const delta=roadShape(s,s.distance+speed/3.6*dt).curve-roadShape(s,s.distance).curve;
  x-=delta*.21;
  const edge=Math.abs(x)>1.04;
  if(edge){speed=Math.max(-15,speed-(speed>0?49:-15)*dt);}
  // Clearance includes half a car width in the shared 5 m lateral scale.
  // Keep cars clear of the pavement façades; no invisible building penetration.
  const limit=route==='carmelo'?1.36:1.48;
  const wallContact=Math.abs(x)>limit&&Math.abs(speed)>7&&!(s.contactCooldown>0);
  if(wallContact)speed*=.62;
  x=clamp(x,-limit,limit);
  const nextDistance=Math.max(0,s.distance+speed/3.6*dt);
  return {...s,speed,x,distance:nextDistance,steerMomentum:Math.abs(x)>=limit?steerMomentum*.4:steerMomentum,slide:Math.abs(x)>=limit?0:slide,driftAngle:slide*.16*direction,throttle,braking,handbrake,wallContact,contactCooldown:wallContact?1.8:s.contactCooldown};
}
export function branchActive(distance,selected,route='coast'){
 const junction=ROUTES[route]?.junction||(route==='coast'?{at:1815}:null);
 return !!junction&&!selected&&distance>=junction.at-165&&distance<=junction.at+165;
}
