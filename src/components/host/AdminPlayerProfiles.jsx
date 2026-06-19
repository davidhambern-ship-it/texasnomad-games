import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const GAME_LABELS = {
  bff: 'BFF', 'square-biz': 'SQUARE BIZ', hangman: 'HANGMAN', spades: 'SPADES',
  'word-search': 'WORD SEARCH', sudoku: 'SUDOKU', viral: 'VIRAL',
  'see-that': 'SEE THAT!', txd: 'TXD DOMINOES', 'name-that-track': 'NTT',
  'word-wrangler': 'WORD WRANGLER',
};

function ProfileDetail({ profile, onBack }) {
  const gameStats = profile.game_stats || {};
  const topGames = Object.entries(gameStats).sort((a, b) => (b[1].times_played || 0) - (a[1].times_played || 0));

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <button onClick={onBack} style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.4)', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', marginBottom: 20 }}>
        ← ALL PROFILES
      </button>

      <div style={{ padding: 20, borderRadius: 14, border: '1px solid rgba(188,19,254,0.3)', background: 'rgba(0,0,0,0.4)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid #BC13FE', background: 'rgba(188,19,254,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>🎮</span>}
          </div>
          <div>
            <h2 style={{ fontFamily: "'Teko', sans-serif", fontSize: 36, color: '#BC13FE', lineHeight: 1, margin: 0 }}>{profile.username || 'Unnamed'}</h2>
            {profile.bio && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{profile.bio}</p>}
          </div>
          {profile.ambassador_status === 'ambassador' && (
            <span style={{ ...PS2, fontSize: 6, padding: '5px 10px', borderRadius: 20, background: 'linear-gradient(135deg,#FFD700,#FF5F1F)', color: '#000', marginLeft: 'auto' }}>⭐ AMB</span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[['GAMES', profile.total_games_played || 0, '#BC13FE'], ['BADGES', (profile.badges || []).length, '#FFD700'], ['REFERRALS', profile.referral_count || 0, '#4ade80'], ['MIN PLAYED', profile.total_play_time_minutes || 0, '#FF5F1F']].map(([label, val, color]) => (
            <div key={label} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: `${color}08`, border: `1px solid ${color}20` }}>
              <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 26, color, lineHeight: 1 }}>{val}</div>
              <div style={{ ...PS2, fontSize: 4, color: 'rgba(255,255,255,0.3)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {profile.referral_code && (
        <div style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(74,222,128,0.2)', background: 'rgba(0,0,0,0.3)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ ...PS2, fontSize: 6, color: '#4ade80' }}>🔗 CODE:</span>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 16, color: '#4ade80', letterSpacing: 3 }}>{profile.referral_code}</span>
        </div>
      )}

      {(profile.badges || []).length > 0 && (
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(255,215,0,0.15)', background: 'rgba(0,0,0,0.3)', marginBottom: 16 }}>
          <div style={{ ...PS2, fontSize: 7, color: '#FFD700', marginBottom: 10 }}>🏆 BADGES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(profile.badges || []).map((b, i) => (
              <span key={i} style={{ ...PS2, fontSize: 5, padding: '4px 8px', borderRadius: 12, border: `1px solid ${b.type === 'win' ? 'rgba(255,215,0,0.4)' : 'rgba(188,19,254,0.4)'}`, background: b.type === 'win' ? 'rgba(255,215,0,0.08)' : 'rgba(188,19,254,0.08)', color: b.type === 'win' ? '#FFD700' : '#BC13FE' }}>
                {b.type === 'win' ? '🏆' : '⭐'} {b.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {topGames.length > 0 && (
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}>
          <div style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>🎮 GAME STATS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {topGames.map(([gameId, stats]) => (
              <div key={gameId} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 15, color: 'white', marginBottom: 6 }}>{GAME_LABELS[gameId] || gameId.toUpperCase()}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><div style={{ ...PS2, fontSize: 4, color: 'rgba(255,255,255,0.3)' }}>BEST</div><div style={{ fontFamily: "'Teko', sans-serif", fontSize: 20, color: '#FFD700', lineHeight: 1 }}>{stats.high_score || 0}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ ...PS2, fontSize: 4, color: 'rgba(255,255,255,0.3)' }}>PLAYED</div><div style={{ fontFamily: "'Teko', sans-serif", fontSize: 20, color: '#BC13FE', lineHeight: 1 }}>{stats.times_played || 0}</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ ...PS2, fontSize: 4, color: 'rgba(255,255,255,0.3)' }}>WINS</div><div style={{ fontFamily: "'Teko', sans-serif", fontSize: 20, color: '#4ade80', lineHeight: 1 }}>{stats.wins || 0}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPlayerProfiles({ onBack }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [sortBy, setSortBy] = useState('games');

  useEffect(() => {
    base44.entities.PlayerProfile.list().then(p => { setProfiles(p); setLoading(false); });
  }, []);

  const filtered = profiles
    .filter(p => !search || (p.username || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'games') return (b.total_games_played || 0) - (a.total_games_played || 0);
      if (sortBy === 'badges') return ((b.badges || []).length) - ((a.badges || []).length);
      if (sortBy === 'referrals') return (b.referral_count || 0) - (a.referral_count || 0);
      if (sortBy === 'name') return (a.username || '').localeCompare(b.username || '');
      return 0;
    });

  if (selected) return <ProfileDetail profile={selected} onBack={() => setSelected(null)} />;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={onBack} style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.4)', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>← BACK</button>
        <div>
          <h1 style={{ fontFamily: "'Teko', sans-serif", fontSize: 32, color: '#BC13FE', lineHeight: 1, margin: 0, textShadow: '0 0 20px rgba(188,19,254,0.4)' }}>PLAYER PROFILES</h1>
          <p style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{profiles.length} REGISTERED PLAYERS</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by username…"
          style={{ flex: 1, minWidth: 180, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(188,19,254,0.3)', color: 'white', fontFamily: "'Inter', sans-serif", fontSize: 13, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[['games', 'GAMES'], ['badges', 'BADGES'], ['referrals', 'REFS'], ['name', 'A–Z']].map(([val, label]) => (
            <button key={val} onClick={() => setSortBy(val)}
              style={{ ...PS2, fontSize: 5, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${sortBy === val ? '#BC13FE' : 'rgba(255,255,255,0.1)'}`, background: sortBy === val ? 'rgba(188,19,254,0.15)' : 'transparent', color: sortBy === val ? '#BC13FE' : 'rgba(255,255,255,0.35)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #BC13FE', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: 'center', ...PS2, fontSize: 8, color: 'rgba(255,255,255,0.2)', padding: 40 }}>NO PROFILES FOUND</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
          {filtered.map(profile => (
            <div key={profile.id} onClick={() => setSelected(profile)}
              style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(188,19,254,0.2)', background: 'rgba(0,0,0,0.35)', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#BC13FE'; e.currentTarget.style.boxShadow = '0 0 20px rgba(188,19,254,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(188,19,254,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(188,19,254,0.2)', border: '2px solid rgba(188,19,254,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16 }}>🎮</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 20, color: 'white', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.username || 'Unnamed'}</div>
                  {profile.ambassador_status === 'ambassador' && <span style={{ ...PS2, fontSize: 5, color: '#FFD700' }}>⭐ AMBASSADOR</span>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
                {[['#BC13FE', profile.total_games_played || 0, 'GAMES'], ['#FFD700', (profile.badges || []).length, 'BADGES'], ['#4ade80', profile.referral_count || 0, 'REFS']].map(([color, val, label]) => (
                  <div key={label} style={{ padding: '4px 0', borderRadius: 6, background: `${color}08` }}>
                    <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 20, color, lineHeight: 1 }}>{val}</div>
                    <div style={{ ...PS2, fontSize: 4, color: 'rgba(255,255,255,0.3)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}