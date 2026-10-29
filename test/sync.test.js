import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createCoordinator} from '../server/sync.js';

const next=socket=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Message timeout')),3000);socket.once('message',data=>{clearTimeout(timeout);resolve(JSON.parse(data));});});
test('two clients converge, reconnect recovers snapshot, rooms isolate and stale writes fail',async()=>{
  const app=createCoordinator({port:0});await once(app.server,'listening');const port=app.server.address().port;
  const connect=async(room)=>{const s=new WebSocket(`ws://127.0.0.1:${port}/?room=${room}`);const initial=next(s);await once(s,'open');return [s,await initial];};
  try{
    const key='a'.repeat(32);const [a,first]=await connect(key);const [b]=await connect(key);assert.equal(first.revision,0);
    const receivedA=next(a),receivedB=next(b);a.send(JSON.stringify({type:'publish',baseRevision:0,cloud:{units:'meters',points:[[1,2,3]],source:'synthetic'}}));
    assert.deepEqual(await receivedA,await receivedB);
    const [c,state]=await connect(key);assert.equal(state.revision,1);assert.deepEqual(state.cloud.points,[[1,2,3]]);
    const [other,isolated]=await connect('b'.repeat(32));assert.equal(isolated.cloud,null);
    const restored=next(c);c.send(JSON.stringify({type:'publish',baseRevision:0,cloud:{units:'meters',points:[[9,9,9]]}}));assert.equal((await restored).revision,1);
    const [reconnect,recovered]=await connect(key);assert.equal(recovered.revision,1);assert.deepEqual(recovered.cloud.points,[[1,2,3]]);
    for(const socket of [a,b,c,other,reconnect])socket.close();
  }finally{await app.close();}
});
