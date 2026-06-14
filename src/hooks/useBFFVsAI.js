/**
 * useBFFVsAI — AI logic for BFF Play vs AI mode.
 *
 * FACE-OFF FLOW:
 *   board_shown → buzzer_active → buzzed → faceoff_phase: 'first_answer' → faceoff_phase: 'second_answer' → playing
 *
 * Rules:
 *   - Buzz winner answers first.
 *   - If first player gets #1 answer → instant win, no second chance.
 *   - If first player gets a lower answer → opponent gets ONE counter-answer.
 *   - If first player is wrong → opponent still gets ONE answer attempt.
 *   - Compare ranks: lower index = higher rank. Higher rank wins control.
 *   - If both wrong → new faceoff (board_shown → buzzer_active).
 */

import { useEffect, useRef } from 'react';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';

const AI_ACCURACY = {
  berna: 0.80, dexter: 0.85, lemonade: 0.65,
  carlos: 0.50, violet: 0.75, tank: 0.78,
};

const AI_REACTION = {
  berna: [2800, 5000], dexter: [3200, 6000], lemonade: [2500, 4500],
  carlos: [4000, 7000], violet: [3500, 5500], tank: [3800, 6500],
};

const TN_TEAM = TEXASNOMAD_CHARACTERS;

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function pickAIAnswer(character, answers, alreadyWrong) {
  const unrevealed = answers.filter(a => !a.revealed);
  if (unrevealed.length === 0) return null;
  if (Math.random() < (AI_ACCURACY[character.id] || 0.7)) {
    return [...unrevealed].sort((a, b) => (b.points || 0) - (a.points || 0))[0];
  }
  const wrong = ['Money', 'Food', 'Family', 'Work', 'Sleep', 'Friends', 'Love', 'Sports', 'TV', 'Car'];
  return wrong.find(g => !alreadyWrong.includes(g)) || 'Pass';
}

function getNextAIMember(idx) { return (idx + 1) % TN_TEAM.length; }

export function useBFFVsAI({ gs, updateState, playerId, humanPlayers, enabled }) {
  const aiTimerRef = useRef(null);
  const buzzerTimersRef = useRef([]);
  const processedRef = useRef(null);

  // ── board_shown → buzzer_active ──────────────────────────────────────────
  useEffect(() => {
    if (!enabled || gs.buzzer_phase !== 'board_shown') return;
    const t = setTimeout(() => updateState({ buzzer_phase: 'buzzer_active' }), 1500);
    return () => clearTimeout(t);
  }, [enabled, gs.buzzer_phase]);

  // ── AI Buzzers ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (gs.buzzer_phase !== 'buzzer_active') {
      buzzerTimersRef.current.forEach(clearTimeout);
      buzzerTimersRef.current = [];
      return;
    }
    if (gs.buzz_winner) return;

    TN_TEAM.forEach(character => {
      const [min, max] = AI_REACTION[character.id] || [3000, 6000];
      const t = setTimeout(async () => {
        try {
          if (gs.buzz_winner) return;
          await updateState({
            buzz_winner: { playerId: `ai_${character.id}`, playerName: character.name, teamName: gs.family2 || 'TexasNomad Team', isAI: true, characterId: character.id },
            buzzer_phase: 'buzzed',
          });
        } catch {}
      }, randomBetween(min, max));
      buzzerTimersRef.current.push(t);
    });

    return () => { buzzerTimersRef.current.forEach(clearTimeout); buzzerTimersRef.current = []; };
  }, [enabled, gs.buzzer_phase, gs.buzz_winner]);

  // ── After buzz: assign first answerer ────────────────────────────────────
  useEffect(() => {
    if (!enabled || gs.buzzer_phase !== 'buzzed' || !gs.buzz_winner) return;
    if (gs.faceoff_phase) return;
    if (gs.answering_player_id || gs.answering_ai) return;

    const winner = gs.buzz_winner;
    if (winner.isAI) {
      updateState({ faceoff_phase: 'first_answer', faceoff_first_team: 2, answering_ai: true, ai_thinking: true, active_turn: 2, answering_player_id: null });
    } else {
      updateState({ faceoff_phase: 'first_answer', faceoff_first_team: 1, answering_ai: false, active_turn: 1, answering_player_id: winner.playerId });
    }
  }, [enabled, gs.buzzer_phase, gs.buzz_winner, gs.faceoff_phase]);

  // ── AI: faceoff first answer ──────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !gs.answering_ai || gs.faceoff_phase !== 'first_answer') return;

    const key = `fo1_r${gs.round_number || 0}_${gs.ai_member_idx || 0}`;
    if (processedRef.current === key) return;
    processedRef.current = key;

    const character = TN_TEAM[gs.ai_member_idx || 0];
    aiTimerRef.current = setTimeout(async () => {
      const answers = gs.answers || [];
      const result = pickAIAnswer(character, answers, []);
      const isCorrect = result && typeof result === 'object' && result.text;

      if (isCorrect) {
        const rank = answers.findIndex(a => a.text === result.text || a.answer === result.text);
        const newAnswers = answers.map((a, i) => i === rank ? { ...a, revealed: true } : a);

        if (rank === 0) {
          // #1 answer — instant win
          const firstHuman = humanPlayers[0] || null;
          await updateState({
            answers: newAnswers, faceoff_phase: null, faceoff_first_answer: null,
            buzz_winner: null, phase: 'playing', buzzer_phase: 'playing',
            control_team: 2, active_turn: 2, answering_ai: true, answering_player_id: null,
            round_bank: 0, bye_count: 0, wrong_guesses: [], steal_mode: false,
            last_ai_answer: { character: character.name, answer: result.text, correct: true },
          });
        } else {
          // Not #1 — opponent (human) gets one shot
          const firstHuman = humanPlayers[0] || null;
          await updateState({
            answers: newAnswers,
            faceoff_phase: 'second_answer',
            faceoff_first_answer: { rank, points: result.points, text: result.text, team: 2 },
            answering_ai: false, active_turn: 1,
            answering_player_id: firstHuman?.playerId || null,
            last_ai_answer: { character: character.name, answer: result.text, correct: true },
          });
        }
      } else {
        // AI wrong — human still gets one shot
        const wrongText = typeof result === 'string' ? result : 'Pass';
        const firstHuman = humanPlayers[0] || null;
        await updateState({
          faceoff_phase: 'second_answer',
          faceoff_first_answer: { rank: -1, points: 0, text: wrongText, team: 2, wrong: true },
          answering_ai: false, active_turn: 1,
          answering_player_id: firstHuman?.playerId || null,
          last_ai_answer: { character: character.name, answer: wrongText, correct: false },
        });
      }
    }, randomBetween(1200, 2500));

    return () => clearTimeout(aiTimerRef.current);
  }, [enabled, gs.answering_ai, gs.faceoff_phase, gs.ai_member_idx]);

  // ── AI: faceoff second answer ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !gs.answering_ai || gs.faceoff_phase !== 'second_answer') return;

    const key = `fo2_r${gs.round_number || 0}_${gs.ai_member_idx || 0}_${JSON.stringify(gs.faceoff_first_answer)}`;
    if (processedRef.current === key) return;
    processedRef.current = key;

    const character = TN_TEAM[gs.ai_member_idx || 0];
    aiTimerRef.current = setTimeout(async () => {
      const answers = gs.answers || [];
      const firstAnswer = gs.faceoff_first_answer || {};
      const result = pickAIAnswer(character, answers, []);
      const isCorrect = result && typeof result === 'object' && result.text;
      const firstHuman = humanPlayers[0] || null;

      if (isCorrect) {
        const rank = answers.findIndex(a => a.text === result.text || a.answer === result.text);
        const newAnswers = answers.map((a, i) => i === rank ? { ...a, revealed: true } : a);
        const firstRank = firstAnswer.wrong ? 999 : (firstAnswer.rank ?? 999);
        const aiWins = rank < firstRank;

        await updateState({
          answers: newAnswers, faceoff_phase: null, faceoff_first_answer: null,
          buzz_winner: null, phase: 'playing', buzzer_phase: 'playing',
          control_team: aiWins ? 2 : 1,
          active_turn: aiWins ? 2 : 1,
          answering_ai: aiWins,
          answering_player_id: aiWins ? null : (firstHuman?.playerId || null),
          round_bank: 0, bye_count: 0, wrong_guesses: [], steal_mode: false,
          last_ai_answer: { character: character.name, answer: result.text, correct: true },
        });
      } else {
        // AI wrong on second answer
        const wrongText = typeof result === 'string' ? result : 'Pass';
        const firstRank = firstAnswer.wrong ? 999 : (firstAnswer.rank ?? 999);

        if (firstRank < 999) {
          // Human had a correct answer → human wins
          await updateState({
            faceoff_phase: null, faceoff_first_answer: null,
            buzz_winner: null, phase: 'playing', buzzer_phase: 'playing',
            control_team: 1, active_turn: 1,
            answering_ai: false, answering_player_id: firstHuman?.playerId || null,
            round_bank: 0, bye_count: 0, wrong_guesses: [], steal_mode: false,
            last_ai_answer: { character: character.name, answer: wrongText, correct: false },
          });
        } else {
          // Both wrong → new faceoff
          await updateState({
            faceoff_phase: null, faceoff_first_answer: null,
            buzz_winner: null, buzzer_phase: 'board_shown',
            answering_ai: false, answering_player_id: null,
            bye_count: 0, wrong_guesses: [], active_turn: 1,
            last_ai_answer: { character: character.name, answer: wrongText, correct: false },
          });
        }
      }
    }, randomBetween(1200, 2500));

    return () => clearTimeout(aiTimerRef.current);
  }, [enabled, gs.answering_ai, gs.faceoff_phase, gs.ai_member_idx, gs.faceoff_first_answer]);

  // ── Normal AI survey play ─────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !gs.answering_ai || gs.faceoff_phase) return;
    if (gs.phase !== 'playing') return;

    const stateKey = `play_r${gs.round_number || 0}_${gs.ai_member_idx}_${gs.round_bank}_${(gs.answers || []).filter(a => a.revealed).length}`;
    if (processedRef.current === stateKey) return;
    processedRef.current = stateKey;

    const character = TN_TEAM[gs.ai_member_idx || 0];
    aiTimerRef.current = setTimeout(async () => {
      const answers = gs.answers || [];
      const alreadyWrong = gs.wrong_guesses || [];
      const result = pickAIAnswer(character, answers, alreadyWrong);

      if (!result) {
        await updateState({ answering_ai: false, answering_player_id: null, ai_thinking: false });
        return;
      }

      const isCorrect = typeof result === 'object' && result.text;

      if (isCorrect) {
        const newAnswers = answers.map(a => a.text === result.text || a.answer === result.text ? { ...a, revealed: true } : a);
        const newBank = (gs.round_bank || 0) + (result.points || 0);
        const allRevealed = newAnswers.every(a => a.revealed);

        if (gs.steal_mode) {
          // AI stealing — correct means AI team gets the bank, round over
          await updateState({
            answers: newAnswers, round_bank: 0,
            score2: (gs.score2 || 0) + newBank,
            last_ai_answer: { character: character.name, answer: result.text, correct: true },
            ai_thinking: false, answering_ai: false,
            steal_mode: false, steal_player_id: null,
            answering_player_id: null, phase: 'round_over',
          });
        } else {
          const nextIdx = getNextAIMember(gs.ai_member_idx || 0);
          await updateState({
            answers: newAnswers, round_bank: newBank,
            last_ai_answer: { character: character.name, answer: result.text, correct: true },
            ai_thinking: false, wrong_guesses: [],
            ai_member_idx: allRevealed ? (gs.ai_member_idx || 0) : nextIdx,
            answering_ai: !allRevealed,
            ...(allRevealed ? { score2: (gs.score2 || 0) + newBank, round_bank: 0, phase: 'round_over' } : {}),
          });
        }
      } else {
        const wrongAnswer = typeof result === 'string' ? result : String(result);
        const newByeCount = Math.min(3, (gs.bye_count || 0) + 1);
        const newWrong = [...alreadyWrong, wrongAnswer];

        if (gs.steal_mode) {
          // AI wrong on steal — no points, next round
          await updateState({
            bye_count: newByeCount, wrong_guesses: newWrong,
            last_ai_answer: { character: character.name, answer: wrongAnswer, correct: false },
            ai_thinking: false, answering_ai: false,
            steal_mode: false, steal_player_id: null,
            answering_player_id: null, phase: 'round_over',
          });
        } else if (newByeCount >= 3) {
          // AI got 3 wrong — human team gets steal opportunity
          const stealPlayer = humanPlayers[0] || null;
          await updateState({
            bye_count: newByeCount, wrong_guesses: newWrong,
            last_ai_answer: { character: character.name, answer: wrongAnswer, correct: false },
            ai_thinking: false, answering_ai: false,
            steal_mode: true, steal_player_id: stealPlayer?.playerId || null,
            steal_family: 1, active_turn: 1, answering_player_id: stealPlayer?.playerId || null,
          });
        } else {
          await updateState({
            bye_count: newByeCount, wrong_guesses: newWrong,
            last_ai_answer: { character: character.name, answer: wrongAnswer, correct: false },
            ai_thinking: false, ai_member_idx: getNextAIMember(gs.ai_member_idx || 0), answering_ai: true,
          });
        }
      }
    }, randomBetween(1200, 2800));

    return () => clearTimeout(aiTimerRef.current);
  }, [enabled, gs.answering_ai, gs.faceoff_phase, gs.steal_mode, gs.ai_member_idx, gs.bye_count, gs.phase, (gs.answers || []).filter(a => a.revealed).length]);

  // ── Auto round-over → next question ──────────────────────────────────────
  useEffect(() => {
    if (!enabled || gs.phase !== 'round_over') return;
    const t = setTimeout(async () => {
      try {
        const { base44 } = await import('@/api/base44Client');
        const surveys = await base44.entities.BFFSurvey.list('-created_date', 50);
        if (!surveys || surveys.length === 0) return;
        const survey = surveys[Math.floor(Math.random() * surveys.length)];
        await updateState({
          phase: 'playing', buzzer_phase: 'board_shown',
          faceoff_phase: null, faceoff_first_answer: null,
          current_question: survey.question,
          answers: (survey.answers || []).map(a => ({ ...a, revealed: false })),
          round_bank: 0, bye_count: 0, wrong_guesses: [],
          steal_mode: false, steal_player_id: null,
          answering_ai: false, answering_player_id: null,
          buzz_winner: null, last_ai_answer: null,
          active_turn: gs.active_turn === 1 ? 2 : 1,
        });
      } catch {}
    }, 3000);
    return () => clearTimeout(t);
  }, [enabled, gs.phase]);
}