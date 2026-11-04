import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const COLORS = ['red', 'blue', 'green', 'yellow'];
const COLOR_HEX = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308' };
const ACTIONS = ['Skip', 'Reverse', 'Draw Two'];

function makeDeck() {
  const deck = [];
  let id = 0;
  for (const color of COLORS) {
    deck.push({ id: id++, color, value: '0' });
    for (let n = 1; n <= 9; n++) {
      deck.push({ id: id++, color, value: String(n) }, { id: id++, color, value: String(n) });
    }
    for (const action of ACTIONS) {
      deck.push({ id: id++, color, value: action }, { id: id++, color, value: action });
    }
  }
  for (let i = 0; i < 4; i++) deck.push({ id: id++, color: 'wild', value: 'Wild' }, { id: id++, color: 'wild', value: 'Wild Draw Four' });
  return deck;
}
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function Card({ card, onClick, disabled }) {
  return <button type="button" disabled={disabled} onClick={onClick}
    className="relative flex h-28 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl border-[3px] border-white bg-white shadow-lg transition hover:-translate-y-2 disabled:cursor-not-allowed disabled:opacity-40 sm:h-36 sm:w-24"
    style={{ color: card.color === 'wild' ? '#111827' : COLOR_HEX[card.color] }}>
    <span className="absolute left-1 top-1 text-xs font-black">{card.value}</span>
    <span className="text-center text-lg font-black leading-tight sm:text-2xl">{card.value === 'Wild Draw Four' ? '+4' : card.value === 'Draw Two' ? '+2' : card.value === 'Reverse' ? '↺' : card.value === 'Skip' ? '⊘' : card.value === 'Wild' ? 'WILD' : card.value}</span>
    <span className="absolute bottom-1 right-1 rotate-180 text-xs font-black">{card.value}</span>
  </button>;
}
function drawFrom(deck, discard, count = 1) {
  let pile = [...deck];
  let top = discard[discard.length - 1];
  if (pile.length < count) {
    const keep = top;
    pile = shuffle(discard.slice(0, -1));
    return { deck: pile, discard: [keep], drawn: [] };
  }
  return { deck: pile.slice(count), discard, drawn: pile.slice(0, count) };
}

export default function OutGame() {
  const navigate = useNavigate();
  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  const [started, setStarted] = useState(false);
  const [deck, setDeck] = useState([]);
  const [hands, setHands] = useState([]);
  const [discard, setDiscard] = useState([]);
  const [turn, setTurn] = useState(0);
  const [direction, setDirection] = useState(1);
  const [activeColor, setActiveColor] = useState('red');
  const [message, setMessage] = useState('Set the table and deal the cards.');
  const [awaitingPass, setAwaitingPass] = useState(false);
  const [drawnThisTurn, setDrawnThisTurn] = useState(false);
  const [winner, setWinner] = useState(null);
  const [wildChoice, setWildChoice] = useState(null);
  const [unoCalled, setUnoCalled] = useState([]);
  const current = hands[turn] || [];
  const topCard = discard[discard.length - 1];

  const startGame = () => {
    const cards = shuffle(makeDeck());
    const dealt = Array.from({ length: playerCount }, (_, i) => cards.slice(i * 7, i * 7 + 7));
    let pile = cards.slice(playerCount * 7);
    let first = pile.pop();
    while (first.color === 'wild') { pile.unshift(first); first = pile.pop(); }
    setDeck(pile); setHands(dealt); setDiscard([first]); setActiveColor(first.color);
    setTurn(0); setDirection(1); setWinner(null); setDrawnThisTurn(false);
    setUnoCalled([]); setMessage('Player 1 starts. Match the color or number.'); setStarted(true); setAwaitingPass(true);
  };
  const nextPlayer = (steps = 1, nextHands = hands, nextUno = unoCalled) => {
    const next = (turn + direction * steps + playerCount * 10) % playerCount;
    setTurn(next); setDrawnThisTurn(false); setAwaitingPass(true);
    setMessage(`${names[next] || `Player ${next + 1}`}, your turn.`);
    setUnoCalled(nextUno);
  };
  const callOut = () => {
    if (current.length === 1) {
      setUnoCalled(prev => prev.includes(turn) ? prev : [...prev, turn]);
      setMessage(`${names[turn]} called OUT! Nice save.`);
    }
  };
  const drawCard = () => {
    const result = drawFrom(deck, discard);
    if (!result.drawn.length) return;
    setDeck(result.deck); setDiscard(result.discard);
    setHands(prev => prev.map((hand, i) => i === turn ? [...hand, ...result.drawn] : hand));
    setDrawnThisTurn(true);
    setMessage(`${names[turn]} drew a card. Play it if it fits, or pass.`);
  };
  const finishTurn = () => nextPlayer();
  const playCard = (card) => {
    if (awaitingPass || winner !== null) return;
    const legal = card.color === 'wild' || card.color === activeColor || card.value === topCard?.value;
    if (!legal || (drawnThisTurn && !current.some(c => c.id === card.id))) return;
    const remaining = current.filter(c => c.id !== card.id);
    const newHands = hands.map((hand, i) => i === turn ? remaining : hand);
    setHands(newHands); setDiscard(prev => [...prev, card]);
    setActiveColor(card.color === 'wild' ? activeColor : card.color);
    if (remaining.length === 0) { setWinner(turn); setMessage(`${names[turn]} is OUT! You win!`); return; }
    if (remaining.length === 1 && !unoCalled.includes(turn)) {
      const penalty = drawFrom(deck, [...discard, card], 2);
      setDeck(penalty.deck); setDiscard(penalty.discard);
      newHands[turn] = [...remaining, ...penalty.drawn];
      setHands([...newHands]);
      setMessage(`${names[turn]} forgot to call OUT! Two-card penalty.`);
    }
    if (card.color === 'wild') { setWildChoice(card.value); return; }
    let steps = card.value === 'Skip' || card.value === 'Draw Two' ? 2 : 1;
    if (card.value === 'Reverse') { setDirection(prev => -prev); if (playerCount === 2) steps = 2; }
    if (card.value === 'Draw Two') {
      const target = (turn + direction + playerCount) % playerCount;
      const penalty = drawFrom(deck, [...discard, card], 2);
      setDeck(penalty.deck); setDiscard(penalty.discard);
      newHands[target] = [...newHands[target], ...penalty.drawn]; setHands([...newHands]);
    }
    nextPlayer(steps, newHands);
  };
  const chooseWildColor = (color) => {
    setActiveColor(color); setWildChoice(null);
    const steps = topCard?.value === 'Wild Draw Four' ? 2 : 1;
    if (steps === 2) {
      const target = (turn + direction + playerCount) % playerCount;
      const penalty = drawFrom(deck, discard, 4);
      setDeck(penalty.deck); setDiscard(penalty.discard);
      setHands(prev => prev.map((hand, i) => i === target ? [...hand, ...penalty.drawn] : hand));
    }
    nextPlayer(steps);
  };
  const reset = () => { setStarted(false); setWinner(null); setMessage('Set the table and deal the cards.'); };

  return <main className="min-h-screen bg-[#09090f] px-4 py-6 text-white">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate('/games')} className="rounded-lg border border-white/20 px-4 py-2 text-sm">← ALL GAMES</button>
        <div className="text-center"><div className="text-xs font-bold tracking-[.45em] text-orange-400">TEXASNOMAD GAMES</div><h1 className="text-4xl font-black tracking-widest text-orange-400 sm:text-6xl">OUT!</h1></div>
        <button onClick={reset} className="rounded-lg border border-white/20 px-4 py-2 text-sm">NEW GAME</button>
      </div>
      {!started ? <section className="mx-auto max-w-xl rounded-2xl border border-orange-500/40 bg-white/5 p-6">
        <h2 className="mb-2 text-2xl font-bold">Deal the cards</h2><p className="mb-5 text-sm text-white/60">A quick pass-and-play card battle for 2–4 people on one screen. No account needed.</p>
        <label className="mb-2 block text-sm">Players</label>
        <select value={playerCount} onChange={e => setPlayerCount(Number(e.target.value))} className="mb-4 w-full rounded-lg bg-black p-3"><option value={2}>2 players</option><option value={3}>3 players</option><option value={4}>4 players</option></select>
        {Array.from({ length: playerCount }, (_, i) => <label key={i} className="mb-3 block text-sm">Player {i + 1}<input value={names[i] || ''} onChange={e => setNames(prev => prev.map((n,j) => j === i ? e.target.value : n))} className="mt-1 w-full rounded-lg border border-white/15 bg-black p-3" maxLength={20} /></label>)}
        <button onClick={startGame} className="mt-3 w-full rounded-xl bg-orange-500 px-5 py-4 font-black tracking-widest text-black">START OUT!</button>
      </section> : <section>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{names.slice(0,playerCount).map((name,i) => <div key={i} className={`rounded-xl border p-3 ${i===turn?'border-orange-400 bg-orange-400/15':'border-white/10 bg-white/5'}`}><div className="font-bold">{name || `Player ${i+1}`}</div><div className="text-xs text-white/50">{hands[i]?.length || 0} cards {i===turn?'· CURRENT TURN':''}</div></div>)}</div>
        <div className="mb-5 rounded-2xl border border-white/10 bg-[#111827] p-5 text-center"><div className="mb-2 text-xs uppercase tracking-widest text-white/50">Table · Active color <span style={{color:COLOR_HEX[activeColor]}}>{activeColor}</span></div><div className="flex items-center justify-center gap-6"><div className="rounded-xl border-4 border-white bg-white px-6 py-8 text-3xl font-black" style={{color:topCard?.color==='wild'?'#111':COLOR_HEX[topCard?.color]}}>{topCard?.value}</div><div className="text-left text-sm text-white/60">Draw pile<br/><button onClick={drawCard} disabled={awaitingPass || drawnThisTurn || !!winner} className="mt-2 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-40">DRAW 1</button></div></div></div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="text-lg font-bold">{names[turn] || `Player ${turn+1}`}'s hand</div><button onClick={callOut} disabled={current.length!==1 || awaitingPass} className="rounded-lg bg-orange-500 px-4 py-2 font-black text-black disabled:opacity-40">CALL OUT!</button></div>
        {awaitingPass ? <div className="rounded-xl border border-orange-400/40 bg-orange-400/10 p-5 text-center"><p className="mb-3 text-lg font-bold">Pass the device to {names[turn] || `Player ${turn+1}`}</p><button onClick={() => setAwaitingPass(false)} className="rounded-lg bg-orange-500 px-6 py-3 font-black text-black">I'M READY</button></div> : <div className="flex flex-wrap justify-center gap-2">{current.map(card => <Card key={card.id} card={card} disabled={!!winner || !(card.color==='wild'||card.color===activeColor||card.value===topCard?.value)} onClick={() => playCard(card)} />)}</div>}
        {drawnThisTurn && !awaitingPass && <button onClick={finishTurn} className="mt-4 w-full rounded-lg border border-white/20 p-3">PASS TURN</button>}
        {wildChoice && <div className="mt-4 rounded-xl bg-white/10 p-4 text-center"><p className="mb-3 font-bold">Choose the next color</p><div className="flex justify-center gap-3">{COLORS.map(color => <button key={color} onClick={() => chooseWildColor(color)} className="h-12 w-12 rounded-full border-2 border-white" style={{background:COLOR_HEX[color]}} aria-label={color}/>)}</div></div>}
        <p className="mt-5 rounded-lg bg-white/5 p-3 text-center text-sm text-white/65">{message}</p>
        {winner !== null && <div className="mt-5 rounded-2xl border-2 border-orange-400 bg-orange-400/10 p-6 text-center"><div className="text-4xl font-black text-orange-400">{names[winner]} IS OUT!</div><p className="mt-2 text-white/60">The table has a winner.</p><button onClick={reset} className="mt-4 rounded-lg bg-orange-500 px-6 py-3 font-black text-black">PLAY AGAIN</button></div>}
      </section>}
    </div>
  </main>;
}
