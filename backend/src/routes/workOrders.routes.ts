import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { query } from "../db/client";
import { absoluteStoragePath, ensureUploadsDir } from "../lib/storage";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { requireRole } from "../middleware/rbac";
import { diagnoseDtcCodes } from "../services/diagnosticsService";
import { generateInvoiceForWorkOrder } from "../services/invoiceService";
import { generateWorkOrderOtp, recordOtpFallback, verifyWorkOrderOtp } from "../services/otpService";

export const workOrdersRouter = Router();
workOrdersRouter.use(requireAuth);

const upload = multer({ dest: path.join(ensureUploadsDir(), "tmp") });

const createWorkOrderSchema = z.object({
  vehicleId: z.string().uuid(),
  customerId: z.string().uuid(),
  customerReportedIssue: z.string().optional(),
  intakeNotes: z.string().optional(),
});

workOrdersRouter.post("/", requireRole("owner", "receptionist"), async (req, res, next) => {
  try {
    const body = createWorkOrderSchema.parse(req.body);
    const result = await query<{ id: string }>(
      `insert into work_orders (workshop_id, vehicle_id, customer_id, customer_reported_issue, intake_notes)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        req.user!.workshopId,
        body.vehicleId,
        body.customerId,
        body.customerReportedIssue ?? null,
        body.intakeNotes ?? null,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

workOrdersRouter.get("/", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const result = await query(
      `select id, vehicle_id, customer_id, assigned_technician_id, status, opened_at, closed_at
       from work_orders
       where workshop_id = $1 and ($2::text is null or status = $2)
       order by opened_at desc`,
      [req.user!.workshopId, status ?? null]
    );
    res.json({ workOrders: result.rows });
  } catch (err) {
    next(err);
  }
});

workOrdersRouter.get("/:workOrderId", async (req, res, next) => {
  try {
    const result = await query(
      `select * from work_orders where id = $1 and workshop_id = $2`,
      [req.params.workOrderId, req.user!.workshopId]
    );
    const workOrder = result.rows[0];
    if (!workOrder) {
      throw new ApiError(404, "WORK_ORDER_NOT_FOUND");
    }
    res.json({ workOrder });
  } catch (err) {
    next(err);
  }
});

const updateStatusSchema = z.object({
  status: z.enum(["checked_in", "awaiting_part", "in_progress", "ready_for_pickup", "closed"]),
});

workOrdersRouter.patch("/:workOrderId/status", async (req, res, next) => {
  try {
    const body = updateStatusSchema.parse(req.body);
    const { workOrderId } = req.params;

    if (body.status === "closed") {
      const verifiedResult = await query<{ pickup_otp_verified_at: Date | null }>(
        `select pickup_otp_verified_at from work_orders where id = $1 and workshop_id = $2`,
        [workOrderId, req.user!.workshopId]
      );
      if (!verifiedResult.rows[0]?.pickup_otp_verified_at) {
        throw new ApiError(
          422,
          "PICKUP_OTP_REQUIRED",
          "لا يمكن إغلاق أمر الشغل قبل التحقق من رمز التسليم"
        );
      }
    }

    const result = await query(
      `update work_orders
       set status = $1, closed_at = case when $1 = 'closed' then now() else closed_at end
       where id = $2 and workshop_id = $3
       returning id, status`,
      [body.status, workOrderId, req.user!.workshopId]
    );
    if (result.rows.length === 0) {
      throw new ApiError(404, "WORK_ORDER_NOT_FOUND");
    }

    if (body.status === "closed") {
      const technicianResult = await query<{ assigned_technician_id: string | null; opened_at: Date }>(
        `select assigned_technician_id, opened_at from work_orders where id = $1`,
        [workOrderId]
      );
      const wo = technicianResult.rows[0];
      if (wo?.assigned_technician_id) {
        const minutesToClose = Math.round((Date.now() - new Date(wo.opened_at).getTime()) / 60000);
        await query(
          `insert into technician_kpi_events (workshop_id, technician_id, work_order_id, minutes_to_close)
           values ($1, $2, $3, $4)`,
          [req.user!.workshopId, wo.assigned_technician_id, workOrderId, minutesToClose]
        );
      }
    }

    res.json({ workOrder: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

workOrdersRouter.post(
  "/:workOrderId/damage-photos",
  upload.single("photo"),
  async (req, res, next) => {
    try {
      const { workOrderId } = req.params;
      if (!req.file) {
        throw new ApiError(400, "FILE_REQUIRED");
      }

      const relativePath = path.join("damage-photos", workOrderId, req.file.filename);
      const destination = absoluteStoragePath(relativePath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.renameSync(req.file.path, destination);

      await query(
        `update work_orders set intake_damage_photos = array_append(intake_damage_photos, $1)
         where id = $2 and workshop_id = $3`,
        [relativePath, workOrderId, req.user!.workshopId]
      );

      res.status(201).json({ storagePath: relativePath });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// رموز التحقق: الاستلام والتسليم
// ---------------------------------------------------------------------------

const otpRequestSchema = z.object({ purpose: z.enum(["checkin", "pickup"]) });

workOrdersRouter.post("/:workOrderId/otp/request", async (req, res, next) => {
  try {
    const body = otpRequestSchema.parse(req.body);
    // ملاحظة: إرسال الكود فعليًا عبر SMS غير منفَّذ — يُعاد هنا مباشرة للاختبار فقط.
    const { code, expiresAt } = await generateWorkOrderOtp(req.params.workOrderId, body.purpose);
    res.status(201).json({ code, expiresAt });
  } catch (err) {
    next(err);
  }
});

const otpVerifySchema = z.object({ purpose: z.enum(["checkin", "pickup"]), code: z.string().length(6) });

workOrdersRouter.post("/:workOrderId/otp/verify", async (req, res, next) => {
  try {
    const body = otpVerifySchema.parse(req.body);
    await verifyWorkOrderOtp(req.params.workOrderId, body.purpose, body.code);
    res.json({ verified: true });
  } catch (err) {
    next(err);
  }
});

const otpFallbackSchema = z.object({
  purpose: z.enum(["checkin", "pickup"]),
  method: z.enum(["digital_signature", "authorized_person"]),
  reference: z.string().min(1),
});

workOrdersRouter.post("/:workOrderId/otp/fallback", requireRole("owner", "receptionist"), async (req, res, next) => {
  try {
    const body = otpFallbackSchema.parse(req.body);
    await recordOtpFallback(req.params.workOrderId, body.purpose, body.method, body.reference);
    res.json({ verified: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// بنود أمر الشغل (قطع + مصنعيات)
// ---------------------------------------------------------------------------

const addItemSchema = z.object({
  itemType: z.enum(["labor", "new_part", "used_part"]),
  description: z.string().min(1),
  usedPartsListingId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).default(1),
  unitPriceSar: z.number().nonnegative(),
  workshopMarginSar: z.number().nonnegative().default(0),
});

workOrdersRouter.post("/:workOrderId/items", requireRole("owner", "receptionist", "warehouse_supervisor"), async (req, res, next) => {
  try {
    const body = addItemSchema.parse(req.body);
    const result = await query<{ id: string }>(
      `insert into work_order_items
         (work_order_id, item_type, description_ar, used_parts_listing_id, quantity, unit_price_sar, workshop_margin_sar)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id`,
      [
        req.params.workOrderId,
        body.itemType,
        body.description,
        body.usedPartsListingId ?? null,
        body.quantity,
        body.unitPriceSar,
        body.workshopMarginSar,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

workOrdersRouter.get("/:workOrderId/items", async (req, res, next) => {
  try {
    const result = await query(
      `select * from work_order_items where work_order_id = $1 order by created_at asc`,
      [req.params.workOrderId]
    );
    res.json({ items: result.rows });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// مساعد التشخيص بالذكاء الاصطناعي
// ---------------------------------------------------------------------------

const diagnoseSchema = z.object({ dtcCodes: z.array(z.string()).min(1) });

workOrdersRouter.post("/:workOrderId/diagnose", async (req, res, next) => {
  try {
    const body = diagnoseSchema.parse(req.body);

    const vehicleResult = await query<{ make: string | null; model: string | null; model_year: number | null }>(
      `select v.make, v.model, v.model_year
       from work_orders wo join vehicles v on v.id = wo.vehicle_id
       where wo.id = $1 and wo.workshop_id = $2`,
      [req.params.workOrderId, req.user!.workshopId]
    );
    const vehicle = vehicleResult.rows[0];
    if (!vehicle) {
      throw new ApiError(404, "WORK_ORDER_NOT_FOUND");
    }

    const suggestions = await diagnoseDtcCodes(req.params.workOrderId, body.dtcCodes, {
      make: vehicle.make ?? undefined,
      model: vehicle.model ?? undefined,
      modelYear: vehicle.model_year ?? undefined,
    });

    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// إصدار الفاتورة
// ---------------------------------------------------------------------------

workOrdersRouter.post("/:workOrderId/invoice", requireRole("owner", "accountant"), async (req, res, next) => {
  try {
    const invoice = await generateInvoiceForWorkOrder(req.user!.workshopId, req.params.workOrderId);
    res.status(201).json({ invoice });
  } catch (err) {
    next(err);
  }
});
