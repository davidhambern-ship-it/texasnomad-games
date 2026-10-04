// Stress test for the dominoes engine: node scripts/domino-sim.mjs
// Plays 2,000 CPU games and checks that tiles never overlap and always connect pip-to-pip.
import * as E from '../src/lib/dominoEngine.js';
const boxGrow={}; let games=0, rounds=0, blocked=0, overlaps=0, badLinks=0, outBox=0, maxW=0, maxH=0, totalPlays=0, illegal=0, spinnerArmsUsed=0;
const box=E.LAYOUT_BOX;
for(let gi=0;gi<2000;gi++){
  let g={players:[0,1,2,3].map(i=>({seat:i,playerName:'P'+i,hand:[],isAI:true})),scoreLimit:150,teamScores:{teamA:0,teamB:0}};
  g=E.newRound(g,{first:true}); games++;
  let guard=0;
  while(g.phase!=='game_over' && guard++<2000){
    if(g.phase==='round_over'){ rounds++; if(g.roundWinner.reason==='blocked') blocked++;
      // validate layout of final board
      check(g.board); g=E.newRound(g); continue; }
    const s=g.currentSeat; const m=E.chooseAIMove(g,s,1+((gi+s)%10));
    const ng = m? E.applyPlay(g,s,m.domino.id,m.side) : E.applyPass(g,s);
    if(ng.error){ illegal++; console.log('ERR',ng.error); break; }
    if(m) totalPlays++;
    g=ng;
  }
  if(g.phase==='round_over'){rounds++; check(g.board);}
}
function check(board){
  const L=E.layoutBoard(board,{halfW:[5.5,9,13][Math.floor(Math.random()*3)],halfH:5.5}); const t=L.tiles; boxGrow[L.box.halfW]=(boxGrow[L.box.halfW]||0)+1; const box=L.box;
  maxW=Math.max(maxW,L.bbox.maxX-L.bbox.minX); maxH=Math.max(maxH,L.bbox.maxY-L.bbox.minY);
  for(let i=0;i<t.length;i++) for(let j=i+1;j<t.length;j++){ const r=t[i].rect,s=t[j].rect; if(Math.abs(r.cx-s.cx)<(r.w+s.w)/2-0.04&&Math.abs(r.cy-s.cy)<(r.h+s.h)/2-0.04){overlaps++;} }
  for(const x of t) { const r=x.rect; if(r.cx-r.w/2< -box.halfW-1e-6||r.cx+r.w/2>box.halfW+1e-6||r.cy-r.h/2< -box.halfH-1e-6||r.cy+r.h/2>box.halfH+1e-6){outBox++;} if(x.side==='up'||x.side==='down') spinnerArmsUsed++; }
  // link check: each non-first tile's inner half must touch a half of the tile it attaches to, with the same pip
  const byId=Object.fromEntries(t.map(x=>[x.id,x])); const lastOnArm={}; const A=board;
  const spinnerId=E.getOpenEnds(A).spinnerId;
  for(const e of A){ if(e.side==='first'){ continue; }
    const side=e.side; let prevId=lastOnArm[side];
    if(!prevId) prevId=(side==='up'||side==='down')? spinnerId : A[0].id;
    const cur=byId[e.id], prev=byId[prevId];
    const inner=cur.halves[0]; const sq={cx:inner.cx,cy:inner.cy,w:1,h:1};
    // target region: for a double, the whole tile; otherwise the half showing the matching pip
    const targets = prev.double ? [prev.rect] : prev.halves.filter(h=>h.pip===e.inner).map(h=>({cx:h.cx,cy:h.cy,w:1,h:1}));
    const touch=(r,s)=>{ const gx=Math.abs(r.cx-s.cx)-(r.w+s.w)/2, gy=Math.abs(r.cy-s.cy)-(r.h+s.h)/2; return (Math.abs(gx)<1e-6&&gy< -1e-6)||(Math.abs(gy)<1e-6&&gx< -1e-6); };
    const ok=targets.some(t=>touch(sq,t)) || (cur.double && cur.halves.some(h=>targets.some(t=>touch({cx:h.cx,cy:h.cy,w:1,h:1},t))));
    if(!ok){ badLinks++; if(badLinks<4) console.log('badlink',e, JSON.stringify(cur.halves), JSON.stringify(prev.halves), prev.double); }
    lastOnArm[side]=e.id; }
}
let boxes={}; console.log(boxGrow); console.log({games,rounds,blocked,totalPlays,illegal,overlaps,badLinks,outBox,spinnerArmsUsed,maxW,maxH});
