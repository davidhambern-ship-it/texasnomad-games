// VIRAL! Card Decks
// Based on Decks_Overview.csv

export const EQUIPMENT_CARDS = [
  { id: 'eq_bs_mic', name: 'BS Mic', slot: 'Microphone', tier: 'BS', effect: { ssp: 5, followers: 1000 } },
  { id: 'eq_playing_mic', name: 'Playing Mic', slot: 'Microphone', tier: 'Playing', effect: { ssp: 10, followers: 3000 } },
  { id: 'eq_serious_mic', name: 'Serious Mic', slot: 'Microphone', tier: 'Serious', effect: { ssp: 20, followers: 8000 } },
  { id: 'eq_bs_camera', name: 'BS Camera', slot: 'Camera', tier: 'BS', effect: { ssp: 5, followers: 1500 } },
  { id: 'eq_playing_camera', name: 'Playing Camera', slot: 'Camera', tier: 'Playing', effect: { ssp: 10, followers: 4000 } },
  { id: 'eq_serious_camera', name: 'Serious Camera', slot: 'Camera', tier: 'Serious', effect: { ssp: 20, followers: 10000 } },
  { id: 'eq_bs_ring_light', name: 'BS Ring Light', slot: 'Lighting', tier: 'BS', effect: { ssp: 5, followers: 800 } },
  { id: 'eq_playing_light_kit', name: 'Playing Light Kit', slot: 'Lighting', tier: 'Playing', effect: { ssp: 10, followers: 2500 } },
  { id: 'eq_serious_studio_lighting', name: 'Serious Studio Lighting', slot: 'Lighting', tier: 'Serious', effect: { ssp: 20, followers: 7000 } },
  { id: 'eq_bs_tripod', name: 'BS Tripod', slot: 'Tripod / Mount', tier: 'BS', effect: { ssp: 5, followers: 500 } },
  { id: 'eq_playing_mount', name: 'Playing Mount', slot: 'Tripod / Mount', tier: 'Playing', effect: { ssp: 10, followers: 2000 } },
  { id: 'eq_serious_stabilizer', name: 'Serious Stabilizer', slot: 'Tripod / Mount', tier: 'Serious', effect: { ssp: 20, followers: 6000 } },
  { id: 'eq_bs_editing_app', name: 'BS Editing App', slot: 'Editing Setup', tier: 'BS', effect: { ssp: 5, followers: 1000 } },
  { id: 'eq_playing_editing_rig', name: 'Playing Editing Rig', slot: 'Editing Setup', tier: 'Playing', effect: { ssp: 10, followers: 3500 } },
  { id: 'eq_serious_editing_suite', name: 'Serious Editing Suite', slot: 'Editing Setup', tier: 'Serious', effect: { ssp: 20, followers: 9000 } },
  { id: 'eq_bs_wifi', name: 'BS Wi-Fi', slot: 'Internet / Router', tier: 'BS', effect: { ssp: 5, followers: 500 } },
  { id: 'eq_playing_router', name: 'Playing Router', slot: 'Internet / Router', tier: 'Playing', effect: { ssp: 10, followers: 2500 } },
  { id: 'eq_serious_fiber', name: 'Serious Fiber Setup', slot: 'Internet / Router', tier: 'Serious', effect: { ssp: 20, followers: 7000 } },
  { id: 'eq_bs_laptop', name: 'BS Laptop', slot: 'Computer / Console', tier: 'BS', effect: { ssp: 5, followers: 1000 } },
  { id: 'eq_playing_gaming_pc', name: 'Playing Gaming PC', slot: 'Computer / Console', tier: 'Playing', effect: { ssp: 10, followers: 4000 } },
  { id: 'eq_serious_workstation', name: 'Serious Creator Workstation', slot: 'Computer / Console', tier: 'Serious', effect: { ssp: 20, followers: 10000 } },
  { id: 'eq_bs_logo_pack', name: 'BS Logo Pack', slot: 'Brand Kit', tier: 'BS', effect: { ssp: 5, followers: 800 } },
  { id: 'eq_playing_brand_kit', name: 'Playing Brand Kit', slot: 'Brand Kit', tier: 'Playing', effect: { ssp: 10, followers: 3000 } },
  { id: 'eq_serious_media_package', name: 'Serious Media Package', slot: 'Brand Kit', tier: 'Serious', effect: { ssp: 20, followers: 8000 } },
];

export const CHALLENGE_CARDS = [
  { id: 'ch_trivia_1', name: 'Creator Trivia', type: 'trivia', difficulty: 1, description: 'Answer a trivia question about content creation', sspReward: 10, equipmentReward: true },
  { id: 'ch_scavenger_1', name: 'Scavenger Hunt', type: 'scavenger', difficulty: 1, description: 'Find and show an item in 30 seconds', sspReward: 15, equipmentReward: true },
  { id: 'ch_dare_1', name: 'Audience Dare', type: 'dare', difficulty: 1, description: 'Complete a dare suggested by chat', sspReward: 20, equipmentReward: false },
  { id: 'ch_trivia_2', name: 'Hard Trivia', type: 'trivia', difficulty: 2, description: 'Answer a hard trivia question', sspReward: 20, equipmentReward: true },
  { id: 'ch_scavenger_2', name: 'Epic Scavenger Hunt', type: 'scavenger', difficulty: 2, description: 'Find a rare item in 60 seconds', sspReward: 30, equipmentReward: true },
  { id: 'ch_performance', name: 'Performance Challenge', type: 'performance', difficulty: 2, description: 'Perform a song, dance, or skit', sspReward: 25, equipmentReward: true },
  { id: 'ch_trivia_3', name: 'Expert Trivia', type: 'trivia', difficulty: 3, description: 'Answer an expert-level question', sspReward: 35, equipmentReward: true },
  { id: 'ch_ultimate', name: 'Ultimate Challenge', type: 'ultimate', difficulty: 3, description: 'Complete a multi-part challenge', sspReward: 50, equipmentReward: true },
];

export const VIRAL_CARDS = [
  { id: 'vir_meme', name: 'Meme Moment', effect: { followers: 25000, description: 'Your meme goes viral!' } },
  { id: 'vir_collab', name: 'Surprise Collab', effect: { followers: 40000, description: 'Unexpected collaboration boosts your profile!' } },
  { id: 'vir_trending', name: 'Trending Topic', effect: { followers: 30000, description: 'You ride a trending topic to fame!' } },
  { id: 'vir_controversy', name: 'Mild Controversy', effect: { followers: 15000, description: 'Controversy brings attention (and followers)!' } },
  { id: 'vir_wholesome', name: 'Wholesome Content', effect: { followers: 35000, description: 'Your wholesome content touches hearts!' } },
  { id: 'vir_challenge_accepted', name: 'Challenge Accepted', effect: { followers: 20000, bonusRoll: true, description: 'You complete a viral challenge!' } },
  { id: 'vir_brand_deal', name: 'Mini Brand Deal', effect: { followers: 25000, money: 1000, description: 'Small brand partnership announced!' } },
  { id: 'vir_platform_feature', name: 'Platform Feature', effect: { followers: 50000, description: 'You get featured by the platform!' } },
];

export const EVENT_CARDS = [
  { id: 'evt_streamathon', name: 'Streamathon', effect: { followers: 20000, money: 500, description: '24-hour stream brings dedicated fans!' } },
  { id: 'evt_giveaway', name: 'Giveaway Event', effect: { followers: 15000, money: -200, description: 'Giveaway costs money but gains followers!' } },
  { id: 'evt_podcast', name: 'Podcast Appearance', effect: { followers: 25000, description: 'Guest spot on popular podcast!' } },
  { id: 'evt_meetup', name: 'Fan Meetup', effect: { followers: 18000, money: -100, description: 'Meet and greet with fans!' } },
  { id: 'evt_merch_drop', name: 'Merch Drop', effect: { followers: 22000, money: 800, description: 'New merch line launches!' } },
  { id: 'evt_charity', name: 'Charity Stream', effect: { followers: 30000, money: -300, description: 'Charity event boosts reputation!' } },
];

export const SPONSOR_CARDS = [
  { id: 'spo_energy', name: 'Energy Drink Sponsor', effect: { money: 2000, followers: 10000, sponsor: true, tier: 'minor' } },
  { id: 'spo_tech', name: 'Tech Company Deal', effect: { money: 3000, followers: 15000, sponsor: true, tier: 'minor' } },
  { id: 'spo_fashion', name: 'Fashion Brand', effect: { money: 2500, followers: 12000, sponsor: true, tier: 'minor' } },
  { id: 'spo_gaming', name: 'Gaming Sponsor', effect: { money: 4000, followers: 20000, sponsor: true, tier: 'major' } },
  { id: 'spo_lifestyle', name: 'Lifestyle Brand', effect: { money: 5000, followers: 25000, sponsor: true, tier: 'major' } },
  { id: 'spo_major_tech', name: 'Major Tech Deal', effect: { money: 8000, followers: 40000, sponsor: true, tier: 'major' } },
];

export const PAY_CARDS = [
  { id: 'pay_subscriber', name: 'Subscriber Surge', effect: { money: 500, followers: 5000 } },
  { id: 'pay_donation', name: 'Big Donation', effect: { money: 1000 } },
  { id: 'pay_ad_revenue', name: 'Ad Revenue Spike', effect: { money: 800, followers: 2000 } },
  { id: 'pay_expense', name: 'Unexpected Expense', effect: { money: -500 } },
  { id: 'pay_equipment_cost', name: 'Equipment Upgrade Cost', effect: { money: -1000, ssp: 10 } },
  { id: 'pay_tax', name: 'Tax Season', effect: { money: -800 } },
  { id: 'pay_bonus', name: 'Platform Bonus', effect: { money: 1500, followers: 3000 } },
];

export const PLAY_CARDS = [
  { id: 'play_poll', name: 'Audience Poll', effect: { followers: 8000, interaction: 'poll' } },
  { id: 'play_qna', name: 'Q&A Session', effect: { followers: 10000, interaction: 'qna' } },
  { id: 'play_reaction', name: 'Reaction Video', effect: { followers: 12000, interaction: 'reaction' } },
  { id: 'play_unboxing', name: 'Unboxing Stream', effect: { followers: 9000, money: 300, interaction: 'unboxing' } },
  { id: 'play_tutorial', name: 'Tutorial Stream', effect: { followers: 15000, interaction: 'tutorial' } },
  { id: 'play_irl', name: 'IRL Content', effect: { followers: 11000, interaction: 'irl' } },
];

export function getCardByType(type, tier = 1) {
  const decks = {
    equipment: EQUIPMENT_CARDS,
    challenge: CHALLENGE_CARDS,
    viral: VIRAL_CARDS,
    event: EVENT_CARDS,
    sponsor: SPONSOR_CARDS,
    pay: PAY_CARDS,
    play: PLAY_CARDS,
  };
  
  const deck = decks[type] || [];
  return deck[Math.floor(Math.random() * deck.length)];
}

export function drawCard(type, tier = 1) {
  const card = getCardByType(type, tier);
  return card ? { ...card, drawnAt: Date.now() } : null;
}