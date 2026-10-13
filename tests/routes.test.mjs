import assert from 'node:assert/strict';
import {ROUTES,getRoute,nearestLandmark,worldProp} from '../js/routes.js';
assert.equal(Object.keys(ROUTES).length,4);
for(const [id,r] of Object.entries(ROUTES)){assert(r.length>4000);assert.equal(r.sky.length,3);assert(r.landmarks.length>=3);assert.equal(getRoute(id),r);assert.equal(nearestLandmark(id,r.landmarks[0].at)?.name,r.landmarks[0].name);assert(typeof worldProp(id,40,-1)==='string');}
assert.equal(getRoute('invalid'),ROUTES.coast);assert.equal(nearestLandmark('coast',0),null);console.log('PASS rutas: cuatro recorridos, hitos y decoraciones');
