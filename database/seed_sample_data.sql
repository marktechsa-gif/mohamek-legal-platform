-- بيانات تمهيدية اختيارية لتجربة التدفق كاملاً (باقات اشتراك تجريبية).
-- لا علاقة لها بقاعدة المعرفة القانونية — تلك في legal-kb/ منفصلة عمدًا.
-- الأسعار تقديرية للعرض فقط، عدّلها حسب نموذج التسعير الفعلي.

insert into subscription_packages (code, name_ar, description_ar, price_sar, billing_period, documents_included_per_period)
values
  ('basic', 'الباقة الأساسية', 'مستند واحد شهريًا (لائحة دعوى)', 99.00, 'monthly', 1),
  ('pro', 'الباقة الاحترافية', 'حتى 5 مستندات شهريًا', 349.00, 'monthly', 5)
on conflict (code) do nothing;
