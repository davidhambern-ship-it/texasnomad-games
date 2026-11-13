import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';

import { db } from '../db/client.js';
import { squareBizQuestions } from '../db/schema.js';

const ANSWERS = ['A', 'B', 'C', 'D'];

function normalizeChoices(choices) {
  if (!Array.isArray(choices) || choices.length !== 4) {
    const error = new Error('Square Biz questions require exactly four answer choices.');
    error.statusCode = 400;
    error.code = 'SQUARE_BIZ_FOUR_CHOICES_REQUIRED';
    throw error;
  }

  const normalized = choices.map((choice) => String(choice || '').trim());
  if (normalized.some((choice) => !choice)) {
    const error = new Error('Square Biz answer choices cannot be blank.');
    error.statusCode = 400;
    error.code = 'SQUARE_BIZ_BLANK_CHOICE';
    throw error;
  }

  return normalized;
}

export function normalizeSquareBizQuestion(input = {}) {
  const question = String(input.question || '').trim();
  if (question.length < 3 || question.length > 500) {
    const error = new Error('Question text must be between 3 and 500 characters.');
    error.statusCode = 400;
    error.code = 'INVALID_SQUARE_BIZ_QUESTION';
    throw error;
  }

  const choices = normalizeChoices(input.choices);
  const correctAnswer = String(input.correctAnswer || input.correct_answer || '').trim().toUpperCase();
  if (!ANSWERS.includes(correctAnswer)) {
    const error = new Error('Correct answer must be A, B, C, or D.');
    error.statusCode = 400;
    error.code = 'INVALID_SQUARE_BIZ_CORRECT_ANSWER';
    throw error;
  }

  const difficulty = String(input.difficulty || 'medium').trim().toLowerCase();
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    const error = new Error('Difficulty must be easy, medium, or hard.');
    error.statusCode = 400;
    error.code = 'INVALID_SQUARE_BIZ_DIFFICULTY';
    throw error;
  }

  return {
    question,
    choices,
    correctAnswer,
    category: String(input.category || 'General').trim().slice(0, 100) || 'General',
    difficulty,
    source: String(input.source || 'manual').trim().slice(0, 50) || 'manual',
    sourceRef: input.sourceRef || input.source_ref
      ? String(input.sourceRef || input.source_ref).trim().slice(0, 255)
      : null,
    active: input.active !== false,
  };
}

export function publicSquareBizQuestion(question) {
  if (!question) return null;
  return {
    id: question.id,
    question: question.question,
    choices: question.choices,
    category: question.category,
    difficulty: question.difficulty,
  };
}

export async function drawSquareBizQuestion({
  excludeIds = [],
  category = null,
  difficulty = null,
  executor = db,
} = {}) {
  const conditions = [eq(squareBizQuestions.active, true)];

  const validExcludeIds = (excludeIds || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (validExcludeIds.length > 0) {
    conditions.push(notInArray(squareBizQuestions.id, validExcludeIds));
  }

  if (category) {
    conditions.push(eq(squareBizQuestions.category, String(category)));
  }

  if (difficulty) {
    conditions.push(eq(squareBizQuestions.difficulty, String(difficulty)));
  }

  const [question] = await executor
    .select()
    .from(squareBizQuestions)
    .where(and(...conditions))
    .orderBy(sql`${squareBizQuestions.timesUsed} ASC, ${squareBizQuestions.lastUsedAt} ASC NULLS FIRST, random()`)
    .limit(1);

  if (!question) {
    const error = new Error('No unused Square Biz trivia questions are available for this round.');
    error.statusCode = 409;
    error.code = 'SQUARE_BIZ_QUESTION_POOL_EXHAUSTED';
    throw error;
  }

  const [updated] = await executor
    .update(squareBizQuestions)
    .set({
      timesUsed: Number(question.timesUsed || 0) + 1,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(squareBizQuestions.id, question.id))
    .returning();

  return updated || question;
}

export async function checkSquareBizAnswer(questionId, answer, executor = db) {
  const [question] = await executor
    .select()
    .from(squareBizQuestions)
    .where(eq(squareBizQuestions.id, questionId))
    .limit(1);

  if (!question || !question.active) {
    const error = new Error('That Square Biz question is no longer available.');
    error.statusCode = 404;
    error.code = 'SQUARE_BIZ_QUESTION_NOT_FOUND';
    throw error;
  }

  const normalizedAnswer = String(answer || '').trim().toUpperCase();
  if (!ANSWERS.includes(normalizedAnswer)) {
    const error = new Error('Answer must be A, B, C, or D.');
    error.statusCode = 400;
    error.code = 'INVALID_SQUARE_BIZ_ANSWER';
    throw error;
  }

  return {
    correct: normalizedAnswer === question.correctAnswer,
    correctAnswer: question.correctAnswer,
    correctAnswerText: question.choices[ANSWERS.indexOf(question.correctAnswer)],
  };
}
