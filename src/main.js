import './style.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import {createViewer} from './viewer.js';
import {createDemo} from './demo.js';
import {validateCloud,reconstructDepth,registerLandmarks,transformPoint,voxelDownsample,exportPly} from './geometry.js';
import {createCapture,validateCapture} from './capture.js';

const $=s=>document.querySelector(s);
const icons={map:'◈',capture:'▣',merge:'⇄',sync:'⌁'};
$('#app').innerHTML=`
<aside class="sidebar"><a class="brand" href="${import.meta.env.BASE_URL}" aria-label="SpatialSync home"><span class="brand-icon">◈</span>SpatialSync<span class="version">LAB / 01</span></a>
<div class="workspace-label">WORKSPACE</div><nav aria-label="Workspace">
${[['map','Overview'],['capture','Capture & replay'],['merge','Align & merge'],['sync','Shared session']].map(([id,label])=>`<button class="nav-button ${id==='map'?'active':''}" data-page="${id}"><span>${icons[id]}</span>${label}${id==='map'?'<i>01</i>':''}</button>`).join('')}</nav>
<div class="side-project"><span class="eyebrow">CURRENT PROJECT</span><h3>Studio survey</h3><p>Indoor mapping workspace</p><div class="side-rule"></div><span class="dot"></span> Local processing</div>
<div class="sidebar-bottom"><span class="avatar">SS</span><div>Spatial research lab<small>Development prototype</small></div></div></aside>
<main><header><div class="breadcrumb">Workspace <span>/</span> <strong id="crumb">Overview</strong></div><div class="header-right"><span class="local"><span class="dot"></span>Local workspace</span><a href="https://github.com/vams2krish/CV-ML-SpatialSync" target="_blank" rel="noreferrer">GitHub ↗</a></div></header>
<div class="page-heading"><div><div class="eyebrow">COLLABORATIVE SPATIAL MAPPING</div><h1 id="page-title">A shared view of your space<span>.</span></h1><p id="page-subtitle">Explore two perspectives. Bring them into one coordinate frame.</p></div><button class="primary" id="demo">↻ Load demo scene</button></div>
<div class="notice"><span class="notice-symbol">i</span><span id="provenance">Synthetic studio fixture · Demo geometry, not a camera reconstruction.</span><span class="pill">RESEARCH PREVIEW</span></div>
<section id="map-page" class="page active"><div class="stats"><article><span>VISIBLE POINTS</span><strong id="point-count">—</strong><small>Metric XYZ geometry</small></article><article><span>INPUT SUBMAPS</span><strong id="map-count">02</strong><small>Independent coordinate frames</small></article><article><span>ALIGNMENT</span><strong id="alignment-status">Unaligned</strong><small id="residual">Paired landmarks available</small></article><article><span>MAP REVISION</span><strong id="revision">00</strong><small id="network-state">Local · not connected</small></article></div></section>
<div class="work-grid"><section class="scene-card"><div class="scene-toolbar"><div><span class="dot"></span><strong id="scene-title">Studio / point cloud</strong><span class="small-label">3D VIEW</span></div><div class="view-actions"><button id="orbit">Orbit</button><button id="top">Top</button><button id="fit" aria-label="Fit map to view">⤢ Fit</button></div></div><div id="viewport"><div class="scene-top"><span id="scene-badge">TWO LOCAL FRAMES</span><span>XYZ / METERS</span></div><div class="axis"><b>Y</b><span>└ X / Z</span></div><div class="scene-bottom"><span><i class="legend-dot a"></i>Participant A</span><span><i class="legend-dot b"></i>Participant B</span><span class="orbit-hint">Drag to orbit · Scroll to zoom</span></div></div><div class="scene-footer"><span id="scene-state">Ready for landmark alignment</span><label><input id="grid" type="checkbox" checked> Floor grid</label></div></section>
<aside class="inspector"><section class="panel" id="map-panel"><div class="panel-heading"><h2>Scene layers</h2><span>02</span></div><p class="muted">Inspect each participant’s local map.</p><label class="layer"><span class="layer-icon a">A</span><div>Participant A<small id="a-count">Reference frame</small></div><input id="show-a" type="checkbox" checked></label><label class="layer"><span class="layer-icon b">B</span><div>Participant B<small id="b-count">Unaligned local frame</small></div><input id="show-b" type="checkbox" checked></label><div class="divider"></div><div class="info-row"><span>Geometry</span><b>Point cloud</b></div><div class="info-row"><span>Scale</span><b>Metric</b></div><div class="info-row"><span>Source</span><b id="source-label">Synthetic fixture</b></div><button id="export" class="secondary full">↓ Export visible map · PLY</button></section>
<section class="panel page-panel" id="capture-panel" hidden><div class="panel-heading"><h2>Camera recording</h2><span>01</span></div><p class="muted">Sample RGB frames locally at 2 fps. No depth or camera poses are inferred.</p><video id="camera" playsinline muted></video><img id="replay-image" alt="Recorded RGB frame" hidden><div id="capture-empty">Camera preview appears here</div><details><summary>Calibration metadata (optional)</summary><label>Intrinsics JSON<textarea id="intrinsics" rows="3" placeholder='{"fx":500,"fy":500,"cx":320,"cy":240}'></textarea></label><small>Use values for the exported frame dimensions. Uncalibrated if blank; no automatic calibration.</small></details><div class="button-pair"><button id="start-capture" class="primary">Start camera</button><button id="stop-capture" class="secondary" disabled>Stop</button></div><p id="capture-status" class="muted" role="status">0 frames · 90 second limit</p><button id="save-capture" class="secondary full" disabled>↓ Save RGB recording</button><label class="file-button">Open RGB recording<input id="load-capture" type="file" accept=".json"></label><button id="play" class="secondary full" disabled>▶ Replay frames</button><input id="scrub" aria-label="Recording frame" type="range" min="0" max="0" value="0" disabled></section>
<section class="panel page-panel" id="merge-panel" hidden><div class="panel-heading"><h2>Align & merge</h2><span>02</span></div><p class="muted">Rigid alignment from at least 3 paired, non-collinear metric landmarks.</p><label class="file-button">↑ Import reference cloud A<input id="import-a" type="file" accept=".json"></label><label class="file-button">↑ Import source cloud B<input id="import-b" type="file" accept=".json"></label><div class="divider"></div><label class="field-label">Maximum landmark error (m)<input id="threshold" type="number" min="0.001" max="1" step="0.01" value="0.08"></label><button class="primary full" id="align">⇄ Align B to A</button><p id="alignment-detail" class="muted">Demo includes four exact landmark pairs. Real clouds must provide matching landmark arrays.</p><label class="file-button">↑ Reconstruct posed depth<input id="import-depth" type="file" accept=".json"></label><p class="fine">Requires measured depth + known poses. RGB-only SLAM and automatic correspondence search remain planned.</p></section>
<section class="panel page-panel" id="sync-panel" hidden><div class="panel-heading"><h2>Shared session</h2><span>03</span></div><p class="muted">Exchange versioned map snapshots with another local browser client.</p><label class="field-label">Coordinator URL<input id="sync-url" value="ws://127.0.0.1:8787"></label><label class="field-label">Session key<input id="room" autocomplete="off" placeholder="Create or paste a session key"></label><button id="new-room" class="secondary full">Generate session key</button><div class="button-pair"><button id="connect" class="primary">Connect</button><button id="disconnect" class="secondary" disabled>Leave</button></div><button id="publish" class="secondary full" disabled>↑ Publish visible map</button><p id="sync-detail" class="muted" role="status">Start the coordinator with npm run sync. Session maps stay in coordinator memory.</p><p class="fine">Local development transport. No accounts, persistence, automatic pose estimation, or production access controls.</p></section>
<section class="panel next-step"><span class="eyebrow">THE NEXT STEP</span><h3>Make two maps agree.</h3><p>Use the supplied landmark pairs to bring both scans into one spatial frame.</p><button id="go-merge">Open alignment workspace <span>→</span></button></section></aside></div>
<section class="bottom-grid"><article><span class="step-number">01 / CAPTURE</span><h3>Start with observations</h3><p>Record timestamped RGB frames. Import calibrated depth with known poses for reconstruction.</p></article><article><span class="step-number">02 / ALIGN</span><h3>Find a common frame</h3><p>Verify paired landmarks and measure residual error before combining metric submaps.</p></article><article><span class="step-number">03 / SHARE</span><h3>Keep the map in sync</h3><p>Publish a versioned snapshot. Reconnecting clients receive the current shared map.</p></article></section>
<footer>SpatialSync <span>Computer vision / SLAM research</span><span>Prototype v0.1 · Geometry first</span></footer></main><div id="toast" role="status" aria-live="polite"></div>`;

const viewer=createViewer($('#viewport'));
let demo=createDemo(),cloudA=demo.a,cloudB=demo.b,alignedB=null,merged=false,recording=null,replayTimer=null,socket=null,revision=0;
let provenance='Synthetic studio fixture · Demo geometry, not a camera reconstruction.';
const format=n=>n.toLocaleString('en-US');
function toast(message,error=false){const el=$('#toast');el.textContent=message;el.className=error?'error visible':'visible';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className='',6000);}
function guard(action){return async(...args)=>{try{await action(...args);}catch(error){toast(error.message,true);}};}
function currentPoints(){return [...($('#show-a').checked?cloudA.points:[]),...($('#show-b').checked?(alignedB||cloudB.points):[])];}
function render(){
  viewer.setClouds([{points:$('#show-a').checked?cloudA.points:[],color:'#b7df95'},{points:$('#show-b').checked?(alignedB||cloudB.points):[],color:'#71b9e8'}]);
  $('#point-count').textContent=format(currentPoints().length);$('#map-count').textContent=String((cloudA.points.length?1:0)+(cloudB.points.length?1:0)).padStart(2,'0');
  $('#a-count').textContent=`${format(cloudA.points.length)} points · reference`;$('#b-count').textContent=`${format(cloudB.points.length)} points · ${merged?'aligned':'local'}`;
  $('#alignment-status').textContent=merged?'Aligned':'Unaligned';$('#scene-badge').textContent=merged?'SHARED COORDINATE FRAME':'LOCAL COORDINATE FRAMES';
  $('#scene-state').textContent=merged?'Landmark alignment accepted':'Ready for landmark alignment';$('#provenance').textContent=provenance;
  $('#source-label').textContent=[cloudA,cloudB].some(c=>c.source==='synthetic')?'Contains synthetic data':'Imported data';
}
function page(id){
  const titles={map:['A shared view of your space.','Explore two perspectives. Bring them into one coordinate frame.'],capture:['Every map starts with a view.','Record RGB observations and replay them on your device.'],merge:['Two maps. One reference frame.','Align metric submaps with explicit, verifiable landmark pairs.'],sync:['A common space, kept in sync.','Share a versioned map snapshot with a second browser client.']};
  document.querySelectorAll('.nav-button').forEach(el=>el.classList.toggle('active',el.dataset.page===id));
  $('#crumb').textContent=$(`[data-page="${id}"]`).textContent.replace('01','').trim();
  $('#page-title').textContent=titles[id][0];$('#page-subtitle').textContent=titles[id][1];
  for(const name of ['map','capture','merge','sync'])$(`#${name}-panel`).hidden=name!==id;
  $('#map-page').classList.toggle('active',id==='map');
}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page));
$('#go-merge').onclick=()=>page('merge');
$('#demo').onclick=()=>{demo=createDemo();cloudA=demo.a;cloudB=demo.b;alignedB=null;merged=false;provenance='Synthetic studio fixture · Demo geometry, not a camera reconstruction.';$('#residual').textContent='Paired landmarks available';$('#alignment-detail').textContent='Demo includes four exact landmark pairs.';render();viewer.reset();toast('Synthetic studio fixture loaded.');};
$('#show-a').onchange=render;$('#show-b').onchange=render;
$('#grid').onchange=e=>viewer.setGrid(e.target.checked);$('#orbit').onclick=viewer.reset;$('#top').onclick=viewer.top;$('#fit').onclick=viewer.fit;
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export').onclick=guard(()=>download('spatialsync-map.ply',exportPly(voxelDownsample(currentPoints())),'text/plain'));
async function readJson(file){if(!file)throw Error('Choose a JSON file.');if(file.size>30*1024*1024)throw Error('File exceeds the 30 MB import limit.');return JSON.parse(await file.text());}
for(const id of ['a','b'])$(`#import-${id}`).onchange=guard(async e=>{
  const data=validateCloud(await readJson(e.target.files[0]));
  const cloud={...data,source:data.source==='synthetic'?'synthetic':'imported'};if(id==='a')cloudA=cloud;else cloudB=cloud;
  alignedB=null;merged=false;provenance='Imported metric cloud · Coordinates and provenance supplied by the file author.';render();viewer.fit();toast(`Cloud ${id.toUpperCase()} imported.`);e.target.value='';
});
$('#align').onclick=guard(()=>{
  const fit=registerLandmarks(cloudB.landmarks,cloudA.landmarks,Number($('#threshold').value));
  alignedB=cloudB.points.map(p=>transformPoint(p,fit.transform));merged=true;
  $('#residual').textContent=`${fit.rmse.toFixed(4)} m landmark RMSE`;
  $('#alignment-detail').textContent=`Accepted · ${fit.correspondences} pairs · RMSE ${fit.rmse.toFixed(6)} m. This measures supplied landmarks, not whole-scene accuracy.`;
  render();viewer.fit();toast('Alignment accepted. Both submaps now share A’s frame.');
});
$('#import-depth').onchange=guard(async e=>{
  cloudA=reconstructDepth(await readJson(e.target.files[0]));cloudB={units:'meters',points:[],source:'empty'};alignedB=null;merged=false;
  provenance=`Posed-depth reconstruction · ${cloudA.source==='synthetic'?'Synthetic depth fixture':'Depth and camera poses supplied by the imported file'}.`;render();viewer.fit();toast('Depth unprojected and voxel-filtered. No SLAM poses were estimated.');e.target.value='';
});

function pauseReplay(){clearTimeout(replayTimer);replayTimer=null;$('#play').textContent='▶ Replay frames';}
function showFrame(index){if(!recording)return;const f=recording.frames[index];$('#replay-image').src=f.image;$('#replay-image').hidden=false;$('#camera').hidden=true;$('#capture-empty').hidden=true;$('#scrub').value=index;$('#capture-status').textContent=`Frame ${index+1} / ${recording.frames.length} · ${(f.timestampMs/1000).toFixed(2)} s`;}
function setRecording(data){recording=validateCapture(data);$('#scrub').max=data.frames.length-1;$('#scrub').disabled=false;$('#play').disabled=false;$('#save-capture').disabled=false;showFrame(0);}
const capture=createCapture($('#camera'),count=>{$('#capture-status').textContent=`Recording · ${count} frames · ${(count/2).toFixed(1)} s`;},data=>{
  $('#start-capture').disabled=false;$('#stop-capture').disabled=true;
  if(data.frames.length)setRecording(data);
});
$('#start-capture').onclick=guard(async()=>{
  pauseReplay();let intrinsics=null;
  if($('#intrinsics').value.trim()){
    intrinsics=JSON.parse($('#intrinsics').value);
    if(!['fx','fy','cx','cy'].every(k=>Number.isFinite(intrinsics[k]))||intrinsics.fx<=0||intrinsics.fy<=0)throw Error('Calibration needs finite fx, fy, cx, cy and positive focal lengths.');
  }
  $('#start-capture').disabled=true;$('#play').disabled=true;$('#scrub').disabled=true;$('#save-capture').disabled=true;
  $('#capture-status').textContent='Starting camera · awaiting permission and video frames…';
  $('#camera').hidden=false;$('#replay-image').hidden=true;$('#capture-empty').hidden=true;
  try{await capture.start(intrinsics);$('#stop-capture').disabled=false;}
  catch(error){$('#start-capture').disabled=false;$('#capture-status').textContent='Camera unavailable. Check browser permission or load a recording.';if(recording)setRecording(recording);throw error;}
});
$('#stop-capture').onclick=()=>capture.stop();
$('#save-capture').onclick=()=>download('spatialsync-rgb-capture.json',JSON.stringify(recording),'application/json');
$('#load-capture').onchange=guard(async e=>{if(capture.active)throw Error('Stop capture before loading a recording.');pauseReplay();setRecording(await readJson(e.target.files[0]));e.target.value='';});
$('#scrub').oninput=e=>{pauseReplay();showFrame(Number(e.target.value));};
$('#play').onclick=()=>{
  if(replayTimer){pauseReplay();return;}
  let index=Number($('#scrub').value);if(index>=recording.frames.length-1)index=0;
  $('#play').textContent='Ⅱ Pause replay';
  function tick(){showFrame(index);if(index===recording.frames.length-1){pauseReplay();return;}const delay=recording.frames[index+1].timestampMs-recording.frames[index].timestampMs;index++;replayTimer=setTimeout(tick,Math.max(1,delay));}tick();
};
window.addEventListener('pagehide',()=>{capture.stop();socket?.close();pauseReplay();});

$('#new-room').onclick=()=>{$('#room').value=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');};
$('#connect').onclick=guard(()=>{
  const room=$('#room').value.trim();if(!/^[a-f0-9]{32}$/.test(room))throw Error('Generate or paste a 32-character session key.');
  const url=new URL($('#sync-url').value);if(!['ws:','wss:'].includes(url.protocol))throw Error('Use a ws:// or wss:// coordinator URL.');url.searchParams.set('room',room);
  socket=new WebSocket(url);$('#connect').disabled=true;
  socket.onopen=()=>{$('#disconnect').disabled=false;$('#network-state').textContent='Connected · awaiting snapshot';};
  socket.onmessage=guard(event=>{
    const message=JSON.parse(event.data);
    if(message.type==='error'){toast(message.message,true);return;}
    if(message.type==='snapshot'){
      revision=message.revision;$('#revision').textContent=String(revision).padStart(2,'0');$('#publish').disabled=false;
      $('#network-state').textContent='Connected · snapshot synchronized';$('#sync-detail').textContent=`Connected · revision ${revision}. Publish replaces the session map for all peers. Copy the session key to another local client.`;
      if(message.cloud){cloudA=validateCloud(message.cloud);cloudB={units:'meters',points:[],source:'empty'};alignedB=null;merged=false;provenance=`Shared snapshot · Revision ${revision} · ${message.cloud.source==='synthetic'?'Contains synthetic fixture geometry':'Peer-supplied geometry'}`;render();viewer.fit();}
    }
  });
  socket.onerror=()=>toast('Cannot reach coordinator. Start npm run sync and check the URL.',true);
  socket.onclose=()=>{$('#connect').disabled=false;$('#disconnect').disabled=true;$('#publish').disabled=true;$('#network-state').textContent='Disconnected · local snapshot retained';$('#sync-detail').textContent='Disconnected. Reconnect to receive the latest snapshot.';};
});
$('#disconnect').onclick=()=>socket?.close();
$('#publish').onclick=guard(()=>{
  if(socket?.readyState!==WebSocket.OPEN)throw Error('Connect to the coordinator first.');
  if($('#show-a').checked&&$('#show-b').checked&&cloudA.points.length&&cloudB.points.length&&!merged)throw Error('Align both maps before publishing, or hide one layer to publish a single frame.');
  const points=voxelDownsample(currentPoints());validateCloud({units:'meters',points});
  socket.send(JSON.stringify({type:'publish',baseRevision:revision,cloud:{units:'meters',points,source:[cloudA,cloudB].some(c=>c.source==='synthetic')?'synthetic':'imported'}}));
});
render();
