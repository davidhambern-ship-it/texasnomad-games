import React, { useCallback, useEffect, useRef, useState } from 'react';
import WWPlay from './WWPlay';
import { Avatar, Confetti, Countdown, loadBest, saveBest } from './WWShared';
import { createGame, applyWord, shuffleBoard, cpuPickWord, cpuDelayMs, ROUND_SECONDS, summary } from '@/lib/wordWranglerEngine';
import { soundManager } from '@/lib/wordWranglerSound';

/**
 * Solo Rush (rival = null): beat the burning rope — Sapphires add time.
 * Vs CPU (rival = {id,name,level,color}): race a Texas Nomad CPU on the same tiles.
 */
export default function WWSolo({ dict, rival = null, playerName = 'You', onExit, muted, setMuted }) {
  const mode = rival ? 'race' : 'timed';
  const [round, setRound] = useState(1);
  const [st, setSt] = useState(() => createGame({ seed: `solo-${Date.now()}`, mode }));
  const [cpu, setCpu] = useState(null);
  const [phase, setPhase] = useState('countdown'); // countdown | playing | paused | over
  const [startAt, setStartAt] = useState(() => Date.now() + 3200);
  const [elapsed, setElapsed] = useState(0);
  const pausedMs = useRef(0);
  const pauseStart = useRef(0);
  const cpuNext = useRef(0);
  const [result, setResult] = useState(null);

  // new round
  const newRound = useCallback(() => {
    const seed = `solo-${Date.now()}-${Math.random()}`;
    const g = createGame({ seed, mode });
    setSt(g);
    setCpu(rival ? { st: createGame({ seed, mode }), last: null } : null);
    cpuNext.current = rival ? cpuDelayMs(rival.level) / 1000 : 0;
    pausedMs.current = 0; setElapsed(0); setResult(null);
    setStartAt(Date.now() + 3200); setPhase('countdown'); setRound(r => r + 1);
  }, [mode, rival]);
  useEffect(() => { newRound(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = ROUND_SECONDS + (mode === 'timed' ? st.timeBonus : 0);
  const timeLeft = Math.max(0, total - elapsed);

  // game clock (also drives the CPU)
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const t = setInterval(() => {
      const el = (Date.now() - startAt - pausedMs.current) / 1000;
      setElapsed(el);
      if (rival) {
        setCpu(prev => {
          if (!prev || el < cpuNext.current) return prev;
          const tr = dict.trie();
          let next = prev;
          const pick = cpuPickWord(prev.st, tr, rival.level, { common: dict.common });
          if (pick) { const r = applyWord(prev.st, pick.path, dict.dict); if (r.ok) next = { st: r.state, last: { w: r.word, p: r.points } }; }
          else next = { ...prev, st: shuffleBoard(prev.st) };
          cpuNext.current = el + cpuDelayMs(rival.level) / 1000;
          return next;
        });
      }
    }, 200);
    return () => clearInterval(t);
  }, [phase, startAt, rival, dict]);

  // time's up
  useEffect(() => {
    if (phase === 'playing' && timeLeft <= 0) {
      setPhase('over');
      const s = summary(st);
      const best = loadBest();
      const key = rival ? `cpu_${rival.id}` : 'solo';
      const prevBest = best[key] || 0;
      const isBest = s.score > prevBest;
      if (isBest) { best[key] = s.score; saveBest(best); }
      const won = rival ? s.score > (cpu?.st.score || 0) : null;
      setResult({ ...s, isBest, prevBest, won, cpuScore: cpu?.st.score || 0, cpuWords: cpu?.st.words.length || 0, cpuBest: cpu?.st.best || null });
      try { if (won || isBest) soundManager.playCrowdCheer(); else soundManager.playSaloonDoors(); } catch { /* ignore */ }
    }
  }, [timeLeft, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePause = () => {
    if (phase === 'playing') { pauseStart.current = Date.now(); setPhase('paused'); }
    else if (phase === 'paused') { pausedMs.current += Date.now() - pauseStart.current; setPhase('playing'); }
  };

  const onMove = useCallback(({ state }) => setSt(state), []);

  const side = rival && cpu ? (
    <div className="ww-panel">
      <h4>Your rival</h4>
      <div className="ww-rival">
        <Avatar name={rival.name} charId={rival.id} color={rival.color} />
        <div><div className="nm">{rival.name}</div><div className="last">{cpu.last ? <>played <b style={{ color: 'var(--ww-text)' }}>{cpu.last.w.toUpperCase()}</b> +{cpu.last.p}</> : 'sizing up the board…'}</div></div>
        <div className="sc">{cpu.st.score.toLocaleString()}</div>
      </div>
      <div className="ww-vs" title="You vs rival">
        <i style={{ width: `${(st.score + 1) / (st.score + cpu.st.score + 2) * 100}%`, background: 'var(--ww-gold)' }} />
        <i style={{ flex: 1, background: rival.color }} />
      </div>
      <div className="ww-row" style={{ justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--ww-dim)' }}><span>{playerName}</span><span>{rival.name} · {cpu.st.words.length} words</span></div>
    </div>
  ) : (
    <div className="ww-panel">
      <h4>Solo Rush</h4>
      <div style={{ fontSize: 14, color: 'var(--ww-dim)', lineHeight: 1.4 }}>Score as much as you can before the rope burns down to the keg. <b style={{ color: 'var(--ww-text)' }}>Sapphires add 10 seconds.</b> Best: <b style={{ color: 'var(--ww-gold)' }}>{(loadBest().solo || 0).toLocaleString()}</b></div>
    </div>
  );

  const hudRight = (
    <>
      {!rival && <button type="button" className="ww-btn small" onClick={togglePause} disabled={phase !== 'playing' && phase !== 'paused'} aria-label={phase === 'paused' ? 'Resume' : 'Pause'}>{phase === 'paused' ? '▶' : '❚❚'}</button>}
      <button type="button" className="ww-btn small" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '🔇' : '🔊'}</button>
      <button type="button" className="ww-btn small" onClick={onExit} aria-label="Quit to menu">✕</button>
    </>
  );

  return (
    <>
      <WWPlay key={round} state={st} onMove={onMove} dict={dict} timeLeft={timeLeft} totalTime={Math.max(total, ROUND_SECONDS)} disabled={phase !== 'playing'} side={side} hudRight={hudRight} muted={muted} />
      {phase === 'countdown' && <Countdown endsAt={startAt} onDone={() => setPhase('playing')} />}
      {phase === 'paused' && (
        <div className="ww-overlay"><div className="ww-card ww-results">
          <p className="ww-banner">Paused</p>
          <p className="ww-sub">The board is hidden while you’re paused.</p>
          <div className="ww-row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <button type="button" className="ww-btn primary" onClick={togglePause}>Resume</button>
            <button type="button" className="ww-btn" onClick={onExit}>Quit</button>
          </div>
        </div></div>
      )}
      {phase === 'over' && result && (
        <div className="ww-overlay"><div className="ww-card ww-results">
          {rival ? <p className={`ww-banner ${result.won ? 'win' : 'lose'}`}>{result.won ? `You beat ${rival.name}!` : result.score === result.cpuScore ? 'Dead heat!' : `${rival.name} wins this one`}</p> : <p className="ww-banner">Time’s up!</p>}
          <div className="big">{result.score.toLocaleString()}</div>
          {result.isBest && <div className="ww-newbest">NEW PERSONAL BEST</div>}
          {rival && <p className="ww-sub">{rival.name}: {result.cpuScore.toLocaleString()} · {result.cpuWords} words{result.cpuBest ? ` · best ${result.cpuBest.w.toUpperCase()}` : ''}</p>}
          <div className="ww-stats">
            <div><b>{result.words}</b><span>Words</span></div>
            <div><b>{result.best ? result.best.w.toUpperCase() : '—'}</b><span>Best word{result.best ? ` · ${result.best.p}` : ''}</span></div>
            <div><b>{result.longest ? result.longest.w.length : 0}</b><span>Longest</span></div>
          </div>
          {(result.caught > 0 || result.escaped > 0) && <p className="ww-sub">Outlaws caught: {result.caught} · got away: {result.escaped}</p>}
          <div className="ww-row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button type="button" className="ww-btn primary" onClick={newRound}>Play again</button>
            <button type="button" className="ww-btn" onClick={onExit}>Menu</button>
          </div>
        </div></div>
      )}
      <Confetti on={phase === 'over' && (result?.won || result?.isBest)} />
    </>
  );
}
