import assert from 'node:assert/strict';
import {roadCurve,roadElevation,advance} from '../js/physics.js';
const routes=['coast','mountain','carmelo','vineyards'];
for(const route of routes){
 for(let d=0;d<=5200;d+=20){
  assert(Number.isFinite(roadCurve(route,d)));
  assert(Number.isFinite(roadElevation(route,d)));
  assert(Math.abs(roadCurve(route,d+1)-roadCurve(route,d))<.03,'continuity: '+route);
 }
}
assert.notEqual(roadCurve('mountain',1200),roadCurve('coast',1200));
assert.notEqual(roadElevation('carmelo',500),roadElevation('vineyards',500));
const base={x:0,speed:70,distance:1200,mode:'cruise',vehicle:'vesper'};
const outcomes=routes.map(route=>advance({...base,route},{},.05).x);
assert(new Set(outcomes.map(x=>x.toFixed(7))).size>=3,'route affects vehicle drift');
console.log('PASS: distinct continuous routes, elevation and steering coherence');
