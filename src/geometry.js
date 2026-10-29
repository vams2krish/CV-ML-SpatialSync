import { Matrix, SingularValueDecomposition, determinant } from 'ml-matrix';

export const IDENTITY = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
export function transformPoint(p, t) {
  return [0,1,2].map(r => t[r*4]*p[0]+t[r*4+1]*p[1]+t[r*4+2]*p[2]+t[r*4+3]);
}
export function validateTransform(t) {
  if (!Array.isArray(t) || t.length!==16 || !t.every(Number.isFinite)) throw Error('Pose must be a finite row-major 4×4 matrix.');
  if (t.slice(12).some((x,i)=>Math.abs(x-[0,0,0,1][i])>1e-6)) throw Error('Invalid homogeneous pose.');
  const r = new Matrix([t.slice(0,3),t.slice(4,7),t.slice(8,11)]);
  const e = r.transpose().mmul(r).sub(Matrix.eye(3));
  if (e.to1DArray().some(x=>Math.abs(x)>1e-3) || Math.abs(determinant(r)-1)>1e-3) throw Error('Pose rotation must be orthonormal with determinant +1.');
}
export function validateCloud(cloud) {
  if (!cloud || !Array.isArray(cloud.points) || !cloud.points.length || cloud.points.length>100000) throw Error('Cloud must contain 1–100,000 points.');
  if (cloud.units !== 'meters') throw Error('Only metric clouds (units: meters) are supported.');
  for (const p of cloud.points) if (!Array.isArray(p) || p.length!==3 || !p.every(Number.isFinite) || p.some(v=>Math.abs(v)>10000)) throw Error('Points must be finite XYZ coordinates within 10 km.');
  return cloud;
}
export function voxelDownsample(points, size=0.04) {
  if (!Number.isFinite(size)||size<=0) throw Error('Voxel size must be positive.');
  const voxels=new Map();
  for(const p of points){const key=p.map(v=>Math.floor(v/size)).join(','); const a=voxels.get(key)||[0,0,0,0]; p.forEach((v,i)=>a[i]+=v); a[3]++; voxels.set(key,a);}
  return [...voxels.values()].map(a=>a.slice(0,3).map(v=>v/a[3]));
}
// Unproject measured depth with externally supplied camera-to-world poses.
// Camera convention: +X right, +Y down, +Z forward. This is NOT pose estimation.
export function reconstructDepth(recording) {
  if (recording?.schemaVersion!==1 || recording.units!=='meters' || !Array.isArray(recording.frames) || !recording.frames.length || recording.frames.length>100) throw Error('Expected a v1 metric posed-depth recording with 1–100 frames.');
  const {width,height,fx,fy,cx,cy}=recording.intrinsics||{};
  if (![width,height].every(v=>Number.isInteger(v)&&v>0) || width*height>100000 || ![fx,fy,cx,cy].every(Number.isFinite) || fx<=0 || fy<=0) throw Error('Invalid camera intrinsics.');
  const points=[]; let previous=-Infinity;
  for(const frame of recording.frames){
    if(!Number.isFinite(frame.timestampMs)||frame.timestampMs<previous) throw Error('Frame timestamps must be finite and monotonic.');
    previous=frame.timestampMs; validateTransform(frame.cameraToWorld);
    if(!Array.isArray(frame.depth)||frame.depth.length!==width*height) throw Error('Depth dimensions do not match intrinsics.');
    for(let i=0;i<frame.depth.length;i++){
      const z=frame.depth[i]; if(z===null||z===0) continue;
      if(!Number.isFinite(z)||z<0||z>50) throw Error('Depth must be null, zero, or a positive distance up to 50 m.');
      const p=transformPoint([((i%width)-cx)*z/fx,(Math.floor(i/width)-cy)*z/fy,z],frame.cameraToWorld);
      points.push(p);
      if(points.length>1000000) throw Error('Recording exceeds the one-million unprojected point limit.');
    }
  }
  const result={units:'meters',points:voxelDownsample(points),source:recording.source==='synthetic'?'synthetic':'posed-depth'};
  validateCloud(result); return result;
}

// Kabsch rigid registration from explicit corresponding metric landmarks.
// Refuse collinear landmarks and high-residual fits; no automatic matching claim.
export function registerLandmarks(source,target,maxRmse=0.08) {
  if(!Array.isArray(source)||!Array.isArray(target)||source.length!==target.length||source.length<3||source.length>1000) throw Error('Supply 3–1,000 paired landmarks.');
  validateCloud({units:'meters',points:source}); validateCloud({units:'meters',points:target});
  const centroid=p=>[0,1,2].map(i=>p.reduce((s,v)=>s+v[i],0)/p.length);
  const a=centroid(source), b=centroid(target);
  const x=new Matrix(source.map(p=>p.map((v,i)=>v-a[i]))), y=new Matrix(target.map(p=>p.map((v,i)=>v-b[i])));
  const {leftSingularVectors:u,rightSingularVectors:v,diagonal:s}=new SingularValueDecomposition(x.transpose().mmul(y));
  if(s[1]<1e-8 || s[1]/s[0]<1e-6) throw Error('Landmarks are collinear or degenerate.');
  const correction=Matrix.eye(3); correction.set(2,2,determinant(v.mmul(u.transpose()))<0?-1:1);
  const r=v.mmul(correction).mmul(u.transpose());
  const t=b.map((value,i)=>value-r.getRow(i).reduce((sum,w,j)=>sum+w*a[j],0));
  const transform=[...r.getRow(0),t[0],...r.getRow(1),t[1],...r.getRow(2),t[2],0,0,0,1];
  const rmse=Math.sqrt(source.reduce((sum,p,i)=>sum+transformPoint(p,transform).reduce((s,v,j)=>s+(v-target[i][j])**2,0),0)/source.length);
  if(!Number.isFinite(maxRmse)||maxRmse<=0||rmse>maxRmse) throw Error(`Alignment rejected: landmark RMSE ${rmse.toFixed(3)} m exceeds threshold.`);
  return {transform,rmse,correspondences:source.length};
}
export function exportPly(points) {
  validateCloud({units:'meters',points});
  return `ply\nformat ascii 1.0\ncomment SpatialSync metric point cloud\nelement vertex ${points.length}\nproperty float x\nproperty float y\nproperty float z\nend_header\n${points.map(p=>p.join(' ')).join('\n')}\n`;
}
