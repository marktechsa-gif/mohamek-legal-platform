import { Router } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { documentsRouter } from "./documents.routes";
import { intakeRouter } from "./intake.routes";

export const casesRouter = Router();

casesRouter.use(requireAuth);

const createCaseSchema = z.object({
  caseType: z.enum(["general", "labor", "commercial"]).default("general"),
  title: z.string().optional(),
});

casesRouter.post("/", async (req, res, next) => {
  try {
    const body = createCaseSchema.parse(req.body ?? {});
    const result = await query<{ id: string }>(
      `insert into cases (user_id, case_type, title)
       values ($1, $2, $3)
       returning id`,
      [req.user!.id, body.caseType, body.title ?? null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

casesRouter.get("/", async (req, res, next) => {
  try {
    const result = await query(
      `select id, case_type, status, title, created_at
       from cases where user_id = $1 order by created_at desc`,
      [req.user!.id]
    );
    res.json({ cases: result.rows });
  } catch (err) {
    next(err);
  }
});

casesRouter.get("/:caseId", async (req, res, next) => {
  try {
    const result = await query(
      `select id, case_type, status, title, created_at
       from cases where id = $1 and user_id = $2`,
      [req.params.caseId, req.user!.id]
    );
    const caseRow = result.rows[0];
    if (!caseRow) {
      throw new ApiError(404, "CASE_NOT_FOUND");
    }
    res.json({ case: caseRow });
  } catch (err) {
    next(err);
  }
});

casesRouter.use("/:caseId/intake", intakeRouter);
casesRouter.use("/:caseId/documents", documentsRouter);
