import React from 'react';
import '@/components/nomadCards/nc.css';

// Shared pre-game lobby styled from OUT!'s original green felt-table interface.
// Keep this presentation common to OUT!, Rodeo Rumble, Battle Sudoku and the
// other games; only the title and game-specific instructions change.
export default function SharedRoomLobby({
  room,
  game,
  people = [],
  isHost = false,
  busy = false,
  onStart,
  rosterError = '',
  error = '',
}) {
  const roomCode = String(room?.roomCode || room?.room_code || '').toUpperCase();
  const hasOtherPlayer = people.some((person) =>
    !['host', 'host_player'].includes(String(person.role || '').toLowerCase()) &&
    Number(person.seatNumber) !== 1
  );
  const isHostPerson = (person) =>
    ['host', 'host_player'].includes(String(person.role || '').toLowerCase()) ||
    Number(person.seatNumber) === 1;
  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      window.prompt('Copy this text:', value);
    }
  };

  return (
    <div className="nc-root" style={{ minHeight: 'auto', borderRadius: 18, padding: 12 }}>
      <div className="nc-wrap" style={{ maxWidth: 1180, padding: '8px 4px 18px' }}>
        <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
          <div className="nc-label" style={{ color: 'var(--nc-gold)' }}>TEXASNOMAD GAMES · MULTIPLAYER TABLE</div>
          <h1 className="nc-h nc-logo" style={{ fontSize: 'clamp(48px, 7vw, 82px)' }}>{game?.title || room?.gameId || 'GAME ROOM'}</h1>
          <p className="nc-sub">{game?.subtitle || 'LIVE MULTIPLAYER'}</p>
          <span className="nc-chip" style={{ '--c': '#63c98a', marginTop: 8 }}>
            <span className="nc-dot" style={{ background: '#63c98a' }} />
            WAITING FOR PLAYERS
          </span>
        </div>

        <div className="nc-lobby">
          <section className="nc-panel" style={{ textAlign: 'center' }}>
            <div className="nc-label">SHARE THIS ROOM CODE</div>
            <div className="nc-joincode">{roomCode || '------'}</div>
            <div className="nc-row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button type="button" className="nc-btn primary" onClick={() => copy(roomCode)}>Copy Code</button>
              <button type="button" className="nc-btn ghost" onClick={() => copy(`${window.location.origin}/join/${roomCode}`)}>Copy Invite Link</button>
            </div>
            <p className="nc-sub" style={{ marginTop: 14 }}>Share the code with everyone joining this table.</p>
            <div style={{ borderTop: '1px solid var(--nc-line)', marginTop: 18, paddingTop: 16, textAlign: 'left' }}>
              <div className="nc-label">HOW TO PLAY · {game?.title || 'THIS GAME'}</div>
              <p className="nc-sub" style={{ marginTop: 8 }}>{game?.lobbyRules || game?.subtitle || 'Follow the game instructions once the host starts.'}</p>
              <p className="nc-sub" style={{ fontSize: 13 }}>When the host starts, everyone moves into the original {game?.title || 'game'} cabinet.</p>
            </div>
          </section>

          <section className="nc-panel nc-settings">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <h4 style={{ margin: 0 }}>Players at the table</h4>
              <span className="nc-chip" style={{ '--c': '#63c98a' }}>{people.length} JOINED</span>
            </div>
            {rosterError ? (
              <div className="nc-err">{rosterError}</div>
            ) : people.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {people.map((person, index) => {
                  const host = isHostPerson(person);
                  return (
                    <div key={person.accountId || person.handle || `${person.role}-${index}`} className="nc-chip" style={{ '--c': host ? 'var(--nc-gold)' : '#63c98a', justifyContent: 'flex-start', borderRadius: 12, padding: '10px 12px' }}>
                      <span className="nc-dot" style={{ background: host ? 'var(--nc-gold)' : '#63c98a' }} />
                      <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {person.displayName || person.name || person.handle || (host ? 'Host' : 'Player')}
                      </span>
                      <small style={{ color: host ? 'var(--nc-gold)' : 'var(--nc-dim)', whiteSpace: 'nowrap' }}>
                        {host ? 'HOST · PLAYER 1' : person.seatNumber ? `PLAYER ${person.seatNumber}` : 'PLAYER'}
                      </small>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="nc-sub">Waiting for players to join this table…</p>
            )}

            {error && <div className="nc-err">{error}</div>}
            <div className="nc-panel" style={{ padding: 12, marginTop: 4 }}>
              <h4>Room status</h4>
              <p className="nc-sub">
                {isHost
                  ? hasOtherPlayer ? 'Players are here. You can start when ready.' : 'Waiting for at least one other player to join.'
                  : 'You have joined the player list. The game will open here when the host starts.'}
              </p>
              {isHost ? (
                <button type="button" className="nc-btn primary big" style={{ width: '100%', marginTop: 8 }} onClick={onStart} disabled={busy || !hasOtherPlayer}>
                  {busy ? 'Starting…' : 'Start Game'}
                </button>
              ) : (
                <div className="nc-btn ghost" style={{ textAlign: 'center', marginTop: 8, cursor: 'default' }}>Waiting for host</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
