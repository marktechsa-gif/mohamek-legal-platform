import { Router } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { requireAuth } from "../middleware/auth";

export const partsCatalogRouter = Router();
partsCatalogRouter.use(requireAuth);

const createCatalogItemSchema = z.object({
  partNumber: z.string().min(1),
  nameAr: z.string().min(1),
  compatibleMakes: z.array(z.string()).default([]),
  compatibleModels: z.array(z.string()).default([]),
  newPriceSar: z.number().nonnegative().optional(),
});

partsCatalogRouter.post("/", async (req, res, next) => {
  try {
    const body = createCatalogItemSchema.parse(req.body);
    const result = await query<{ id: string }>(
      `insert into parts_catalog (workshop_id, part_number, name_ar, compatible_makes, compatible_models, new_price_sar)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        req.user!.workshopId,
        body.partNumber,
        body.nameAr,
        body.compatibleMakes,
        body.compatibleModels,
        body.newPriceSar ?? null,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

/** يعيد كتالوج الورشة الخاص بالإضافة للكتالوج العام المشترك (workshop_id = null). */
partsCatalogRouter.get("/", async (req, res, next) => {
  try {
    const search = typeof req.query.q === "string" ? `%${req.query.q}%` : "%";
    const result = await query(
      `select id, part_number, name_ar, compatible_makes, compatible_models, new_price_sar
       from parts_catalog
       where (workshop_id = $1 or workshop_id is null) and name_ar ilike $2
       order by name_ar asc`,
      [req.user!.workshopId, search]
    );
    res.json({ parts: result.rows });
  } catch (err) {
    next(err);
  }
});
