import assert from 'node:assert/strict';
import {trafficCars,resolveTrafficContact,advance,VEHICLES} from '../js/physics.js';
assert.equal(trafficCars(100,'off',20).length,0);
assert.notDeepEqual(trafficCars(0,'normal',0),trafficCars(0,'normal',40),'tráfico dinámico');
assert(trafficCars(0,'normal',0).length>=trafficCars(0,'light',0).length);
const target={speed:80,x:-.43,distance:300,mode:'cruise'};
const hit=resolveTrafficContact(target,[{offset:2,lane:-.43}],1/60);
assert(hit.contact&&hit.speed<80,'colisión suave');
assert(!resolveTrafficContact(hit,[{offset:2,lane:-.43}],1/60).contact,'cooldown');
assert(!resolveTrafficContact(target,[{offset:20,lane:-.43}],1/60).contact,'distancia segura');
assert(!resolveTrafficContact(target,[],1/60).contact,'sin tráfico no hay choque');
const accel={};for(const vehicle of Object.keys(VEHICLES)){let state={...target,vehicle,speed:0};for(let i=0;i<120;i++)state=advance(state,{gas:true},1/60);accel[vehicle]=state.speed;}
assert.notEqual(accel.vesper,accel.solstice);assert.notEqual(accel.solstice,accel.phantom);
console.log('PASS: tráfico móvil, niveles, colisiones, cooldown y vehículos');
