import assert from 'node:assert/strict';
import {laneChangeClear,trafficCars} from '../js/physics.js';
assert.equal(typeof laneChangeClear(0,18,7),'boolean');
for(const level of ['light','normal']){
  for(let t=0;t<100;t+=.1){
    const cars=trafficCars(300,level,t);
    for(const c of cars){
      assert(Number.isFinite(c.lane));
      assert(Math.abs(c.lane)<.6);
      if(c.overtaking){
        const phase=(t+c.id*7.3)%28;
        const start=t-phase+7;
        assert(laneChangeClear(c.id,level==='normal'?18:8,start),'change requires gap approval');
      }
    }
  }
}
assert.deepEqual(trafficCars(300,'off',11),[]);
console.log('PASS iter4: lane gaps checked, bounded lanes, traffic off');
