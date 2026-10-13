import assert from 'node:assert/strict';
import {junctionApproach,roadShape,advance} from '../js/physics.js';
const s={route:'coast',selected:false,distance:1200,speed:65,x:0,vehicle:'vesper',mode:'cruise'};
assert.equal(junctionApproach(s,1000),null);
assert.equal(junctionApproach(s,1200).remaining,615);
assert.equal(junctionApproach(s,1815).remaining,0);
assert.equal(junctionApproach({...s,selected:true},1400),null);
assert.equal(junctionApproach({...s,route:'mountain'},1400),null);
for(const route of ['coast','mountain','carmelo','vineyards']){
 for(let d=0;d<5000;d+=25){const q=roadShape({...s,route},d);assert(Number.isFinite(q.curve)&&Number.isFinite(q.elevation));}
}
const next=advance(s,{gas:true,right:true},.016); assert(next.distance>=s.distance);
console.log('road-signs PASS');
