# قاعدة البيانات

Postgres 14+ (Supabase مناسب).

```bash
psql "$DATABASE_URL" -f schema.sql
psql "$DATABASE_URL" -f seed_sample_data.sql   # اختياري: باقة اشتراك تجريبية للورش
```

## العزل بين المستأجرين (Multi-tenancy)

كل جدول أعمال يحمل `workshop_id`. الباك-إند **لا** يثق بأي `workshop_id` قادم من الطلب نفسه — يستخرجه فقط من المستخدم المُصادَق عليه (JWT) عبر middleware مركزي (`backend/src/middleware/tenant.ts`)، بحيث يستحيل بنيويًا أن تطّلع ورشة على بيانات ورشة أخرى حتى لو حاول العميل تمرير `workshop_id` مختلف يدويًا.

## الترتيب المنطقي

`workshops` → `users` → `subscription_packages` → `workshop_subscriptions` → `customers` → `vehicles` → `work_orders` (+`work_order_otps`, `work_order_diagnostics`) → `parts_catalog` / `used_parts_suppliers` → `used_parts_listings` (+`used_parts_supplier_reviews`) → `work_order_items` → `part_shipments` → `invoices` → `technician_kpi_events`.

راجع تعليقات كل جدول داخل `schema.sql`، والمعمارية الكاملة في [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
