import { Router } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

export const usedPartsRouter = Router();
usedPartsRouter.use(requireAuth);

// ---------------------------------------------------------------------------
// موردو التشاليح
// ---------------------------------------------------------------------------

const createSupplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  city: z.string().optional(),
});

usedPartsRouter.post("/suppliers", async (req, res, next) => {
  try {
    const body = createSupplierSchema.parse(req.body);
    const result = await query<{ id: string }>(
      `insert into used_parts_suppliers (name, phone, city) values ($1, $2, $3) returning id`,
      [body.name, body.phone ?? null, body.city ?? null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

usedPartsRouter.get("/suppliers", async (_req, res, next) => {
  try {
    const result = await query(
      `select id, name, phone, city, rating_average, on_time_rate, return_rate
       from used_parts_suppliers order by rating_average desc`
    );
    res.json({ suppliers: result.rows });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// تقييمات الموردين — نظام السمعة (من 5 نجوم)
// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

usedPartsRouter.post("/suppliers/:supplierId/reviews", async (req, res, next) => {
  try {
    const body = reviewSchema.parse(req.body);
    const { supplierId } = req.params;

    await query(
      `insert into used_parts_supplier_reviews (supplier_id, workshop_id, stars, comment)
       values ($1, $2, $3, $4)`,
      [supplierId, req.user!.workshopId, body.stars, body.comment ?? null]
    );

    const avgResult = await query<{ avg: string }>(
      `select avg(stars)::numeric(2,1) as avg from used_parts_supplier_reviews where supplier_id = $1`,
      [supplierId]
    );
    await query(`update used_parts_suppliers set rating_average = $1 where id = $2`, [
      avgResult.rows[0].avg,
      supplierId,
    ]);

    res.status(201).json({ ratingAverage: avgResult.rows[0].avg });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// عروض القطع المستعملة (التسعير المزدوج: جديد مقابل مستعمل)
// ---------------------------------------------------------------------------

const createListingSchema = z.object({
  supplierId: z.string().uuid(),
  partCatalogId: z.string().uuid().optional(),
  description: z.string().min(1),
  usedPriceSar: z.number().nonnegative(),
  conditionGrade: z.enum(["excellent", "good", "fair"]),
  warrantyDays: z.number().int().nonnegative().default(0),
});

usedPartsRouter.post("/listings", async (req, res, next) => {
  try {
    const body = createListingSchema.parse(req.body);
    const result = await query<{ id: string }>(
      `insert into used_parts_listings
         (supplier_id, part_catalog_id, description_ar, used_price_sar, condition_grade, warranty_days)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        body.supplierId,
        body.partCatalogId ?? null,
        body.description,
        body.usedPriceSar,
        body.conditionGrade,
        body.warrantyDays,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

/**
 * يُرجع عروض القطع المستعملة مع سعر الجديد المقابل من الكتالوج عند توفره،
 * ليعرض التطبيق التسعير المزدوج (جديد مقابل مستعمل) كما تتطلب المواصفات.
 */
usedPartsRouter.get("/listings", async (req, res, next) => {
  try {
    const search = typeof req.query.q === "string" ? `%${req.query.q}%` : "%";
    const result = await query(
      `select
         upl.id, upl.description_ar, upl.used_price_sar, upl.condition_grade, upl.warranty_days,
         upl.is_available, pc.new_price_sar,
         ups.name as supplier_name, ups.rating_average as supplier_rating
       from used_parts_listings upl
       join used_parts_suppliers ups on ups.id = upl.supplier_id
       left join parts_catalog pc on pc.id = upl.part_catalog_id
       where upl.description_ar ilike $1 and upl.is_available = true
       order by upl.created_at desc`,
      [search]
    );
    res.json({ listings: result.rows });
  } catch (err) {
    next(err);
  }
});

usedPartsRouter.get("/listings/:listingId", async (req, res, next) => {
  try {
    const result = await query(
      `select upl.*, ups.name as supplier_name, ups.rating_average as supplier_rating
       from used_parts_listings upl
       join used_parts_suppliers ups on ups.id = upl.supplier_id
       where upl.id = $1`,
      [req.params.listingId]
    );
    const listing = result.rows[0];
    if (!listing) {
      throw new ApiError(404, "LISTING_NOT_FOUND");
    }
    res.json({ listing });
  } catch (err) {
    next(err);
  }
});
