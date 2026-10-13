// Utilidades puras comprobables fuera del navegador.
export function smoothWeight(baseWeight,dt){
 if(!Number.isFinite(baseWeight)||baseWeight<0||baseWeight>1)throw new RangeError('Factor de seguimiento inválido');
 if(!Number.isFinite(dt)||dt<0)throw new RangeError('Tiempo inválido');
 return 1-Math.pow(1-baseWeight,dt*60);
}
export function clipNearTriangle(vertices,depth,near=.5){
 let output=vertices;
 for(const _ of [0]){
  const input=output;output=[];
  for(let i=0;i<input.length;i++){
   const a=input[i],b=input[(i+1)%input.length],da=depth(a),db=depth(b);
   const insideA=da>=near,insideB=db>=near;
   if(insideA)output.push(a);
   if(insideA!==insideB){const t=(near-da)/(db-da);output.push(a.map((v,k)=>v+(b[k]-v)*t));}
  }
 }
 return output;
}
