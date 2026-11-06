import React, { useEffect, useState } from 'react';
import { NCHost } from '@/components/nomadCards/NCOnline';
import { STHost } from '@/components/seeThat/STOnline';
import { BSHost } from '@/components/battleSudoku/BSOnline';
import WWOnline from '@/components/wordWrangler/WWOnline';
import DominoHost from '@/pages/DominoHost';
import { loadSceneList } from '@/api/seeThatApi';
import { loadWordDict } from '@/lib/wordWranglerDict';
import { useTngGameIdentity } from '@/hooks/useTngGameIdentity';

export default function SharedGameBoard({ gameId, roomCode }) {
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

  if (gameId === 'out') return <NCHost initialCode={roomCode} onExit={() => {}} />;
  if (gameId === 'dominoes') return <DominoHost initialCode={roomCode} />;
  if (gameId === 'see-that') {
    if (loadError) return <p className="p-4 text-red-400">{loadError}</p>;
    return scenes.length ? <STHost initialCode={roomCode} scenes={scenes} onExit={() => {}} /> : <p className="p-4 text-white/50">Loading See That scenes…</p>;
  }
  if (gameId === 'sudoku') return <BSHost initialCode={roomCode} onExit={() => {}} />;
  if (gameId === 'word-wrangler') {
    if (loadError) return <p className="p-4 text-red-400">{loadError}</p>;
    if (!dict) return <p className="p-4 text-white/50">Loading Word Wrangler dictionary…</p>;
    return <WWOnline dict={dict} code={roomCode} name={identity.publicName || 'Host'} identityReady={!identity.loading && Boolean(identity.publicName)} onExit={() => {}} onCode={() => {}} muted={false} setMuted={() => {}} autoHost />;
  }
  return <p className="p-4 text-red-400">This game board is not connected to the shared room yet.</p>;
}
