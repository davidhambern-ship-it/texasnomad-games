// BFF Rotation Utilities — shared between BFFGame and BFFHostPanel

export function getActivePlayers(players, familyTeam) {
  return players.filter(
    p => (p.familyTeam === familyTeam || p.familyTeam === String(familyTeam)) && p.active !== false
  );
}

// Get next player in rotation after currentId within a family
export function getNextPlayer(players, familyTeam, currentId) {
  const active = getActivePlayers(players, familyTeam);
  if (!active.length) return null;
  const idx = active.findIndex(p => p.playerId === currentId);
  return active[(idx + 1) % active.length];
}

// Auto-pick faceoff players by rotating from last used index
// Uses gs.faceoff_round_idx1 and faceoff_round_idx2 to track rotation
export function pickFaceoffPlayers(players, gs) {
  const f1 = getActivePlayers(players, 1);
  const f2 = getActivePlayers(players, 2);
  
  const lastIdx1 = gs.faceoff_round_idx1 ?? -1;
  const lastIdx2 = gs.faceoff_round_idx2 ?? -1;
  
  const nextIdx1 = f1.length ? (lastIdx1 + 1) % f1.length : -1;
  const nextIdx2 = f2.length ? (lastIdx2 + 1) % f2.length : -1;
  
  return {
    player1: f1[nextIdx1] || null,
    player2: f2[nextIdx2] || null,
    nextIdx1,
    nextIdx2,
  };
}

// After a wrong answer, get next answering player in the same family (skipping current)
export function getNextAnsweringPlayer(players, familyTeam, currentAnsweringId) {
  return getNextPlayer(players, familyTeam, currentAnsweringId);
}

// Determine steal player from opposing family
export function getStealPlayer(players, byeFamilyTeam, gs) {
  const stealFamily = byeFamilyTeam === 1 ? 2 : 1;
  const active = getActivePlayers(players, stealFamily);
  if (!active.length) return null;
  // Rotate steal player too — use steal_round_idx
  const lastStealIdx = gs.steal_round_idx ?? -1;
  const nextIdx = (lastStealIdx + 1) % active.length;
  return { player: active[nextIdx], nextIdx, stealFamily };
}

// Is 1-player mode viable (only 1 player total)
export function is1PlayerMode(players) {
  return players.filter(p => p.active !== false).length === 1;
}