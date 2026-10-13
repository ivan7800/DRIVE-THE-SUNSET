import assert from 'node:assert/strict';
import {roadShape,advance} from '../js/physics.js';
import {validateTrip} from '../js/save.js';
const at=1780, s={route:'mountain',branchFrom:'coast',branchAt:at,vehicle:'vesper',mode:'cruise',distance:at,x:0,speed:78,selected:true,postcard:false,finished:false};
const old={route:'coast'};
for (const d of [at,at+0.001]) assert(Math.abs(roadShape(s,d).curve-roadShape(old,d).curve)<.00001);
const fin=at+420;
assert(Math.abs(roadShape(s,fin).curve-roadShape({route:'mountain'},fin).curve)<1e-10);
for(let d=at;d<=fin;d+=1){const a=roadShape(s,d),b=roadShape(s,d+1);assert(Number.isFinite(a.curve)&&Number.isFinite(a.elevation));assert(Math.abs(b.curve-a.curve)<.04);}
const saved=validateTrip({schemaVersion:1,...s});assert(saved&&saved.branchAt===at);assert.equal(validateTrip({...s,schemaVersion:1,branchAt:999999}),null);
const next=advance(s,{left:false,right:false},.05);assert(Number.isFinite(next.x));
console.log('PASS: seamless road fork and backward-compatible validated save');
