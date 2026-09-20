-- تأصيل تك — Postgres schema (Supabase-compatible)
-- Apply with: psql "$DATABASE_URL" -f database/schema.sql

create extension if not exists pgcrypto;
create extension if not exists vector; -- pgvector: reserved for future semantic retrieval over legal_articles.embedding

-- ============================================================
-- المستخدمون (العملاء)
-- ============================================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone text,
  password_hash text not null,
  is_employee boolean, -- يوجّه فرع أسئلة نظام العمل في محرك الاستقصاء
  disclaimer_accepted_at timestamptz, -- إقرار صريح بقراءة التنويه القانوني؛ يجب تعبئته قبل أول توليد مستند
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- الباقات والاشتراكات
-- ============================================================
create table if not exists subscription_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  description_ar text,
  price_sar numeric(10,2) not null,
  billing_period text not null default 'monthly' check (billing_period in ('monthly','yearly','one_time')),
  documents_included_per_period integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  package_id uuid not null references subscription_packages(id),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','active','cancelled','expired')),
  -- تكامل بوابة الدفع الفعلية (Moyasar/PayTabs/Tap) غير مُنفَّذ في الـ MVP؛
  -- هذا العمود نقطة الامتداد الوحيدة المطلوبة لاحقًا.
  payment_provider_ref text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  documents_used_this_period integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user on subscriptions(user_id);

-- ============================================================
-- القضايا
-- ============================================================
create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subscription_id uuid references subscriptions(id),
  case_type text not null default 'general'
    check (case_type in ('general','labor','commercial')), -- يحدد أي حزم أسئلة/أنظمة إضافية تُفعَّل
  status text not null default 'intake_in_progress'
    check (status in ('intake_in_progress','ready_to_generate','generated','failed')),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cases_user on cases(user_id);

-- ============================================================
-- محادثة الاستقصاء (بنك الأسئلة مُعرَّف في الكود؛ هذا الجدول يخزّن الإجابات فقط)
-- ============================================================
create table if not exists intake_answers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  question_id text not null, -- يطابق id في INTAKE_QUESTIONS بالكود
  answer_value jsonb not null,
  answered_at timestamptz not null default now(),
  unique (case_id, question_id)
);

create index if not exists idx_intake_answers_case on intake_answers(case_id);

-- ============================================================
-- المستندات الداعمة المرفوعة من العميل
-- ============================================================
create table if not exists case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  original_filename text not null,
  storage_path text not null, -- محلي في الـ MVP؛ لاحقًا مفتاح كائن S3-compatible
  mime_type text,
  size_bytes bigint,
  client_description text, -- وصف العميل المختصر لصلة المستند بالقضية (يُستخدم في الـ Prompt كملخّص فقط)
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_case_documents_case on case_documents(case_id);

-- ============================================================
-- قاعدة المعرفة القانونية: الأنظمة
-- ============================================================
create table if not exists legal_regulations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- مثال: sharia_procedure_law
  name_ar text not null,
  issued_by text,
  royal_decree_ref text,
  effective_date date,
  source_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- قاعدة المعرفة القانونية: المواد
-- ============================================================
create table if not exists legal_articles (
  id uuid primary key default gen_random_uuid(),
  regulation_id uuid not null references legal_regulations(id) on delete cascade,
  article_number text not null,
  article_text text not null, -- يجب أن يكون النص الرسمي الحرفي؛ راجع docs/LEGAL_KNOWLEDGE_BASE.md
  topic_tags text[] not null default '{}',
  embedding vector(1536), -- محجوز لترقية الاسترجاع الدلالي لاحقًا؛ غير مُستخدم في الـ MVP
  created_at timestamptz not null default now(),
  unique (regulation_id, article_number)
);

create index if not exists idx_legal_articles_regulation on legal_articles(regulation_id);
create index if not exists idx_legal_articles_topic_tags on legal_articles using gin(topic_tags);

-- ============================================================
-- المستندات المولَّدة
-- ============================================================
create table if not exists generated_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  document_type text not null
    check (document_type in (
      'lawsuit_statement',   -- لائحة دعوى — النوع المُنفَّذ في الـ MVP
      'response_memo',       -- مذكرة جوابية
      'defense_memo',        -- مذكرة دفاع
      'appeal_memo',         -- مذكرة استئناف
      'retrial_petition'     -- التماس إعادة نظر
    )),
  status text not null default 'draft'
    check (status in ('draft','rejected_missing_grounds','finalized')),
  content_json jsonb not null, -- البنية الكاملة للمستند (الأطراف، الوقائع، السند النظامي، الطلبات...)
  docx_storage_path text, -- يُملأ بعد التصدير الناجح لـ Word
  ai_provider text,
  ai_model text,
  generated_at timestamptz not null default now()
);

create index if not exists idx_generated_documents_case on generated_documents(case_id);

-- ============================================================
-- الربط بين المستند المولَّد والمواد النظامية المُستشهَد بها فعليًا
-- (كل صف هنا هو استشهاد تم التحقق أنه موجود حرفيًا في legal_articles — راجع validateCitations في الكود)
-- ============================================================
create table if not exists generated_document_citations (
  id uuid primary key default gen_random_uuid(),
  generated_document_id uuid not null references generated_documents(id) on delete cascade,
  legal_article_id uuid not null references legal_articles(id),
  cited_for text -- السياق: أي جزء من المستند استند لهذه المادة (مثلاً "الطلب الأول")
);

create index if not exists idx_generated_document_citations_doc on generated_document_citations(generated_document_id);
