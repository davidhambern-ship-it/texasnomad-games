import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, Mail, MessageCircle, Search, Send, UserPlus, Users, X } from 'lucide-react';

import { tngApi } from '@/api/tngApi';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const GAME_LABELS = {
  'square-biz': 'Square Biz!',
  spades: 'Spades',
  hangman: 'Hangman',
  'word-search': 'Word Search',
  bff: 'BFF',
};

function MiniButton({ children, onClick, disabled, tone = '#BC13FE' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border px-2.5 py-2 text-[6px] uppercase tracking-wider transition-all enabled:hover:scale-[1.02] disabled:opacity-30"
      style={{ ...PS2, color: tone, borderColor: `${tone}66`, background: `${tone}0c` }}
    >
      {children}
    </button>
  );
}

export default function TngSocialPanel() {
  const [social, setSocial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');

  const load = useCallback(async () => {
    try {
      const payload = await tngApi.social.get();
      setSocial(payload?.social || {});
      setError('');
    } catch (err) {
      setError(err?.message || 'TNG social could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 12000);
    return () => window.clearInterval(interval);
  }, [load]);

  const run = useCallback(async (key, action, payload = {}) => {
    setBusy(key);
    setError('');
    try {
      const result = await tngApi.social.action(action, payload);
      if (result?.social) setSocial(result.social);
      return result;
    } catch (err) {
      setError(err?.message || 'That social action did not go through.');
      return null;
    } finally {
      setBusy('');
    }
  }, []);

  const search = async () => {
    if (query.trim().length < 2) return;
    const result = await run('search', 'search_players', { query });
    setResults(Array.isArray(result?.players) ? result.players : []);
  };

  const openConversation = async (friend) => {
    setSelectedFriend(friend);
    setMessageDraft('');
    const result = await run(`conversation-${friend.accountId}`, 'conversation', {
      friendAccountId: friend.accountId,
    });
    setMessages(Array.isArray(result?.messages) ? result.messages : []);
    load();
  };

  const sendMessage = async () => {
    const body = messageDraft.trim();
    if (!selectedFriend || !body) return;

    const result = await run('send-message', 'send_message', {
      recipientAccountId: selectedFriend.accountId,
      body,
    });

    if (!result) return;
    setMessageDraft('');
    const refreshed = await tngApi.social.action('conversation', {
      friendAccountId: selectedFriend.accountId,
    }).catch(() => null);
    if (refreshed?.messages) setMessages(refreshed.messages);
  };

  const unreadCount = useMemo(
    () => (social?.notifications || []).filter((item) => !item.readAt).length,
    [social?.notifications],
  );

  if (loading) {
    return (
      <section className="mt-5 rounded-2xl border border-[#BC13FE]/25 bg-black/35 p-6 text-center text-white/35">
        Loading friends and messages…
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#BC13FE]/25 bg-black/35 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[#BC13FE]">
          <Users className="h-5 w-5" />
          <span className="text-[7px] tracking-widest" style={PS2}>TNG SOCIAL</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/35">
          {social?.currentRoom ? (
            <span className="rounded-full border border-green-400/25 bg-green-400/5 px-3 py-1 text-green-400">
              In {GAME_LABELS[social.currentRoom.gameId] || social.currentRoom.gameId} · {social.currentRoom.roomCode}
            </span>
          ) : (
            <span>Not currently in a live room</span>
          )}
          {unreadCount > 0 && (
            <span className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/5 px-2 py-1 text-[#FFD700]">
              {unreadCount} unread
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <div className="space-y-4">
          {(social?.incomingRequests || []).length > 0 && (
            <div className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/[.035] p-3">
              <div className="mb-2 flex items-center gap-2 text-[6px] tracking-widest text-[#FFD700]" style={PS2}>
                <UserPlus className="h-3.5 w-3.5" /> FRIEND REQUESTS
              </div>
              <div className="space-y-2">
                {social.incomingRequests.map((request) => (
                  <div key={request.friendshipId} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/30 p-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-white/85">{request.displayName}</div>
                      <div className="text-xs text-[#FFD700]/70">@{request.handle}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <MiniButton
                        tone="#4ade80"
                        disabled={!!busy}
                        onClick={() => run(request.friendshipId, 'respond_friend', {
                          friendshipId: request.friendshipId,
                          response: 'accepted',
                        })}
                      >
                        ✓
                      </MiniButton>
                      <MiniButton
                        tone="#ef4444"
                        disabled={!!busy}
                        onClick={() => run(request.friendshipId, 'respond_friend', {
                          friendshipId: request.friendshipId,
                          response: 'declined',
                        })}
                      >
                        ✕
                      </MiniButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(social?.invites || []).length > 0 && (
            <div className="rounded-xl border border-[#FF5F1F]/25 bg-[#FF5F1F]/[.035] p-3">
              <div className="mb-2 text-[6px] tracking-widest text-[#FF5F1F]" style={PS2}>GAME INVITES</div>
              <div className="space-y-2">
                {social.invites.map((invite) => (
                  <div key={invite.id} className="rounded-lg border border-white/8 bg-black/30 p-2.5">
                    <div className="text-sm font-bold text-white/80">{invite.sender.displayName}</div>
                    <div className="mt-1 text-xs text-white/35">
                      {GAME_LABELS[invite.gameId] || invite.gameId} · Room {invite.roomCode}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <MiniButton
                        tone="#4ade80"
                        disabled={!!busy}
                        onClick={async () => {
                          const result = await run(invite.id, 'respond_invite', {
                            inviteId: invite.id,
                            response: 'accepted',
                          });
                          if (result?.joinPath) window.location.href = result.joinPath;
                        }}
                      >
                        JOIN
                      </MiniButton>
                      <MiniButton
                        tone="#ef4444"
                        disabled={!!busy}
                        onClick={() => run(invite.id, 'respond_invite', {
                          inviteId: invite.id,
                          response: 'declined',
                        })}
                      >
                        DECLINE
                      </MiniButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[.02] p-3">
            <div className="text-[6px] tracking-widest text-white/35" style={PS2}>FIND PLAYERS</div>
            <div className="mt-2 flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && search()}
                placeholder="Search name or @handle"
                className="min-w-0 flex-1 rounded-lg border border-[#BC13FE]/25 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-[#BC13FE]"
              />
              <button
                type="button"
                onClick={search}
                disabled={busy === 'search'}
                className="rounded-lg border border-[#BC13FE]/50 px-3 text-[#BC13FE]"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>

            {results.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {results.map((player) => (
                  <div key={player.accountId} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/25 p-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white/80">{player.displayName}</div>
                      <div className="text-xs text-white/30">@{player.handle}</div>
                    </div>
                    {player.friendship ? (
                      <span className="text-[8px] uppercase text-white/25">{player.friendship.status}</span>
                    ) : (
                      <MiniButton
                        disabled={!!busy}
                        onClick={async () => {
                          const result = await run(player.accountId, 'request_friend', {
                            accountId: player.accountId,
                          });
                          if (result) {
                            setResults([]);
                            setQuery('');
                          }
                        }}
                      >
                        + FRIEND
                      </MiniButton>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[.02] p-3">
            <div className="mb-2 text-[6px] tracking-widest text-[#4ade80]" style={PS2}>
              FRIENDS · {(social?.friends || []).length}
            </div>
            <div className="space-y-2">
              {(social?.friends || []).map((friend) => (
                <div key={friend.accountId} className="rounded-lg border border-white/8 bg-black/25 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-white/85">{friend.displayName}</div>
                      <div className="text-xs text-white/30">@{friend.handle}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <MiniButton
                        tone="#22d3ee"
                        disabled={!!busy}
                        onClick={() => openConversation(friend)}
                      >
                        MESSAGE
                      </MiniButton>
                      <MiniButton
                        tone="#FF5F1F"
                        disabled={!!busy || !social?.currentRoom}
                        onClick={() => run(`invite-${friend.accountId}`, 'send_invite', {
                          recipientAccountId: friend.accountId,
                        })}
                      >
                        INVITE
                      </MiniButton>
                    </div>
                  </div>
                </div>
              ))}

              {(social?.friends || []).length === 0 && (
                <div className="py-5 text-center text-xs text-white/25">
                  Search for somebody above and start building your TNG crew.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex min-h-[360px] flex-col rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/[.025] p-3">
            <div className="flex items-center gap-2 text-[#22d3ee]">
              <MessageCircle className="h-4 w-4" />
              <span className="text-[6px] tracking-widest" style={PS2}>
                {selectedFriend ? `MESSAGES · @${selectedFriend.handle}` : 'DIRECT MESSAGES'}
              </span>
            </div>

            {!selectedFriend ? (
              <div className="flex flex-1 items-center justify-center px-5 text-center text-sm leading-relaxed text-white/25">
                Pick a friend and hit MESSAGE. DMs stay between TNG accounts; in-game notifications only show a small preview.
              </div>
            ) : (
              <>
                <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-lg border border-white/8 bg-black/25 p-3">
                  {messages.map((message) => {
                    const mine = message.senderAccountId !== selectedFriend.accountId;
                    return (
                      <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[82%] rounded-xl px-3 py-2 text-sm leading-relaxed ${mine ? 'bg-[#BC13FE]/15 text-white/80' : 'bg-white/[.06] text-white/70'}`}>
                          {message.body}
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && (
                    <div className="py-10 text-center text-xs text-white/20">No messages yet. Say something useful. Or weird.</div>
                  )}
                </div>

                <div className="mt-2 flex gap-2">
                  <textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={2}
                    maxLength={1200}
                    placeholder="Message your friend…"
                    className="min-w-0 flex-1 resize-none rounded-lg border border-[#22d3ee]/25 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-[#22d3ee]"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!messageDraft.trim() || busy === 'send-message'}
                    className="rounded-lg border border-[#22d3ee]/50 px-4 text-[#22d3ee] disabled:opacity-30"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/[.025] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#FFD700]">
                <Bell className="h-4 w-4" />
                <span className="text-[6px] tracking-widest" style={PS2}>NOTIFICATIONS</span>
              </div>
              {unreadCount > 0 && (
                <MiniButton
                  tone="#FFD700"
                  disabled={!!busy}
                  onClick={() => run('mark-all', 'mark_all_read')}
                >
                  MARK READ
                </MiniButton>
              )}
            </div>

            <div className="mt-2 max-h-[210px] space-y-1.5 overflow-y-auto">
              {(social?.notifications || []).slice(0, 12).map((notification) => {
                const actor = notification.actor?.handle
                  ? `@${notification.actor.handle}`
                  : notification.actor?.displayName || 'TNG';
                const label = notification.type.replace(/_/g, ' ').toUpperCase();
                return (
                  <div key={notification.id} className="rounded-lg border border-white/8 bg-black/25 px-3 py-2">
                    <div className="text-[6px] tracking-widest text-[#FFD700]/65" style={PS2}>{label}</div>
                    <div className="mt-1 text-xs text-white/55">{actor}</div>
                  </div>
                );
              })}

              {(social?.notifications || []).length === 0 && (
                <div className="py-4 text-center text-xs text-white/20">All quiet over here.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
