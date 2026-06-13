// VIRAL! Board Data Generator
// Based on Board_Architecture.csv, Space_Distribution.csv, Space_Effects.csv

const SPACE_TYPES = {
  EQUIPMENT: 'Equipment',
  CHALLENGE: 'Challenge',
  VIRAL: 'Viral',
  PAY: 'Pay',
  PLAY: 'Play',
  EVENT: 'Event',
  SPONSOR: 'Sponsor',
};

const LEVELS = {
  1: { spaces: '1–40', theme: 'The Grind', primary: [SPACE_TYPES.EQUIPMENT, SPACE_TYPES.CHALLENGE, SPACE_TYPES.VIRAL], secondary: [SPACE_TYPES.PAY, SPACE_TYPES.PLAY] },
  2: { spaces: '41–80', theme: 'Growth Mode', primary: [SPACE_TYPES.PAY, SPACE_TYPES.PLAY, SPACE_TYPES.EVENT], secondary: [SPACE_TYPES.EQUIPMENT, SPACE_TYPES.VIRAL] },
  3: { spaces: '81–120', theme: 'Influencer Status', primary: [SPACE_TYPES.SPONSOR, SPACE_TYPES.PAY, SPACE_TYPES.CHALLENGE], secondary: [SPACE_TYPES.EVENT, SPACE_TYPES.VIRAL] },
};

const LEVEL_DISTRIBUTION = {
  1: {
    [SPACE_TYPES.EQUIPMENT]: 0.25,
    [SPACE_TYPES.CHALLENGE]: 0.20,
    [SPACE_TYPES.VIRAL]: 0.20,
    [SPACE_TYPES.PAY]: 0.15,
    [SPACE_TYPES.PLAY]: 0.15,
    [SPACE_TYPES.EVENT]: 0.05,
    [SPACE_TYPES.SPONSOR]: 0.00,
  },
  2: {
    [SPACE_TYPES.EQUIPMENT]: 0.15,
    [SPACE_TYPES.CHALLENGE]: 0.10,
    [SPACE_TYPES.VIRAL]: 0.15,
    [SPACE_TYPES.PAY]: 0.25,
    [SPACE_TYPES.PLAY]: 0.20,
    [SPACE_TYPES.EVENT]: 0.15,
    [SPACE_TYPES.SPONSOR]: 0.00,
  },
  3: {
    [SPACE_TYPES.EQUIPMENT]: 0.10,
    [SPACE_TYPES.CHALLENGE]: 0.20,
    [SPACE_TYPES.VIRAL]: 0.10,
    [SPACE_TYPES.PAY]: 0.25,
    [SPACE_TYPES.PLAY]: 0.10,
    [SPACE_TYPES.EVENT]: 0.10,
    [SPACE_TYPES.SPONSOR]: 0.15,
  },
};

const EQUIPMENT_SLOTS = [
  'Microphone',
  'Camera',
  'Lighting',
  'Tripod / Mount',
  'Editing Setup',
  'Internet / Router',
  'Computer / Console',
  'Brand Kit',
];

const EQUIPMENT_TIERS = ['BS', 'Playing', 'Serious'];

function getLevelForSpace(spaceNumber) {
  if (spaceNumber <= 40) return 1;
  if (spaceNumber <= 80) return 2;
  return 3;
}

function getRandomSpaceType(level) {
  const dist = LEVEL_DISTRIBUTION[level];
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [type, probability] of Object.entries(dist)) {
    cumulative += probability;
    if (rand <= cumulative) return type;
  }
  
  return SPACE_TYPES.EQUIPMENT;
}

function generateSpaceEffect(spaceType, spaceNumber, level) {
  const tierIndex = level === 1 ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 3);
  const tier = EQUIPMENT_TIERS[tierIndex];
  const equipSlot = EQUIPMENT_SLOTS[Math.floor(Math.random() * EQUIPMENT_SLOTS.length)];
  
  const baseEffects = {
    [SPACE_TYPES.EQUIPMENT]: () => ({
      type: SPACE_TYPES.EQUIPMENT,
      description: `Gain ${equipSlot} (${tier} tier)`,
      equipmentSlot: equipSlot,
      tier: tier,
      followerGain: Math.floor(Math.random() * 5000) + 1000,
    }),
    [SPACE_TYPES.CHALLENGE]: () => ({
      type: SPACE_TYPES.CHALLENGE,
      description: 'Draw Challenge Card',
      challengeTier: level,
      sspReward: level * 10,
      equipmentReward: Math.random() > 0.7,
      penaltyOnFail: { followers: level * 2500, ssp: level * 5 },
    }),
    [SPACE_TYPES.VIRAL]: () => ({
      type: SPACE_TYPES.VIRAL,
      description: 'Viral Moment!',
      followerGain: level * 10000 + Math.floor(Math.random() * 10000),
      bonusRoll: Math.random() > 0.8,
      sponsorAttention: Math.random() > 0.9,
    }),
    [SPACE_TYPES.PAY]: () => ({
      type: SPACE_TYPES.PAY,
      description: 'Money Movement',
      moneyGain: level * 500 + Math.floor(Math.random() * 500),
      followerGain: Math.random() > 0.5 ? level * 1000 : 0,
    }),
    [SPACE_TYPES.PLAY]: () => ({
      type: SPACE_TYPES.PLAY,
      description: 'Interactive Play Action',
      audienceEngagement: true,
      followerGain: level * 2000 + Math.floor(Math.random() * 2000),
      movementBonus: Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0,
    }),
    [SPACE_TYPES.EVENT]: () => ({
      type: SPACE_TYPES.EVENT,
      description: 'Special Event Triggered',
      eventTier: level,
      possibleEffects: ['collab', 'show', 'public_moment', 'controversy'],
    }),
    [SPACE_TYPES.SPONSOR]: () => ({
      type: SPACE_TYPES.SPONSOR,
      description: 'Sponsorship Opportunity',
      sponsorTier: level >= 3 ? 'major' : 'minor',
      moneyReward: level * 2000,
      followerReward: level * 5000,
      winConditionProgress: level === 3,
    }),
  };
  
  return baseEffects[spaceType]();
}

export function generateBoard() {
  const spaces = [];
  
  for (let i = 1; i <= 120; i++) {
    const level = getLevelForSpace(i);
    
    if (i === 40 || i === 80) {
      spaces.push({
        number: i,
        type: 'SAFE',
        level,
        effect: {
          type: 'SAFE',
          description: 'SAFE ZONE - No progress review penalty!',
          animation: 'safe_zone',
        },
        isCheckpoint: true,
      });
      continue;
    }
    
    if (i === 120) {
      spaces.push({
        number: i,
        type: 'CREATOR_MANSION',
        level: 3,
        effect: {
          type: 'CREATOR_MANSION',
          description: 'Creator Mansion - Win Condition Check',
          winCheck: true,
          endgameMode: true,
        },
        isEndgame: true,
      });
      continue;
    }
    
    const spaceType = getRandomSpaceType(level);
    const effect = generateSpaceEffect(spaceType, i, level);
    
    spaces.push({
      number: i,
      type: spaceType,
      level,
      effect,
      isReviewZone: (i >= 20 && i <= 39) || (i >= 60 && i <= 79) || (i >= 100 && i <= 119),
    });
  }
  
  return spaces;
}

export function getProgressReviewRequirements(level) {
  const reviews = {
    1: { followers: 20000, equipment: 4, zone: '20–39' },
    2: { followers: 50000, equipment: 6, zone: '60–79' },
    3: { followers: 100000, equipment: 8, zone: '100–119' },
  };
  return reviews[level];
}

export function getProgressReviewOutcomes(level, roll) {
  const outcomes = {
    1: {
      '1-2': { outcome: 'Move back 5 spaces', movement: -5 },
      '3-4': { outcome: 'Draw Challenge Card', cardDraw: 'challenge' },
      '5': { outcome: 'Lose 2,500 followers', followerLoss: 2500 },
      '6': { outcome: 'Gain BS Equipment Opportunity', equipmentTier: 'BS' },
    },
    2: {
      '1-2': { outcome: 'Move back 10 spaces', movement: -10 },
      '3-4': { outcome: 'Draw Challenge Card', cardDraw: 'challenge' },
      '5': { outcome: 'Lose 5,000 followers', followerLoss: 5000 },
      '6': { outcome: 'Gain Playing Equipment Opportunity', equipmentTier: 'Playing' },
    },
    3: {
      '1-2': { outcome: 'Move back 15 spaces', movement: -15 },
      '3-4': { outcome: 'Draw Challenge Card', cardDraw: 'challenge' },
      '5': { outcome: 'Lose 10,000 followers', followerLoss: 10000 },
      '6': { outcome: 'Gain Serious Equipment Opportunity', equipmentTier: 'Serious' },
    },
  };
  
  const rollKey = roll <= 2 ? '1-2' : roll <= 4 ? '3-4' : roll === 5 ? '5' : '6';
  return outcomes[level][rollKey];
}

export function getEndgameRollOutcome(roll) {
  const outcomes = {
    1: { type: 'followers', outcome: 'Gain Followers', followerGain: 50000 },
    2: { type: 'followers', outcome: 'Gain Followers', followerGain: 50000 },
    3: { type: 'equipment', outcome: 'Equipment Hunt', equipmentOpportunity: true },
    4: { type: 'equipment', outcome: 'Equipment Hunt', equipmentOpportunity: true },
    5: { type: 'sponsor', outcome: 'Sponsor Opportunity', sponsorOpportunity: true },
    6: { type: 'any_deck', outcome: 'Draw Any Deck', freeDraw: true },
  };
  return outcomes[roll] || outcomes[1];
}