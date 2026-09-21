import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, LockKeyhole, Shuffle, Users } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import { getCardImage } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const SUIT_ORDER = { '♣': 0, '♦': 1, '♥': 2, '♠': 3, Joker: 4 };
const VALUE_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
  LJ: 15, BJ: 16,
};

function sortHand(hand) {
  return [...(hand || [])].sort((a, b) => {
    const suitDiff = (SUIT_ORDER[a.suit] ?? 9) - (SUIT_ORDER[b.suit] ?? 9);
    if (suitDiff !== 0) return suitDiff;
    return (VALUE_ORDER[a.value] ?? 0) - (VALUE_ORDER[b.value] ?? 0);
  });
}

export default function NeonSpadesHostPanel({ controllerId }) {
  const [state, setState] = useState(null);
  const [hand, setHand] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sortedHand = useMemo(() => sortHand(hand), [hand]);
  const players = state?.gameState?.players || [];
  const tableReady = players.length === 4;
  const dealt = state?.gameState?.phase === 'dealt';

  async function refresh() {
    if (!controllerId) return;

    try {
      const payload = await tngApi.spades.getHostState(controllerId);
      setState(payload.room);
      setHand(payload.hand || []);
      setError('');
    } catch (stateError) {
      setError(stateError.message || 'The Spades table could not be loaded.');
    }
  }

  useEffect(() => {
    if (!controllerId) return undefined;

    refresh();
    const interval = window.setInterval(refresh, 1200);
    return () => window.clearInterval(interval);
  }, [controllerId]);

  async function act(action) {
    if (!controllerId || busy) return;

    setBusy(true);
    setError('');

    try {
      const payload = await tngApi.spades.hostAction(controllerId, action);
      setState(payload.room);
      setHand(payload.hand || []);
    } catch (actionError) {
      setError(actionError.message || 'That Spades action could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <div className="py-14 text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#BC13FE]" />
        <div className="text-sm text-white/40">Loading secure Spades table…</div>
        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#BC13FE]/30 bg-black/60 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#BC13FE]">
              <LockKeyhole className="h-4 w-4" />
              <span className="text-[8px] uppercase tracking-[0.18em]" style={PS2}>
                PRIVATE-STATE TEST
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
              The Host hand below is private. The paired Game Display receives only
              seat/card counts and public table state — never these card identities.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => act('setup_demo')}
              className="rounded-lg border border-[#BC13FE]/50 px-4 py-3 text-[#BC13FE] disabled:opacity-40"
            >
              <Users className="mr-2 inline h-4 w-4" />
              SET TABLE
            </button>

            <button
              type="button"
              disabled={busy || !tableReady}
              onClick={() => act('deal')}
              className="rounded-lg border border-[#FFD700]/50 px-4 py-3 text-[#FFD700] disabled:opacity-40"
            >
              <Shuffle className="mr-2 inline h-4 w-4" />
              SHUFFLE + DEAL
            </button>
          </div>
        </div>

        {error && <div className="mt-4 text-sm text-red-400">{error}</div>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((seat) => {
          const player = players.find((item) => item.seatNumber === seat);
          const team = seat === 1 || seat === 3 ? 1 : 2;
          const isHost = seat === 1;

          return (
            <div
              key={seat}
              className="rounded-xl border bg-black/50 p-4"
              style={{
                borderColor: isHost ? 'rgba(188,19,254,.45)' : 'rgba(255,255,255,.10)',
              }}
            >
              <div className="text-[7px] uppercase tracking-[0.18em] text-white/30" style={PS2}>
                SEAT {seat} · TEAM {team}
              </div>
              <div className="mt-2 text-lg text-white">
                {player?.name || 'Empty'}
              </div>
              <div className="mt-1 text-xs text-white/35">
                {player?.playerType === 'cpu' ? 'CPU' : isHost ? 'Host Player' : 'Player'}
              </div>
              <div className="mt-3 font-mono text-sm text-[#FFD700]">
                {player?.cardCount || 0} cards
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-[#FFD700]/25 bg-black/60 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[8px] uppercase tracking-[0.18em] text-[#FFD700]" style={PS2}>
              HOST PRIVATE HAND
            </div>
            <div className="mt-1 text-xs text-white/35">
              Seat 1 · {sortedHand.length} cards
            </div>
          </div>

          {dealt && (
            <div className="rounded-full border border-green-400/25 bg-green-400/[0.05] px-3 py-1.5 text-[7px] uppercase tracking-[0.15em] text-green-400" style={PS2}>
              DEAL VERIFIED
            </div>
          )}
        </div>

        {sortedHand.length === 0 ? (
          <div className="py-8 text-center text-sm text-white/25">
            Set the table, then shuffle and deal.
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {sortedHand.map((card) => (
              <div
                key={card.id}
                className="overflow-hidden rounded-md border border-white/15 bg-black shadow-lg"
                style={{ width: 64, height: 92 }}
              >
                <img
                  src={getCardImage(card)}
                  alt={card.value + card.suit}
                  className="h-full w-full object-contain"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="text-[7px] uppercase tracking-[0.16em] text-white/25" style={PS2}>
          NEXT
        </div>
        <p className="mt-2 text-sm text-white/40">
          Once the private deal is verified on the TV, we wire server-authoritative
          bidding, legal card plays, trick resolution, and CPU turns.
        </p>
      </div>
    </div>
  );
}
