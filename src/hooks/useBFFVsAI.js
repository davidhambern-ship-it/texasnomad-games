/**
 * useBFFVsAI — manages all AI logic for BFF Play vs AI mode.
 * Handles:
 *   - Buzzer timing (AI reaction delays per character)
 *   - AI answer generation (personality-based)
 *   - Auto turn advancement after AI submits
 */

import { useEffect, useRef } from 'react';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';
import { findMatchingAnswer } from '@/lib/bffAnswerMatch';

// Per-character accuracy (0-1)
const AI_ACCURACY = {
  berna: 0.80,
  dexter: 0.85,
  lemonade: 0.65,
  carlos: 0.50,
  violet: 0.75,
  tank: 0.78,
};

// Per-character buzzer reaction range [min, max] ms
// Minimum 2500ms so humans always have time to read the question first
const AI_REACTION = {
  berna: [2800, 5000],
  dexter: [3200, 6000],
  lemonade: [2500, 4500],
  carlos: [4000, 7000],
  violet: [3500, 5500],
  tank: [3800, 6500],
};

const TN_TEAM = TEXASNOMAD_CHARACTERS;

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function pickAIAnswer(character, answers, alreadyWrong) {
  const unrevealed = answers.filter(a => !a.revealed);
  if (unrevealed.length === 0) return null;

  const accuracy = AI_ACCURACY[character.id] || 0.7;
  const willBeCorrect = Math.random() < accuracy;

  if (willBeCorrect) {
    // Pick highest-points unrevealed answer
    const sorted = [...unrevealed].sort((a, b) => (b.points || 0) - (a.points || 0));
    return sorted[0];
  } else {
    // Return a plausible-sounding but wrong answer based on personality
    const wrongGuesses = [
      `${character.name}'s guess`, 'Money', 'Food', 'Family',
      'Work', 'Sleep', 'Friends', 'Love', 'Sports', 'TV',
    ];
    return wrongGuesses.find(g => !alreadyWrong.includes(g)) || 'Pass';
  }
}

function getNextAIMember(currentIdx) {
  return (currentIdx + 1) % TN_TEAM.length;
}

function getNextHumanPlayer(humanPlayers, currentPlayerId) {
  if (humanPlayers.length === 0) return null;
  if (humanPlayers.length === 1) return humanPlayers[0];
  const idx = humanPlayers.findIndex(p => p.playerId === currentPlayerId);
  return humanPlayers[(idx + 1) % humanPlayers.length];
}

export function useBFFVsAI({ gs, updateState, playerId, humanPlayers, enabled }) {
  const aiTimerRef = useRef(null);
  const buzzerTimersRef = useRef([]);
  const processedRef = useRef(null);

  // ── Buzzer Phase: schedule AI buzzers ─────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (gs.buzzer_phase !== 'buzzer_active') {
      // Cancel pending AI buzzers
      buzzerTimersRef.current.forEach(clearTimeout);
      buzzerTimersRef.current = [];
      return;
    }
    if (gs.buzz_winner) return; // already won

    // Schedule each AI character to buzz at their reaction time
    TN_TEAM.forEach(character => {
      const [min, max] = AI_REACTION[character.id] || [500, 1000];
      const delay = randomBetween(min, max);
      const t = setTimeout(async () => {
        // Re-check: if a human already buzzed, don't override
        // We rely on the state check — if buzz_winner is already set, skip
        // We'll let the component handle the race via the state
        try {
          const currentGs = gs; // closure snapshot — fine for race logic
          if (currentGs.buzz_winner) return;
          await updateState({
            buzz_winner: { playerId: `ai_${character.id}`, playerName: character.name, teamName: gs.family2 || 'TexasNomad Team', isAI: true, characterId: character.id },
            buzzer_phase: 'buzzed',
            answering_ai: true,
            answering_player_id: null,
            active_turn: 2,
          });
        } catch {}
      }, delay);
      buzzerTimersRef.current.push(t);
    });

    return () => {
      buzzerTimersRef.current.forEach(clearTimeout);
      buzzerTimersRef.current = [];
    };
  }, [enabled, gs.buzzer_phase, gs.buzz_winner]);

  // ── AI Answering: auto-submit answer when it's AI's turn ──────────────────
  useEffect(() => {
    if (!enabled) return;
    if (!gs.answering_ai || gs.buzzer_phase === 'buzzer_active' || gs.buzzer_phase === 'get_ready') return;
    if (gs.phase !== 'playing') return;

    const stateKey = `${gs.ai_member_idx}_${gs.round_bank}_${(gs.answers || []).filter(a => a.revealed).length}`;
    if (processedRef.current === stateKey) return;
    processedRef.current = stateKey;

    const character = TN_TEAM[gs.ai_member_idx || 0];
    const thinkDelay = randomBetween(1200, 2800);

    aiTimerRef.current = setTimeout(async () => {
      const answers = gs.answers || [];
      const alreadyWrong = gs.wrong_guesses || [];
      const answerResult = pickAIAnswer(character, answers, alreadyWrong);

      if (!answerResult) {
        // No more answers — end round
        await updateState({
          answering_ai: false,
          answering_player_id: null,
          ai_thinking: false,
          last_ai_answer: null,
        });
        return;
      }

      const isCorrect = typeof answerResult === 'object' && answerResult.text;

      if (isCorrect) {
        const newAnswers = answers.map(a => a.text === answerResult.text || a.answer === answerResult.text ? { ...a, revealed: true } : a);
        const newBank = (gs.round_bank || 0) + (answerResult.points || 0);
        const allRevealed = newAnswers.every(a => a.revealed);

        // Check if we should keep answering or end
        const nextMemberIdx = getNextAIMember(gs.ai_member_idx || 0);

        await updateState({
          answers: newAnswers,
          round_bank: newBank,
          last_ai_answer: { character: character.name, answer: answerResult.text || answerResult, correct: true },
          ai_thinking: false,
          wrong_guesses: [],
          // Stay in AI turn — rotate to next AI member unless all revealed
          ai_member_idx: allRevealed ? (gs.ai_member_idx || 0) : nextMemberIdx,
          answering_ai: !allRevealed,
          ...(allRevealed ? {
            // Award bank to team 2
            score2: (gs.score2 || 0) + newBank,
            round_bank: 0,
            phase: 'round_over',
          } : {}),
        });
      } else {
        // Wrong answer
        const wrongAnswer = typeof answerResult === 'string' ? answerResult : String(answerResult);
        const newByeCount = Math.min(3, (gs.bye_count || 0) + 1);
        const newWrong = [...alreadyWrong, wrongAnswer];

        if (newByeCount >= 3) {
          // BYE complete — switch to human team steal
          const stealPlayer = humanPlayers[0] || null;
          await updateState({
            bye_count: newByeCount,
            wrong_guesses: newWrong,
            last_ai_answer: { character: character.name, answer: wrongAnswer, correct: false },
            ai_thinking: false,
            answering_ai: false,
            steal_mode: true,
            steal_player_id: stealPlayer?.playerId || null,
            steal_family: 1,
            active_turn: 1,
            answering_player_id: stealPlayer?.playerId || null,
          });
        } else {
          // Rotate to next AI member
          const nextMemberIdx = getNextAIMember(gs.ai_member_idx || 0);
          await updateState({
            bye_count: newByeCount,
            wrong_guesses: newWrong,
            last_ai_answer: { character: character.name, answer: wrongAnswer, correct: false },
            ai_thinking: false,
            ai_member_idx: nextMemberIdx,
            answering_ai: true,
          });
        }
      }
    }, thinkDelay);

    return () => clearTimeout(aiTimerRef.current);
  }, [enabled, gs.answering_ai, gs.ai_member_idx, gs.bye_count, gs.phase, gs.buzzer_phase, (gs.answers || []).filter(a => a.revealed).length]);

  // ── Auto round-over: load next question ───────────────────────────────────
  useEffect(() => {
    if (!enabled || gs.phase !== 'round_over') return;
    const t = setTimeout(async () => {
      try {
        const { base44 } = await import('@/api/base44Client');
        const surveys = await base44.entities.BFFSurvey.filter({ active: true }, '-created_date', 50);
        if (!surveys || surveys.length === 0) return;
        const survey = surveys[Math.floor(Math.random() * surveys.length)];
        const nextStartTeam = gs.active_turn === 1 ? 2 : 1;

        await updateState({
          phase: 'get_ready',
          buzzer_phase: 'get_ready',
          current_question: null,
          answers: [],
          round_bank: 0,
          bye_count: 0,
          wrong_guesses: [],
          steal_mode: false,
          steal_player_id: null,
          answering_ai: false,
          answering_player_id: null,
          buzz_winner: null,
          last_ai_answer: null,
          active_turn: nextStartTeam,
          pending_question: survey.question,
          pending_answers: (survey.answers || []).map(a => ({ ...a, revealed: false })),
        });
      } catch {}
    }, 3000);
    return () => clearTimeout(t);
  }, [enabled, gs.phase]);

  // ── Get Ready → reveal board → activate buzzer ───────────────────────────
  // Step 1: after random 2-5s delay, reveal the question & board (phase=playing, buzzer=board_shown)
  // Step 2: after another 1.5s (give players time to read), activate the buzzer
  useEffect(() => {
    if (!enabled) return;
    if (gs.buzzer_phase !== 'get_ready') return;
    // Must have a pending question to reveal
    const question = gs.pending_question || gs.current_question;
    const answers = gs.pending_answers || gs.answers || [];
    if (!question) return; // wait until question is available
    const revealDelay = randomBetween(2000, 4000);
    const t = setTimeout(async () => {
      await updateState({
        phase: 'playing',
        buzzer_phase: 'board_shown',
        current_question: question,
        answers: answers,
        pending_question: null,
        pending_answers: null,
        buzz_winner: null,
      });
    }, revealDelay);
    return () => clearTimeout(t);
  }, [enabled, gs.buzzer_phase, gs.pending_question, gs.current_question]);

  // Step 2: board_shown → buzzer_active after 1.5s
  useEffect(() => {
    if (!enabled || gs.buzzer_phase !== 'board_shown') return;
    const t = setTimeout(async () => {
      await updateState({ buzzer_phase: 'buzzer_active' });
    }, 1500);
    return () => clearTimeout(t);
  }, [enabled, gs.buzzer_phase]);

  // ── After buzz winner is set: set up who answers ───────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (gs.buzzer_phase !== 'buzzed' || !gs.buzz_winner) return;
    if (gs.answering_player_id || gs.answering_ai) return;

    const winner = gs.buzz_winner;
    if (winner.isAI) {
      updateState({ answering_ai: true, ai_thinking: true, active_turn: 2, answering_player_id: null });
    } else {
      // Human buzzed — set them as answering player
      updateState({ answering_ai: false, active_turn: 1, answering_player_id: winner.playerId });
    }
  }, [enabled, gs.buzzer_phase, gs.buzz_winner]);
}