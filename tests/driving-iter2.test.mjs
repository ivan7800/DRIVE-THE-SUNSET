import assert from 'node:assert/strict';
import {advance,trafficCars,resolveTrafficContact,VEHICLES} from '../js/physics.js';
const s={speed:100,x:0,distance:20,mode:'cruise',vehicle:'vesper'};
let first=advance(s,{right:true},1/60);
assert(first.x>0 && first.x<0.01,'soft initial steer');
let later=first;for(let i=0;i<30;i++)later=advance(later,{right:true},1/60);
assert(later.x>first.x,'progressive steering');
const released=advance(later,{},1/60);
assert(released.steerMomentum<later.steerMomentum,'steer self centering');
let reverse=advance({...s,speed:-15,steerMomentum:0},{right:true},1/60);
assert(reverse.x<0,'reverse steering');
for(const vehicle of Object.keys(VEHICLES)){
 let state={...s,vehicle};for(let i=0;i<600;i++)state=advance(state,{gas:true,right:true},1/60);
 assert(Number.isFinite(state.x)&&Number.isFinite(state.distance),'finite physics '+vehicle);
 assert(Math.abs(state.x)<=1.52,'lateral bounds '+vehicle);
}
assert.deepEqual(trafficCars(300,'off',20),[]);
assert.deepEqual(trafficCars(300,'normal',20),trafficCars(300,'normal',20),'repeatable traffic');
const hit=resolveTrafficContact({...s,x:-.43},[{offset:1,lane:-.43}],1/60);
assert(hit.contact && hit.speed<s.speed && !resolveTrafficContact(hit,[{offset:1,lane:-.43}],1/60).contact);
console.log('PASS: progressive steering, release, reverse, bounds, repeatable traffic and cooldown');
