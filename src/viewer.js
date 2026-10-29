import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createViewer(container){
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#141d25');
  scene.fog=new THREE.Fog('#141d25',20,50);
  const camera=new THREE.PerspectiveCamera(43,1,0.01,100);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2)); container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive 3D point cloud. Drag to orbit, scroll to zoom.');
  const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true;
  const grid=new THREE.GridHelper(20,40,'#3c5057','#24333d'); grid.position.y=-0.015;scene.add(grid);
  let objects=[];
  function reset(){camera.position.set(8,6.5,9);controls.target.set(0,0.8,0);controls.update();}
  reset();
  function clear(){for(const o of objects){scene.remove(o);o.geometry.dispose();o.material.dispose();}objects=[];}
  function setClouds(clouds){
    clear();
    for(const {points,color} of clouds){
      if(!points.length)continue;
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
      const material=new THREE.PointsMaterial({color,size:0.032,sizeAttenuation:true,transparent:true,opacity:0.9});
      const object=new THREE.Points(geometry,material);objects.push(object);scene.add(object);
    }
  }
  function fit(){
    if(!objects.length)return;
    const bounds=new THREE.Box3(); for(const object of objects)bounds.expandByObject(object);
    const center=bounds.getCenter(new THREE.Vector3()), size=bounds.getSize(new THREE.Vector3()).length();
    controls.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(1,0.8,1.2).normalize().multiplyScalar(Math.max(size,1)*1.25));controls.update();
  }
  new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/Math.max(height,1);camera.updateProjectionMatrix();}).observe(container);
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
  return {setClouds,reset,fit,top(){camera.position.set(0,13,0.001);controls.target.set(0,0,0);controls.update();},setGrid(value){grid.visible=value;}};
}
