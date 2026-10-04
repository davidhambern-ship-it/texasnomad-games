import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { dominoStore as base44 } from '@/api/dominoStore';
import Header from '@/components/home/Header';
import TestFeedbackButton from '@/components/testing/TestFeedbackButton';
import DominoTable, { TEAM_COLORS, TEAM_NAMES } from '@/components/domino/DominoTable';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';
import { getTeam, applyPlay, applyPass } from '@/lib/dominoEngine';
import '@/components/domino/domino.css';

const BG = { background: 'radial-gradient(ellipse at 50% 0%,#1a0b33,#050505 70%)', minHeight: '100vh' };

async function fetchRoom(code) {
  const rows = await base44.entities.DominoGame.filter({ room_code: code });
  return rows[0] || null;
}

function SeatAvatar({ p, seat }) {
  const ch = TEXASNOMAD_CHARACTERS.find(c => c.id === p?.aiCharacterId);
  const color = TEAM_COLORS[getTeam(seat)];
  const [broken, setBroken] = useState(false);
  if (ch && !broken) return <img src={ch.avatar} alt="" className="tnd-avatar" style={{ width: 40, height: 40, borderColor: color }} onError={() => setBroken(true)} />;
  return <div className="tnd-avatar tnd-avatar-txt" style={{ width: 40, height: 40, borderColor: color, background: `${color}33`, fontSize: 15 }}>{p?.playerName ? p.playerName.slice(0, 2).toUpperCase() : '·'}</div>;
}

export default function DominoGame() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = searchParams.get('room')?.toUpperCase() || '';

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(!!roomCode);
  const [mySeat, setMySeat] = useState(null);
  const [nameInput, setNameInput] = useState(() => { try { return localStorage.getItem('dom_player_name') || ''; } catch { return ''; } });
  const [codeInput, setCodeInput] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!roomCode) { setLoading(false); return; }
    let alive = true;
    const load = async () => { try { const g = await fetchRoom(roomCode); if (alive) { setGame(g); setLoading(false); } } catch { if (alive) setLoading(false); } };
    load();
    const poll = setInterval(load, 2000);
    let unsub;
    try { unsub = base44.entities.DominoGame.subscribe(ev => { if (alive && ev.data?.room_code === roomCode) setGame(ev.data); }); } catch { /* polling only */ }
    return () => { alive = false; clearInterval(poll); try { unsub && unsub(); } catch { /* ignore */ } };
  }, [roomCode]);

  // Rejoin the seat this device took before
  useEffect(() => {
    if (!game || mySeat !== null) return;
    try {
      const seat = localStorage.getItem(`dom_seat_${roomCode}`), pid = localStorage.getItem(`dom_pid_${roomCode}`);
      if (seat !== null && pid && game.players?.[+seat]?.playerId === pid) setMySeat(+seat);
    } catch { /* ignore */ }
  }, [game?.id]);

  const takeSeat = async (seat) => {
    if (!nameInput.trim()) { setMsg('Type your name first'); return; }
    const fresh = await fetchRoom(roomCode);
    if (!fresh) { setMsg('Room not found'); return; }
    if (fresh.players[seat].playerId) { setMsg('Someone just took that seat — pick another'); setGame(fresh); return; }
    const pid = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const updated = { ...fresh, players: fresh.players.map((p, i) => (i === seat ? { ...p, playerId: pid, playerName: nameInput.trim(), isAI: false, connected: true } : p)) };
    await base44.entities.DominoGame.update(fresh.id, updated);
    setGame(updated); setMySeat(seat);
    try { localStorage.setItem(`dom_seat_${roomCode}`, String(seat)); localStorage.setItem(`dom_pid_${roomCode}`, pid); localStorage.setItem('dom_player_name', nameInput.trim()); } catch { /* ignore */ }
  };

  const act = async (fn) => {
    const fresh = await fetchRoom(roomCode);
    if (!fresh) return 'Lost connection to the room';
    const next = fn(fresh);
    if (next.error) return next.error;
    await base44.entities.DominoGame.update(fresh.id, next);
    setGame(next); return null;
  };

  if (loading) return <div style={{ ...BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="tnd-root" style={{ textAlign: 'center' }}>Finding the table…</div></div>;

  // No code yet → enter one
  if (!roomCode || !game) {
    return (
      <div style={BG}><Header />
        <div className="tnd-root"><div className="tnd-lobby">
          <div className="tnd-panel" style={{ textAlign: 'center' }}>
            <h1>DOMINOES</h1>
            {roomCode && !game && <p className="tnd-sub" style={{ color: '#fca5a5' }}>Room {roomCode} wasn’t found. Check the code with your host.</p>}
            <h3 style={{ marginTop: 16 }}>Room code</h3>
            <input className="tnd-input" value={codeInput} maxLength={6} placeholder="ABCDE" style={{ textTransform: 'uppercase', letterSpacing: '.25em' }}
              onChange={e => setCodeInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && codeInput.trim() && setSearchParams({ room: codeInput.trim() })} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <button type="button" className="tnd-btn primary" style={{ flex: 1 }} disabled={!codeInput.trim()} onClick={() => setSearchParams({ room: codeInput.trim() })}>Find table</button>
              <button type="button" className="tnd-btn" onClick={() => navigate('/games/dominoes/host')}>Host a game</button>
            </div>
          </div>
        </div></div>
      </div>
    );
  }

  // Pick a seat
  if (mySeat === null) {
    const open = game.players.map((p, i) => (!p.playerId && i !== 0 ? i : null)).filter(i => i !== null);
    return (
      <div style={BG}><Header />
        <TestFeedbackButton gameId="dominoes" roomCode={roomCode} testerName={nameInput} />
        <div className="tnd-root"><div className="tnd-lobby">
          <div className="tnd-panel" style={{ textAlign: 'center' }}>
            <h1>DOMINOES</h1>
            <p className="tnd-sub">Room <b style={{ color: '#FFD700', letterSpacing: '.2em' }}>{roomCode}</b>{game.phase !== 'waiting' ? ' · game in progress' : ''}</p>
          </div>
          <div className="tnd-panel">
            <h3>Your name</h3>
            <input className="tnd-input" value={nameInput} maxLength={20} placeholder="YOUR NAME" onChange={e => setNameInput(e.target.value)} />
            <h3 style={{ marginTop: 16 }}>Pick a seat</h3>
            <div className="tnd-seats">
              {game.players.map((p, seat) => (
                <div key={seat} className="tnd-seatbox" style={{ '--tc': TEAM_COLORS[getTeam(seat)] }}>
                  <SeatAvatar p={p} seat={seat} />
                  <div className="who"><b>{p.playerName || 'Open seat'}{p.isAI ? ' · CPU' : ''}</b><span>Seat {seat + 1} · {TEAM_NAMES[getTeam(seat)]}{seat === 0 ? ' · Host' : ''}</span></div>
                  {open.includes(seat) && <button type="button" className="tnd-btn primary" onClick={() => takeSeat(seat)}>Sit here</button>}
                </div>
              ))}
            </div>
            {!open.length && <p className="tnd-sub" style={{ marginTop: 10 }}>The table is full. You can still watch.</p>}
            {msg && <p className="tnd-sub" style={{ color: '#fca5a5', marginTop: 10 }}>{msg}</p>}
            <button type="button" className="tnd-btn ghosty" style={{ marginTop: 14 }} onClick={() => setMySeat(-1)}>Just watch</button>
          </div>
        </div></div>
      </div>
    );
  }

  const seat = mySeat >= 0 ? mySeat : null;
  return (
    <div style={BG}><Header />
      <TestFeedbackButton gameId="dominoes" roomCode={roomCode} testerName={nameInput} />
      <DominoTable game={game} mySeat={seat} roomCode={roomCode}
        onPlay={(id, side) => act(g => applyPlay(g, seat, id, side))}
        onPass={() => act(g => applyPass(g, seat))}
        onLeave={() => navigate('/games')}
        notice={game.phase === 'waiting' ? 'You’re seated! Waiting for the host to start…' : null} />
    </div>
  );
}
