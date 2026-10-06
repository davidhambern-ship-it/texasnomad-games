import { randomBytes } from 'node:crypto';
import * as G from '../src/lib/nomadicBowling/engine.js';
const TTL = 3 * 60 * 60 * 1000, ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const COLORS = ['#32e6ff','#ffbb5c','#f373ff','#74ffb5','#a98aff','#f78a98','#c0e85a','#e8e1cf'];
const CPU_NAMES = ['Chrome Cassidy','Neon Nell','Rusty Circuit','Copper Colt','Pixel Pearl','Dusty Voltage','Tin Star'];
const token = () => randomBytes(18).toString('base64url'), id = () => randomBytes(6).toString('base64url');
function error(status, code, message){const e=new Error(message);e.status=status;e.code=code;throw e;}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8000)error(413,'TOO_LARGE','Request too large.');}try{return raw?JSON.parse(raw):{};}catch{error(400,'BAD_JSON','Invalid request.');}}
function cleanSettings(value={},old=G.DEFAULTS){return {mode:['classic','brawl'].includes(value.mode)?value.mode:old.mode,teams:typeof value.teams==='boolean'?value.teams:old.teams,stage:G.STAGES.some(s=>s.id===value.stage)?value.stage:old.stage};}
export function createNomadicBowlingApi({store=null,resolveIdentity=async()=>null,recordResults=async()=>{},claimRoomCode=async()=>true,touchRoomCode=async()=>{},releaseRoomCode=async()=>{}}={}){
  const rooms=new Map(),queues=new Map(),recorded=new Set(),checkpoints=new Map();
  const count=()=>store?store.count():rooms.size;
  async function load(code){let r=rooms.get(code);if(!r&&store){r=await store.load(code);if(r)rooms.set(code,r);}if(r&&Date.now()-r.updatedAt>TTL){rooms.delete(code);return null;}return r;}
  async function save(r,force=false){rooms.set(r.code,r);if(r.game?.phase==='final'&&!recorded.has(r.sessionKey)){try{await recordResults({gameId:'nomadic-bowling',sessionKey:r.sessionKey,roomCode:r.code,results:r.players.filter(p=>p.accountId&&r.game.players.some(q=>q.id===p.id)).map(p=>({accountId:p.accountId,score:G.scoreFrames(r.game.players.find(q=>q.id===p.id).frames).total,won:r.game.winnerIds.includes(p.id)}))});recorded.add(r.sessionKey);}catch(e){console.warn('[bowling] score recording deferred',e.message);}}
    if(store&&(force||Date.now()-(checkpoints.get(r.code)||0)>3000)){await store.save(r.code,r);checkpoints.set(r.code,Date.now());await touchRoomCode(r.code,{ttlMs:TTL});}}
  function view(r,me){return {room:{code:r.code,now:Date.now(),settings:r.settings,roster:r.players.map(p=>({id:p.id,name:p.name,color:p.color,cpu:Boolean(p.cpu),isHost:p.isHost||false})),game:r.game?G.view(r.game):null},you:me?{id:me.id,name:me.name,isHost:Boolean(me.isHost)}:null};}
  async function identity(req){const who=await resolveIdentity(req);if(!who?.accountId||!who.publicName)error(401,'AUTH_REQUIRED','Sign in to TNG with your player profile first.');return who;}
  async function handle(req,res){try{
    const path=new URL(req.url||'/','http://localhost').pathname.replace(/^\/nb-api/,'')||'/',seatToken=String(req.headers['x-nb-token']||'');
    if(req.method==='GET'&&path==='/health')return send(res,200,{ok:true,service:'nomadic-bowling',persistent:Boolean(store),rooms:await count()});
    if(req.method==='POST'&&path==='/rooms'){
      const who=await identity(req),b=await body(req);if(await count()>=1000)error(503,'BUSY','The lanes are full. Try again shortly.');
      let code='';for(let i=0;i<50;i++){const c=Array.from(randomBytes(5),x=>ALPHABET[x%ALPHABET.length]).join('');if(rooms.has(c)||await store?.exists(c))continue;if(await claimRoomCode({code:c,gameId:'nomadic-bowling',service:'nomadic-bowling',kind:'standalone',joinPath:'/games/nomadic-bowling?room='+c,spectatePath:'/games/nomadic-bowling?display='+c,hostAccountId:who.accountId,ttlMs:TTL})){code=c;break;}}
      if(!code)error(503,'NO_CODE','Could not reserve a lane code.');
      const host={id:id(),name:String(who.publicName).slice(0,32),accountId:who.accountId,isHost:true,token:token(),color:COLORS[0]};
      const r={code,hostAccountId:who.accountId,players:[host],settings:cleanSettings(b),game:null,sessionKey:null,updatedAt:Date.now()};try{await save(r,true);}catch(e){rooms.delete(code);await releaseRoomCode(code,'nomadic-bowling').catch(()=>{});throw e;}
      return send(res,200,{roomCode:code,token:host.token,...view(r,host)});
    }
    const match=path.match(/^\/rooms\/([A-Za-z]{5})(\/action)?$/);if(!match)error(404,'NOT_FOUND','Not found.');
    const r=await load(match[1].toUpperCase());if(!r)error(404,'ROOM_NOT_FOUND','That bowling room was not found.');
    let me=r.players.find(p=>seatToken&&p.token===seatToken)||null,who=null;
    if(seatToken){who=await identity(req);if(!me||String(me.accountId)!==String(who.accountId))error(403,'IDENTITY_MISMATCH','That bowling seat belongs to another account.');}
    if(r.game)G.tick(r.game);r.updatedAt=Date.now();
    if(req.method==='GET'&&!match[2]){await save(r);return send(res,200,view(r,me));}
    if(req.method!=='POST'||!match[2])error(405,'METHOD','Unsupported method.');
    const b=await body(req),a=String(b.action||'');
    if(a==='join'){
      who ||= await identity(req);me ||= r.players.find(p=>String(p.accountId)===String(who.accountId));
      if(me?.isHost&&!seatToken)error(409,'HOST_SEAT','Return to Host a game to use your reserved host seat.');
      if(!me){if(r.game&&r.game.phase!=='final')error(409,'IN_GAME','This match has started. Watch the display or join the next match.');if(r.players.length>=8){const cpu=r.players.findIndex(p=>p.cpu);if(cpu<0)error(409,'FULL','All eight seats are taken.');r.players.splice(cpu,1);}me={id:id(),name:String(who.publicName).slice(0,32),accountId:who.accountId,color:COLORS.find(c=>!r.players.some(p=>p.color===c))||COLORS[0],token:token()};r.players.push(me);}else if(!seatToken)me.token=token();
      await save(r,true);return send(res,200,{token:me.token,playerId:me.id,...view(r,me)});
    }
    if(!me)error(401,'NO_SEAT','Join this bowling room first.');
    if(['settings','addCpu','kick','start','lobby'].includes(a)){
      if(!me.isHost)error(403,'HOST_ONLY','Only the host can manage the room.');
      if(a!=='lobby'&&r.game&&r.game.phase!=='final')error(409,'IN_GAME','Finish the match first.');
      if(a==='settings')r.settings=cleanSettings(b,r.settings);
      if(a==='addCpu'){if(r.players.length>=8)error(409,'FULL','All eight seats are taken.');r.players.push({id:id(),name:CPU_NAMES.find(n=>!r.players.some(p=>p.name===n))||'CPU',cpu:true,color:COLORS.find(c=>!r.players.some(p=>p.color===c))||COLORS[0]});}
      if(a==='kick'){if(b.playerId===me.id)error(403,'HOST_SEAT','The host seat stays reserved.');r.players=r.players.filter(p=>p.id!==b.playerId);}
      if(a==='lobby')r.game=null;
      if(a==='start'){if(r.players.length<2)error(409,'PLAYERS','Add another player or a CPU.');if(r.settings.teams&&r.players.length%2)error(409,'TEAMS','Teams need 2, 4, 6 or 8 players. Add a CPU or switch to free for all.');r.sessionKey=token();r.game=G.createGame({players:r.players,settings:r.settings,seed:randomBytes(4).readUInt32LE(),now:Date.now()});}
      await save(r,true);return send(res,200,{result:{ok:true},...view(r,me)});
    }
    if(!r.game)error(409,'NO_GAME','The host has not opened the lanes yet.');
    const result=G.act(r.game,me.id,{...b,type:a});await save(r,true);return send(res,200,{result,...view(r,me)});
  }catch(e){if(!e.status)console.error('[bowling]',e);return send(res,e.status||500,{error:{code:e.code||'SERVER_ERROR',message:e.status?e.message:'The bowling lane hit a snag. Try again.'}});}}
  return function queued(req,res){const key=new URL(req.url||'/','http://localhost').pathname.match(/\/rooms\/([A-Za-z]{5})/)?.[1]?.toUpperCase();if(!key)return handle(req,res);const next=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(()=>handle(req,res));queues.set(key,next);return next.finally(()=>{if(queues.get(key)===next)queues.delete(key);});};
}
