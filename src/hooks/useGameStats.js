import { useRef } from 'react';
import { tngApi } from '@/api/tngApi';

function newSessionKey(gameId) {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${gameId}:${crypto.randomUUID()}`;
    }
  } catch { /* fallback below */ }

  return `${gameId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

/**
 * Records one authenticated local-mode result in the central TNG stats table.
 * Multiplayer/standalone live games are recorded server-side by their room
 * engines and should not use this hook.
 */
export default function useGameStats(gameId) {
  const recordedRef = useRef(false);
  const sessionKeyRef = useRef(newSessionKey(gameId));

  const recordStat = async ({ score = 0, won = false } = {}) => {
    if (recordedRef.current) return;
    recordedRef.current = true;

    try {
      await tngApi.stats.recordLocalResult({
        gameId,
        sessionKey: sessionKeyRef.current,
        score: Math.max(0, Math.round(Number(score) || 0)),
        won: won === true,
      });
    } catch (error) {
      recordedRef.current = false;
      console.error('[useGameStats] failed to record stat:', error);
    }
  };

  const resetStat = () => {
    recordedRef.current = false;
    sessionKeyRef.current = newSessionKey(gameId);
  };

  return { recordStat, resetStat };
}
