import assert from 'node:assert/strict';
import {trafficCars,overtakeBlend,resolveTrafficContact} from '../js/physics.js';
for(const t of [-1,0,.2,.5,.8,1,2])assert(overtakeBlend(t)>=0&&overtakeBlend(t)<=1);
assert.equal(overtakeBlend(0),0);assert.equal(overtakeBlend(1),1);
for(const level of ['light','normal']){
 for(let time=0;time<70;time+=.25){
  const cars=trafficCars(300,level,time);
  for(const car of cars){assert(Number.isFinite(car.lane));assert(Math.abs(car.lane)<.6);assert(Number.isFinite(car.offset));}
 }
}
const before=trafficCars(0,'normal',7.01).find(c=>c.id===0);
const after=trafficCars(0,'normal',7.02).find(c=>c.id===0);
assert(before&&after&&Math.abs(before.lane-after.lane)<.01,'No teleport on lane change');
assert(trafficCars(0,'normal',13).some(c=>c.overtaking),'NPC lane changes');
assert.deepEqual(trafficCars(200,'off',10),[]);
const contact=resolveTrafficContact({speed:55,x:.43},[{offset:1,lane:.43}],1/60);
assert(contact.contact);
console.log('PASS driving iter3: smooth lane changes, bounds, disabled traffic, collision');
