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

  return (
    <div className="min-h-screen bg-[#070311] text-white">
      <header className="sticky top-0 z-40 border-b border-[#BC13FE]/30 bg-[#070311]/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <div className="text-[8px] uppercase tracking-[0.22em] text-[#BC13FE]" style={PS2}>
              TEXASNOMAD SPADES · PLAYER
            </div>
            <div className="mt-1 font-mono text-lg tracking-[0.18em] text-[#FFD700]">
              ROOM {roomCode}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[7px] uppercase tracking-[0.16em] text-white/30" style={PS2}>
              {mySeat ? `SEAT ${mySeat}` : 'CHOOSE A SEAT'}
            </div>
            <div className={`mt-1 text-sm ${isMyTurn ? 'text-green-400' : 'text-white/45'}`}>
              {isMyTurn ? 'YOUR TURN' : String(phase).replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <div className="mx-auto mb-4 max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {!mySeat && (
          <div className="mx-auto mb-4 max-w-2xl rounded-xl border border-[#BC13FE]/30 bg-[#BC13FE]/5 px-4 py-3 text-center">
            <div className="text-[7px] uppercase tracking-[0.18em] text-[#BC13FE]" style={PS2}>
              CHOOSE SEAT 2, 3, OR 4 DIRECTLY ON THE TABLE
            </div>
          </div>
        )}

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
        />
      </main>
    </div>
  );
}
