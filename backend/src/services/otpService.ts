import bcrypt from "bcryptjs";
import { query } from "../db/client";
import { ApiError } from "../middleware/errorHandler";

const OTP_TTL_MINUTES = 15;

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * يُنشئ رمز تحقق للاستلام أو التسليم. إرساله الفعلي عبر SMS (Unifonic/Twilio
 * وغيرها) غير منفَّذ في الـ MVP — الكود يُعاد في استجابة الـ API مباشرة بدل
 * الإرسال، لتبقى تجربة الاختبار قابلة للتنفيذ الآن دون بوابة رسائل مربوطة.
 * راجع docs/ROADMAP.md.
 */
export async function generateWorkOrderOtp(
  workOrderId: string,
  purpose: "checkin" | "pickup"
): Promise<{ code: string; expiresAt: Date }> {
  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await query(
    `insert into work_order_otps (work_order_id, purpose, code_hash, expires_at)
     values ($1, $2, $3, $4)`,
    [workOrderId, purpose, codeHash, expiresAt]
  );

  return { code, expiresAt };
}

export async function verifyWorkOrderOtp(
  workOrderId: string,
  purpose: "checkin" | "pickup",
  code: string
): Promise<void> {
  const result = await query<{ id: string; code_hash: string; expires_at: Date }>(
    `select id, code_hash, expires_at from work_order_otps
     where work_order_id = $1 and purpose = $2 and verified_at is null
     order by created_at desc limit 1`,
    [workOrderId, purpose]
  );

  const otp = result.rows[0];
  if (!otp) {
    throw new ApiError(404, "OTP_NOT_FOUND");
  }
  if (new Date(otp.expires_at) < new Date()) {
    throw new ApiError(410, "OTP_EXPIRED");
  }
  if (!(await bcrypt.compare(code, otp.code_hash))) {
    throw new ApiError(401, "OTP_INVALID");
  }

  await query(`update work_order_otps set verified_at = now() where id = $1`, [otp.id]);

  const column = purpose === "checkin" ? "checkin_otp_verified_at" : "pickup_otp_verified_at";
  await query(`update work_orders set ${column} = now() where id = $1`, [workOrderId]);
}

/**
 * بديل موثّق عند تعذّر الاتصال بالعميل (توقيع رقمي أو تسجيل مفوَّض) بدل الـ OTP،
 * حسب متطلبات "خيارات الاستقبال المرنة" في المواصفات.
 */
export async function recordOtpFallback(
  workOrderId: string,
  purpose: "checkin" | "pickup",
  method: "digital_signature" | "authorized_person",
  reference: string
): Promise<void> {
  await query(
    `insert into work_order_otps (work_order_id, purpose, code_hash, expires_at, fallback_method, fallback_reference, verified_at)
     values ($1, $2, '', now(), $3, $4, now())`,
    [workOrderId, purpose, method, reference]
  );

  const column = purpose === "checkin" ? "checkin_otp_verified_at" : "pickup_otp_verified_at";
  await query(`update work_orders set ${column} = now() where id = $1`, [workOrderId]);
}
