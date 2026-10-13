/** Speed-aware framing keeps the road readable without changing the vehicle simulation. */
export function cameraFraming(preset,speed=0){
 const value=Math.max(0,Math.min(172,Number.isFinite(speed)?Math.abs(speed):0));
 if(preset.distance<0)return {...preset};
 const fast=value/172;
 return {...preset,distance:preset.distance+Math.min(5.2,value*.034),height:preset.height+value*.0065,look:preset.look+Math.min(11,value*.064),follow:Math.min(.14,preset.follow+fast*.025)};
}
