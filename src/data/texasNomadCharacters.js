/**
 * TexasNomad CPU Character Database
 * Reusable across all current games: spades, bff, squareBiz, hangman
 * Future games can be added to gameProfiles without breaking existing logic.
 */

export const TEXASNOMAD_CHARACTERS = [
  {
    id: "berna",
    name: "Berna",
    role: "Team Captain",
    archetype: "Competitive Leader",
    avatar: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=berna&backgroundColor=bc13fe&eyes=eva&mouth=smile01",
    difficulty: 9,
    personalityType: "competitive_leader",
    shortDescription: "Confident, competitive, motivational, and hard to rattle.",
    strengths: ["Leadership", "Pressure", "Adaptability", "Confidence"],
    weaknesses: ["Can get stubborn", "Hates losing", "May overcommit when challenged"],
    traits: {
      competitiveness: 95,
      confidence: 95,
      humor: 75,
      intelligence: 85,
      patience: 70,
      riskTaking: 80,
      teamwork: 90,
      chaos: 35,
      emotionalControl: 80
    },
    gameProfiles: {
      spades: {
        style: "balanced_aggressive",
        description: "Tracks books, protects partner, and applies pressure late.",
        riskLevel: 75,
        strategyLevel: 85
      },
      bff: {
        style: "popular_answer_hunter",
        description: "Prioritizes common survey answers and strong guesses.",
        riskLevel: 65,
        strategyLevel: 80
      },
      squareBiz: {
        style: "pressure_player",
        description: "Controls the board and pressures opponents into mistakes.",
        riskLevel: 70,
        strategyLevel: 85
      },
      hangman: {
        style: "pattern_reader",
        description: "Uses common letters, word structure, and player behavior.",
        riskLevel: 60,
        strategyLevel: 80
      }
      // Future games can be added here (e.g., viral, tournament)
    },
    catchphrases: [
      "Let's get to work.",
      "That wasn't luck.",
      "Run it back.",
      "You sure about that?",
      "Game recognize game."
    ],
    dialogue: {
      gameStart: ["Let's get to work.", "Hope you came ready."],
      winning: ["That's how you control a game.", "Pressure does that."],
      losing: ["Alright, now I'm awake.", "You got my attention now."],
      mistake: ["That one's on me.", "I rushed that move."],
      comeback: ["Momentum just changed."],
      win: ["Good game. I respect it.", "That's how you finish."],
      loss: ["Run it back.", "I need that rematch."]
    },
    relationships: {
      bestFriends: ["carlos"],
      trustedAllies: ["violet", "tank"],
      respects: ["dexter"],
      frustratedBy: ["lemonade"],
      rivals: []
    }
  },
  {
    id: "dexter",
    name: "Dexter",
    role: "Strategist",
    archetype: "Mastermind",
    avatar: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=dexter&backgroundColor=22d3ee&eyes=eva&mouth=smile01",
    difficulty: 8,
    personalityType: "calculated_strategist",
    shortDescription: "Logical, patient, observant, and slightly sarcastic.",
    strengths: ["Strategy", "Memory", "Patience", "Pattern recognition"],
    weaknesses: ["Too cautious", "Slow to take risks", "Can overthink"],
    traits: {
      competitiveness: 80,
      confidence: 70,
      humor: 55,
      intelligence: 98,
      patience: 95,
      riskTaking: 20,
      teamwork: 85,
      chaos: 15,
      emotionalControl: 95
    },
    gameProfiles: {
      spades: {
        style: "book_counter",
        description: "Counts suits, avoids wasting spades, and protects books late.",
        riskLevel: 25,
        strategyLevel: 95
      },
      bff: {
        style: "survey_logic",
        description: "Chooses the most obvious survey-style answers first.",
        riskLevel: 30,
        strategyLevel: 90
      },
      squareBiz: {
        style: "defensive_controller",
        description: "Prioritizes blocking, center control, and board logic.",
        riskLevel: 25,
        strategyLevel: 95
      },
      hangman: {
        style: "letter_frequency",
        description: "Uses vowels, common letters, and word-pattern logic.",
        riskLevel: 20,
        strategyLevel: 95
      }
      // Future games can be added here
    },
    catchphrases: [
      "Interesting.",
      "There's a better move.",
      "Think ahead.",
      "That changes things.",
      "That was mathematically questionable."
    ],
    dialogue: {
      gameStart: ["Interesting matchup.", "Let's see how you think."],
      winning: ["The pattern is clear now.", "Efficient."],
      losing: ["Unexpected, but not impossible.", "I need to recalculate."],
      mistake: ["That was inefficient.", "I saw it too late."],
      comeback: ["Now the pattern makes sense."],
      win: ["Clean execution.", "The odds were always there."],
      loss: ["I'll need to review that.", "You made fewer mistakes than expected."]
    },
    relationships: {
      bestFriends: ["tank"],
      trustedAllies: ["violet", "berna"],
      respects: ["tank", "violet"],
      frustratedBy: ["lemonade", "carlos"],
      rivals: []
    }
  },
  {
    id: "lemonade",
    name: "Lemonade",
    role: "Wild Card",
    archetype: "High Risk / High Reward",
    avatar: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=lemonade&backgroundColor=ffd700&eyes=eva&mouth=smile01",
    difficulty: 7,
    personalityType: "flashy_risk_taker",
    shortDescription: "Loud, flashy, aggressive, and unpredictable.",
    strengths: ["Big plays", "Confidence", "Pressure", "Momentum swings"],
    weaknesses: ["Impatient", "Overconfident", "Takes bad risks"],
    traits: {
      competitiveness: 95,
      confidence: 100,
      humor: 85,
      intelligence: 70,
      patience: 25,
      riskTaking: 100,
      teamwork: 60,
      chaos: 90,
      emotionalControl: 45
    },
    gameProfiles: {
      spades: {
        style: "aggressive_cutter",
        description: "Cuts aggressively, steals books, and may overbid.",
        riskLevel: 95,
        strategyLevel: 70
      },
      bff: {
        style: "fast_buzzer",
        description: "Guesses fast and flashy, sometimes skipping obvious answers.",
        riskLevel: 90,
        strategyLevel: 65
      },
      squareBiz: {
        style: "attack_first",
        description: "Attacks instead of blocking unless forced.",
        riskLevel: 95,
        strategyLevel: 70
      },
      hangman: {
        style: "risky_guesser",
        description: "Takes bold letter guesses and may attempt full words early.",
        riskLevel: 90,
        strategyLevel: 60
      }
      // Future games can be added here
    },
    catchphrases: [
      "SEND IT!",
      "YOLO!",
      "Double or nothing!",
      "Watch this!",
      "Scared money don't win games."
    ],
    dialogue: {
      gameStart: ["Hope you like pressure.", "I don't play safe."],
      winning: ["Told you I was built different.", "That's highlight-reel material."],
      losing: ["Nah, run that back — energy loading.", "You got lucky, don't get comfortable."],
      mistake: ["Okay... maybe that was too spicy.", "I regret nothing."],
      comeback: ["Now it's a show.", "Big risk, bigger reward."],
      win: ["SEND IT! That's game!", "Legendary finish."],
      loss: ["I almost had you.", "That was luck and you know it."]
    },
    relationships: {
      bestFriends: ["carlos"],
      trustedAllies: [],
      respects: ["berna"],
      frustratedBy: ["tank", "dexter", "violet"],
      rivals: ["tank"]
    }
  },
  {
    id: "carlos",
    name: "Carlos",
    role: "Entertainer",
    archetype: "Chaos Agent",
    avatar: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=carlos&backgroundColor=ff5f1f&eyes=eva&mouth=smile01",
    difficulty: 5,
    personalityType: "chaotic_storyteller",
    shortDescription: "Funny, random, dramatic, and unpredictable.",
    strengths: ["Humor", "Surprise moves", "Entertainment", "Morale"],
    weaknesses: ["Distracted", "Inconsistent", "Makes strange choices"],
    traits: {
      competitiveness: 60,
      confidence: 75,
      humor: 100,
      intelligence: 65,
      patience: 55,
      riskTaking: 75,
      teamwork: 80,
      chaos: 95,
      emotionalControl: 70
    },
    gameProfiles: {
      spades: {
        style: "unpredictable_partner",
        description: "Sometimes cuts at strange times and occasionally makes genius plays.",
        riskLevel: 75,
        strategyLevel: 50
      },
      bff: {
        style: "comedy_guesser",
        description: "Gives funny answers that might randomly be correct.",
        riskLevel: 70,
        strategyLevel: 45
      },
      squareBiz: {
        style: "vibes_based",
        description: "Sometimes blocks, sometimes picks based on vibes.",
        riskLevel: 70,
        strategyLevel: 45
      },
      hangman: {
        style: "instinct_guesser",
        description: "Guesses letters based on instinct, jokes, and random ideas.",
        riskLevel: 75,
        strategyLevel: 45
      }
      // Future games can be added here
    },
    catchphrases: [
      "Now listen...",
      "Funny story...",
      "Back in my day...",
      "You ain't gonna believe this.",
      "Trust the process. Don't ask what process."
    ],
    dialogue: {
      gameStart: ["Now listen, I got a strategy.", "This reminds me of a story."],
      winning: ["See! Y'all thought I was playing!", "Accidental genius still counts."],
      losing: ["The game cheating, not me.", "I was distracted by my own brilliance."],
      mistake: ["That was a plot twist.", "I meant to do that spiritually."],
      comeback: ["The ancestors just tagged me in.", "Now the story gets good."],
      win: ["Told you! I had it the whole time.", "That was strategy with seasoning."],
      loss: ["Hold on, let me explain.", "I need to tell y'all what happened."]
    },
    relationships: {
      bestFriends: ["berna", "lemonade"],
      trustedAllies: ["violet"],
      respects: ["berna"],
      frustratedBy: [],
      rivals: []
    }
  },
  {
    id: "violet",
    name: "Violet",
    role: "Advisor",
    archetype: "Balanced Player",
    avatar: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=violet&backgroundColor=8b5cf6&eyes=eva&mouth=smile01",
    difficulty: 6,
    personalityType: "calm_balanced_advisor",
    shortDescription: "Calm, thoughtful, encouraging, and consistent.",
    strengths: ["Balance", "Patience", "Teamwork", "Composure"],
    weaknesses: ["Not aggressive enough", "Can hesitate", "Avoids unnecessary conflict"],
    traits: {
      competitiveness: 70,
      confidence: 80,
      humor: 65,
      intelligence: 85,
      patience: 90,
      riskTaking: 35,
      teamwork: 95,
      chaos: 20,
      emotionalControl: 95
    },
    gameProfiles: {
      spades: {
        style: "supportive_partner",
        description: "Protects partner, avoids waste, and plays steady.",
        riskLevel: 35,
        strategyLevel: 80
      },
      bff: {
        style: "steady_answerer",
        description: "Uses category logic and avoids wild guesses.",
        riskLevel: 35,
        strategyLevel: 75
      },
      squareBiz: {
        style: "balanced_board_control",
        description: "Balances offense and defense.",
        riskLevel: 40,
        strategyLevel: 78
      },
      hangman: {
        style: "calm_solver",
        description: "Guesses common letters and avoids reckless full-word guesses.",
        riskLevel: 30,
        strategyLevel: 80
      }
      // Future games can be added here
    },
    catchphrases: [
      "Stay focused.",
      "There's always another move.",
      "Trust the process.",
      "Patience wins.",
      "Breathe and play smart."
    ],
    dialogue: {
      gameStart: ["Let's keep it clean.", "Stay focused and have fun."],
      winning: ["Consistency matters.", "Good rhythm."],
      losing: ["There's still another move.", "No need to panic."],
      mistake: ["That's okay. Reset.", "We adjust."],
      comeback: ["See? Patience wins.", "The game is turning."],
      win: ["Good game.", "That was steady work."],
      loss: ["Well played.", "You earned that one."]
    },
    relationships: {
      bestFriends: ["dexter"],
      trustedAllies: ["berna", "tank"],
      protects: ["carlos"],
      respects: ["dexter", "tank"],
      frustratedBy: ["lemonade"],
      rivals: []
    }
  },
  {
    id: "tank",
    name: "Tank",
    role: "The Closer",
    archetype: "Defensive Juggernaut",
    avatar: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=tank&backgroundColor=4ade80&eyes=eva&mouth=smile01",
    difficulty: 8,
    personalityType: "defensive_closer",
    shortDescription: "Calm, stubborn, disciplined, and almost impossible to rattle.",
    strengths: ["Defense", "Late-game pressure", "Patience", "Discipline"],
    weaknesses: ["Too cautious", "Slow starts", "Not flashy"],
    traits: {
      competitiveness: 90,
      confidence: 85,
      humor: 40,
      intelligence: 80,
      patience: 100,
      riskTaking: 20,
      teamwork: 85,
      chaos: 5,
      emotionalControl: 100
    },
    gameProfiles: {
      spades: {
        style: "book_protector",
        description: "Excellent book management, protects partner, and rarely wastes trump cards.",
        riskLevel: 20,
        strategyLevel: 88
      },
      bff: {
        style: "answer_eliminator",
        description: "Uses logical answer elimination and lets others make mistakes.",
        riskLevel: 25,
        strategyLevel: 78
      },
      squareBiz: {
        style: "defensive_master",
        description: "Blocks threats immediately and creates traps.",
        riskLevel: 20,
        strategyLevel: 90
      },
      hangman: {
        style: "methodical_solver",
        description: "Methodical letter selection and rarely guesses randomly.",
        riskLevel: 15,
        strategyLevel: 88
      }
      // Future games can be added here
    },
    catchphrases: [
      "Slow down.",
      "There's still time.",
      "One move at a time.",
      "You missed something.",
      "Pressure creates mistakes."
    ],
    dialogue: {
      gameStart: ["One move at a time.", "Let's see who breaks first."],
      winning: ["Never rushed.", "That's what patience looks like."],
      losing: ["There's still time.", "I can do this all day."],
      mistake: ["I'll remember that.", "Interesting."],
      comeback: ["Pressure creates mistakes.", "You left the door open."],
      win: ["Good game.", "Never rushed."],
      loss: ["Next time.", "I'll remember that."]
    },
    relationships: {
      bestFriends: ["dexter"],
      trustedAllies: ["berna", "violet"],
      respects: ["dexter", "violet"],
      frustratedBy: ["lemonade"],
      rivals: ["lemonade"]
    }
  }
];

export function getCharacterById(id) {
  return TEXASNOMAD_CHARACTERS.find(c => c.id === id) || null;
}

export function getRandomCharacter() {
  return TEXASNOMAD_CHARACTERS[Math.floor(Math.random() * TEXASNOMAD_CHARACTERS.length)];
}

export function getCharactersForGame(gameKey) {
  // gameKey: 'spades' | 'bff' | 'squareBiz' | 'hangman'
  return TEXASNOMAD_CHARACTERS.filter(c => c.gameProfiles?.[gameKey]);
}