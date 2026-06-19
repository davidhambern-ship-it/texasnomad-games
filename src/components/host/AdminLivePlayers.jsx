import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const GAME_LABELS = {
  bff: 'BFF', 'square-biz': 'SQUARE BIZ', hangman: 'HANGMAN', spades: 'SPADES',
  'word-search': 'WORD SEARCH', sudoku: 'SUDOKU', viral: 'VIRAL',
  'see-that': 'SEE THAT!', txd: 'TXD DOMINOES', 'name-that-track': 'NTT',
  'word-wrangler': 'WORD WRANGLER',
};

function PlayerTag({ presence, profile, color }) {
  if (!presence) return (
    <div style={{ padding: '6px 14px', borderRadius: 8, border: `1px dashed ${color}40`, color: `${color}40`, ...PS2, fontSize: 6 }}>PICK A PLAYER</div>
  );
  return (
    <div style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${color}60`, background: `${color}10`, color, ...PS2, fontSize: 6 }}>
      {profile?.username || presence.username || 'Player'}
    </div>
  );
}

export default function AdminLivePlayers({ onBack }) {
  const [presences, setPresences] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [matchA, setMatchA] = useState(null);
  const [matchB, setMatchB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    const all = await base44.entities.PlayerPresence.list();
    const onlineThreshold = Date.now() - 3 * 60 * 1000;
    const live = all.filter(p => p.last_seen && new Date(p.last_seen).getTime() > onlineThreshold);
    setPresences(live);
    if (live.length > 0) {
      const profs = await base44.entities.PlayerProfile.list();
      const map = {};
      profs.forEach(p => { map[p.user_id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  }

  const filtered = presences.filter(p => {
    if (filter === 'in-game') return !!p.current_room_code;
    if (filter === 'browsing') return !p.current_room_code;
    return true;
  });

  function toggleMatchSelect(presence) {
    if (matchA?.user_id === presence.user_id) { setMatchA(null); return; }
    if (matchB?.user_id === presence.user_id) { setMatchB(null); return; }
    if (!matchA) { setMatchA(presence); return; }
    if (!matchB) { setMatchB(presence); return; }
  }

  const isSelected = (p) => matchA?.user_id === p.user_id || matchB?.user_id === p.user_id;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={onBack} style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.4)', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>
          ← BACK
        </button>
        <div>
          <h1 style={{ fontFamily: "'Teko', sans-serif", fontSize: 32, color: '#4ade80', lineHeight: 1, margin: 0, textShadow: '0 0 20px rgba(74,222,128,0.4)' }}>LIVE PLAYERS</h1>
          <p style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{presences.length} ONLINE NOW · REFRESHES EVERY 15s</p>
        </div>
        <div style={{ marginLeft: 'auto', width: 12, height: 12, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80', animation: 'pulse-dot 2s infinite' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['all', 'ALL'], ['in-game', 'IN GAME'], ['browsing', 'BROWSING']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ ...PS2, fontSize: 6, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${filter === val ? '#4ade80' : 'rgba(255,255,255,0.1)'}`, background: filter === val ? 'rgba(74,222,128,0.1)' : 'transparent', color: filter === val ? '#4ade80' : 'rgba(255,255,255,0.35)' }}>
            {label}
          </button>
        ))}
      </div>

      {(matchA || matchB) && (
        <div style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid rgba(255,215,0,0.4)', background: 'rgba(255,215,0,0.06)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ ...PS2, fontSize: 7, color: '#FFD700' }}>⚔ MATCH MAKER</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <PlayerTag presence={matchA} profile={matchA ? profiles[matchA.user_id] : null} color="#FFD700" />
            <span style={{ ...PS2, fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>VS</span>
            <PlayerTag presence={matchB} profile={matchB ? profiles[matchB.user_id] : null} color="#FF5F1F" />
          </div>
          {matchA && matchB && (
            <div style={{ ...PS2, fontSize: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
              READY TO MATCH!
            </div>
          )}
          <button onClick={() => { setMatchA(null); setMatchB(null); }}
            style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕ CLEAR</button>
        </div>
      )}

      {!matchA && !matchB && (
        <div style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.2)', marginBottom: 16 }}>💡 TAP ANY TWO PLAYERS TO MATCH THEM</div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #4ade80', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👁</div>
          <p style={{ ...PS2, fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>NO LIVE PLAYERS</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filtered.map(presence => {
            const profile = profiles[presence.user_id];
            const selected = isSelected(presence);
            const inGame = !!presence.current_room_code;
            return (
              <div key={presence.user_id} onClick={() => toggleMatchSelect(presence)} style={{ padding: '14px 16px', borderRadius: 12, cursor: 'pointer', border: selected ? '2px solid #FFD700' : `1px solid ${inGame ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}`, background: selected ? 'rgba(255,215,0,0.06)' : inGame ? 'rgba(74,222,128,0.04)' : 'rgba(0,0,0,0.3)', boxShadow: selected ? '0 0 20px rgba(255,215,0,0.2)' : 'none', transition: 'all 0.15s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', flexShrink: 0 }} />
                  <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 22, color: 'white', lineHeight: 1, flex: 1 }}>
                    {profile?.username || presence.username || 'Player'}
                  </div>
                  {selected && <span style={{ fontSize: 14 }}>✓</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ ...PS2, fontSize: 5, padding: '3px 7px', borderRadius: 5, background: 'rgba(188,19,254,0.1)', border: '1px solid rgba(188,19,254,0.2)', color: '#BC13FE' }}>{profile?.total_games_played || 0} GAMES</span>
                  <span style={{ ...PS2, fontSize: 5, padding: '3px 7px', borderRadius: 5, background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', color: '#FFD700' }}>{(profile?.badges || []).length} BADGES</span>
                  {profile?.ambassador_status === 'ambassador' && (
                    <span style={{ ...PS2, fontSize: 5, padding: '3px 7px', borderRadius: 5, background: 'rgba(255,95,31,0.1)', border: '1px solid rgba(255,95,31,0.3)', color: '#FF5F1F' }}>⭐ AMB</span>
                  )}
                </div>
                {inGame ? (
                  <div style={{ ...PS2, fontSize: 5, color: '#4ade80', padding: '5px 8px', borderRadius: 6, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                    🎮 {GAME_LABELS[presence.current_game_id] || presence.current_game_id} · {presence.current_room_code}
                    {presence.current_context === 'host' && <span style={{ color: '#FFD700', marginLeft: 6 }}>[HOST]</span>}
                  </div>
                ) : (
                  <div style={{ ...PS2, fontSize: 5, color: 'rgba(255,255,255,0.2)' }}>BROWSING SITE</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}