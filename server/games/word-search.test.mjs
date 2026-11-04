import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyWordSearchTimeout,
  buildWordSearchPuzzle,
  defaultWordSearchState,
  publicWordSearchState,
  revealWordSearchWord,
  startWordSearchGame,
  submitWordSearchSelection,
} from './word-search.js';

function wordText(grid, cells) {
  return cells.map((id) => {
    const [y, x] = id.split('-').map(Number);
    return grid[y][x];
  }).join('');
}

test('all category and difficulty puzzles have a square board and valid word paths', () => {
  const categories = [
    'random', 'popculture', 'online', 'food', 'spiritual',
    'gaming', 'music', 'travel', 'general',
  ];

  for (const [difficulty, size] of [
    ['simpleton', 12],
    ['reader', 16],
    ['scholar', 22],
  ]) {
    for (const category of categories) {
      const { grid, words } = buildWordSearchPuzzle(difficulty, category);
      assert.equal(grid.length, size, `${category} / ${difficulty} board height`);
      assert.ok(grid.every((row) => row.length === size && row.every((cell) => /^[A-Z]$/.test(cell))));
      assert.ok(words.length > 0, `${category} / ${difficulty} must place words`);

      for (const word of words) {
        assert.equal(wordText(grid, word.cells), word.word);
        assert.equal(word.cells.length, word.word.length);
        assert.ok(word.points > 0);
      }
    }
  }
});

test('starting a game requires a player and initializes a race round', () => {
  assert.throws(
    () => startWordSearchGame(defaultWordSearchState(), { activeSeats: [] }),
    { code: 'WORD_SEARCH_PLAYER_REQUIRED' },
  );

  const state = startWordSearchGame(defaultWordSearchState(), {
    mode: 'race',
    difficulty: 'simpleton',
    category: 'gaming',
    activeSeats: [1, 2],
  });

  assert.equal(state.phase, 'playing');
  assert.equal(state.mode, 'race');
  assert.equal(state.category, 'gaming');
  assert.equal(state.grid.length, 12);
  assert.ok(state.time_end > Date.now());
  assert.equal(state.scores['1'], 0);
  assert.equal(state.scores['2'], 0);
});

test('a correct reverse-direction selection scores once and marks the word found', () => {
  const started = startWordSearchGame(defaultWordSearchState(), {
    mode: 'race',
    activeSeats: [1, 2],
  });
  const target = started.words[0];
  const reversedCells = [...target.cells].reverse();
  const result = submitWordSearchSelection(started, {
    actorSeat: 2,
    cells: reversedCells,
    activeSeats: [1, 2],
  });

  const found = result.state.words.find((word) => word.word === target.word);
  assert.equal(found.found, true);
  assert.equal(found.foundBy, 2);
  assert.equal(result.state.scores['2'], target.points);
  assert.equal(result.matched.word, target.word);
});

test('wrong selections apply the penalty and advance turn mode', () => {
  const started = startWordSearchGame(defaultWordSearchState(), {
    mode: 'turn',
    activeSeats: [1, 2],
  });
  const result = submitWordSearchSelection(started, {
    actorSeat: 1,
    cells: ['999-999', '999-1000'],
    activeSeats: [1, 2],
  });

  assert.equal(result.matched, null);
  assert.equal(result.state.scores['1'], -20);
  assert.equal(result.state.active_seat, 2);
  assert.equal(result.state.last_action.result, 'wrong');
});

test('turn timeout applies its penalty and advances to the next active seat', () => {
  const started = startWordSearchGame(defaultWordSearchState(), {
    mode: 'turn',
    activeSeats: [1, 2, 3],
  });
  const expired = { ...started, active_seat: 2, time_end: Date.now() - 1 };
  const next = applyWordSearchTimeout(expired, [1, 2, 3]);

  assert.equal(next.scores['2'], -10);
  assert.equal(next.active_seat, 3);
  assert.equal(next.last_action.type, 'timeout');
  assert.ok(next.time_end > Date.now());
});

test('race timeout finishes the round and chooses the highest scorer', () => {
  const started = startWordSearchGame(defaultWordSearchState(), {
    mode: 'race',
    activeSeats: [1, 2],
  });
  const expired = {
    ...started,
    time_end: Date.now() - 1,
    scores: { ...started.scores, '1': 100, '2': 250 },
  };
  const finished = applyWordSearchTimeout(expired, [1, 2]);

  assert.equal(finished.phase, 'finished');
  assert.equal(finished.winner_seat, 2);
  assert.equal(finished.message, 'Time is up!');
});

test('revealing a word does not award points and public state hides unfound paths', () => {
  const started = startWordSearchGame(defaultWordSearchState(), {
    mode: 'race',
    activeSeats: [1],
  });
  const hidden = publicWordSearchState(started, [{ seatNumber: 1, name: 'Host' }], 1);
  assert.deepEqual(hidden.words[0].cells, []);
  assert.equal(hidden.words[0].points, null);

  const revealed = revealWordSearchWord(started, [1]);
  assert.equal(revealed.words[0].found, true);
  assert.equal(revealed.words[0].revealed, true);
  assert.equal(revealed.scores['1'], 0);
});
