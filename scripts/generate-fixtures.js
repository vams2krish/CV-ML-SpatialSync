import {mkdir,writeFile} from 'node:fs/promises';
import {createDemo} from '../src/demo.js';
await mkdir('examples',{recursive:true});
const demo=createDemo();
for(const id of ['a','b'])await writeFile(`examples/cloud-${id}.json`,JSON.stringify({...demo[id],points:demo[id].points.filter((_,i)=>i%8===0)},null,2)+'\n');
const width=32,height=24;
const recording={schemaVersion:1,units:'meters',source:'synthetic',intrinsics:{width,height,fx:26,fy:26,cx:15.5,cy:11.5},frames:[]};
for(let frame=0;frame<3;frame++){
  // Camera is 1.4 m above a floor, pointing toward the back wall at z = -2.
  const x=(frame-1)*0.6;
  const depth=[];
  for(let v=0;v<height;v++)for(let u=0;u<width;u++){
    const wall=4.5;const floor=v>11.5?1.4*26/(v-11.5):Infinity;
    depth.push(Math.min(wall,floor));
  }
  recording.frames.push({timestampMs:frame*500,depth,cameraToWorld:[1,0,0,x,0,-1,0,1.4,0,0,-1,2.5,0,0,0,1]});
}
await writeFile('examples/posed-depth.json',JSON.stringify(recording,null,2)+'\n');
console.log('Wrote three synthetic metric fixtures to examples/.');
