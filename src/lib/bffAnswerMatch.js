/**
 * BFF Answer Matching Engine
 * Handles normalization, synonyms, fuzzy matching, and debug logging.
 */

// ── Synonym map (bidirectional) ─────────────────────────────────────────────
// Cross-concept groups: words that aren't synonyms but are conceptually related
const CROSS_CONCEPT_GROUPS = [
  // Food ↔ Cooking relationship
  ['food', 'meal', 'dish', 'grub', 'eats', 'cook', 'cooking', 'cooked', 'kitchen', 'chef', 'recipe', 'ingredients'],
  // Sleep ↔ Dreams
  ['sleep', 'rest', 'nap', 'snooze', 'slumber', 'dream', 'dreams', 'nightmare', 'bed'],
  // Money ↔ Work
  ['money', 'cash', 'currency', 'funds', 'dough', 'bread', 'job', 'work', 'occupation', 'career', 'salary', 'pay', 'income'],
  // Love ↔ Relationship
  ['love', 'affection', 'adore', 'care', 'devotion', 'relationship', 'dating', 'romance', 'partner', 'crush'],
  // Fear ↔ Scared
  ['fear', 'scared', 'afraid', 'phobia', 'terrified', 'worried', 'anxious', 'nervous', 'panic'],
  // Anger ↔ Fight
  ['angry', 'mad', 'furious', 'upset', 'irate', 'livid', 'fight', 'argue', 'quarrel', 'bicker', 'conflict'],
  // Sad ↔ Cry
  ['sad', 'unhappy', 'depressed', 'upset', 'down', 'miserable', 'gloomy', 'cry', 'crying', 'tears'],
  // Happy ↔ Smile
  ['happy', 'joyful', 'glad', 'pleased', 'cheerful', 'content', 'elated', 'smile', 'smiling', 'laugh'],
  // Tired ↔ Sleep
  ['tired', 'exhausted', 'sleepy', 'weary', 'fatigued', 'sleep', 'rest', 'nap'],
  // Doctor ↔ Hospital
  ['doctor', 'physician', 'medical doctor', 'doc', 'md', 'hospital', 'clinic', 'medical center', 'nurse'],
  // School ↔ Learning
  ['school', 'class', 'classroom', 'education', 'learn', 'learning', 'study', 'student', 'teacher'],
  // Car ↔ Drive
  ['car', 'vehicle', 'automobile', 'auto', 'drive', 'driving', 'road', 'street'],
  // Phone ↔ Call
  ['phone', 'cell phone', 'cellphone', 'mobile', 'telephone', 'call', 'calling', 'text'],
  // Music ↔ Song
  ['music', 'song', 'tune', 'melody', 'track', 'sing', 'singing', 'dance'],
  // Book ↔ Read
  ['book', 'novel', 'story', 'read', 'reading', 'library', 'author'],
  // Movie ↔ Watch
  ['movie', 'film', 'flick', 'picture', 'watch', 'watching', 'cinema', 'theater'],
  // Pet ↔ Animal
  ['dog', 'puppy', 'pup', 'canine', 'cat', 'kitty', 'kitten', 'feline', 'pet', 'animal'],
  // Family ↔ Home
  ['family', 'relatives', 'kin', 'folks', 'house', 'home', 'residence', 'household'],
  // Time ↔ Clock
  ['time', 'moment', 'period', 'hour', 'second', 'minute', 'clock', 'watch', 'schedule'],
  // Place ↔ Location
  ['place', 'location', 'spot', 'area', 'venue', 'site', 'where', 'destination'],
];

const SYNONYM_GROUPS = [
  ['sickness', 'illness', 'disease', 'ailment', 'condition'],
  ['doctor', 'physician', 'medical doctor', 'doc', 'md'],
  ['job', 'work', 'occupation', 'career', 'profession', 'employment'],
  ['car', 'vehicle', 'automobile', 'auto'],
  ['kids', 'children', 'child', 'kid'],
  ['mom', 'mother', 'mama', 'mum', 'mommy', 'mamma'],
  ['dad', 'father', 'papa', 'daddy', 'pop', 'pops'],
  ['money', 'cash', 'currency', 'funds', 'dough', 'bread'],
  ['house', 'home', 'residence', 'dwelling', 'household'],
  ['school', 'class', 'classroom', 'education'],
  ['food', 'meal', 'dish', 'grub', 'eats', 'cooking', 'cook'],
  ['bathroom', 'restroom', 'toilet', 'lavatory', 'washroom', 'powder room', 'wc'],
  ['phone', 'cell phone', 'cellphone', 'mobile', 'telephone', 'cell', 'mobile phone'],
  ['tv', 'television', 'telly', 'tube'],
  ['friend', 'buddy', 'pal', 'companion', 'mate', 'amigo'],
  ['happy', 'joyful', 'glad', 'pleased', 'cheerful', 'content', 'elated'],
  ['sad', 'unhappy', 'depressed', 'upset', 'down', 'miserable', 'gloomy'],
  ['angry', 'mad', 'furious', 'upset', 'irate', 'livid'],
  ['tired', 'exhausted', 'sleepy', 'weary', 'fatigued'],
  ['scared', 'afraid', 'fearful', 'frightened', 'terrified', 'nervous'],
  ['fast', 'quick', 'speedy', 'rapid', 'swift'],
  ['big', 'large', 'huge', 'giant', 'enormous', 'massive'],
  ['small', 'little', 'tiny', 'mini', 'petite', 'miniature'],
  ['old', 'elderly', 'aged', 'senior', 'ancient'],
  ['pretty', 'beautiful', 'attractive', 'gorgeous', 'lovely', 'cute'],
  ['smart', 'intelligent', 'clever', 'bright', 'wise', 'genius'],
  ['stupid', 'dumb', 'foolish', 'silly', 'idiot', 'ignorant'],
  ['drink', 'beverage', 'liquid', 'sip'],
  ['eat', 'consume', 'munch', 'snack', 'dine'],
  ['walk', 'stroll', 'hike', 'trek'],
  ['run', 'jog', 'sprint', 'dash'],
  ['talk', 'speak', 'chat', 'converse', 'communicate'],
  ['look', 'see', 'watch', 'observe', 'view', 'glance'],
  ['buy', 'purchase', 'shop', 'acquire', 'get'],
  ['movie', 'film', 'flick', 'picture'],
  ['music', 'song', 'tune', 'melody', 'track'],
  ['book', 'novel', 'story', 'read'],
  ['game', 'sport', 'play', 'contest'],
  ['party', 'celebration', 'gathering', 'event', 'get together'],
  ['vacation', 'holiday', 'trip', 'getaway', 'travel'],
  ['church', 'chapel', 'temple', 'place of worship', 'worship'],
  ['store', 'shop', 'market', 'mall', 'supermarket'],
  ['sleep', 'rest', 'nap', 'snooze', 'slumber'],
  ['cook', 'prepare food', 'make food', 'bake', 'fry', 'grill', 'cooking', 'cooked'],
  ['fight', 'argue', 'quarrel', 'bicker', 'disagree', 'conflict'],
  ['love', 'affection', 'adore', 'care', 'devotion'],
  ['hate', 'dislike', 'despise', 'loathe', 'detest'],
  ['help', 'assist', 'support', 'aid', 'lend a hand'],
  ['problem', 'issue', 'trouble', 'difficulty', 'challenge', 'concern'],
  ['idea', 'thought', 'concept', 'notion', 'plan'],
  ['time', 'moment', 'period', 'hour', 'second', 'minute'],
  ['place', 'location', 'spot', 'area', 'venue', 'site'],
  ['thing', 'item', 'object', 'stuff'],
  ['road', 'street', 'avenue', 'highway', 'path', 'route', 'way'],
  ['dog', 'puppy', 'pup', 'canine', 'hound', 'doggy'],
  ['cat', 'kitty', 'kitten', 'feline', 'kittycat'],
  ['baby', 'infant', 'newborn', 'toddler'],
  ['wife', 'spouse', 'partner', 'significant other', 'other half'],
  ['husband', 'spouse', 'partner', 'significant other', 'other half'],
  ['family', 'relatives', 'kin', 'folks'],
  ['boss', 'manager', 'supervisor', 'employer'],
  ['employee', 'worker', 'staff', 'coworker'],
  ['teacher', 'instructor', 'educator', 'professor', 'tutor'],
  ['student', 'pupil', 'learner', 'scholar'],
  ['police', 'cop', 'officer', 'law enforcement', 'detective'],
  ['hospital', 'clinic', 'medical center', 'emergency room', 'er'],
  ['computer', 'laptop', 'pc', 'desktop'],
  ['internet', 'web', 'online', 'wifi'],
  ['accident', 'crash', 'collision', 'incident', 'mishap'],
  ['emergency', 'crisis', 'urgent', 'disaster'],
  ['pain', 'hurt', 'ache', 'discomfort', 'soreness'],
  ['medicine', 'medication', 'drug', 'prescription', 'pill'],
  ['exercise', 'workout', 'fitness', 'gym', 'training'],
  ['weight', 'pounds', 'lbs', 'kilos'],
  ['money problems', 'financial issues', 'debt', 'broke', 'poverty'],
  ['stress', 'anxiety', 'pressure', 'worry', 'tension'],
  ['fun', 'enjoyment', 'pleasure', 'entertainment', 'amusement'],
  ['joke', 'humor', 'comedy', 'funny', 'laugh'],
  ['gift', 'present', 'surprise', 'treat'],
  ['dinner', 'supper', 'evening meal'],
  ['breakfast', 'morning meal', 'brunch'],
  ['lunch', 'midday meal', 'brunch'],
  ['sport', 'athletics', 'activity', 'recreational activity'],
  ['beer', 'ale', 'brew', 'lager'],
  ['wine', 'vino', 'bubbly', 'champagne'],
  ['alcohol', 'booze', 'liquor', 'spirits', 'drinks'],
  ['clothing', 'clothes', 'outfit', 'attire', 'apparel', 'dress', 'garment', 'wear'],
  ['shoes', 'sneakers', 'footwear', 'boots', 'heels'],
  ['hair', 'haircut', 'hairstyle', 'hairdo'],
  ['money', 'finances', 'budget', 'savings', 'income'],
  ['lie', 'lies', 'lying', 'dishonest', 'untruthful', 'deceive', 'deception'],
  ['secret', 'secrets', 'hidden', 'conceal', 'private'],
  ['fear', 'scared', 'afraid', 'phobia', 'terrified', 'worried', 'anxious'],
  ['embarrassing', 'embarrassed', 'shameful', 'shame', 'humiliating', 'awkward'],
  ['regret', 'regrets', 'sorry', 'remorse', 'wish'],
  ['crush', 'infatuation', 'attraction', 'like', 'love interest'],
  ['weird', 'strange', 'odd', 'bizarre', 'unusual', 'creepy'],
  ['gross', 'disgusting', 'revolting', 'nasty', 'vile'],
  ['awesome', 'amazing', 'cool', 'great', 'excellent', 'fantastic', 'wonderful'],
  ['terrible', 'awful', 'horrible', 'bad', 'worst', 'dreadful'],
  ['nervous', 'anxious', 'uneasy', 'apprehensive', 'jittery', 'worried'],
  ['guilty', 'guilt', 'blame', 'responsible', 'at fault'],
  ['jealous', 'jealousy', 'envious', 'envy', 'possessive'],
  ['lonely', 'loneliness', 'isolated', 'alone', 'solitary'],
  ['confident', 'confidence', 'self assured', 'bold', 'certain'],
  ['insecure', 'insecurity', 'uncertain', 'doubtful', 'unsure'],
  ['pet peeve', 'annoyance', 'irritation', 'bother', 'hate'],
  ['habit', 'habits', 'routine', 'custom', 'practice', 'addiction'],
  ['talent', 'talents', 'skill', 'ability', 'gift', 'strength'],
  ['dream', 'dreams', 'goal', 'aspiration', 'wish', 'ambition'],
  ['nightmare', 'bad dream', 'terrifying', 'horror'],
  ['memory', 'memories', 'remember', 'recall', 'nostalgia'],
  ['favorite', 'favourite', 'best', 'top', 'preferred', 'most liked'],
  ['first time', 'first', 'debut', 'maiden'],
  ['last time', 'last', 'most recent', 'final'],
  ['childhood', 'child', 'kid', 'young', 'growing up'],
  ['adult', 'grown up', 'mature', 'older'],
  ['relationship', 'relationships', 'dating', 'romance', 'partner'],
  ['breakup', 'break up', 'split', 'separation', 'divorce'],
  ['trust', 'trusts', 'believe', 'faith', 'rely'],
  ['betray', 'betrayal', 'backstab', 'deceive', 'cheat'],
  ['forgive', 'forgiveness', 'pardon', 'excuse', 'let go'],
  ['apologize', 'apology', 'say sorry', 'apologetic', 'regret'],
  ['compliment', 'praise', 'flattery', 'kind words'],
  ['insult', 'offense', 'rude', 'disrespect', 'mean'],
  ['revenge', 'vengeance', 'payback', 'retaliation'],
  ['prank', 'practical joke', 'joke', 'trick', 'hoax'],
  ['addiction', 'addicted', 'dependence', 'hooked', 'obsession'],
  ['phobia', 'fear', 'panic', 'terror'],
  ['what', 'which', 'who', 'when', 'where', 'why', 'how'],
  ['cooks', 'cook', 'cooking', 'cooked', 'prepare', 'makes', 'make'],
];

// Build flat synonym lookup: word → group index
const synonymLookup = new Map();
SYNONYM_GROUPS.forEach((group, idx) => {
  group.forEach(word => {
    const norm = word.toLowerCase().trim();
    if (!synonymLookup.has(norm)) synonymLookup.set(norm, idx);
  });
});

// ── Normalization ────────────────────────────────────────────────────────────
const FILLER_WORDS = new Set(['a', 'an', 'the', 'my', 'your', 'our', 'their', 'its', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'so', 'yet']);

const CONTRACTIONS = {
  "i'm": 'i am', "i've": 'i have', "i'll": 'i will', "i'd": 'i would',
  "you're": 'you are', "you've": 'you have', "you'll": 'you will',
  "he's": 'he is', "she's": 'she is', "it's": 'it is', "we're": 'we are',
  "they're": 'they are', "we've": 'we have', "they've": 'they have',
  "can't": 'cannot', "won't": 'will not', "don't": 'do not', "doesn't": 'does not',
  "didn't": 'did not', "isn't": 'is not', "aren't": 'are not',
  "wasn't": 'was not', "weren't": 'were not', "haven't": 'have not',
  "hadn't": 'had not', "hasn't": 'has not', "wouldn't": 'would not',
  "shouldn't": 'should not', "couldn't": 'could not',
};

// Basic plural → singular for common endings
function singularize(word) {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('ves') && word.length > 4) return word.slice(0, -3) + 'f';
  if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes') || word.endsWith('ches') || word.endsWith('shes')) return word.slice(0, -2);
  if (word.endsWith('men') && word !== 'men') return word.slice(0, -3) + 'man';
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is') && word.length > 3) return word.slice(0, -1);
  return word;
}

export function normalize(text) {
  if (!text) return '';
  let s = String(text).toLowerCase().trim();
  // expand contractions
  Object.entries(CONTRACTIONS).forEach(([k, v]) => { s = s.replace(new RegExp(k, 'g'), v); });
  // remove punctuation
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  // collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  // remove filler words, singularize
  s = s.split(' ').filter(w => w && !FILLER_WORDS.has(w)).map(singularize).join(' ');
  return s;
}

// ── Levenshtein similarity ───────────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

// ── Synonym check ────────────────────────────────────────────────────────────
function areSynonyms(a, b) {
  const ga = synonymLookup.get(a);
  const gb = synonymLookup.get(b);
  if (ga === undefined || gb === undefined) return false;
  return ga === gb;
}

// ── Core match function ──────────────────────────────────────────────────────
/**
 * Returns { match: boolean, type: 'exact'|'synonym'|'phrase'|'fuzzy'|'rejected' }
 * answerObj can have { text, answer, synonyms: string[] }
 */
export function matchAnswer(playerGuess, answerObj) {
  const normGuess = normalize(playerGuess);
  const rawAns = answerObj.text || answerObj.answer || '';
  const normAns = normalize(rawAns);

  // 1. Exact normalized match
  if (normGuess === normAns) {
    return { match: true, type: 'exact', normGuess, normAns };
  }

  // 2. Synonym match (check all words in both normalized strings)
  const guessWords = normGuess.split(' ');
  const ansWords = normAns.split(' ');
  // Also check full phrase synonyms
  const allGuessTokens = [normGuess, ...guessWords];
  const allAnsTokens = [normAns, ...ansWords];
  for (const g of allGuessTokens) {
    for (const a of allAnsTokens) {
      if (g && a && areSynonyms(g, a)) {
        return { match: true, type: 'synonym', normGuess, normAns };
      }
    }
  }
  
  // Check if any guess word is a synonym of any answer word (partial match)
  for (const gw of guessWords) {
    if (gw.length >= 3) {
      for (const aw of ansWords) {
        if (aw.length >= 3 && areSynonyms(gw, aw)) {
          return { match: true, type: 'synonym', normGuess, normAns };
        }
      }
    }
  }

  // 3. Custom synonyms on the answer object
  const customSynonyms = answerObj.synonyms || [];
  for (const syn of customSynonyms) {
    if (normalize(syn) === normGuess) {
      return { match: true, type: 'synonym', normGuess, normAns };
    }
  }

  // 4. Phrase contains (main keyword) — more lenient
  if (normAns.length >= 3 && normGuess.includes(normAns)) {
    return { match: true, type: 'phrase', normGuess, normAns };
  }
  if (normGuess.length >= 3 && normAns.includes(normGuess)) {
    return { match: true, type: 'phrase', normGuess, normAns };
  }
  
  // Check if answer contains the key word from guess (and vice versa)
  if (ansWords.length > 1 && guessWords.length > 0) {
    for (const gw of guessWords) {
      if (gw.length >= 3 && ansWords.some(aw => aw === gw || aw.includes(gw) || gw.includes(aw))) {
        return { match: true, type: 'phrase', normGuess, normAns };
      }
    }
  }

  // 5. Fuzzy match — Levenshtein similarity
  // Threshold: more lenient for human players
  const sim = similarity(normGuess, normAns);
  const isShort = normAns.length < 4 || normGuess.length < 4;
  const threshold = isShort ? 0.85 : 0.75;

  if (sim >= threshold) {
    return { match: true, type: 'fuzzy', normGuess, normAns, sim };
  }

  // Also try fuzzy on individual words against the full answer
  for (const gw of guessWords) {
    if (gw.length >= 3) {
      const ws = similarity(gw, normAns);
      if (ws >= 0.80) return { match: true, type: 'fuzzy', normGuess, normAns, sim: ws };
    }
  }
  for (const aw of ansWords) {
    if (aw.length >= 3) {
      const ws = similarity(normGuess, aw);
      if (ws >= 0.80) return { match: true, type: 'fuzzy', normGuess, normAns, sim: ws };
    }
  }

  return { match: false, type: 'rejected', normGuess, normAns, sim };
}

/**
 * Find the first unrevealed answer that matches the player's guess.
 * Returns { idx, result } or { idx: -1 }
 * Also logs debug info to console.
 */
export function findMatchingAnswer(playerGuess, answers, debug = false) {
  for (let i = 0; i < answers.length; i++) {
    const ans = answers[i];
    if (ans.revealed) continue;
    const result = matchAnswer(playerGuess, ans);
    if (debug) {
      console.log(`[BFF Match] guess="${playerGuess}" | norm="${result.normGuess}" | answer="${ans.text || ans.answer}" | norm="${result.normAns}" | type=${result.type}${result.sim !== undefined ? ` | sim=${result.sim?.toFixed(3)}` : ''}`);
    }
    if (result.match) return { idx: i, result };
  }
  return { idx: -1 };
}