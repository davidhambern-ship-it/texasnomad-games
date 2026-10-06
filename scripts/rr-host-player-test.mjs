import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { createRodeoRumbleLive } from '../server/rodeoRumbleLive.mjs';
const recorded = [];
const relay = createRodeoRumbleLive({ verifyHostAuthorization: async () => ({ accountId: 'host-account', publicName: '@mulatto' }), resolvePlayerIdentity: async ({token}) => ({accountId:token,publicName:token}), recordResults: async r => recorded.push(r) });
const server = createServer((req,res) => relay.handleHttp(req,res));
server.on('upgrade',(req,sock,head) => relay.handleUpgrade(req,sock,head));
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const sockets=[];
async function connect(hello) {
  const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/rr-live`); const messages=[];
  sockets.push(ws); ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));
  await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  ws.send(JSON.stringify(hello));
  return { send:m=>ws.send(JSON.stringify(m)), wait:async t=>{
    const end=Date.now()+3000;
    while(Date.now()<end){const i=messages.findIndex(m=>m.t===t);if(i>=0)return messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,10));}
    throw new Error('Missing '+t);
  }};
}
try {
  const host=await connect({t:'host'}); const room=await host.wait('room');
  assert.equal(room.players.length,1); assert.equal(room.players[0].isHost,true); assert.equal(room.players[0].name,'@mulatto'); assert.equal(room.players[0].online,true);
  host.send({t:'host-pick',fighter:'danni'}); const pick=await host.wait('pick'); assert.equal(pick.id,room.hostPlayerId); assert.equal(pick.fighter,'danni'); await host.wait('ready');
  const one=await connect({t:'join',code:room.code,authToken:'@txnomad'}); const p1=await one.wait('joined');
  const two=await connect({t:'join',code:room.code,authToken:'@burnd'}); const p2=await two.wait('joined');
  assert.equal(relay.stats().players,3);
  const duplicate=await connect({t:'join',code:room.code,authToken:'host-account'}); assert.equal((await duplicate.wait('error')).code,'HOST_PLAYER_LOCAL');
  const frame={game:{fighters:[{id:room.hostPlayerId},{id:p1.id},{id:p2.id}]}};
  host.send({t:'frame',frame}); assert.deepEqual((await one.wait('frame')).frame,frame); assert.deepEqual((await two.wait('frame')).frame,frame);
  host.send({t:'lobby',lobby:{phase:'fight'}});
  host.send({t:'result',result:{winner:room.hostPlayerId,ranked:[{id:room.hostPlayerId,kos:2,dealt:100}]}});
  await one.wait('result'); await new Promise(r=>setTimeout(r,20));
  assert.equal(recorded[0].results[0].accountId,'host-account'); assert.equal(recorded[0].results[0].won,true);
  for(let i=0;i<5;i++){const p=await connect({t:'join',code:room.code,authToken:'guest'+i});await p.wait('joined');}
  const extra=await connect({t:'join',code:room.code,authToken:'ninth'});assert.equal((await extra.wait('error')).code,'FULL');
  console.log('PASS: @mulatto host seat, host character selection, two guests, shared 3-fighter frames, host result attribution, duplicate protection, 8-human limit.');
} finally { sockets.forEach(ws=>ws.close());server.close(); }
