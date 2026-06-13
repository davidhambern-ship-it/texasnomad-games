// VIRAL! AI Character Profiles
// Based on AI_Stats_Draft.csv and AI_Roster.csv

export const VIRAL_AI_CHARACTERS = [
  {
    id: 'dexter',
    name: 'Dexter',
    role: 'The Professor',
    reputation: 'Strategic planner',
    avatar: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/carlos-avatar.jpeg', // placeholder - update with actual avatar
    playStyle: 'Careful early, dangerous late, equipment-focused.',
    priorities: 'Equipment, SSP, efficient growth, endgame control',
    playerReaction: "If Dexter survives Level 1, we're in trouble.",
    stats: {
      riskTolerance: 55,
      equipmentPriority: 90,
      sponsorPriority: 65,
      followerPriority: 70,
      challengeConfidence: 75,
      sspUsage: 80,
      comebackFactor: 70,
    },
    decisionRules: {
      // Higher = more likely to choose this action
      preferEquipmentSpaces: 0.9,
      preferChallengeSpaces: 0.7,
      preferSponsorSpaces: 0.65,
      preferViralSpaces: 0.5,
      riskTakingModifier: 0.55,
      sspSpendThreshold: 20, // spends SSP when penalty > this
    },
  },
  {
    id: 'lemonade',
    name: 'Lemonade',
    role: 'The Hustler',
    reputation: "Feels like she cheats",
    avatar: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/carlos-avatar.jpeg',
    playStyle: 'Aggressive, flashy, high-risk/high-reward.',
    priorities: 'Viral spaces, sponsors, big swings, comeback plays',
    playerReaction: "Here we go... Lemonade's about to pull some nonsense.",
    stats: {
      riskTolerance: 95,
      equipmentPriority: 40,
      sponsorPriority: 90,
      followerPriority: 90,
      challengeConfidence: 85,
      sspUsage: 65,
      comebackFactor: 95,
    },
    decisionRules: {
      preferEquipmentSpaces: 0.4,
      preferChallengeSpaces: 0.85,
      preferSponsorSpaces: 0.9,
      preferViralSpaces: 0.95,
      riskTakingModifier: 0.95,
      sspSpendThreshold: 35,
    },
  },
  {
    id: 'carlos',
    name: 'Carlos',
    role: 'The Menace',
    reputation: 'Pure chaos',
    avatar: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/carlos-avatar.jpeg',
    playStyle: 'Unpredictable, funny, weird decisions that sometimes work.',
    priorities: 'Random risk, wild plays, entertainment value',
    playerReaction: 'Nobody knows what Carlos is doing, including Carlos.',
    stats: {
      riskTolerance: 80,
      equipmentPriority: 50,
      sponsorPriority: 50,
      followerPriority: 60,
      challengeConfidence: 70,
      sspUsage: 45,
      comebackFactor: 100,
    },
    decisionRules: {
      preferEquipmentSpaces: 0.5,
      preferChallengeSpaces: 0.7,
      preferSponsorSpaces: 0.5,
      preferViralSpaces: 0.6,
      riskTakingModifier: 0.8,
      sspSpendThreshold: 45,
    },
  },
  {
    id: 'skie',
    name: 'Skie',
    role: 'The Ghost',
    reputation: 'Silent killer',
    avatar: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/carlos-avatar.jpeg',
    playStyle: 'Quiet, defensive, efficient, resource-focused.',
    priorities: 'Equipment, SSP, steady follower growth, low risk',
    playerReaction: 'Wait... when did Skie get 900k followers?',
    stats: {
      riskTolerance: 35,
      equipmentPriority: 85,
      sponsorPriority: 55,
      followerPriority: 75,
      challengeConfidence: 65,
      sspUsage: 90,
      comebackFactor: 60,
    },
    decisionRules: {
      preferEquipmentSpaces: 0.85,
      preferChallengeSpaces: 0.65,
      preferSponsorSpaces: 0.55,
      preferViralSpaces: 0.4,
      riskTakingModifier: 0.35,
      sspSpendThreshold: 10,
    },
  },
];

export function getAICharacter(characterId) {
  return VIRAL_AI_CHARACTERS.find(c => c.id === characterId) || VIRAL_AI_CHARACTERS[0];
}

export function getRandomAICharacter() {
  return VIRAL_AI_CHARACTERS[Math.floor(Math.random() * VIRAL_AI_CHARACTERS.length)];
}

// AI Decision Engine
export function makeAIDecision(aiCharacter, gameState, player) {
  const rules = aiCharacter.decisionRules;
  const rand = Math.random();
  
  // Decision: which space type to prefer (for card draws, challenges, etc.)
  if (rand < rules.preferEquipmentSpaces) {
    return { action: 'focus_equipment', confidence: rules.equipmentPriority / 100 };
  }
  if (rand < rules.preferChallengeSpaces) {
    return { action: 'take_challenge', confidence: rules.challengeConfidence / 100 };
  }
  if (rand < rules.preferSponsorSpaces) {
    return { action: 'seek_sponsor', confidence: rules.sponsorPriority / 100 };
  }
  if (rand < rules.preferViralSpaces) {
    return { action: 'go_viral', confidence: rules.followerPriority / 100 };
  }
  
  return { action: 'safe_play', confidence: 0.5 };
}

export function shouldAISpendSSP(aiCharacter, penaltySeverity) {
  return penaltySeverity >= aiCharacter.decisionRules.sspSpendThreshold;
}

export function calculateAIRiskLevel(aiCharacter) {
  return aiCharacter.stats.riskTolerance / 100;
}