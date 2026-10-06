import assert from 'node:assert/strict';
import * as G from '../src/lib/nomadicBowling/engine.js';
let checks=0;
function check(actual,expected){assert.deepEqual(actual,expected);checks++;}
check(G.scoreFrames([...Array.from({length:9},()=>[10]),[10,10,10]]).total,300);
check(G.scoreFrames([...Array.from({length:9},()=>[9,1]),[9,1,9]]).total,190);
check(G.scoreFrames(Array.from({length:10},()=>[3,4])).total,70);
check(G.scoreFrames(Array.from({length:10},()=>[0,0])).total,0);
check(G.scoreFrames([[10]]).cumulative[0],null);
check(G.scoreFrames([[10],[4,3]]).cumulative.slice(0,2),[17,24]);
check(G.scoreFrames([...Array.from({length:9},()=>[0,0]),[10,7,3]]).total,20);
check(G.marks([10,7,3],9),['X','7','/']);check(G.marks([7,3,10],9),['7','/','X']);
const seats=[{id:'a',name:'A'},{id:'b',name:'B'}];
const spare=G.createGame({players:seats,now:0});
function force(g,n,now){g.delivery={knocked:g.standing.slice(0,n),hit:false};g.phase='settling';g.deadline=now;G.tick(g,now);}
for(let frame=0;frame<9;frame++){force(spare,0,frame*100);force(spare,0,frame*100+1);force(spare,0,frame*100+2);force(spare,0,frame*100+3);}
check(spare.frame,9);force(spare,10,1000);check(spare.standing.length,10);force(spare,7,1001);check(spare.standing.length,3);force(spare,3,1002);check(spare.turn,1);force(spare,0,1003);force(spare,0,1004);check(spare.phase,'final');check(G.scoreFrames(spare.players[0].frames).total,20);
const g=G.createGame({players:seats,now:100,settings:{mode:'brawl'}});
check(G.act(g,'b',{type:'bowl',start:0,aim:0,spin:0,power:.85},100).ok,false);
check(G.act(g,'a',{type:'bowl',start:0,aim:0,spin:0,power:.85},100).ok,true);
const d=g.delivery,fireAt=100+d.duration*.55-200;
check(G.act(g,'b',{type:'sabotage',x:0,push:1},fireAt).ok,true);check(g.players[1].charges,2);
check(G.act(g,'b',{type:'sabotage',x:0,push:1},fireAt+1).ok,false);
G.tick(g,fireAt+200);check(g.delivery.hit,true);
G.tick(g,g.deadline+1);assert(['revenge','settling'].includes(g.phase));checks++;
if(g.phase==='revenge'){const pin=G.PIN_POSITIONS.find(p=>g.standing.includes(p.id)&&!g.delivery.knocked.includes(p.id));check(G.act(g,'b',{type:'revenge',x:pin.x,z:pin.z},g.phaseAt+100).ok,false);check(G.act(g,'a',{type:'revenge',x:pin.x,z:pin.z},g.phaseAt+100).ok,true);check(g.delivery.revengeShot.pins.length<=2,true);}
const classic=G.createGame({players:seats,now:0,settings:{mode:'classic'}});G.act(classic,'a',{type:'bowl',start:0,aim:0,power:1,spin:0},0);check(G.act(classic,'b',{type:'sabotage',x:0},2000).ok,false);check(classic.players[1].charges,0);
const late=G.createGame({players:seats,now:0});G.tick(late,45001);check(late.players[0].frames[0],[0]);
let rolls=0,sabotages=0,revenge=0,strikes=0;
for(let n=0;n<60;n++){
  let now=1000;const players=Array.from({length:2+n%7},(_,i)=>({id:'p'+i,name:'CPU'+i,cpu:true}));const teams=players.length%2===0&&n%3===0;
  let game=G.createGame({players,settings:{mode:n%2?'classic':'brawl',teams,stage:G.STAGES[n%3].id},seed:n+100,now});let prevSeq=0;
  for(let step=0;step<40000&&game.phase!=='final';step++){
    now+=120;G.tick(game,now);
    if(step%67===0)game=JSON.parse(JSON.stringify(game));
    for(const p of game.players){assert(p.charges>=0&&p.charges<=3);assert(p.frames.every((a,i)=>a.length<=(i===9?3:2)&&a.every(v=>v>=0&&v<=10)));assert(G.scoreFrames(p.frames).total<=300);}
    for(const l of game.log.filter(l=>l.seq>prevSeq)){if(l.text.includes('sends it'))rolls++;if(l.text.includes('SABOTAGE LANDED'))sabotages++;if(l.text.includes('PINSHOT!'))revenge++;if(l.text.includes('STRIKE!'))strikes++;}prevSeq=game.seq;
  }
  assert.equal(game.phase,'final');assert(game.players.every(p=>p.frames.every((a,i)=>i===9?a.length===3||a.length===2&&a[0]+a[1]<10:a[0]===10||a.length===2)));checks++;
}
console.log(JSON.stringify({checks,matches:60,rolls,sabotages,revenge,strikes,scoring:'passed',restartRecovery:'passed'}));
