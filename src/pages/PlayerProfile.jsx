import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Header from '@/components/home/Header';
import FriendsList from '@/components/friends/FriendsList';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const THEME_STYLES = {
  'neon-noir':       { bg: '#050308', accent: '#BC13FE', secondary: '#FFD700', glow: 'rgba(188,19,254,0.3)' },
  'retro-gold':      { bg: '#0a0800', accent: '#FFD700', secondary: '#FF5F1F', glow: 'rgba(255,215,0,0.3)' },
  'sunset-kinetic':  { bg: '#0a0400', accent: '#FF5F1F', secondary: '#FFD700', glow: 'rgba(255,95,31,0.3)' },
  'void-black':      { bg: '#020202', accent: '#ffffff', secondary: '#BC13FE', glow: 'rgba(255,255,255,0.15)' },
  'cyber-grid':      { bg: '#00080a', accent: '#22d3ee', secondary: '#4ade80', glow: 'rgba(34,211,238,0.3)' },
};

const GAME_LABELS = {
  bff: 'BFF', 'square-biz': 'SQUARE BIZ', hangman: 'HANGMAN', spades: 'SPADES',
  'word-search': 'WORD SEARCH', sudoku: 'SUDOKU', viral: 'VIRAL',
  'see-that': 'SEE THAT!', txd: 'TXD DOMINOES', 'name-that-track': 'NAME THAT TRACK',
  'word-wrangler': 'WORD WRANGLER', 'word-wrangler-game': 'WORD WRANGLER',
};

function StatCard({ label, value, color }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${color}30`, background: `${color}08`, textAlign: 'center' }}>
      <div style={{ ...PS2, fontSize: 7, color: `${color}80`, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 28, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function BadgeChip({ badge }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 20,
      border: `1px solid ${badge.type === 'win' ? '#FFD700' : '#BC13FE'}50`,
      background: badge.type === 'win' ? 'rgba(255,215,0,0.08)' : 'rgba(188,19,254,0.08)',
    }}>
      <span style={{ fontSize: 14 }}>{badge.type === 'win' ? '🏆' : '⭐'}</span>
      <span style={{ ...PS2, fontSize: 6, color: badge.type === 'win' ? '#FFD700' : '#BC13FE' }}>{badge.name}</span>
    </div>
  );
}

export default function PlayerProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const profileIdRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const profiles = await base44.entities.PlayerProfile.filter({ user_id: u.id });
        if (profiles.length > 0) {
          setProfile(profiles[0]);
          profileIdRef.current = profiles[0].id;
          setEditData({
            username: profiles[0].username || '',
            bio: profiles[0].bio || '',
            profile_theme: profiles[0].profile_theme || 'neon-noir',
            social_links: profiles[0].social_links || {},
          });
        }
      } catch (e) {
        navigate('/');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Real-time subscription — refresh profile when game stats update
  useEffect(() => {
    const unsubscribe = base44.entities.PlayerProfile.subscribe((event) => {
      if (event.type === 'update' && event.id === profileIdRef.current && event.data) {
        setProfile(prev => prev ? { ...prev, ...event.data } : event.data);
      }
    });
    return unsubscribe;
  }, []);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const updated = await base44.entities.PlayerProfile.update(profile.id, editData);
    setProfile({ ...profile, ...editData });
    setEditing(false);
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #BC13FE', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!profile) return null;

  const theme = THEME_STYLES[profile.profile_theme || 'neon-noir'];
  const gameStats = profile.game_stats || {};
  const badges = profile.badges || [];
  const memberSince = profile.member_since ? new Date(profile.member_since).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Unknown';
  const topGames = Object.entries(gameStats).sort((a, b) => (b[1].times_played || 0) - (a[1].times_played || 0)).slice(0, 10);
  // High scores: all games sorted by high_score desc
  const highScores = Object.entries(gameStats)
    .filter(([, s]) => (s.high_score || 0) > 0)
    .sort((a, b) => (b[1].high_score || 0) - (a[1].high_score || 0));

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: 'white' }}>
      <Header />

      {/* Profile banner */}
      <div style={{
        background: `linear-gradient(180deg, ${theme.glow.replace('0.3', '0.12')}, transparent)`,
        borderBottom: `1px solid ${theme.accent}20`,
        padding: '32px 16px 0',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Avatar + identity */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>

            {/* Avatar */}
            <div style={{
              width: 90, height: 90, borderRadius: '50%', flexShrink: 0,
              border: `3px solid ${theme.accent}`,
              boxShadow: `0 0 20px ${theme.glow}`,
              background: `linear-gradient(135deg, ${theme.accent}40, ${theme.secondary}20)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 36 }}>🎮</span>
              }
            </div>

            {/* Name + badges */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <h1 style={{ fontFamily: "'Teko', sans-serif", fontSize: 36, color: theme.accent, textShadow: `0 0 20px ${theme.glow}`, lineHeight: 1, margin: 0 }}>
                  {profile.username || user?.full_name || 'Nomad'}
                </h1>
                {profile.ambassador_status === 'ambassador' && (
                  <span style={{
                    padding: '3px 10px', borderRadius: 20,
                    background: 'linear-gradient(135deg, #FFD700, #FF5F1F)',
                    color: '#000', ...PS2, fontSize: 6,
                    boxShadow: '0 0 12px rgba(255,215,0,0.6)',
                  }}>⭐ AMBASSADOR</span>
                )}
              </div>
              <div style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>MEMBER SINCE {memberSince.toUpperCase()}</div>
              {profile.bio && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.55)', maxWidth: 400 }}>{profile.bio}</p>}

              {/* Social links */}
              {profile.social_links && Object.entries(profile.social_links).filter(([, v]) => v).map(([platform, url]) => (
                <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                  style={{ ...PS2, fontSize: 6, color: theme.secondary, marginRight: 12, textDecoration: 'none', opacity: 0.8 }}>
                  @{platform}
                </a>
              ))}
            </div>

            {/* Edit button */}
            <button onClick={() => setEditing(e => !e)}
              style={{
                padding: '8px 18px', borderRadius: 8,
                border: `2px solid ${theme.accent}60`,
                color: theme.accent, background: `${theme.accent}10`,
                ...PS2, fontSize: 7, cursor: 'pointer',
              }}>
              {editing ? '✕ CANCEL' : '✏ EDIT'}
            </button>
          </div>

          {/* Theme selector (inline when editing) */}
          {editing && (
            <div style={{ padding: '16px', borderRadius: 12, border: `1px solid ${theme.accent}30`, background: 'rgba(0,0,0,0.4)', marginBottom: 16 }}>
              <div style={{ ...PS2, fontSize: 7, color: theme.accent, marginBottom: 12 }}>EDIT PROFILE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>DISPLAY NAME</label>
                  <input value={editData.username} onChange={e => setEditData(p => ({ ...p, username: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.6)', border: `1px solid ${theme.accent}40`, color: 'white', fontFamily: "'Inter', sans-serif", fontSize: 13, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>VIBE / THEME</label>
                  <select value={editData.profile_theme} onChange={e => setEditData(p => ({ ...p, profile_theme: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: '#0a0a0a', border: `1px solid ${theme.accent}40`, color: 'white', fontFamily: "'Inter', sans-serif", fontSize: 13, outline: 'none' }}>
                    <option value="neon-noir">Neon Noir</option>
                    <option value="retro-gold">Retro Gold</option>
                    <option value="sunset-kinetic">Sunset Kinetic</option>
                    <option value="void-black">Void Black</option>
                    <option value="cyber-grid">Cyber Grid</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>BIO</label>
                <textarea value={editData.bio} onChange={e => setEditData(p => ({ ...p, bio: e.target.value }))} rows={2} maxLength={160}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.6)', border: `1px solid ${theme.accent}40`, color: 'white', fontFamily: "'Inter', sans-serif", fontSize: 13, outline: 'none', resize: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                {['twitter', 'instagram', 'tiktok'].map(platform => (
                  <div key={platform}>
                    <label style={{ ...PS2, fontSize: 5, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>{platform}</label>
                    <input value={editData.social_links?.[platform] || ''} onChange={e => setEditData(p => ({ ...p, social_links: { ...p.social_links, [platform]: e.target.value } }))}
                      placeholder={`https://${platform}.com/...`}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 5, background: 'rgba(0,0,0,0.6)', border: `1px solid ${theme.accent}20`, color: 'white', fontFamily: "'Inter', sans-serif", fontSize: 11, outline: 'none' }} />
                  </div>
                ))}
              </div>
              <button onClick={saveProfile} disabled={saving}
                style={{ padding: '10px 24px', borderRadius: 8, background: theme.accent, color: '#000', ...PS2, fontSize: 7, cursor: saving ? 'wait' : 'pointer', border: 'none' }}>
                {saving ? 'SAVING…' : 'SAVE CHANGES'}
              </button>
            </div>
          )}

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, paddingBottom: 16 }}>
            <StatCard label="GAMES PLAYED" value={profile.total_games_played || 0} color={theme.accent} />
            <StatCard label="BADGES" value={badges.length} color="#FFD700" />
            <StatCard label="REFERRALS" value={profile.referral_count || 0} color="#4ade80" />
          </div>
        </div>
      </div>

      {/* Main content — side by side: left col (content) + right col (portrait high scores) */}
      <style>{`
        @keyframes hs-scroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .hs-track { animation: hs-scroll ${Math.max(highScores.length * 3, 8)}s linear infinite; }
        .hs-track:hover { animation-play-state: paused; }
      `}</style>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px', display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16, alignItems: 'start' }}>

        {/* Left column — all content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Game Stats */}
          <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${theme.accent}20`, background: 'rgba(0,0,0,0.3)', gridColumn: '1 / -1' }}>
            <div style={{ ...PS2, fontSize: 8, color: theme.accent, marginBottom: 12 }}>🎮 GAME HISTORY</div>
            {topGames.length === 0 ? (
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No games played yet. Jump into the arcade!</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {topGames.map(([gameId, stats]) => (
                  <div key={gameId} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${theme.accent}20`, background: `${theme.accent}06` }}>
                    <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 18, color: 'white', marginBottom: 6 }}>{GAME_LABELS[gameId] || gameId.toUpperCase()}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ ...PS2, fontSize: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>HIGH SCORE</div>
                        <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 24, color: '#FFD700', lineHeight: 1 }}>{stats.high_score || 0}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ ...PS2, fontSize: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>PLAYED</div>
                        <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 20, color: theme.accent, lineHeight: 1 }}>{stats.times_played || 0}×</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ ...PS2, fontSize: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>WINS</div>
                        <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 20, color: '#4ade80', lineHeight: 1 }}>{stats.wins || 0}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Badges */}
          <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${theme.accent}20`, background: 'rgba(0,0,0,0.3)' }}>
            <div style={{ ...PS2, fontSize: 8, color: theme.accent, marginBottom: 12 }}>🏆 BADGE CASE</div>
            {badges.length === 0 ? (
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No badges yet. Win some games to earn them!</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {badges.map((badge, i) => <BadgeChip key={i} badge={badge} />)}
              </div>
            )}
          </div>

          {/* Playstyle */}
          {(profile.playstyle_tags || []).length > 0 && (
            <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${theme.secondary}20`, background: 'rgba(0,0,0,0.3)' }}>
              <div style={{ ...PS2, fontSize: 8, color: theme.secondary, marginBottom: 12 }}>⚡ PLAYSTYLE</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(profile.playstyle_tags || []).map((tag, i) => (
                  <span key={i} style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${theme.secondary}40`, background: `${theme.secondary}10`, ...PS2, fontSize: 6, color: theme.secondary }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Friends */}
          <div style={{ gridColumn: '1 / -1' }}>
            <FriendsList userId={user?.id} theme={theme} />
          </div>

          {/* Host Stats */}
          {profile.host_stats && (profile.host_stats.total_sessions > 0) && (
            <div style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(255,95,31,0.25)', background: 'rgba(0,0,0,0.3)' }}>
              <div style={{ ...PS2, fontSize: 8, color: '#FF5F1F', marginBottom: 12 }}>🎛 HOST ACTIVITY</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <StatCard label="SESSIONS HOSTED" value={profile.host_stats.total_sessions || 0} color="#FF5F1F" />
                <StatCard label="HOST TIME" value={`${Math.floor((profile.host_stats.total_host_time_minutes || 0) / 60)}h`} color="#FFD700" />
              </div>
              {profile.host_stats.last_hosted && (
                <p style={{ ...PS2, fontSize: 5, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
                  LAST HOSTED: {new Date(profile.host_stats.last_hosted).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Referral */}
          <div style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(74,222,128,0.2)', background: 'rgba(0,0,0,0.3)' }}>
            <div style={{ ...PS2, fontSize: 8, color: '#4ade80', marginBottom: 12 }}>🔗 REFERRAL CODE</div>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(74,222,128,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 16, color: '#4ade80', letterSpacing: 3 }}>{profile.referral_code || '—'}</span>
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}?ref=${profile.referral_code}`)}
                style={{ ...PS2, fontSize: 6, color: '#4ade80', background: 'transparent', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer' }}>
                COPY
              </button>
            </div>
            <p style={{ ...PS2, fontSize: 5, color: 'rgba(255,255,255,0.2)', marginTop: 8, lineHeight: 1.6 }}>
              Share your code. Earn rewards when new players join.
            </p>
          </div>
        </div>

        {/* Right column — portrait High Scores ticker */}
        <div style={{ position: 'sticky', top: 80, padding: 14, borderRadius: 12, border: '1px solid rgba(255,215,0,0.3)', background: 'rgba(0,0,0,0.4)', boxShadow: '0 0 20px rgba(255,215,0,0.08)' }}>
          <div style={{ ...PS2, fontSize: 7, color: '#FFD700', marginBottom: 10, textAlign: 'center', letterSpacing: '0.1em' }}>🥇 HIGH SCORES</div>
          {highScores.length === 0 ? (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Play games to set scores!</p>
          ) : (
            <div style={{ height: 480, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 30, background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)', zIndex: 2, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 30, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', zIndex: 2, pointerEvents: 'none' }} />
              <div className="hs-track">
                {[...highScores, ...highScores].map(([gameId, stats], i) => {
                  const rank = i % highScores.length;
                  return (
                    <div key={`${gameId}-${i}`} style={{ padding: '10px 8px', marginBottom: 6, borderRadius: 8, background: rank === 0 ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${rank === 0 ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.06)'}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>
                        {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`}
                      </div>
                      <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 15, color: 'white', lineHeight: 1.1, marginBottom: 4 }}>{GAME_LABELS[gameId] || gameId.toUpperCase()}</div>
                      <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 28, color: '#FFD700', lineHeight: 1, textShadow: rank === 0 ? '0 0 10px rgba(255,215,0,0.5)' : 'none' }}>{stats.high_score.toLocaleString()}</div>
                      <div style={{ ...PS2, fontSize: 5, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{stats.wins || 0}W · {stats.times_played || 0}P</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}