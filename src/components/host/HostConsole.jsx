import React from 'react';
import { useGameRoom } from '@/hooks/useGameRoom';
import ConnectionStatus from '@/components/host/ConnectionStatus';
import BFFHostPanel from '@/components/host/panels/BFFHostPanel';
import SquareBizHostPanel from '@/components/host/panels/SquareBizHostPanel';
import HangmanHostPanel from '@/components/host/panels/HangmanHostPanel';
import SpadesHostPanel from '@/components/host/panels/SpadesHostPanel';

export default function HostConsole({ game, roomCode, onDisconnect }) {
  const { room, loading, error, updateState, sendCommand, updateRoomStatus } = useGameRoom(roomCode, game.id, 'host');

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
          <span className="font-heading text-sm tracking-widest text-[#FFD700] uppercase">
            Connecting to Room {roomCode}…
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 font-heading tracking-widest uppercase mb-4">Connection Error</p>
          <p className="text-white/50 text-sm mb-6">{error}</p>
          <button
            onClick={onDisconnect}
            className="px-6 py-2 border border-red-500 text-red-400 font-heading text-sm tracking-widest uppercase rounded hover:bg-red-500/20 transition-all"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const gs = room?.game_state || {};

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {/* Connection Status Bar */}
      <ConnectionStatus room={room} roomCode={roomCode} gameId={game.id} />

      {/* Game-specific Panel */}
      <div className="flex-1 p-4 md:p-6">
        {game.id === 'bff' && (
          <BFFHostPanel gs={gs} updateState={updateState} sendCommand={sendCommand} roomCode={roomCode} />
        )}
        {game.id === 'square-biz' && (
          <SquareBizHostPanel gs={gs} updateState={updateState} sendCommand={sendCommand} room={room} />
        )}
        {game.id === 'hangman' && (
          <HangmanHostPanel gs={gs} updateState={updateState} sendCommand={sendCommand} />
        )}
        {game.id === 'spades' && (
          <SpadesHostPanel gs={gs} updateState={updateState} sendCommand={sendCommand} />
        )}
      </div>
    </div>
  );
}