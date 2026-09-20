import { query } from "../db/client";
import { env } from "../config/env";
import { buildZatcaQrBase64 } from "../lib/zatcaQr";
import { ApiError } from "../middleware/errorHandler";

const VAT_RATE = 0.15; // نظام ضريبة القيمة المضافة السعودي

interface WorkOrderItemRow {
  unit_price_sar: string;
  quantity: number;
}

export async function generateInvoiceForWorkOrder(workshopId: string, workOrderId: string) {
  const workOrderResult = await query<{ id: string; status: string }>(
    `select id, status from work_orders where id = $1 and workshop_id = $2`,
    [workOrderId, workshopId]
  );
  const workOrder = workOrderResult.rows[0];
  if (!workOrder) {
    throw new ApiError(404, "WORK_ORDER_NOT_FOUND");
  }

  const existing = await query(`select id from invoices where work_order_id = $1`, [workOrderId]);
  if (existing.rows.length > 0) {
    throw new ApiError(409, "INVOICE_ALREADY_EXISTS");
  }

  const itemsResult = await query<WorkOrderItemRow>(
    `select unit_price_sar, quantity from work_order_items where work_order_id = $1`,
    [workOrderId]
  );
  if (itemsResult.rows.length === 0) {
    throw new ApiError(422, "WORK_ORDER_HAS_NO_ITEMS");
  }

  const subtotal = itemsResult.rows.reduce(
    (sum, item) => sum + Number(item.unit_price_sar) * item.quantity,
    0
  );
  const vat = Math.round(subtotal * VAT_RATE * 100) / 100;
  const total = Math.round((subtotal + vat) * 100) / 100;

  const workshopResult = await query<{ name: string; vat_number: string | null }>(
    `select name, vat_number from workshops where id = $1`,
    [workshopId]
  );
  const workshop = workshopResult.rows[0];
  if (!workshop?.vat_number) {
    throw new ApiError(
      422,
      "WORKSHOP_MISSING_VAT_NUMBER",
      "لا يمكن إصدار فاتورة ZATCA قبل تسجيل الرقم الضريبي للورشة"
    );
  }

  const countResult = await query<{ count: string }>(
    `select count(*) from invoices where workshop_id = $1`,
    [workshopId]
  );
  const invoiceNumber = `INV-${String(Number(countResult.rows[0].count) + 1).padStart(6, "0")}`;
  const issuedAt = new Date();

  const zatcaQrBase64 = buildZatcaQrBase64({
    sellerName: workshop.name || env.ZATCA_DEFAULT_SELLER_NAME,
    vatNumber: workshop.vat_number,
    timestampIso: issuedAt.toISOString(),
    totalWithVat: total.toFixed(2),
    vatAmount: vat.toFixed(2),
  });

  const insertResult = await query<{ id: string }>(
    `insert into invoices
       (workshop_id, work_order_id, invoice_number, subtotal_sar, vat_sar, total_sar, zatca_qr_base64, issued_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [workshopId, workOrderId, invoiceNumber, subtotal, vat, total, zatcaQrBase64, issuedAt]
  );

  return {
    id: insertResult.rows[0].id,
    invoiceNumber,
    subtotal,
    vat,
    total,
    zatcaQrBase64,
    issuedAt,
  };
}
