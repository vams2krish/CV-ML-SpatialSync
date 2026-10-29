import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {validateCloud} from '../src/geometry.js';

// Development coordinator: bounded in-memory snapshots, optimistic revisions.
export function createCoordinator({port=8787,host='127.0.0.1'}={}){
  const rooms=new Map();
  const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({service:'SpatialSync local coordinator',rooms:rooms.size}));});
  const wss=new WebSocketServer({noServer:true,maxPayload:8*1024*1024});
  server.on('upgrade',(req,socket,head)=>{
    let room;
    try{room=new URL(req.url,'http://localhost').searchParams.get('room');}catch{socket.destroy();return;}
    // Reject browser connections from arbitrary websites to the loopback server.
    if(req.headers.origin&&!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin)){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
    if(!/^[a-f0-9]{32}$/.test(room||'')||(!rooms.has(room)&&rooms.size>=32)){socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,client=>wss.emit('connection',client,room));
  });
  const snapshot=room=>JSON.stringify({type:'snapshot',revision:room.revision,cloud:room.cloud});
  wss.on('connection',(client,key)=>{
    let room=rooms.get(key);if(!room){room={revision:0,cloud:null,clients:new Set(),timer:null};rooms.set(key,room);}
    clearTimeout(room.timer);
    if(room.clients.size>=8){client.close(1013,'Session full');return;}
    room.clients.add(client);client.send(snapshot(room));let lastPublish=0;
    client.on('message',bytes=>{
      try{
        const message=JSON.parse(bytes.toString());if(message.type!=='publish')throw Error('Unknown message type.');
        if(Date.now()-lastPublish<500)throw Error('Please wait between publishes.');lastPublish=Date.now();
        if(message.baseRevision!==room.revision){client.send(snapshot(room));throw Error('Revision conflict: current shared map restored. Re-import or align your local map before publishing again.');}
        const cloud=validateCloud(message.cloud);
        room.cloud={units:'meters',points:cloud.points,source:cloud.source==='synthetic'?'synthetic':'imported'};room.revision++;
        const state=snapshot(room);for(const peer of room.clients)if(peer.readyState===WebSocket.OPEN)peer.send(state);
      }catch(error){client.send(JSON.stringify({type:'error',message:error.message}));}
    });
    client.on('error',()=>{});
    client.on('close',()=>{room.clients.delete(client);if(!room.clients.size)room.timer=setTimeout(()=>rooms.delete(key),10*60*1000).unref();});
  });
  server.listen(port,host);
  return {server,wss,rooms,async close(){for(const r of rooms.values())clearTimeout(r.timer);for(const c of wss.clients)c.terminate();await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const port=Number(process.env.SYNC_PORT||8787);const app=createCoordinator({port});
  app.server.on('listening',()=>console.log(`SpatialSync development coordinator: ws://127.0.0.1:${port}`));
}
