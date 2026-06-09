/**
 * TexasNomad Relationship System
 * Used for team dynamics, dialogue triggers, and CPU behavior modifiers.
 */

export const TEXASNOMAD_RELATIONSHIPS = {
  berna: {
    bestFriends: ["carlos"],
    trustedAllies: ["violet", "tank"],
    respects: ["dexter"],
    frustratedBy: ["lemonade"],
    rivals: [],
    notes: "Berna loves Lemonade's confidence but gets annoyed when Lemonade takes unnecessary risks."
  },
  dexter: {
    bestFriends: ["tank"],
    trustedAllies: ["violet", "berna"],
    tolerates: ["carlos"],
    frustratedBy: ["lemonade"],
    rivals: [],
    notes: "Dexter spends half his life trying to explain probability to Lemonade."
  },
  lemonade: {
    bestFriends: ["carlos"],
    favoriteRival: "tank",
    respects: ["berna"],
    annoys: ["dexter", "violet", "tank"],
    rivals: ["tank"],
    notes: "Lemonade believes every problem can be solved by going all-in."
  },
  carlos: {
    bestFriends: ["berna", "lemonade"],
    friendlyWith: ["dexter", "violet", "tank"],
    rivals: [],
    notes: "Carlos is the glue of the team. When tension rises, Carlos breaks it with a joke."
  },
  violet: {
    bestFriends: ["dexter"],
    trustedAllies: ["berna", "tank"],
    protectiveOf: ["carlos"],
    frustratedBy: ["lemonade"],
    rivals: [],
    notes: "Violet is constantly cleaning up the chaos Lemonade creates."
  },
  tank: {
    bestFriends: ["dexter"],
    trustedAllies: ["berna", "violet"],
    primaryRival: "lemonade",
    rivals: ["lemonade"],
    notes: "Tank represents discipline. Lemonade represents impulse. They constantly clash."
  }
};

export const TEAM_DYNAMICS = {
  brains: ["dexter", "violet"],
  leaders: ["berna", "tank"],
  chaosCrew: ["lemonade", "carlos"],
  responsibleAdults: ["berna", "violet", "tank"],
  problemMakers: ["lemonade", "carlos"],
  problemSolvers: ["dexter", "violet", "tank"],
  mostLikelyToArgue: ["tank", "lemonade"],
  mostLikelyToTeamUp: ["dexter", "tank"],
  mostLikelyToGetDistracted: ["carlos", "lemonade"],
  mostLikelyToWinTournament: ["berna", "dexter", "tank"],
  mostLikelyToCreateTournamentDisaster: ["lemonade", "carlos"]
};

/**
 * Get relationship modifier between two characters.
 * Returns a value between -1.0 (rivals/frustrated) to 1.0 (best friends).
 */
export function getRelationshipModifier(char1Id, char2Id) {
  const rel = TEXASNOMAD_RELATIONSHIPS[char1Id];
  if (!rel) return 0;
  if (rel.bestFriends?.includes(char2Id)) return 1.0;
  if (rel.trustedAllies?.includes(char2Id) || rel.friendlyWith?.includes(char2Id)) return 0.6;
  if (rel.respects?.includes(char2Id)) return 0.3;
  if (rel.tolerates?.includes(char2Id)) return 0.1;
  if (rel.frustratedBy?.includes(char2Id) || rel.annoys?.includes(char2Id)) return -0.4;
  if (rel.rivals?.includes(char2Id)) return -0.8;
  return 0;
}