import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROSTER, fighterById } from '@/lib/brawl/fighters';
import { STAGE_LIST } from '@/lib/brawl/engine';
import { clearRodeoDisplayTarget, rrConnect, setRodeoDisplayTarget } from '@/api/rodeoRumbleLive';
import RRFight from './RRFight';
import RRPortrait from './RRPortrait';
import { rrSfx } from './rrSfx';

const TNG_PUBLIC_ORIGIN = String((import.meta.env && import.meta.env.VITE_TNG_PUBLIC_ORIGIN) || 'https://texasnomadgames.com').replace(/\/+$/, '');
const JOIN_HOST = TNG_PUBLIC_ORIGIN.replace(/^https?:\/\//, '');
const STAGE_LOOKS = {
  mesa: 'linear-gradient(160deg,#6b2a6b,#e8603c 70%,#ffb35c)',
  saloon: 'linear-gradient(160deg,#060a1f,#1b2350 60%,#8a5530)',
  canyon: 'linear-gradient(160deg,#3f8fd6,#8fc8ee 50%,#a3532e)',
  lounge: 'linear-gradient(160deg,#1a0c2a,#5a1a4a 60%,#ff4fb0)',
  random: 'linear-gradient(160deg,#2a1a4d,#4a2d86)',
};
const readHost = () => { try { return JSON.parse(localStorage.getItem('rr_host') || 'null'); } catch { return null; } };

/** Authenticated Host + local fight engine. Players use signed-in phones as controllers. */
export default function RRHost({ onExit }) {
  const [conn, setConn] = useState('connecting');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState({});
  const [phase, setPhase] = useState('lobby');
  const [lineup, setLineup] = useState(null);
  const [stage, setStage] = useState(() => { try { return localStorage.getItem('rr_stage') || 'mesa'; } catch { return 'mesa'; } });
  const [stocks, setStocks] = useState(3);
  const [displayAttached, setDisplayAttached] = useState(false);
  const sock = useRef(null);
  const inputs = useRef({});
  const statusAt = useRef(0);

  useEffect(() => {
    const socket = rrConnect({
      hello: ({ authToken }) => {
        const saved = readHost();
        return {
          t: 'host',
          code: saved?.code,
          token: saved?.token,
          authToken,
          deviceId: localStorage.getItem('tng_device_id') || '',
        };
      },
      onStatus: setConn,
      onMessage: (message) => {
        if (message.t === 'room') {
          setCode(message.code);
          setError('');
          try { localStorage.setItem('rr_host', JSON.stringify({ code: message.code, token: message.token })); } catch { /* ignore */ }
          setPlayers(Object.fromEntries((message.players || []).map((player) => [player.id, player])));
        } else if (message.t === 'pjoin') {
          setPlayers((current) => ({
            ...current,
            [message.id]: {
              ...(current[message.id] || {}),
              id: message.id,
              name: message.name,
              fighter: message.fighter,
              ready: message.ready,
              color: message.color,
              online: true,
              isHost: message.isHost === true,
            },
          }));
          rrSfx.count();
        } else if (message.t === 'pleave') {
          setPlayers((current) => {
            const next = { ...current };
            if (message.gone) delete next[message.id];
            else if (next[message.id]) next[message.id] = { ...next[message.id], online: false };
            return next;
          });
          if (inputs.current[message.id]) inputs.current[message.id] = { x: 0, y: 0, b: 0, latch: 0 };
        } else if (message.t === 'pick') {
          setPlayers((current) => current[message.id]
            ? { ...current, [message.id]: { ...current[message.id], fighter: message.fighter, ready: false } }
            : current);
        } else if (message.t === 'ready') {
          setPlayers((current) => current[message.id]
            ? { ...current, [message.id]: { ...current[message.id], ready: message.v } }
            : current);
        } else if (message.t === 'i') {
          const current = inputs.current[message.id] || (inputs.current[message.id] = { x: 0, y: 0, b: 0, latch: 0 });
          current.x = message.x / 100;
          current.y = message.y / 100;
          current.b = message.b;
          current.latch |= message.b;
        } else if (message.t === 'error') {
          setError(message.message || 'Connection problem.');
        }
      },
    });
    sock.current = socket;
    return () => socket.close();
  }, []);

  const roster = useMemo(() => Object.values(players), [players]);
  const livePlayers = useMemo(() => roster.filter((player) => player.online !== false).slice(0, 8), [roster]);

  useEffect(() => {
    if (!sock.current || !code) return;
    sock.current.send({
      t: 'lobby',
      lobby: {
        phase,
        stage,
        stocks,
        players: roster.map((player) => ({
          id: player.id,
          name: player.name,
          fighter: player.fighter,
          ready: player.ready,
          color: player.color,
          online: player.online,
        })),
        inMatch: lineup ? lineup.map((player) => player.id) : [],
      },
    });
  }, [phase, stage, stocks, roster, code, lineup, conn]);

  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;
    const attach = async () => {
      try {
        const result = await setRodeoDisplayTarget(code);
        if (!cancelled) setDisplayAttached(Boolean(result?.displayAttached));
      } catch (attachError) {
        if (!cancelled) console.warn('[Rodeo Rumble] display attach failed', attachError);
      }
    };
    attach();
    const timer = window.setInterval(attach, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      clearRodeoDisplayTarget();
    };
  }, [code]);

  const remote = useMemo(() => ({
    read(id) {
      const current = inputs.current[id];
      if (!current) return null;
      const buttons = current.b | current.latch;
      return {
        x: current.x,
        y: current.y,
        jump: !!(buttons & 1),
        light: !!(buttons & 2),
        heavy: !!(buttons & 4),
        dodge: !!(buttons & 8),
      };
    },
    consumed() {
      for (const current of Object.values(inputs.current)) current.latch = 0;
    },
  }), []);

  const start = () => {
    if (livePlayers.length < 2) {
      setError('Rodeo Rumble needs at least 2 human players.');
      return;
    }
    rrSfx.unlock();
    setError('');
    try { localStorage.setItem('rr_stage', stage); } catch { /* ignore */ }
    const nextLineup = livePlayers.map((player) => ({
      id: player.id,
      fighter: player.fighter || ROSTER[Math.floor(Math.random() * ROSTER.length)].id,
      name: player.name,
      remote: !player.isHost,
      you: player.isHost === true,
      slotColor: player.color,
    }));
    for (const player of nextLineup) {
      inputs.current[player.id] = { x: 0, y: 0, b: 0, latch: 0 };
    }
    setLineup(nextLineup);
    setPhase('fight');
  };

  const onStatus = useCallback((status) => {
    const now = Date.now();
    if (now - statusAt.current < 220) return;
    statusAt.current = now;
    sock.current?.send({ t: 'status', status });
  }, []);

  const onFrame = useCallback((frame) => {
    sock.current?.send({ t: 'frame', frame });
  }, []);

  const onResult = useCallback((result) => {
    setPhase('results');
    sock.current?.send({
      t: 'result',
      result: {
        winner: result.winner ? result.winner.id : null,
        ranked: result.ranked.map((ranked) => ({
          id: ranked.id,
          name: ranked.tag.label,
          ch: ranked.ch.id,
          kos: ranked.kos,
          falls: ranked.falls,
          dealt: ranked.dealt,
        })),
      },
    });
  }, []);

  const backToLobby = () => {
    setPhase('lobby');
    setLineup(null);
    sock.current?.send({ t: 'reset' });
  };

  const closeRoom = () => {
    sock.current?.send({ t: 'close' });
    clearRodeoDisplayTarget();
    try { localStorage.removeItem('rr_host'); } catch { /* ignore */ }
    onExit();
  };

  if (phase !== 'lobby' && lineup) {
    return (
      <div className="rr-root">
        <RRFight
          key={lineup.map((player) => player.id).join()}
          players={lineup}
          stocks={stocks}
          stage={stage}
          party
          remote={remote}
          onStatus={onStatus}
          onFrame={onFrame}
          onResult={onResult}
          setupLabel="Back to lobby"
          onSetup={backToLobby}
          onExit={backToLobby}
        />
        <div className="rr-roomtag">Room <b>{code}</b>{displayAttached ? ' · Display linked' : ''}</div>
      </div>
    );
  }

  const Seg = ({ value, set, opts }) => (
    <div className="rr-seg">
      {opts.map(([nextValue, label]) => (
        <button key={nextValue} type="button" aria-pressed={value === nextValue} onClick={() => set(nextValue)}>{label}</button>
      ))}
    </div>
  );

  return (
    <div className="rr-root">
      <div className="rr-scroll">
        <div className="rr-wrap" style={{ maxWidth: 1240 }}>
          <div className="rr-hostgrid">
            <div className="rr-card" style={{ textAlign: 'center' }}>
              <h1 className="rr-h rr-logo" style={{ fontSize: 'clamp(48px, 6vw, 92px)' }}>Rodeo<b>Rumble</b></h1>
              <p className="rr-sub">On each phone go to <b style={{ color: '#fff' }}>{JOIN_HOST}/join</b> and enter</p>
              <div className="rr-joincode">{code || '·····'}</div>
              {conn !== 'open' && <p className="rr-sub">{conn === 'connecting' ? 'Connecting to TNG…' : 'Reconnecting…'}</p>}
              {error && <p className="rr-sub" style={{ color: '#ff8a8a' }}>{error}</p>}
              <div className="rr-slots">
                {Array.from({ length: 8 }, (_, index) => {
                  const player = roster[index];
                  if (!player) return <div key={index} className="rr-pslot empty"><span>Open</span></div>;
                  const fighter = player.fighter ? fighterById(player.fighter) : null;
                  return (
                    <div key={player.id} className={`rr-pslot${player.online === false ? ' off' : ''}`} style={{ '--c': player.color }}>
                      {fighter ? <RRPortrait ch={fighter} size={110} animate={false} /> : <div className="q">?</div>}
                      <b>{player.name}</b>
                      <small>{player.isHost ? 'HOST · ' : ''}{fighter ? fighter.name : 'picking…'}{player.ready ? ' ✓' : ''}{player.online === false ? ' · offline' : ''}</small>
                      {!player.isHost && <button type="button" className="x" aria-label={`Remove ${player.name}`} onClick={() => sock.current?.send({ t: 'kick', id: player.id })}>✕</button>}
                    </div>
                  );
                })}
              </div>
              <p className="rr-sub">{livePlayers.length} live player{livePlayers.length === 1 ? '' : 's'} · {roster.filter((player) => player.ready).length} ready</p>
            </div>

            <div className="rr-card" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <div className="rr-label">Stage</div>
              <div className="rr-stages">
                {[...STAGE_LIST, { id: 'random', name: 'Random', blurb: 'Surprise me.' }].map((stageOption) => (
                  <button key={stageOption.id} type="button" className="rr-stagecard" aria-pressed={stage === stageOption.id} style={{ background: STAGE_LOOKS[stageOption.id] }} onClick={() => setStage(stageOption.id)}><b>{stageOption.name}</b></button>
                ))}
              </div>
              <div className="rr-row"><span className="rr-label">Stocks</span><Seg value={stocks} set={setStocks} opts={[[2, '2'], [3, '3'], [4, '4'], [5, '5']]} /></div>
              <div className="rr-label">Your fighter — Host plays too</div>
              <div className="rr-roster small">
                {ROSTER.map((fighter) => (
                  <button key={fighter.id} type="button" className="rr-fcard" style={{ '--c': fighter.color }} aria-pressed={roster.find((player) => player.isHost)?.fighter === fighter.id} onClick={() => sock.current?.send({ t: 'host-pick', fighter: fighter.id })}>
                    <RRPortrait ch={fighter} size={120} animate={false} />
                    <b>{fighter.name}</b>
                  </button>
                ))}
              </div>
              <p className="rr-sub" style={{ margin: 0 }}>You play on this screen with keyboard, touch controls or a gamepad. Other players see the match on their own devices. 2–8 fighters total, including you.</p>
              <button type="button" className="rr-btn primary" style={{ fontSize: 22, padding: 14 }} disabled={!code || livePlayers.length < 2} onClick={start}>Start the rumble!</button>
              <div className="rr-row">
                <button type="button" className="rr-btn ghost" onClick={closeRoom}>← Close room</button>
                <span className="rr-sub" style={{ margin: 0 }}>{displayAttached ? 'Paired Game Display linked.' : 'Host screen is live.'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
