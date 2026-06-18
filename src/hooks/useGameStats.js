import { useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook to record a game session to the player's profile.
 * Returns a `recordStat` function to call when a game ends.
 * Uses a ref to prevent double-recording the same game session.
 *
 * Usage:
 *   const { recordStat } = useGameStats('bff');
 *   // When game over:
 *   recordStat({ score: 500, won: true, play_time_minutes: 12 });
 */
export default function useGameStats(gameId) {
  const recordedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const recordStat = async ({ score = 0, won = false, play_time_minutes = null } = {}) => {
    if (recordedRef.current) return; // don't double-record
    recordedRef.current = true;

    const elapsedMinutes = play_time_minutes ?? Math.round((Date.now() - startTimeRef.current) / 60000);

    try {
      const user = await base44.auth.me();
      if (!user) return;
      await base44.functions.invoke('recordGameStat', {
        user_id: user.id,
        game_id: gameId,
        score,
        won,
        play_time_minutes: elapsedMinutes,
      });
    } catch (_) {
      // Fail silently — don't interrupt the game UX
    }
  };

  // Reset so a "Play Again" can record the next game
  const resetStat = () => {
    recordedRef.current = false;
    startTimeRef.current = Date.now();
  };

  return { recordStat, resetStat };
}