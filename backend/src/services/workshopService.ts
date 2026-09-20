import bcrypt from "bcryptjs";
import { query } from "../db/client";
import { ApiError } from "../middleware/errorHandler";
import type { AuthUser } from "../types";

interface RegisterWorkshopInput {
  workshopName: string;
  commercialRegistrationNumber?: string;
  city?: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
}

/**
 * بوابة التسجيل الذاتي: تُنشئ الورشة + المستخدم المالك (owner) + اشتراكًا
 * تجريبيًا (trial) دفعة واحدة، لتسجّل الورشة نفسها خلال دقائق دون تدخّل يدوي
 * من فريق المنصة — كما هو مطلوب في وحدة "تسجيل واشتراكات الورش السحابية".
 */
export async function registerWorkshop(input: RegisterWorkshopInput): Promise<AuthUser> {
  const existingUser = await query(`select id from users where email = $1`, [input.ownerEmail]);
  if (existingUser.rows.length > 0) {
    throw new ApiError(409, "EMAIL_ALREADY_REGISTERED");
  }

  const workshopResult = await query<{ id: string }>(
    `insert into workshops (name, commercial_registration_number, city)
     values ($1, $2, $3)
     returning id`,
    [input.workshopName, input.commercialRegistrationNumber ?? null, input.city ?? null]
  );
  const workshopId = workshopResult.rows[0].id;

  const passwordHash = await bcrypt.hash(input.ownerPassword, 10);
  const userResult = await query<{ id: string; email: string }>(
    `insert into users (workshop_id, full_name, email, password_hash, role)
     values ($1, $2, $3, $4, 'owner')
     returning id, email`,
    [workshopId, input.ownerFullName, input.ownerEmail, passwordHash]
  );
  const user = userResult.rows[0];

  const starterPackage = await query<{ id: string }>(
    `select id from subscription_packages where code = 'starter' limit 1`
  );
  if (starterPackage.rows.length > 0) {
    await query(
      `insert into workshop_subscriptions (workshop_id, package_id, status, current_period_end)
       values ($1, $2, 'trial', now() + interval '14 days')`,
      [workshopId, starterPackage.rows[0].id]
    );
  }

  return { id: user.id, email: user.email, workshopId, role: "owner" };
}
