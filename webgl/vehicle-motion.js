// Efectos visuales únicamente: nunca modifican la física ni el guardado.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function motionStep(current,{speed=0,steer=0,acceleration=0,roadHeight=0,dt=1/60}={}){
 const step=clamp(dt,0,.05),blend=1-Math.exp(-step*7.5);
 const targetRoll=clamp(-steer*clamp(speed/95,0,1)*.085,-.085,.085);
 const targetPitch=clamp(-acceleration*.012,-.052,.052);
 const targetBob=Math.sin((current.phase||0))*clamp(speed/140,0,1)*.045;
 const next={...current};
 next.phase=(current.phase||0)+step*(2.5+speed*.10);
 next.roll=(current.roll||0)+(targetRoll-(current.roll||0))*blend;
 next.pitch=(current.pitch||0)+(targetPitch-(current.pitch||0))*blend;
 next.bob=(current.bob||0)+(targetBob-(current.bob||0))*blend;
 next.cameraBob=(current.cameraBob||0)+((next.bob*.20)-(current.cameraBob||0))*blend*.55;
 return next;
}
export function orientCarVertex(point,origin,motion){
 const [x,y,z]=point,[ox,oy,oz]=origin;
 const dx=x-ox,dy=y-oy,dz=z-oz;
 const cr=Math.cos(motion.roll),sr=Math.sin(motion.roll),cp=Math.cos(motion.pitch),sp=Math.sin(motion.pitch);
 const rx=dx*cr-dy*sr, ry=dx*sr+dy*cr;
 return [ox+rx,oy+ry*cp-dz*sp+(motion.bob||0),oz+ry*sp+dz*cp];
}
