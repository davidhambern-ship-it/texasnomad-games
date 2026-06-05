// Maps card value + suit to custom TexasNomad Spades card image URLs
// Only spades suit has custom images; other suits use a styled fallback

const CARD_BACK = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/711c24400_BackDesign.png';

const SPADES_IMAGES = {
  '2': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/53f30e114_2-spades.png',
  '3': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/dd0d5f07d_3-spades.png',
  '4': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/b322b21d3_4-spades.png',
  '5': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/79dd880b7_5-spades.png',
  '6': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/d282b76a3_6-spades.png',
  '7': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/c27ff1ef7_7-spades.png',
  '8': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/63d2b95a0_8-spades.png',
  '9': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/76741bf96_9-spades.png',
  '10': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1a6724f54_10-spades.png',
  'A': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/f112b1b1b_Ace-spades.png',
  'J': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/d73569090_Jack-spades.png',
  'K': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/442e05070_King-spades.png',
  'Q': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/e68cf06b4_Queen-spades.png',
};

const HEARTS_IMAGES = {
  '2': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/e310765ac_hearts-2.png',
  '3': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/c3377892f_hearts-3.png',
  '4': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/86f65cd37_hearts-4.png',
  '5': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/3072be389_hearts-5.png',
  '6': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/a1e31dbaf_hearts-6.png',
  '7': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/558934f0e_hearts-7.png',
  '8': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/561cdc8de_hearts-8.png',
  '9': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/cd985c7d9_hearts-9.png',
  'J': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/8dd0b4d5d_hearts-J.png',
  'Q': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/32394a79e_hearts-Q.png',
  'K': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/5119c6ee6_hearts-K.png',
  'A': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/0bcc16c68_hearts-A.png',
};

const DIAMONDS_IMAGES = {
  '2': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/e0ca7025b_diamonds-2.png',
  '3': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1a00a0d46_diamonds-3.png',
  '4': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/07365cea2_diamonds-4.png',
  '5': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/589949d24_diamonds-5.png',
  '6': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/cda427d97_diamonds-6.png',
  '7': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1b272df26_diamonds-7.png',
  '8': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/393115af6_diamonds-8.png',
  '9': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/6743b5917_diamonds-9.png',
  '10': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/8f3a3bb3a_diamonds-10.png',
  'J': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/dd1de24bb_diamonds-J.png',
  'Q': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/c4d98f8d5_diamonds-Q.png',
  'K': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/d0d98c669_diamonds-K.png',
  'A': 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/e1ecc1e89_diamonds-A.png',
};

export function getCardImage(card) {
  if (!card) return null;
  if (card.suit === '♠') {
    return SPADES_IMAGES[card.value] || null;
  }
  if (card.suit === '♥') {
    return HEARTS_IMAGES[card.value] || null;
  }
  if (card.suit === '♦') {
    return DIAMONDS_IMAGES[card.value] || null;
  }
  return null;
}

export function getCardBack() {
  return CARD_BACK;
}