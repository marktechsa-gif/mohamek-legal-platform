import { Router } from "express";
import { query } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

invoicesRouter.get("/", async (req, res, next) => {
  try {
    const result = await query(
      `select id, invoice_number, work_order_id, subtotal_sar, vat_sar, total_sar, status, issued_at
       from invoices where workshop_id = $1 order by issued_at desc`,
      [req.user!.workshopId]
    );
    res.json({ invoices: result.rows });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/:invoiceId", async (req, res, next) => {
  try {
    const result = await query(
      `select * from invoices where id = $1 and workshop_id = $2`,
      [req.params.invoiceId, req.user!.workshopId]
    );
    const invoice = result.rows[0];
    if (!invoice) {
      throw new ApiError(404, "INVOICE_NOT_FOUND");
    }
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});
