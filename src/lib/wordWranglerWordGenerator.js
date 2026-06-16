// Word Wrangler - Target Word Generator for Bookworm-style gameplay
// Generates a board with 20 embeddable target words that can actually be found

// WORD WRANGLER MASTER WORD LIST
// Curated word bank organized by category
// Rules: 3-8 letters, common words, no proper nouns, no profanity

const WORD_POOL = [
  // ANIMALS (3-8 letters)
  'DOG','CAT','FROG','BEAR','WOLF','LION','TIGER','MOUSE','HORSE','SNAKE','EAGLE','SHARK','WHALE','OTTER','RAVEN','GOOSE','DUCK','CROW','MULE','BISON','DEER','FOX','HAWK','OWL','MOLE','CRAB','SEAL','PUMA','RAM','YAK',
  
  // FOOD (3-8 letters)
  'APPLE','PEACH','GRAPE','BERRY','LEMON','MANGO','PEAR','PLUM','MELON','BREAD','STEAK','BACON','PIZZA','PASTA','RICE','BEANS','CHILI','CAKE','PIE','CANDY','COOKIE','HONEY','SUGAR','SALAD','SOUP','ROLL','CHIPS','TACO','BURGER','FRIES',
  
  // NATURE (3-8 letters)
  'TREE','GRASS','RIVER','LAKE','POND','ROCK','STONE','CLIFF','CLOUD','RAIN','STORM','WIND','SNOW','FROST','EMBER','FLAME','OCEAN','BEACH','SHELL','MOSS','CAVE','DIRT','MUD','DUNE','LEAF','ROOT','BLOOM','SEED','FERN','BARK',
  
  // HOME (3-8 letters)
  'CHAIR','TABLE','COUCH','CLOCK','DOOR','FLOOR','WALL','LAMP','SHELF','BED','PILLOW','BLANKET','RUG','OVEN','SPOON','FORK','PLATE','CUP','MUG','BROOM','SOAP','TOWEL','BRUSH','FRAME','PAN','BOWL','KNIFE','TRAY','STOOL','DESK',
  
  // TEXASNOMAD (3-8 letters)
  'BEAN','GOLD','DEXTER','FROG','BOOT','HAT','ROPE','SPUR','TEXAS','RANCH','HORSE','SALOON','BADGE','CARD','DICE','MIC','CAMERA','LIGHT','STREAM','HOST','PLAYER','ROOM','TEAM','BONUS','SCORE','ROUND','QUEST','PRIZE','TOKEN','GEM',
  
  // JOBS (3-8 letters)
  'CHEF','PILOT','NURSE','DOCTOR','TEACHER','FARMER','JUDGE','CLERK','BAKER','DRIVER','WRITER','SINGER','ACTOR','COACH','GUARD','MINER','RANGER','ARTIST','DANCER','SERVER','BOSS','MAYOR','CAPTAIN','SAILOR','WORKER','EDITOR','DESIGNER','CASHIER','PLUMBER','ELECTRIC',
  
  // SPORTS (3-8 letters)
  'GOLF','TENNIS','SOCCER','BASEBALL','FOOTBALL','RUGBY','RACE','TRACK','SKATE','BOXING','HOCKEY','SWIM','DIVE','BOWL','SPORT','TEAM','SCORE','COACH','FIELD','COURT','GOAL','PASS','KICK','RUN','JUMP','THROW','MATCH','GAME','WIN','LOSE',
  
  // TRAVEL (3-8 letters)
  'TRAIN','PLANE','HOTEL','ROAD','TRIP','MAP','GUIDE','TICKET','BAG','LUGGAGE','TAXI','CAB','PORT','DOCK','BRIDGE','TUNNEL','ROUTE','TRAIL','CAMP','PARK','CITY','TOWN','STATE','COUNTRY','ISLAND','RESORT','MOTEL','STOP','SIGN','GATE',
  
  // TECH (3-8 letters)
  'PHONE','TABLET','SCREEN','MOUSE','KEYBOARD','MONITOR','CAMERA','VIDEO','AUDIO','STREAM','PIXEL','CABLE','SERVER','ROUTER','BUTTON','WINDOW','BROWSER','LOGIN','UPLOAD','DOWNLOAD','APP','CODE','DATA','FILE','FOLDER','EMAIL','CHAT','TEXT','CLICK','TOUCH',
];

// Filter to only words that can fit on our board (3-8 letters typically)
const VALID_WORDS = WORD_POOL.filter(w => w.length >= 3 && w.length <= 8);

// Directions: [rowDelta, colDelta]
const DIRECTIONS = [
  [0, 1],   // horizontal right
  [1, 0],   // vertical down
  [1, 1],   // diagonal down-right
  [-1, 1],  // diagonal up-right
  [0, -1],  // horizontal left
  [-1, 0],  // vertical up
  [-1, -1], // diagonal up-left
  [1, -1],  // diagonal down-left
];

export function pickTargetWords(count, minLength = 3, maxLength = 8) {
  const filtered = VALID_WORDS.filter(w => w.length >= minLength && w.length <= maxLength);
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function canPlaceWord(board, word, startRow, startCol, direction) {
  const [dRow, dCol] = direction;
  const size = board.length;
  
  for (let i = 0; i < word.length; i++) {
    const row = startRow + i * dRow;
    const col = startCol + i * dCol;
    
    // Out of bounds
    if (row < 0 || row >= size || col < 0 || col >= size) {
      return false;
    }
    
    // Cell must be empty or match the letter
    if (board[row][col] !== null && board[row][col] !== word[i]) {
      return false;
    }
  }
  
  return true;
}

export function placeWord(board, word, startRow, startCol, direction) {
  const [dRow, dCol] = direction;
  const placed = [];
  
  for (let i = 0; i < word.length; i++) {
    const row = startRow + i * dRow;
    const col = startCol + i * dCol;
    board[row][col] = word[i];
    placed.push({ row, col, letter: word[i] });
  }
  
  return placed;
}

export function generateBoardWithWords(boardSize, targetWordCount = 20) {
  // Initialize empty board
  const board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
  const placedWords = [];
  
  // Sort words by length (longer first - harder to place)
  const words = pickTargetWords(targetWordCount * 2, 3, 8).sort((a, b) => b.length - a.length);
  
  // Try to place words
  for (const word of words) {
    if (placedWords.length >= targetWordCount) break;
    
    let placed = false;
    const attempts = 50;
    
    for (let attempt = 0; attempt < attempts && !placed; attempt++) {
      const startRow = Math.floor(Math.random() * boardSize);
      const startCol = Math.floor(Math.random() * boardSize);
      
      // Shuffle directions for variety
      const shuffledDirections = [...DIRECTIONS].sort(() => Math.random() - 0.5);
      
      for (const direction of shuffledDirections) {
        if (canPlaceWord(board, word, startRow, startCol, direction)) {
          placeWord(board, word, startRow, startCol, direction);
          placedWords.push({
            word,
            startRow,
            startCol,
            direction,
          });
          placed = true;
          break;
        }
      }
    }
  }
  
  // Fill empty cells with random letters
  const vowels = 'AEIOU';
  const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
  
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (board[row][col] === null) {
        // 40% vowel, 60% consonant for natural distribution
        board[row][col] = Math.random() < 0.4 
          ? vowels[Math.floor(Math.random() * vowels.length)]
          : consonants[Math.floor(Math.random() * consonants.length)];
      }
    }
  }
  
  return { board, placedWords };
}

// Get 5 visible target words from the full list
export function getVisibleTargetWords(allWords, foundWords, visibleCount = 5) {
  const remaining = allWords.filter(w => !foundWords.includes(w.word));
  return remaining.slice(0, visibleCount);
}

// Check if a word matches any target word
export function isTargetWord(word, targetWords) {
  return targetWords.some(t => t.word === word);
}