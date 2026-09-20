import { query } from "../db/client";
import { ApiError } from "../middleware/errorHandler";

export interface SubscriptionPackage {
  id: string;
  code: string;
  nameAr: string;
  descriptionAr: string | null;
  priceSar: number;
  billingPeriod: string;
  documentsIncludedPerPeriod: number;
}

export async function listActivePackages(): Promise<SubscriptionPackage[]> {
  const result = await query<{
    id: string;
    code: string;
    name_ar: string;
    description_ar: string | null;
    price_sar: string;
    billing_period: string;
    documents_included_per_period: number;
  }>(
    `select id, code, name_ar, description_ar, price_sar, billing_period, documents_included_per_period
     from subscription_packages
     where is_active = true
     order by price_sar asc`
  );

  return result.rows.map((r) => ({
    id: r.id,
    code: r.code,
    nameAr: r.name_ar,
    descriptionAr: r.description_ar,
    priceSar: Number(r.price_sar),
    billingPeriod: r.billing_period,
    documentsIncludedPerPeriod: r.documents_included_per_period,
  }));
}

/**
 * ينشئ اشتراكًا بحالة "pending_payment". ربطه ببوابة دفع فعلية (Moyasar/PayTabs/Tap)
 * غير منفَّذ في الـ MVP — راجع payment_provider_ref في database/schema.sql.
 * هنا فقط نفعّله مباشرة لأغراض تجربة التدفق الكاملة برمجيًا.
 */
export async function subscribeUserToPackage(userId: string, packageId: string) {
  const packageResult = await query<{ id: string }>(
    `select id from subscription_packages where id = $1 and is_active = true`,
    [packageId]
  );
  if (packageResult.rows.length === 0) {
    throw new ApiError(404, "PACKAGE_NOT_FOUND");
  }

  const result = await query<{ id: string }>(
    `insert into subscriptions
       (user_id, package_id, status, current_period_start, current_period_end)
     values ($1, $2, 'active', now(), now() + interval '30 days')
     returning id`,
    [userId, packageId]
  );

  return { id: result.rows[0].id };
}
