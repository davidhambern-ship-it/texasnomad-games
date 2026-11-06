import React from 'react';
import { sfx } from './bsSfx';

const DIFFS = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];
const SOLVES = [30, 40, 60], BATTLES = [10, 15, 20], VOLLEYS = [6, 8, 10];

function Setting({ label, value, options, field, act }) {
  return <div className="bs-room-setting">
    <span className="bs-label">{label}</span>
    <div className="bs-seg">{options.map(([v, title]) => <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => act('settings', { [field]: v })}>{title}</button>)}</div>
  </div>;
}

export default function BSLobby({ room, isHost, act, onExit, joinUrl, playerName = '', selfPlayerId = '' }) {
  const settings = room.settings || {};
  const players = room.roster || [];
  return (
    <div className="bs-room-lobby">
      <header className="bs-room-top">
        <span className="bs-h bs-room-brand">Battle<b>Sudoku</b></span>
        <span className="bs-room-state">{players.length} / 8 captains joined</span>
        <button type="button" className="bs-btn ghost small" onClick={onExit}>Exit room</button>
      </header>
      <div className="bs-room-columns">
        <section className="bs-card bs-room-main">
          <div className="bs-room-kicker">Your live room is ready</div>
          <h1 className="bs-h bs-room-title">Waiting for your crew</h1>
          <p className="bs-sub">Share this room code. Everyone joins from their own device — no account or second screen needed.</p>
          <div className="bs-room-code" aria-label={`Room code ${room.code}`}>{room.code}</div>
          <div className="bs-room-link">{joinUrl}</div>
          <div className="bs-room-roster-head"><b>Players in this room</b><span>{players.length} / 8</span></div>
          <div className="bs-room-roster">
            {players.length ? players.map(p => (
              <div className="bs-room-player" key={p.id}>
                <span className="bs-dot" style={{ background: p.color }} />
                <span className="bs-room-player-name">{p.name}{p.cpu ? ' · CPU' : ''}</span>
                <span className={`bs-room-online ${p.online ? 'online' : ''}`}>{p.online ? 'Connected' : 'Reconnecting'}</span>
                {isHost && !p.cpu && p.id !== selfPlayerId && <button type="button" className="bs-btn ghost small" onClick={() => act('kick', { playerId: p.id })} aria-label={`Remove ${p.name}`}>Remove</button>}
              </div>
            )) : <div className="bs-room-empty">Waiting for the first captain to join…</div>}
          </div>
          <div className="bs-room-how"><b>What happens next?</b><span>Players join with the code, then everyone gets the same Sudoku gameplay screen when the host starts.</span></div>
        </section>
        <aside className="bs-card bs-room-controls">
          {isHost ? <>
            <div className="bs-room-kicker">Host controls</div>
            <h2 className="bs-h bs-room-control-title">Set up the battle</h2>
            <Setting label="Puzzle difficulty" value={settings.difficulty} field="difficulty" options={DIFFS} act={act} />
            <Setting label="Solve phase" value={settings.solveSec} field="solveSec" options={SOLVES.map(n => [n, `${n}s`])} act={act} />
            <Setting label="Battle phase" value={settings.battleSec} field="battleSec" options={BATTLES.map(n => [n, `${n}s`])} act={act} />
            <Setting label="Volleys" value={settings.volleys} field="volleys" options={VOLLEYS.map(n => [n, String(n)])} act={act} />
            <button type="button" className="bs-btn" disabled={players.length >= 8} onClick={() => act('addCpu')}>+ Add CPU captain</button>
            <button type="button" className="bs-btn primary bs-room-start" disabled={players.length < 2} onClick={() => { sfx.unlock(); act('start'); }}>{players.length < 2 ? 'Waiting for another player' : 'Start battle'}</button>
            <p className="bs-sub bs-room-note">{players.length < 2 ? 'You need at least 2 captains to begin.' : 'Everyone is connected. Start when your crew is ready.'}</p>
          </> : <>
            <div className="bs-room-kicker">You’re in</div>
            <h2 className="bs-h bs-room-control-title">Waiting for the host</h2>
            <p className="bs-sub">You’re playing as <b>{playerName || 'Guest'}</b>. Stay here; the game will open automatically when the host starts the battle.</p>
            <div className="bs-room-wait"><span className="bs-room-pulse" /> Room updates automatically</div>
            <button type="button" className="bs-btn ghost" onClick={onExit}>Leave room</button>
          </>}
        </aside>
      </div>
    </div>
  );
}
