import React, { useEffect, useRef, useState } from 'react';
import { rrConnect } from '@/api/rodeoRumbleLive';
import { createRenderer, pctColor } from './draw';
import RRPortrait from './RRPortrait';
import { fighterById } from '@/lib/brawl/fighters';

/** Read-only Rodeo Rumble renderer for the paired TNG Game Display / spectator route. */
export default function RRDisplay({ code }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const rendererRef = useRef(createRenderer());
  const [lobby, setLobby] = useState(null);
  const [result, setResult] = useState(null);
  const [hostOnline, setHostOnline] = useState(true);
  const [error, setError] = useState('');
  const [count, setCount] = useState(null);
  const [hud, setHud] = useState([]);

  useEffect(() => {
    const socket = rrConnect({
      hello: () => ({ t: 'display', code }),
      onMessage: (message) => {
        if (message.t === 'displayed') {
          setLobby(message.lobby || null);
          setResult(message.result || null);
          setHostOnline(Boolean(message.host));
          if (message.frame) frameRef.current = message.frame;
        } else if (message.t === 'lobby') {
          setLobby(message.lobby || null);
          if (message.lobby?.phase === 'lobby') {
            setResult(null);
            frameRef.current = null;
          }
        } else if (message.t === 'frame') {
          frameRef.current = message.frame || null;
          setCount(message.frame?.count ?? null);
          const game = message.frame?.game;
          const tags = message.frame?.tags || {};
          if (game?.fighters) {
            setHud(game.fighters.map((fighter) => ({
              id: fighter.id,
              name: `${tags[fighter.id]?.label || fighter.name || 'PLAYER'} · ${fighter.ch?.name || ''}`,
              color: tags[fighter.id]?.color || fighter.color || '#fff',
              dmg: Math.floor(Number(fighter.dmg) || 0),
              stocks: Number(fighter.stocks) || 0,
              out: Number(fighter.stocks) <= 0,
            })));
          }
        } else if (message.t === 'result') {
          setResult(message.result || null);
        } else if (message.t === 'host') {
          setHostOnline(Boolean(message.online));
        } else if (message.t === 'error') {
          setError(message.message || 'Rodeo Rumble display disconnected.');
        }
      },
    });
    return () => socket.close();
  }, [code]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const frame = frameRef.current;
      if (!frame?.game) return;
      const dpr = canvas.width / Math.max(1, canvas.clientWidth);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();
      ctx.scale(dpr, dpr);
      rendererRef.current.render(ctx, frame.game, canvas.clientWidth, canvas.clientHeight, {
        tags: frame.tags || {},
        hudH: frame.game.fighters?.length > 4 ? 52 : 64,
      });
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const inFight = Boolean(frameRef.current?.game) && lobby?.phase !== 'lobby';

  if (!inFight) {
    const players = Array.isArray(lobby?.players) ? lobby.players : [];
    return (
      <div className="rr-root">
        <div className="rr-scroll">
          <div className="rr-wrap" style={{ maxWidth: 1180 }}>
            <div className="rr-card" style={{ textAlign: 'center', marginTop: 20 }}>
              <h1 className="rr-h rr-logo" style={{ fontSize: 'clamp(54px,8vw,100px)' }}>Rodeo<b>Rumble</b></h1>
              <p className="rr-sub">ROOM <b style={{ color: 'var(--rr-gold)', letterSpacing: '.2em' }}>{code}</b></p>
              {!hostOnline && <p className="rr-sub" style={{ color: '#ff8a8a' }}>Host reconnecting…</p>}
              {error && <p className="rr-sub" style={{ color: '#ff8a8a' }}>{error}</p>}
              <div className="rr-slots" style={{ marginTop: 18 }}>
                {players.map((player) => {
                  const fighter = player.fighter ? fighterById(player.fighter) : null;
                  return (
                    <div key={player.id} className={`rr-pslot${player.online === false ? ' off' : ''}`} style={{ '--c': player.color }}>
                      {fighter ? <RRPortrait ch={fighter} size={110} animate={false} /> : <div className="q">?</div>}
                      <b>{player.name}</b>
                      <small>{fighter ? fighter.name : 'picking…'}{player.ready ? ' ✓' : ''}</small>
                    </div>
                  );
                })}
              </div>
              <p className="rr-sub">Waiting for the Host to start the rumble…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rr-root rr-stage">
      <canvas ref={canvasRef} />
      <div className={`rr-hud${hud.length > 4 ? ' compact' : ''}`}>
        {hud.map((player) => (
          <div key={player.id} className={`rr-pcard${player.out ? ' out' : ''}`} style={{ '--c': player.color }}>
            <div className="who"><b>{player.name}</b><div className="stocks">{Array.from({ length: player.stocks }, (_, index) => <i key={index} />)}</div></div>
            <div className="pct" style={{ color: pctColor(player.dmg) }}>{player.dmg}<small>%</small></div>
          </div>
        ))}
      </div>
      {count != null && <div className="rr-count">{count > 0 ? count : 'GO!'}</div>}
      <div className="rr-roomtag">Room <b>{code}</b></div>
      {result && (
        <div className="rr-overlay">
          <div className="rr-card rr-results">
            <h2 className="rr-h" style={{ fontSize: 'clamp(48px, 9vw, 80px)', color: 'var(--rr-gold)' }}>
              {result.winner ? `${result.ranked?.find((entry) => entry.id === result.winner)?.name || 'Winner'} wins!` : 'Draw!'}
            </h2>
            <table>
              <thead><tr><th>#</th><th style={{ textAlign: 'left' }}>Fighter</th><th>KOs</th><th>Falls</th><th>Damage</th></tr></thead>
              <tbody>{(result.ranked || []).map((entry, index) => <tr key={entry.id}><td>{index + 1}</td><td style={{ textAlign: 'left', fontWeight: 900 }}>{entry.name}</td><td>{entry.kos}</td><td>{entry.falls}</td><td>{entry.dealt}%</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}