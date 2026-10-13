import assert from 'node:assert/strict';
import {advance,VEHICLES} from '../js/physics.js';
import {createFixedStepper} from '../js/trip.js';

const base={route:'coast',vehicle:'vesper',mode:'cruise',speed:0,distance:0,x:0};
function drive(fps,seconds){
 let state={...base};const clock=createFixedStepper();
 for(let i=0;i<fps*seconds;i++)clock.update(1/fps,dt=>state=advance(state,{gas:true},dt));
 return state;
}
const reference=drive(60,3);
for(const fps of [10,20,30,60,120,144]){
 const state=drive(fps,3);assert(Math.abs(state.distance-reference.distance)<1e-8,'same elapsed distance at '+fps+' Hz');
 assert(Math.abs(state.speed-reference.speed)<1e-8,'same acceleration at '+fps+' Hz');
}
for(const vehicle of Object.keys(VEHICLES)){
 let state={...base,vehicle};for(let i=0;i<180;i++)state=advance(state,{left:true},1/60);
 assert.equal(state.distance,0,'stationary distance '+vehicle);assert.equal(state.x,0,'stationary lateral position '+vehicle);
}
const stepper=createFixedStepper();let steps=0;
assert.equal(stepper.update(Infinity,()=>steps++),0);assert.equal(stepper.update(-1,()=>steps++),0);
assert.equal(stepper.update(10,()=>steps++),15,'long focus loss is bounded to 0.25 s');
stepper.update(.008,()=>steps++);stepper.reset();assert.equal(stepper.remainder,0,'reset discards fractional suspension time');
console.log('PASS: fixed-step at 10/20/30/60/120/144 Hz, four vehicles stationary, suspension limit and reset');
