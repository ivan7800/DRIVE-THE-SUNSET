/** Small 2D atlas used in the HUD. The driving scene is rendered only with WebGL. */
import {getRoute} from './routes.js';
import {clamp,roadShape} from './physics.js';

function line(g,points,color,width=1){
 g.strokeStyle=color;g.lineWidth=width;g.beginPath();
 points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
}
function ellipse(g,x,y,rx,ry,color){
 g.fillStyle=color;g.beginPath();g.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);g.fill();
}
export function drawMiniMap(g,state){
 const w=g.canvas.width,h=g.canvas.height,r=getRoute(state.route),samples=90;
 const centre=[0];for(let i=1;i<=samples;i++)centre.push(centre.at(-1)+roadShape(state,(i-.5)*r.length/samples).curve*r.length/samples);
 const lo=Math.min(...centre),hi=Math.max(...centre),span=Math.max(1,hi-lo);
 const xAt=t=>{const f=clamp(t,0,1)*samples,i=Math.min(samples-1,Math.floor(f));return w*.21+(centre[i]+(centre[i+1]-centre[i])*(f-i)-lo)/span*w*.48;};
 const yAt=t=>h*.88-clamp(t,0,1)*h*.75;
 g.clearRect(0,0,w,h);g.save();g.fillStyle='#14263e';g.fillRect(0,0,w,h);
 const points=[];for(let i=0;i<=samples;i++)points.push([xAt(i/samples),yAt(i/samples)]);
 line(g,points,'#ffffff3b',4);line(g,points,r.accent||'#f2bd80',1.5);
 if(r.junction){const t=r.junction.at/r.length,x=xAt(t),y=yAt(t),decided=(state.choices||[]).includes(state.route);line(g,[[x,y],[x+12,y-5],[w*.91,y-10]],decided?'#d8caad55':'#fff1c899',1.5);ellipse(g,x,y,2.7,2.7,'#e9b887');g.fillStyle='#dfd5c2';g.font='6px sans-serif';g.textAlign='right';g.fillText(r.junction.choices[1]==='mountain'?'SIERRA':r.junction.choices[1]==='vineyards'?'VIÑA':'CARMELO',w*.96,y-14);}
 for(const mark of r.landmarks)ellipse(g,xAt(mark.at/r.length),yAt(mark.at/r.length),2,2,'#f9deb4');
 const t=clamp(state.distance/r.length,0,1);ellipse(g,xAt(t),yAt(t),4,4,'#fff3c7');g.restore();
}
