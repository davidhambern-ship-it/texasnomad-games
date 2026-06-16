// Word Wrangler - Target Word Generator for Bookworm-style gameplay
// Generates a board with 5 connected target words that are physically playable

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

// Helper functions for cell letter manipulation
export function getLetter(cell) {
  return typeof cell === 'string' ? cell : cell?.letter;
}

export function setLetter(cell, letter) {
  if (typeof cell === 'string' || cell == null) return letter;
  return { ...cell, letter };
}

export function normalizeWord(word) {
  return String(word || '').toUpperCase().trim();
}

// All 8 directions for path building
const PATH_DIRECTIONS = [
  [-1,-1], [-1,0], [-1,1],
  [0,-1],          [0,1],
  [1,-1],  [1,0],  [1,1],
];

// Force place a connected word path on the board
export function forcePlaceConnectedWord(board, word) {
  const clean = normalizeWord(word);
  const size = board.length;

  for (let attempt = 0; attempt < 500; attempt++) {
    const path = [];
    let row = Math.floor(Math.random() * size);
    let col = Math.floor(Math.random() * size);

    path.push({ row, col });

    for (let i = 1; i < clean.length; i++) {
      const options = PATH_DIRECTIONS
        .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
        .filter(pos =>
          pos.row >= 0 &&
          pos.row < size &&
          pos.col >= 0 &&
          pos.col < size &&
          !path.some(p => p.row === pos.row && p.col === pos.col)
        );

      if (!options.length) break;

      const next = options[Math.floor(Math.random() * options.length)];
      path.push(next);
      row = next.row;
      col = next.col;
    }

    if (path.length === clean.length) {
      const newBoard = board.map(r => r.map(cell => ({ ...(typeof cell === 'string' ? { letter: cell } : cell) })));

      path.forEach((pos, i) => {
        newBoard[pos.row][pos.col] = {
          ...(newBoard[pos.row][pos.col] || {}),
          letter: clean[i]
        };
      });

      return newBoard;
    }
  }

  return board;
}

// Ensure all active words are placed as connected paths on the board
export function ensureActiveWordsOnBoard(board, activeWords = []) {
  let fixedBoard = board;

  activeWords.forEach(word => {
    fixedBoard = forcePlaceConnectedWord(fixedBoard, word);
  });

  return fixedBoard;
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

// Place a word as a connected path on the board, overwriting if needed
function placeWordAsPath(board, word, boardSize) {
  // Try to find a valid path for this word
  for (let startRow = 0; startRow < boardSize; startRow++) {
    for (let startCol = 0; startCol < boardSize; startCol++) {
      for (const [dRow, dCol] of DIRECTIONS) {
        const endRow = startRow + (word.length - 1) * dRow;
        const endCol = startCol + (word.length - 1) * dCol;
        
        if (endRow < 0 || endRow >= boardSize || endCol < 0 || endCol >= boardSize) {
          continue;
        }
        
        // Place the word
        const path = [];
        for (let i = 0; i < word.length; i++) {
          const row = startRow + i * dRow;
          const col = startCol + i * dCol;
          board[row][col] = word[i];
          path.push({ row, col, letter: word[i] });
        }
        
        return { word, path, startRow, startCol, direction: [dRow, dCol] };
      }
    }
  }
  
  return null;
}

export function generateBoardWithWords(boardSize, activeWordCount = 5) {
  // Initialize empty board
  const board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
  const placedWords = [];
  
  // Pick words and sort by length (longer first for better placement)
  const words = pickTargetWords(activeWordCount * 4, 3, 8).sort((a, b) => b.length - a.length);
  
  // Place each word as a connected path
  for (const word of words) {
    if (placedWords.length >= activeWordCount) break;
    
    // Skip if word is too long for board
    if (word.length > boardSize) continue;
    
    const placed = placeWordAsPath(board, word, boardSize);
    if (placed) {
      placedWords.push(placed);
    }
  }
  
  // Fill remaining empty cells with random letters
  const vowels = 'AEIOU';
  const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
  
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (board[row][col] === null || board[row][col] === '') {
        board[row][col] = Math.random() < 0.4 
          ? vowels[Math.floor(Math.random() * vowels.length)]
          : consonants[Math.floor(Math.random() * consonants.length)];
      }
    }
  }
  
  return { board, placedWords };
}

export function injectWordIntoBoard(board, word, boardSize) {
  // Try to inject word by overwriting existing letters (not just empty cells)
  // This ensures new words are always playable after cascade fills the board
  for (const direction of DIRECTIONS) {
    for (let startRow = 0; startRow < boardSize; startRow++) {
      for (let startCol = 0; startCol < boardSize; startCol++) {
        const [dRow, dCol] = direction;
        const endRow = startRow + (word.length - 1) * dRow;
        const endCol = startCol + (word.length - 1) * dCol;
        
        // Check bounds
        if (endRow < 0 || endRow >= boardSize || endCol < 0 || endCol >= boardSize) {
          continue;
        }
        
        // Place the word (overwriting existing letters)
        const placed = [];
        for (let i = 0; i < word.length; i++) {
          const row = startRow + i * dRow;
          const col = startCol + i * dCol;
          placed.push({ row, col, letter: word[i] });
        }
        
        return { word, startRow, startCol, direction, placed };
      }
    }
  }
  
  return null;
}

// Get 5 visible target words from the full list
export function getVisibleTargetWords(allWords, foundWords, visibleCount = 5) {
  const remaining = allWords.filter(w => !foundWords.includes(w.word));
  return remaining.slice(0, visibleCount);
}

// Check if a word matches any target word
export function isTargetWord(word, targetWords) {
  if (!Array.isArray(targetWords)) return false;
  return targetWords.some(t => {
    const targetWord = typeof t === 'string' ? t : t?.word;
    return targetWord === word;
  });
}

// Check if a word can be spelled on the current board using adjacent tiles
export function canSpellWordOnBoard(word, board) {
  if (!word || word.length === 0 || !board || board.length === 0) return false;
  
  const size = board.length;
  
  function canFindFromCell(rowIndex, colIndex, charIndex, visited) {
    if (charIndex === word.length) return true;
    
    const key = `${rowIndex}-${colIndex}`;
    if (rowIndex < 0 || rowIndex >= size || colIndex < 0 || colIndex >= size) return false;
    if (visited.has(key)) return false;
    
    const cellLetter = board[rowIndex][colIndex]?.letter;
    if (cellLetter !== word[charIndex]) return false;
    
    visited.add(key);
    
    const directions = [
      [0, 1], [0, -1], [1, 0], [-1, 0],
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];
    
    for (const [dRow, dCol] of directions) {
      if (canFindFromCell(rowIndex + dRow, colIndex + dCol, charIndex + 1, visited)) {
        return true;
      }
    }
    
    visited.delete(key);
    return false;
  }
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col]?.letter === word[0]) {
        const visited = new Set();
        if (canFindFromCell(row, col, 0, visited)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

// Get playable target words that can actually be spelled on the current board
export function getPlayableTargetWords(allTargetWords, board, foundWords, count = 5) {
  if (!allTargetWords || !board) return [];
  
  const remaining = allTargetWords.filter(w => !foundWords.includes(w));
  const playable = remaining.filter(word => canSpellWordOnBoard(word, board));
  
  return playable.slice(0, count);
}