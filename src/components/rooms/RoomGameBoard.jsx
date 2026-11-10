import React, { useEffect, useState } from 'react';
import { NCHost } from '@/components/nomadCards/NCOnline';
import { STHost } from '@/components/seeThat/STOnline';
import BattleSudokuGameBoard from '@/components/games/BattleSudokuGameBoard';
import WWOnline from '@/components/wordWrangler/WWOnline';
import RRHost from '@/components/brawl/RRHost';
import { loadSceneList } from '@/api/seeThatApi';
import { loadWordDict } from '@/lib/wordWranglerDict';
import { useTngGameIdentity } from '@/hooks/useTngGameIdentity';

export default function RoomGameBoard({ gameId, roomCode, controllerId, onEndRoom }) {
  // This code belongs to the shared room created by SharedRoomPage. Every
  // game adapter must attach to this exact code; it must never mint a new one.
  const identity = useTngGameIdentity();
  const [scenes, setScenes] = useState([]);
  const [dict, setDict] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (gameId !== 'see-that') return undefined;
    let active = true;
    loadSceneList().then((items) => { if (active) setScenes(items); })
      .catch((error) => { if (active) setLoadError(error?.message || 'See That scenes could not load.'); });
    return () => { active = false; };
  }, [gameId]);

  useEffect(() => {
    if (gameId !== 'word-wrangler') return undefined;
    let active = true;
    loadWordDict().then((value) => { if (active) setDict(value); })
      .catch((error) => { if (active) setLoadError(error?.message || 'Word Wrangler dictionary could not load.'); });
    return () => { active = false; };
  }, [gameId]);

  if (gameId === 'out') return <NCHost sharedRoomCode={roomCode} freshRoom onExit={() => {}} />;
  if (gameId === 'rodeo-rumble') return <RRHost initialCode={roomCode} freshRoom onExit={() => {}} />;
  if (gameId === 'viral') return <iframe title="VIRAL! live game" src={`/viral/index.html?host=1&room=${encodeURIComponent(roomCode)}`} className="w-full rounded-xl border-0 bg-[#0a0916]" style={{ height: 'min(78vh, 900px)', minHeight: 620 }} allow="fullscreen; autoplay" />;
  if (gameId === 'see-that') {
    if (loadError) return <p className="p-4 text-red-400">{loadError}</p>;
    return scenes.length ? <STHost initialCode={roomCode} freshRoom scenes={scenes} onExit={() => {}} /> : <p className="p-4 text-white/50">Loading See That scenes…</p>;
  }
  if (gameId === 'sudoku') return <BattleSudokuGameBoard controllerId={controllerId} onEndRoom={onEndRoom} />;
  if (gameId === 'word-wrangler') {
    if (loadError) return <p className="p-4 text-red-400">{loadError}</p>;
    if (!dict) return <p className="p-4 text-white/50">Loading Word Wrangler dictionary…</p>;
    return <WWOnline dict={dict} code={roomCode} name={identity.publicName || 'Host'} identityReady={!identity.loading && Boolean(identity.publicName)} onExit={() => {}} onCode={() => {}} muted={false} setMuted={() => {}} autoHost />;
  }
  return <p className="p-4 text-red-400">This game board is not connected to the shared room yet.</p>;
}
