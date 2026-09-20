# قاعدة البيانات

Postgres 14+ (يُوصى بـ Supabase، فيه امتداد `pgvector` مفعّل افتراضيًا).

```bash
psql "$DATABASE_URL" -f schema.sql
psql "$DATABASE_URL" -f seed_sample_data.sql   # اختياري: باقتا اشتراك تجريبيتان لعرضهما في الواجهة
```

## ملاحظة حول `pgvector`

`schema.sql` يحاول تفعيل امتداد `vector` (مستخدم فقط لعمود `legal_articles.embedding` المحجوز لترقية استرجاع دلالي لاحقًا — غير مُستخدم فعليًا في منطق الـ MVP الحالي).

- **Supabase**: يعمل مباشرة بدون أي خطوة إضافية.
- **Postgres محلي**: ثبّت الامتداد أولًا (`apt install postgresql-16-pgvector` أو ما يعادلها حسب توزيعتك) قبل تشغيل السكربت. إن لم ترغب بتثبيته الآن، احذف سطري `create extension if not exists vector;` وتعريف عمود `embedding` من `schema.sql` — لا شيء آخر في الـ MVP يعتمد عليهما.

## الترتيب المنطقي للجداول

`users` → `subscription_packages` → `subscriptions` → `cases` → `intake_answers` / `case_documents` → `legal_regulations` → `legal_articles` → `generated_documents` → `generated_document_citations`.

راجع تعليقات كل جدول داخل `schema.sql` نفسه، وتفاصيل قاعدة المعرفة القانونية في [`../docs/LEGAL_KNOWLEDGE_BASE.md`](../docs/LEGAL_KNOWLEDGE_BASE.md).
