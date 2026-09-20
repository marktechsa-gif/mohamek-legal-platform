import { Router } from "express";
import { query } from "../db/client";

export const legalKbRouter = Router();

legalKbRouter.get("/regulations", async (_req, res, next) => {
  try {
    const result = await query(
      `select lr.id, lr.code, lr.name_ar, lr.issued_by, count(la.id) as article_count
       from legal_regulations lr
       left join legal_articles la on la.regulation_id = lr.id
       group by lr.id
       order by lr.name_ar`
    );
    res.json({ regulations: result.rows });
  } catch (err) {
    next(err);
  }
});
