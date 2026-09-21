import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import SpadesTable from '@/components/spades/SpadesTable';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function NeonSpadesPlayer({ roomCode }) {
  const [room, setRoom] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [hand, setHand] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const actionLockRef = useRef(false);

  const deviceId = localStorage.getItem('tng_player_device_id');
  const gameState = room?.gameState || {};
  const mySeat = Number(participant?.seatNumber || 0);
  const phase = gameState.phase || 'setup';
  const currentTurnSeat = Number(gameState.currentTurnSeat || 0);
  const isMyTurn = mySeat > 0 && phase === 'playing' && currentTurnSeat === mySeat;
  const neonPlayerId = 'neon-current-player';

  const refresh = useCallback(async () => {
    if (!deviceId || !roomCode) return;

    try {
      const payload = await tngApi.spades.getPlayerState(deviceId, roomCode);
      setRoom(payload.room);
      setParticipant(payload.participant);
      setHand(payload.hand || []);
      setError('');
    } catch (stateError) {
      setError(stateError.message || 'The live Spades room could not be loaded.');
    }
  }, [deviceId, roomCode]);

  const act = useCallback(async (action, payload = {}) => {
    if (!deviceId || actionLockRef.current) return false;

    actionLockRef.current = true;
    setBusy(true);
    setError('');

    try {
      const result = await tngApi.spades.playerAction(
        deviceId,
        roomCode,
        action,
        payload,
      );
      setRoom(result.room);
      setParticipant(result.participant);
      setHand(result.hand || []);
      return true;
    } catch (actionError) {
      setError(actionError.message || 'That player action could not be completed.');
      return false;
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }, [deviceId, roomCode]);

  useEffect(() => {
    if (!deviceId) return undefined;

    refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => window.clearInterval(interval);
  }, [deviceId, refresh]);

  const tableState = useMemo(() => {
    const sourcePlayers = Array.isArray(gameState.players) ? gameState.players : [];

    const players = sourcePlayers.map((player) => {
      const seatNumber = Number(player.seatNumber);
      const isMe = mySeat > 0 && seatNumber === mySeat;

      return {
        ...player,
        seatNumber,
        playerId: isMe ? neonPlayerId : `neon-seat-${seatNumber}`,
        hand: isMe ? hand : undefined,
        cardCount: isMe ? hand.length : Number(player.cardCount || 0),
      };
    });

    return {
      ...gameState,
      players,
      phase,
      current_turn_seat: gameState.currentTurnSeat ?? null,
      current_bidder_seat: gameState.currentBidderSeat ?? null,
      current_trick: Array.isArray(gameState.currentTrick) ? gameState.currentTrick : [],
      tricks_played: Number(gameState.tricksPlayed || 0),
      spades_broken: gameState.spadesBroken === true,
      first_hand_no_bid: gameState.firstHandNoBid === true,
      dealer_seat: Number(gameState.dealerSeat || 1),
      deal_start_seat: gameState.dealStartSeat ?? null,
      hand_number: Number(gameState.handNumber || 0),
    };
  }, [gameState, hand, mySeat, phase]);

  const joinableSeats = useMemo(() => {
    const players = tableState.players || [];

    return [2, 3, 4].filter((seat) => {
      const player = players.find((item) => Number(item.seatNumber) === seat);
      return !player || player.playerType === 'cpu';
    });
  }, [tableState.players]);

  const emptySeats = useMemo(() => {
    const players = tableState.players || [];
    return [2, 3, 4].filter(
      (seat) => !players.some((player) => Number(player.seatNumber) === seat),
    );
  }, [tableState.players]);

  const takeSeat = useCallback((seatNumber) => {
    if (busy) return;
    act('sit', { seatNumber });
  }, [act, busy]);

  const playCard = useCallback((card) => {
    if (!card?.id || busy) return;
    act('play_card', { cardId: card.id });
  }, [act, busy]);

  if (!deviceId) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center px-4 text-center">
        <div className="max-w-md">
          <div className="mb-4 text-xl text-red-400">Player device not registered.</div>
          <Link to={`/join/${roomCode}`} className="text-[#FFD700] underline">
            Rejoin room {roomCode}
          </Link>
        </div>
      </div>
    );
  }

  if (!room && !error) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#BC13FE]" />
          <div className="text-sm text-white/40">Connecting to room {roomCode}…</div>
        </div>
      </div>
    );
  }

  const teamOne = {
    name: gameState.team1Name || 'Team 1',
    score: Number(gameState.score1 || 0),
    bid: gameState.bid1 ?? 0,
    books: Number(gameState.books1 || 0),
  };
  const teamTwo = {
    name: gameState.team2Name || 'Team 2',
    score: Number(gameState.score2 || 0),
    bid: gameState.bid2 ?? 0,
    books: Number(gameState.books2 || 0),
  };
  const currentTrick = Array.isArray(gameState.currentTrick) ? gameState.currentTrick : [];
  const activeSuit = currentTrick[0]?.card?.suit || '—';
  const bookNumber = Math.min(13, Number(gameState.tricksPlayed || 0) + 1);

  return (
    <div className="min-h-screen bg-[#070311] text-white lg:h-screen lg:overflow-hidden">
      <main className="lg:grid lg:h-full lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="border-b border-[#BC13FE]/30 bg-black/35 p-5 lg:h-full lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 pb-5">
            <div className="text-[8px] uppercase tracking-[0.22em] text-[#BC13FE]" style={PS2}>
              TEXASNOMAD SPADES
            </div>
            <div className="mt-2 text-[7px] uppercase tracking-[0.18em] text-white/30" style={PS2}>
              PLAYER VIEW
            </div>
            <div className="mt-5">
              <div className="text-[6px] uppercase tracking-[0.18em] text-white/25" style={PS2}>
                ROOM
              </div>
              <div className="mt-1 font-mono text-2xl tracking-[0.18em] text-[#FFD700]">
                {roomCode}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
                <div className="text-[6px] uppercase text-white/25" style={PS2}>SEAT</div>
                <div className="mt-1 text-lg text-white">{mySeat || '—'}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
                <div className="text-[6px] uppercase text-white/25" style={PS2}>STATUS</div>
                <div className={`mt-1 text-sm uppercase ${isMyTurn ? 'text-green-400' : 'text-white/55'}`}>
                  {isMyTurn ? 'YOUR TURN' : String(phase).replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {!mySeat && (
            <div className="mt-4 rounded-xl border border-[#BC13FE]/30 bg-[#BC13FE]/5 p-3 text-center">
              <div className="text-[6px] uppercase leading-relaxed tracking-[0.14em] text-[#BC13FE]" style={PS2}>
                CHOOSE SEAT 2, 3, OR 4 ON THE TABLE
              </div>
            </div>
          )}

          <div className="mt-5 space-y-3">
            <div
              className="rounded-xl border-2 p-4"
              style={{
                borderColor: mySeat === 1 || mySeat === 3 ? '#FFD700' : 'rgba(188,19,254,.35)',
                background: 'rgba(188,19,254,.05)',
              }}
            >
              <div className="text-[7px] uppercase tracking-[0.16em] text-[#BC13FE]" style={PS2}>
                {teamOne.name}
              </div>
              <div className="mt-2 text-3xl font-bold text-[#BC13FE]">{teamOne.score}</div>
              <div className="mt-2 text-xs text-white/35">
                Bid {teamOne.bid} · Books {teamOne.books}
              </div>
              <div className="mt-1 text-[10px] text-white/20">Seats 1 & 3</div>
            </div>

            <div
              className="rounded-xl border-2 p-4"
              style={{
                borderColor: mySeat === 2 || mySeat === 4 ? '#FFD700' : 'rgba(255,95,31,.35)',
                background: 'rgba(255,95,31,.05)',
              }}
            >
              <div className="text-[7px] uppercase tracking-[0.16em] text-[#FF5F1F]" style={PS2}>
                {teamTwo.name}
              </div>
              <div className="mt-2 text-3xl font-bold text-[#FF5F1F]">{teamTwo.score}</div>
              <div className="mt-2 text-xs text-white/35">
                Bid {teamTwo.bid} · Books {teamTwo.books}
              </div>
              <div className="mt-1 text-[10px] text-white/20">Seats 2 & 4</div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/5 p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[6px] uppercase text-white/25" style={PS2}>BOOK</div>
                <div className="mt-2 text-sm text-[#FFD700]">{bookNumber}/13</div>
              </div>
              <div>
                <div className="text-[6px] uppercase text-white/25" style={PS2}>SUIT</div>
                <div className="mt-2 text-lg text-[#FFD700]">{activeSuit}</div>
              </div>
              <div>
                <div className="text-[6px] uppercase text-white/25" style={PS2}>SPADES</div>
                <div className={`mt-2 text-[10px] ${gameState.spadesBroken ? 'text-green-400' : 'text-red-400'}`}>
                  {gameState.spadesBroken ? 'BROKEN' : 'INTACT'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[6px] uppercase tracking-[0.16em] text-white/25" style={PS2}>
              TABLE
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((seat) => {
                const player = (tableState.players || []).find((item) => Number(item.seatNumber) === seat);
                return (
                  <div
                    key={seat}
                    className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2"
                  >
                    <div>
                      <div className="text-xs text-white/65">
                        {player?.name || `Seat ${seat}`}
                      </div>
                      <div className="text-[10px] text-white/25">
                        Seat {seat} · {player?.playerType === 'cpu' ? 'CPU' : seat === 1 ? 'Host' : 'Player'}
                      </div>
                    </div>
                    <div className="text-xs text-[#FFD700]">
                      {Number(player?.cardCount || 0)} cards
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="min-w-0 p-3 lg:flex lg:h-full lg:items-center lg:justify-center lg:overflow-hidden lg:p-4">
          <div className="w-full max-w-[700px]">
            <SpadesTable
              gs={tableState}
              playerId={neonPlayerId}
              mySeatNumber={mySeat || null}
              myRole={mySeat ? 'player' : null}
              isPlayer={Boolean(mySeat)}
              isSpectator={false}
              updateState={() => {}}
              joinableSeats={joinableSeats}
              emptySeats={emptySeats}
              onSitInSeat={takeSeat}
              roomCode={roomCode}
              onPlayAgainstCPU={() => {}}
              onWaitForRealPlayers={() => {}}
              cpuChoiceShown={false}
              onChooseSpectate={() => {}}
              onChooseSit={() => {}}
              onPlayCard={playCard}
              onStandUp={() => {}}
              onTakeOverCPU={takeSeat}
              onBidTimeout={() => {}}
              showPlayerControls={false}
              showTableHud={false}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
