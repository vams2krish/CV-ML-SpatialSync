import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemo} from '../src/demo.js';
import {IDENTITY,registerLandmarks,transformPoint,reconstructDepth,voxelDownsample,validateCloud,exportPly} from '../src/geometry.js';

test('recovers a known rigid transform and aligns held-out scene points',()=>{
  const {a,b}=createDemo();const fit=registerLandmarks(b.landmarks,a.landmarks);
  assert.ok(fit.rmse<1e-10);
  const merged=b.points.map(p=>transformPoint(p,fit.transform));
  // B includes a known table point at metric height 0.85 after alignment.
  assert.ok(merged.some(p=>Math.abs(p[1]-0.85)<1e-8));
  const target=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],source=target.map(p=>[p[0]+2,p[1]-3,p[2]+4]);
  const result=registerLandmarks(source,target);
  assert.ok(Math.hypot(...transformPoint([2.2,-2.7,4.4],result.transform).map((v,i)=>v-[0.2,0.3,0.4][i]))<1e-10);
});
test('rejects degeneracy, mismatched pairs and inconsistent landmarks',()=>{
  assert.throws(()=>registerLandmarks([[0,0,0],[1,0,0],[2,0,0]],[[0,0,0],[1,0,0],[2,0,0]]),/degenerate/);
  assert.throws(()=>registerLandmarks([[0,0,0]],[]),/paired/);
  assert.throws(()=>registerLandmarks([[0,0,0],[1,0,0],[0,1,0],[0,0,1]],[[0,0,0],[10,0,0],[0,1,0],[0,0,1]]),/rejected/);
});
test('unprojects known depth and translates camera pose, ignoring missing samples',()=>{
  const translated=[...IDENTITY];translated[3]=2;
  const result=reconstructDepth({schemaVersion:1,units:'meters',intrinsics:{width:2,height:1,fx:2,fy:2,cx:0,cy:0},frames:[{timestampMs:0,depth:[2,0],cameraToWorld:IDENTITY},{timestampMs:100,depth:[null,2],cameraToWorld:translated}]});
  assert.deepEqual(result.points,[[0,0,2],[3,0,2]]);
});
test('rejects invalid poses, depth, intrinsics and backwards timestamps',()=>{
  const fixture={schemaVersion:1,units:'meters',intrinsics:{width:1,height:1,fx:1,fy:1,cx:0,cy:0},frames:[{timestampMs:0,depth:[-1],cameraToWorld:IDENTITY}]};
  assert.throws(()=>reconstructDepth(fixture),/Depth/);
  fixture.frames[0].depth=[1];fixture.frames[0].cameraToWorld=[...IDENTITY];fixture.frames[0].cameraToWorld[0]=2;
  assert.throws(()=>reconstructDepth(fixture),/orthonormal/);
  fixture.frames[0].cameraToWorld=IDENTITY;fixture.frames.push({...fixture.frames[0],timestampMs:-1});assert.throws(()=>reconstructDepth(fixture),/monotonic/);
});
test('voxel fusion produces centroids and exports a valid ASCII PLY header',()=>{
  const points=voxelDownsample([[0,0,0],[0.02,0,0],[1,0,0]],0.1);assert.deepEqual(points,[[0.01,0,0],[1,0,0]]);
  assert.match(exportPly(points),/element vertex 2/);assert.throws(()=>validateCloud({units:'feet',points}),/metric/);assert.throws(()=>validateCloud({units:'meters',points:[[NaN,0,0]]}),/finite/);
});
