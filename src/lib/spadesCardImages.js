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

export function getCardImage(card) {
  if (!card) return null;
  if (card.suit === '♠') {
    return SPADES_IMAGES[card.value] || null;
  }
  return null;
}

export function getCardBack() {
  return CARD_BACK;
}