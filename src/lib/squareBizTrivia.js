import { base44 } from '@/api/base44Client';

// Generates a fresh, up-to-date multiple-choice trivia question focused on
// pop culture and current events. Uses InvokeLLM with web-search context so
// questions stay current. Returns the same shape the UI expects:
//   { id, question, answer_a, answer_b, answer_c, answer_d, correct_answer, category }
// Returns null on failure (callers fall back gracefully).

// In-memory history of recent questions so the LLM doesn't repeat itself
const MAX_HISTORY = 40;
const recentQuestions = [];

export async function fetchTriviaQuestion() {
  const avoidList = recentQuestions.length
    ? `\nIMPORTANT: Do NOT ask about any of these topics/questions (they were asked recently):\n${recentQuestions.map(q => `- ${q}`).join('\n')}\nPick a completely different topic and angle.`
    : '';

  const prompt = [
    'Generate ONE engaging multiple-choice trivia question.',
    'Focus on pop culture and current events: movies, TV, music, celebrities,',
    'sports, trending topics, viral moments, and recent news from the last few years.',
    'Avoid obscure or overly academic trivia. Keep it fun and widely recognizable.',
    'Vary the topic widely across entertainment, sports, tech, world events, music, etc.',
    'Provide exactly 4 answer choices (one correct, three plausible but incorrect).',
    'Shuffle the order of the choices randomly.',
    'Return the result as JSON matching the provided schema.',
    avoidList,
  ].join(' ');

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    response_json_schema: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        category: { type: 'string' },
        choices: {
          type: 'array',
          items: { type: 'string' },
          description: 'Exactly 4 answer choices in shuffled order',
        },
        correct_answer: {
          type: 'string',
          description: 'The correct answer text (must match one of the choices)',
        },
      },
      required: ['question', 'category', 'choices', 'correct_answer'],
    },
  });

  const data = typeof res === 'string' ? JSON.parse(res) : res;
  if (!data || !data.choices || data.choices.length < 4 || !data.correct_answer) return null;

  // Track a short snippet of the question to avoid repeats
  const snippet = data.question.slice(0, 60);
  recentQuestions.push(snippet);
  if (recentQuestions.length > MAX_HISTORY) recentQuestions.shift();

  // Shuffle once more for good measure
  const shuffled = [...data.choices].sort(() => Math.random() - 0.5);
  const letters = ['A', 'B', 'C', 'D'];
  const correctIdx = shuffled.indexOf(data.correct_answer);
  if (correctIdx === -1) return null;

  return {
    id: Math.random().toString(36),
    question: data.question,
    answer_a: shuffled[0],
    answer_b: shuffled[1],
    answer_c: shuffled[2],
    answer_d: shuffled[3],
    correct_answer: letters[correctIdx],
    category: data.category || 'Pop Culture',
  };
}