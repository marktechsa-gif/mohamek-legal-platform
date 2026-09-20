import { Router } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { ApiError } from "../middleware/errorHandler";
import { getNextQuestion, isIntakeComplete } from "../services/intakeEngine";

export const intakeRouter = Router({ mergeParams: true });

async function loadAnswers(caseId: string): Promise<Record<string, unknown>> {
  const result = await query<{ question_id: string; answer_value: unknown }>(
    `select question_id, answer_value from intake_answers where case_id = $1`,
    [caseId]
  );
  const answers: Record<string, unknown> = {};
  for (const row of result.rows) {
    answers[row.question_id] = row.answer_value;
  }
  return answers;
}

intakeRouter.get("/next", async (req, res, next) => {
  try {
    const { caseId } = req.params as { caseId: string };
    const answers = await loadAnswers(caseId);
    const nextQuestion = getNextQuestion(answers);

    res.json({
      complete: !nextQuestion && isIntakeComplete(answers),
      question: nextQuestion ?? null,
    });
  } catch (err) {
    next(err);
  }
});

const answerSchema = z.object({
  questionId: z.string(),
  value: z.unknown(),
});

intakeRouter.post("/answer", async (req, res, next) => {
  try {
    const { caseId } = req.params as { caseId: string };
    const body = answerSchema.parse(req.body);

    const caseResult = await query(`select id from cases where id = $1`, [caseId]);
    if (caseResult.rows.length === 0) {
      throw new ApiError(404, "CASE_NOT_FOUND");
    }

    await query(
      `insert into intake_answers (case_id, question_id, answer_value)
       values ($1, $2, $3)
       on conflict (case_id, question_id) do update set answer_value = excluded.answer_value`,
      [caseId, body.questionId, JSON.stringify(body.value)]
    );

    const answers = await loadAnswers(caseId);
    const complete = isIntakeComplete(answers);
    if (complete) {
      await query(`update cases set status = 'ready_to_generate', updated_at = now() where id = $1`, [
        caseId,
      ]);
    }

    res.json({ complete, nextQuestion: complete ? null : getNextQuestion(answers) });
  } catch (err) {
    next(err);
  }
});
