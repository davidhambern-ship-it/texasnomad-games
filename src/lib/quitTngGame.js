import { tngApi } from '@/api/tngApi';

export async function quitTngGame(roomCode) {
  try {
    if (roomCode) {
      await tngApi.stats.quitGame(roomCode);
    }
  } catch (error) {
    console.warn('[TNG quit tracking] could not record player exit:', error);
  } finally {
    window.location.assign('/');
  }
}
