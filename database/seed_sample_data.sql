-- بيانات تمهيدية اختيارية لتجربة التدفق كاملاً (باقات اشتراك تجريبية للورش).
-- الأسعار تقديرية للعرض فقط، عدّلها حسب نموذج التسعير الفعلي.

insert into subscription_packages (code, name_ar, price_sar, billing_period, max_active_work_orders, max_users)
values
  ('starter', 'باقة البداية', 199.00, 'monthly', 30, 5),
  ('growth', 'باقة النمو', 499.00, 'monthly', 150, 20)
on conflict (code) do nothing;
