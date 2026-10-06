import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createNomadicBowlingApi } from '../server/nomadicBowlingApi.mjs';
const snapshots=new Map(),claims=new Map(),records=[];
const store={load:async c=>structuredClone(snapshots.get(c)||null),save:async(c,r)=>snapshots.set(c,JSON.parse(JSON.stringify(r))),exists:async c=>snapshots.has(c),count:async()=>snapshots.size,cleanup:async()=>{}};
const make=()=>createNomadicBowlingApi({store,resolveIdentity:async req=>{const account=req.headers.authorization?.replace('Bearer ','');return account?{accountId:account,publicName:'@'+account}:null;},claimRoomCode:async r=>{claims.set(r.code,r);return true;},recordResults:async r=>records.push(r)});
let api=make(),checks=0;
const server=createServer((req,res)=>api(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port+'/nb-api';
async function request(path,{account,token,action,body,status=200}={}){const data=action?{action,...body}:body;const response=await fetch(origin+path,{method:data?'POST':'GET',headers:{...(account?{Authorization:'Bearer '+account}:{}),...(token?{'X-NB-Token':token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));checks++;return json;}
try{
  await request('/rooms',{body:{},status:401});
  const host=await request('/rooms',{account:'host',body:{mode:'brawl',teams:true,stage:'midnight-saloon'}}),code=host.roomCode,path='/rooms/'+code,h={account:'host',token:host.token};
  assert.match(code,/^[A-Z]{5}$/);assert.equal(host.you.isHost,true);assert.equal(host.room.roster[0].name,'@host');assert.equal(claims.get(code).gameId,'nomadic-bowling');
  const one=await request(path+'/action',{account:'one',action:'join'}),two=await request(path+'/action',{account:'two',action:'join'});
  await request(path+'/action',{...h,action:'start',status:409});
  await request(path+'/action',{...h,action:'settings',body:{teams:false}});
  await request(path+'/action',{account:'one',token:one.token,action:'start',status:403});
  await request(path,{account:'two',token:one.token,status:403});
  await request(path+'/action',{account:'two',token:one.token,action:'join',status:403});
  await request(path,{token:host.token,status:401});
  await request(path+'/action',{...h,action:'kick',body:{playerId:host.you.id},status:403});
  const started=await request(path+'/action',{...h,action:'start'});assert.equal(started.room.game.turn,host.you.id);assert.equal(started.room.game.attacker,one.playerId);
  const badTurn=await request(path+'/action',{account:'one',token:one.token,action:'bowl',body:{start:0,aim:0,spin:0,power:.85}});assert.equal(badTurn.result.ok,false);
  const roll=await request(path+'/action',{...h,action:'bowl',body:{start:0,aim:0,spin:0,power:.85}});assert.equal(roll.result.ok,true);assert.equal(roll.room.game.phase,'rolling');
  await request(path+'/action',{...h,action:'start',status:409});await request(path+'/action',{account:'late',action:'join',status:409});
  const wrongSabotage=await request(path+'/action',{account:'two',token:two.token,action:'sabotage',body:{x:0}});assert.equal(wrongSabotage.result.ok,false);
  const thrown=await request(path);assert(!thrown.you);assert(thrown.room.roster.every(p=>!p.token&&!p.accountId));assert(!JSON.stringify(thrown).includes(host.token));
  api=make();const restored=await request(path,h);assert.equal(restored.room.game.delivery.launchedAt,roll.room.game.delivery.launchedAt);assert.equal(restored.you.isHost,true);
  await request(path+'/action',{...h,action:'lobby'});
  for(let i=0;i<5;i++)await request(path+'/action',{...h,action:'addCpu'});
  await request(path+'/action',{...h,action:'addCpu',status:409});
  const extra=await request(path+'/action',{account:'extra',action:'join'});assert.equal(extra.room.roster.length,8);
  const reconnect=await request(path+'/action',{account:'one',action:'join'});assert.equal(reconnect.playerId,one.playerId);assert.notEqual(reconnect.token,one.token);
  await request(path,{account:'one',token:one.token,status:403});
  const snapshot=snapshots.get(code);snapshot.players=snapshot.players.filter(p=>p.accountId);snapshot.settings.teams=true;assert.equal(snapshot.players.length,4);snapshots.set(code,snapshot);api=make();
  const team=await request(path+'/action',{...h,action:'start'});assert.equal(team.room.game.settings.teams,true);assert.equal(team.room.game.players.filter(p=>p.team===0).length,2);
  const final=snapshots.get(code);final.game.phase='final';final.game.players.forEach((p,i)=>{p.frames=Array.from({length:10},()=>[3,4]);if(i===0)p.frames=[...Array.from({length:9},()=>[10]),[10,10,10]];});final.game.winnerIds=[host.you.id];snapshots.set(code,final);api=make();await request(path,h);assert.equal(records.length,1);assert.equal(records[0].results.find(r=>r.accountId==='host').score,300);await request(path,h);assert.equal(records.length,1);
  console.log(JSON.stringify({checks,hostPlayable:true,maxSeats:8,teams:true,auth:'passed',recovery:'passed',resultAttribution:'passed'}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
