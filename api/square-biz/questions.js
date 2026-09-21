import { desc, eq, sql } from 'drizzle-orm';

import { requireController } from '../../server/auth/require-controller.js';
import { db } from '../../server/db/client.js';
import { squareBizQuestions } from '../../server/db/schema.js';
import { normalizeSquareBizQuestion } from '../../server/games/square-biz-trivia.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

function serialize(question) {
  return {
    id: question.id,
    question: question.question,
    choices: question.choices,
    correctAnswer: question.correctAnswer,
    category: question.category,
    difficulty: question.difficulty,
    source: question.source,
    sourceRef: question.sourceRef,
    active: question.active,
    timesUsed: question.timesUsed,
    lastUsedAt: question.lastUsedAt,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

async function bankSummary() {
  const [summary] = await db
    .select({
      total: sql`count(*)::int`,
      active: sql`count(*) filter (where ${squareBizQuestions.active} = true)::int`,
      inactive: sql`count(*) filter (where ${squareBizQuestions.active} = false)::int`,
      used: sql`count(*) filter (where ${squareBizQuestions.timesUsed} > 0)::int`,
    })
    .from(squareBizQuestions);

  return summary || { total: 0, active: 0, inactive: 0, used: 0 };
}

export default async function handler(request, response) {
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) {
    return methodNotAllowed(response, ['GET', 'POST', 'PATCH']);
  }

  try {
    await requireController(request);

    if (request.method === 'GET') {
      const questions = await db
        .select()
        .from(squareBizQuestions)
        .orderBy(desc(squareBizQuestions.createdAt))
        .limit(250);

      return sendJson(response, 200, {
        summary: await bankSummary(),
        questions: questions.map(serialize),
      });
    }

    if (request.method === 'PATCH') {
      const id = String(request.body?.id || '').trim();
      if (!id) {
        const error = new Error('Question id is required.');
        error.statusCode = 400;
        error.code = 'SQUARE_BIZ_QUESTION_ID_REQUIRED';
        throw error;
      }

      const patch = request.body?.question
        ? normalizeSquareBizQuestion(request.body)
        : {};

      if (request.body?.active !== undefined) {
        patch.active = request.body.active === true;
      }

      patch.updatedAt = new Date();

      const [updated] = await db
        .update(squareBizQuestions)
        .set(patch)
        .where(eq(squareBizQuestions.id, id))
        .returning();

      if (!updated) {
        const error = new Error('Square Biz question not found.');
        error.statusCode = 404;
        error.code = 'SQUARE_BIZ_QUESTION_NOT_FOUND';
        throw error;
      }

      return sendJson(response, 200, {
        question: serialize(updated),
        summary: await bankSummary(),
      });
    }

    const action = String(request.body?.action || 'create').trim();

    if (action === 'create') {
      const normalized = normalizeSquareBizQuestion(request.body);
      const [created] = await db
        .insert(squareBizQuestions)
        .values(normalized)
        .returning();

      return sendJson(response, 201, {
        question: serialize(created),
        summary: await bankSummary(),
      });
    }

    if (action === 'bulk_import') {
      const items = Array.isArray(request.body?.questions)
        ? request.body.questions
        : [];

      if (!items.length) {
        const error = new Error('Provide at least one question to import.');
        error.statusCode = 400;
        error.code = 'SQUARE_BIZ_IMPORT_EMPTY';
        throw error;
      }

      if (items.length > 500) {
        const error = new Error('Import a maximum of 500 questions at a time.');
        error.statusCode = 400;
        error.code = 'SQUARE_BIZ_IMPORT_TOO_LARGE';
        throw error;
      }

      const normalized = items.map(normalizeSquareBizQuestion);
      const imported = [];
      const duplicates = [];

      for (const item of normalized) {
        try {
          const [created] = await db
            .insert(squareBizQuestions)
            .values(item)
            .returning();
          imported.push(serialize(created));
        } catch (error) {
          if (error?.code === '23505') {
            duplicates.push(item.question);
            continue;
          }
          throw error;
        }
      }

      return sendJson(response, 201, {
        importedCount: imported.length,
        duplicateCount: duplicates.length,
        duplicates,
        questions: imported,
        summary: await bankSummary(),
      });
    }

    const error = new Error('Unknown Square Biz trivia bank action.');
    error.statusCode = 400;
    error.code = 'INVALID_SQUARE_BIZ_QUESTION_ACTION';
    throw error;
  } catch (error) {
    return sendError(response, error);
  }
}
