import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const GAME_LABELS = {
  bff: 'BFF', 'square-biz': 'SQUARE BIZ', hangman: 'HANGMAN', spades: 'SPADES',
  'word-search': 'WORD SEARCH', sudoku: 'SUDOKU', viral: 'VIRAL',
  'see-that': 'SEE THAT!', txd: 'TXD DOMINOES', 'name-that-track': 'NAME THAT TRACK',
  'word-wrangler': 'WORD WRANGLER',
};

export default function FriendsList({ userId, theme }) {
  const [friends, setFriends] = useState([]);
  const [pendingIn, setPendingIn] = useState([]);
  const [presenceMap, setPresenceMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const accent = theme?.accent || '#BC13FE';
  const secondary = theme?.secondary || '#FFD700';

  useEffect(() => {
    loadFriends();
    const interval = setInterval(loadFriends, 15000);
    return () => clearInterval(interval);
  }, [userId]);

  async function loadFriends() {
    const [sent, received] = await Promise.all([
      base44.entities.Friendship.filter({ requester_user_id: userId }),
      base44.entities.Friendship.filter({ recipient_user_id: userId }),
    ]);

    const accepted = [
      ...sent.filter(f => f.status === 'accepted').map(f => ({ friendUserId: f.recipient_user_id, username: f.recipient_username })),
      ...received.filter(f => f.status === 'accepted').map(f => ({ friendUserId: f.requester_user_id, username: f.requester_username })),
    ];
    setFriends(accepted);
    setPendingIn(received.filter(f => f.status === 'pending'));

    // Load presence for all friends
    if (accepted.length > 0) {
      const presences = await Promise.all(
        accepted.map(f => base44.entities.PlayerPresence.filter({ user_id: f.friendUserId }))
      );
      const map = {};
      presences.forEach((p, i) => {
        if (p.length > 0) {
          const pr = p[0];
          const onlineThreshold = Date.now() - 2 * 60 * 1000; // 2 min
          map[accepted[i].friendUserId] = {
            ...pr,
            is_online: pr.last_seen && new Date(pr.last_seen).getTime() > onlineThreshold,
          };
        }
      });
      setPresenceMap(map);
    }
    setLoading(false);
  }

  async function searchPlayers() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await base44.entities.PlayerProfile.filter({});
    const q = searchQuery.toLowerCase();
    const filtered = results.filter(p =>
      p.user_id !== userId &&
      (p.username?.toLowerCase().includes(q))
    ).slice(0, 8);
    setSearchResults(filtered);
    setSearching(false);
  }

  async function sendFriendRequest(targetProfile) {
    // Check not already friends/pending
    const existing = await base44.entities.Friendship.filter({ requester_user_id: userId, recipient_user_id: targetProfile.user_id });
    if (existing.length > 0) return;
    const myProfile = await base44.entities.PlayerProfile.filter({ user_id: userId });
    await base44.entities.Friendship.create({
      requester_user_id: userId,
      recipient_user_id: targetProfile.user_id,
      status: 'pending',
      requester_username: myProfile[0]?.username || 'Player',
      recipient_username: targetProfile.username || 'Player',
    });
    setSearchResults([]);
    setSearchQuery('');
    loadFriends();
  }

  async function acceptRequest(friendship) {
    await base44.entities.Friendship.update(friendship.id, { status: 'accepted' });
    loadFriends();
  }

  async function declineRequest(friendship) {
    await base44.entities.Friendship.update(friendship.id, { status: 'declined' });
    loadFriends();
  }

  async function joinFriendGame(presence) {
    const isFull = presence.current_players >= presence.max_players;
    if (isFull) {
      // Queue: just navigate to join page, host can manage
      window.location.href = `/join/${presence.current_room_code}?queue=1`;
    } else {
      window.location.href = `/join/${presence.current_room_code}`;
    }
  }

  const onlineFriends = friends.filter(f => presenceMap[f.friendUserId]?.is_online);
  const offlineFriends = friends.filter(f => !presenceMap[f.friendUserId]?.is_online);

  return (
    <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${accent}20`, background: 'rgba(0,0,0,0.3)' }}>
      <div style={{ ...PS2, fontSize: 8, color: accent, marginBottom: 14 }}>👥 FRIENDS</div>

      {/* Pending requests */}
      {pendingIn.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...PS2, fontSize: 6, color: '#FFD700', marginBottom: 8 }}>⏳ FRIEND REQUESTS</div>
          {pendingIn.map(req => (
            <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)', marginBottom: 6 }}>
              <span style={{ fontFamily: "'Teko', sans-serif", fontSize: 16, color: 'white' }}>{req.requester_username}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => acceptRequest(req)} style={{ ...PS2, fontSize: 6, padding: '4px 8px', borderRadius: 5, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.5)', color: '#4ade80', cursor: 'pointer' }}>✓ ACCEPT</button>
                <button onClick={() => declineRequest(req)} style={{ ...PS2, fontSize: 6, padding: '4px 8px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add friend search */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchPlayers()}
            placeholder="Search by username…"
            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.6)', border: `1px solid ${accent}30`, color: 'white', fontFamily: "'Inter', sans-serif", fontSize: 12, outline: 'none' }}
          />
          <button onClick={searchPlayers} disabled={searching} style={{ ...PS2, fontSize: 6, padding: '8px 12px', borderRadius: 8, background: `${accent}20`, border: `1px solid ${accent}50`, color: accent, cursor: 'pointer' }}>
            {searching ? '…' : '+ ADD'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ borderRadius: 8, border: `1px solid ${accent}20`, overflow: 'hidden' }}>
            {searchResults.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)' }}>
                <span style={{ fontFamily: "'Teko', sans-serif", fontSize: 16, color: 'white' }}>{p.username || 'Player'}</span>
                <button onClick={() => sendFriendRequest(p)} style={{ ...PS2, fontSize: 6, padding: '4px 8px', borderRadius: 5, background: `${accent}20`, border: `1px solid ${accent}50`, color: accent, cursor: 'pointer' }}>REQUEST</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Online friends */}
      {onlineFriends.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...PS2, fontSize: 6, color: '#4ade80', marginBottom: 8 }}>● ONLINE — {onlineFriends.length}</div>
          {onlineFriends.map(f => {
            const presence = presenceMap[f.friendUserId];
            const inGame = !!presence?.current_room_code;
            const isFull = inGame && presence.current_players >= presence.max_players;
            return (
              <div key={f.friendUserId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 17, color: 'white', lineHeight: 1 }}>{f.username}</div>
                    {inGame && (
                      <div style={{ ...PS2, fontSize: 5, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {GAME_LABELS[presence.current_game_id] || presence.current_game_id} · {presence.current_room_code}
                        {isFull && <span style={{ color: '#FF5F1F', marginLeft: 6 }}>FULL</span>}
                      </div>
                    )}
                  </div>
                </div>
                {inGame && (
                  <button onClick={() => joinFriendGame(presence)} style={{ ...PS2, fontSize: 6, padding: '5px 10px', borderRadius: 6, background: isFull ? 'rgba(255,95,31,0.15)' : 'rgba(74,222,128,0.15)', border: `1px solid ${isFull ? 'rgba(255,95,31,0.5)' : 'rgba(74,222,128,0.5)'}`, color: isFull ? '#FF5F1F' : '#4ade80', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {isFull ? '⏳ QUEUE' : '▶ JOIN'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Offline friends */}
      {offlineFriends.length > 0 && (
        <div>
          <div style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.2)', marginBottom: 8 }}>○ OFFLINE — {offlineFriends.length}</div>
          {offlineFriends.map(f => (
            <div key={f.friendUserId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 4, opacity: 0.5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
              <span style={{ fontFamily: "'Teko', sans-serif", fontSize: 17, color: 'white' }}>{f.username}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && friends.length === 0 && pendingIn.length === 0 && (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '16px 0' }}>
          Search for players above to add friends!
        </p>
      )}
    </div>
  );
}