export function validateCapture(data){
  if(data?.schemaVersion!==1||data.kind!=='rgb-capture'||!Array.isArray(data.frames)||data.frames.length<1||data.frames.length>180)throw Error('Expected an RGB capture with 1–180 frames.');
  let previous=-1;
  for(const f of data.frames){
    if(!Number.isFinite(f.timestampMs)||f.timestampMs<previous||typeof f.image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(f.image)||f.image.length>500000)throw Error('Invalid timestamp or JPEG frame.');
    previous=f.timestampMs;
  }
  return data;
}

export function createCapture(video,onFrame,onStop){
  let stream=null,timer=null,frames=[],started=0,metadata=null;
  const canvas=document.createElement('canvas');
  function stop(){
    if(timer){clearInterval(timer);timer=null;}
    stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;
    if(metadata){const result={...metadata,frames};metadata=null;onStop(result);}
  }
  async function start(intrinsics){
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access requires HTTPS or localhost and a supported browser.');
    if(stream)throw Error('A recording is already active.');
    let expired=false,timeout;
    const request=navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480}},audio:false});
    request.then(result=>{if(expired)result.getTracks().forEach(t=>t.stop());},()=>{});
    try{stream=await Promise.race([request,new Promise((_,reject)=>{timeout=setTimeout(()=>{expired=true;reject(Error('Camera permission timed out. Allow camera access and try again.'));},20000);})]);}finally{clearTimeout(timeout);}
    try{
      video.srcObject=stream;
      await Promise.race([video.play(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Camera did not deliver video. Try another device or browser.')),15000);})]);
    }catch(error){stop();throw error;}finally{clearTimeout(timeout);}
    const scale=Math.min(1,640/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    frames=[];started=performance.now();
    metadata={schemaVersion:1,kind:'rgb-capture',createdAt:new Date().toISOString(),width:canvas.width,height:canvas.height,clock:'performance.now relative to capture start; browser sampling time, not sensor exposure',sampleIntervalMs:500,intrinsics,depth:null,imu:null,poses:null};
    const context=canvas.getContext('2d');
    const sample=()=>{
      context.drawImage(video,0,0,canvas.width,canvas.height);
      frames.push({timestampMs:Math.round((performance.now()-started)*1000)/1000,image:canvas.toDataURL('image/jpeg',0.65)});
      onFrame(frames.length,frames.at(-1));if(frames.length>=180)stop();
    };
    sample();timer=setInterval(sample,500);
  }
  return {start,stop,get active(){return !!stream;}};
}
