// Geometría transversal reproducible, compartida por terreno y pruebas.
export function roadCrossSection(center,elevation){
 if(!Number.isFinite(center)||!Number.isFinite(elevation))throw new TypeError('Terreno inválido');
 return [
  {x:center-210,y:elevation-1.8},
  {x:center-25,y:elevation-1.0},
  {x:center-9,y:elevation-.3},
  {x:center-8.2,y:elevation-.04},
  {x:center+8.2,y:elevation-.04},
  {x:center+9,y:elevation-.3},
  {x:center+25,y:elevation-1.0},
  {x:center+210,y:elevation-1.8}
 ];
}
export function followCamera(current,target,weight=.065){
 const t=Math.min(1,Math.max(0,weight));
 const blend=(a,b)=>a+(b-a)*t;
 return {x:blend(current.x,target.x),y:current.y===null?target.y:blend(current.y,target.y),yaw:blend(current.yaw,target.yaw)};
}
