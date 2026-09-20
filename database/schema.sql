-- Smart MRO & Garage ERP — Postgres schema (Supabase-compatible)
-- Multi-tenant: every business table carries workshop_id and is scoped by it.
-- Apply with: psql "$DATABASE_URL" -f database/schema.sql

create extension if not exists pgcrypto;

-- ============================================================
-- المستأجرون: الورش (Tenants)
-- ============================================================
create table if not exists workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  commercial_registration_number text,
  vat_number text, -- مطلوب لتوليد فواتير ZATCA
  city text,
  is_active boolean not null default true,
  data_residency_note text not null default 'كل بيانات الورشة معزولة بالكامل عبر workshop_id في كل جدول',
  created_at timestamptz not null default now()
);

-- ============================================================
-- المستخدمون والأدوار (RBAC)
-- ============================================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  password_hash text not null,
  role text not null check (role in ('owner','receptionist','technician','accountant','warehouse_supervisor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workshop_id, email)
);

create index if not exists idx_users_workshop on users(workshop_id);

-- ============================================================
-- الباقات والاشتراكات (SaaS billing للورش أنفسها)
-- ============================================================
create table if not exists subscription_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  price_sar numeric(10,2) not null,
  billing_period text not null default 'monthly' check (billing_period in ('monthly','yearly')),
  max_active_work_orders integer,
  max_users integer,
  is_active boolean not null default true
);

create table if not exists workshop_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  package_id uuid not null references subscription_packages(id),
  status text not null default 'trial' check (status in ('trial','active','past_due','cancelled')),
  -- تكامل بوابة دفع فعلية (Moyasar/PayTabs/Tap) للتجديد الآلي غير منفَّذ في الـ MVP
  payment_provider_ref text,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_workshop_subscriptions_workshop on workshop_subscriptions(workshop_id);

-- ============================================================
-- العملاء والمركبات (CRM & Asset Management)
-- ============================================================
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  kind text not null default 'individual' check (kind in ('individual','company','fleet')),
  name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_customers_workshop on customers(workshop_id);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  plate_number text not null,
  vin text, -- رقم الهيكل، يُستخدم لمطابقة كتالوج القطع
  make text,
  model text,
  model_year integer,
  current_odometer integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicles_workshop on vehicles(workshop_id);
create index if not exists idx_vehicles_customer on vehicles(customer_id);

-- ============================================================
-- أوامر الشغل (Reception & Diagnostics)
-- ============================================================
create table if not exists work_orders (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id),
  customer_id uuid not null references customers(id),
  assigned_technician_id uuid references users(id),
  status text not null default 'checked_in'
    check (status in (
      'checked_in',            -- تحت الفحص
      'awaiting_part',         -- بانتظار القطعة (يشمل: معلق بانتظار توريد تشليح)
      'in_progress',           -- جارِ الإصلاح
      'ready_for_pickup',      -- جاهزة للاستلام
      'closed'                 -- مغلق ومسلَّم
    )),
  customer_reported_issue text,
  intake_notes text,
  intake_damage_photos text[] not null default '{}', -- مسارات تخزين الصور
  checkin_otp_verified_at timestamptz,
  pickup_otp_verified_at timestamptz,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists idx_work_orders_workshop on work_orders(workshop_id);
create index if not exists idx_work_orders_vehicle on work_orders(vehicle_id);
create index if not exists idx_work_orders_technician on work_orders(assigned_technician_id);

-- رموز التحقق الآمن عند الاستلام والتسليم
create table if not exists work_order_otps (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  purpose text not null check (purpose in ('checkin','pickup')),
  code_hash text not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  -- بديل موثّق عند تعذّر الاتصال (توقيع رقمي / تسجيل مفوَّض) بدل الـ OTP
  fallback_method text check (fallback_method in ('digital_signature','authorized_person')),
  fallback_reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_order_otps_wo on work_order_otps(work_order_id);

-- ============================================================
-- أكواد الأعطال (DTC) ومساعد التشخيص بالذكاء الاصطناعي
-- ============================================================
create table if not exists work_order_diagnostics (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  dtc_codes text[] not null default '{}', -- أكواد OBD-II الخام؛ إدخال يدوي في الـ MVP، ربط أجهزة الفحص لاسلكيًا لاحقًا
  ai_suggested_causes jsonb, -- مخرجات مساعد الذكاء الاصطناعي: أسباب محتملة + خطوات إصلاح
  ai_provider text,
  ai_model text,
  generated_at timestamptz not null default now()
);

create index if not exists idx_work_order_diagnostics_wo on work_order_diagnostics(work_order_id);

-- ============================================================
-- كتالوج قطع الغيار (جديد) والتشاليح (مستعمل)
-- ============================================================
create table if not exists parts_catalog (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid references workshops(id) on delete cascade, -- null = كتالوج عام مشترك بين كل الورش
  part_number text not null,
  name_ar text not null,
  compatible_makes text[] not null default '{}',
  compatible_models text[] not null default '{}',
  new_price_sar numeric(10,2),
  created_at timestamptz not null default now()
);

create table if not exists used_parts_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  city text,
  rating_average numeric(2,1) not null default 0, -- من 5، محسوبة من used_parts_supplier_reviews
  on_time_rate numeric(5,2), -- نسبة الالتزام بالوقت
  return_rate numeric(5,2), -- نسبة المرتجعات
  created_at timestamptz not null default now()
);

create table if not exists used_parts_listings (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references used_parts_suppliers(id) on delete cascade,
  part_catalog_id uuid references parts_catalog(id),
  description_ar text not null,
  used_price_sar numeric(10,2) not null,
  condition_grade text check (condition_grade in ('excellent','good','fair')),
  warranty_days integer not null default 0, -- ضمان القطعة المستعملة، يتبع المورّد
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_used_parts_listings_supplier on used_parts_listings(supplier_id);

create table if not exists used_parts_supplier_reviews (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references used_parts_suppliers(id) on delete cascade,
  workshop_id uuid not null references workshops(id),
  stars integer not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_used_parts_reviews_supplier on used_parts_supplier_reviews(supplier_id);

-- ============================================================
-- بنود أمر الشغل (قطع + مصنعيات)
-- ============================================================
create table if not exists work_order_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  item_type text not null check (item_type in ('labor','new_part','used_part')),
  description_ar text not null,
  used_parts_listing_id uuid references used_parts_listings(id), -- فقط لو item_type = used_part
  quantity integer not null default 1,
  unit_price_sar numeric(10,2) not null,
  workshop_margin_sar numeric(10,2) not null default 0, -- هامش ربح الورشة عند بيع قطعة مستعملة
  status text not null default 'pending'
    check (status in ('pending','ordered','delivered','installed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_work_order_items_wo on work_order_items(work_order_id);

-- ============================================================
-- اللوجستيات: طلب الشراء وتتبع الشحن
-- ============================================================
create table if not exists part_shipments (
  id uuid primary key default gen_random_uuid(),
  work_order_item_id uuid not null references work_order_items(id) on delete cascade,
  carrier_name text,
  tracking_reference text,
  -- تكامل API فعلي مع شركات الشحن (أرامكس/SMSA...) غير منفَّذ في الـ MVP؛
  -- هذا الحقل نقطة الامتداد لتتبع لحظي حقيقي لاحقًا.
  status text not null default 'requested'
    check (status in ('requested','picked_up','in_transit','delivered','delayed')),
  estimated_arrival_at timestamptz, -- ناتج محرك حساب ETA
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_part_shipments_item on part_shipments(work_order_item_id);

-- ============================================================
-- الفواتير (ZATCA)
-- ============================================================
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  work_order_id uuid not null references work_orders(id),
  invoice_number text not null,
  subtotal_sar numeric(10,2) not null,
  vat_sar numeric(10,2) not null,
  total_sar numeric(10,2) not null,
  zatca_qr_base64 text not null, -- TLV-encoded QR payload حسب متطلبات المرحلة الأولى المبسّطة
  status text not null default 'unpaid' check (status in ('unpaid','paid','void')),
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (workshop_id, invoice_number)
);

create index if not exists idx_invoices_workshop on invoices(workshop_id);
create index if not exists idx_invoices_work_order on invoices(work_order_id);

-- ============================================================
-- مؤشرات أداء الفنيين (KPIs)
-- ============================================================
create table if not exists technician_kpi_events (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  technician_id uuid not null references users(id),
  work_order_id uuid not null references work_orders(id),
  minutes_to_close integer not null,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_technician_kpi_technician on technician_kpi_events(technician_id);
