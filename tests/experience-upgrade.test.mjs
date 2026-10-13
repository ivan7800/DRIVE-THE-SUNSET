import assert from 'node:assert/strict';
import {cameraFraming} from '../webgl/camera.js';
import {routeAtmosphere} from '../webgl/atmosphere.js';

const preset={distance:12.5,height:4.2,look:29,follow:.085};
const parked=cameraFraming(preset,0),fast=cameraFraming(preset,150),hood=cameraFraming({...preset,distance:-1.35},150);
assert.deepEqual(parked,preset);assert(fast.distance>parked.distance&&fast.height>parked.height&&fast.look>parked.look,'camera opens the view with speed');
assert(fast.follow>parked.follow&&fast.follow<=.14,'camera response remains capped');assert.equal(hood.distance,-1.35,'hood camera retains its framing');
assert.deepEqual(preset,{distance:12.5,height:4.2,look:29,follow:.085},'camera presets are not mutated');
const mood={ambient:.5,fog:[.4,.5,.6],top:[.1,.2,.3]},roads=['coast','mountain','vineyards','carmelo'].map(route=>routeAtmosphere(route,mood));
assert(roads.every(value=>value.ambient>0&&value.ambient<1&&value.fog.length===3));
assert.equal(mood.ambient,.5,'base mood is not mutated');assert.equal(new Set(roads.map(value=>value.fog.join(','))).size,4,'each road has a distinct atmospheric tint');
assert.deepEqual(routeAtmosphere('unknown',mood),routeAtmosphere('coast',mood),'unknown routes use safe defaults');
console.log('PASS: speed-aware camera and four route lighting profiles');
