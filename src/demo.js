import { transformPoint } from './geometry.js';

// Deterministic synthetic survey fixture: never presented as a live capture.
export function createDemo(){
  const points=[];
  for(let x=-3;x<=3;x+=0.07) for(let z=-2.5;z<=2.5;z+=0.07){
    points.push([x,0,z]);
    if(z < -2.42) for(let y=0.07;y<2.7;y+=0.07) points.push([x,y,z]);
    if(x < -2.92) for(let y=0.07;y<2.7;y+=0.07) points.push([x,y,z]);
  }
  const box=(cx,cz,w,d,h)=>{for(let x=cx-w/2;x<=cx+w/2;x+=0.055)for(let z=cz-d/2;z<=cz+d/2;z+=0.055){points.push([x,h,z]);if(x<cx-w/2+0.06||z<cz-d/2+0.06)for(let y=0;y<h;y+=0.065)points.push([x,y,z]);}};
  box(-0.4,0.1,2.2,1.1,0.85);box(1.9,-1.7,0.7,0.65,1.6);box(-2,1.5,0.8,0.65,0.5);
  const a=points.filter(p=>p[0]<1.2), sharedB=points.filter(p=>p[0]>-1.3);
  const angle=0.34,c=Math.cos(angle),s=Math.sin(angle);
  const toLocal=[c,0,s,1.35,0,1,0,0.12,-s,0,c,0.75,0,0,0,1];
  const landmarks=[[-1,0,-2],[1,0,-2],[-1,1.5,-2],[0,0,1]];
  return {a:{units:'meters',points:a,landmarks,source:'synthetic'},b:{units:'meters',points:sharedB.map(p=>transformPoint(p,toLocal)),landmarks:landmarks.map(p=>transformPoint(p,toLocal)),source:'synthetic'}};
}
