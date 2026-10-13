import assert from 'node:assert/strict';
import {smoothWeight,clipNearTriangle} from '../webgl/render-utils.js';
for(const fps of [30,60,120,144]){
 let x=0;for(let i=0;i<fps;i++)x+=(1-x)*smoothWeight(.065,1/fps);
 assert.ok(Math.abs(x-(1-Math.pow(1-.065,60)))<1e-9,`Cámara inconsistente a ${fps}FPS`);
}
const triangle=[[-1,0,.2],[1,0,2],[0,1,2]];
const out=clipNearTriangle(triangle,v=>v[2],.5);
assert.equal(out.length,4);assert.ok(out.every(v=>v[2]>=.5-1e-9));
assert.deepEqual(clipNearTriangle([[0,0,.1],[1,0,.1],[0,1,.1]],v=>v[2],.5),[]);
console.log('PASS: camera smoothing at 30/60/120/144 Hz, near-plane clipping; no WebGL execution claim');
