# backend

Express + TypeScript API، متعدد المستأجرين.

```bash
npm install
cp .env.example .env
npm run dev
```

## المسارات الرئيسية

| المسار | الوصف |
|---|---|
| `POST /auth/register-workshop`, `POST /auth/login` | تسجيل ذاتي للورشة + دخول |
| `GET /subscriptions/packages`, `GET /subscriptions/current` | باقات الاشتراك |
| `POST/GET /customers`, `POST/GET /customers/:id/vehicles` | العملاء والمركبات |
| `POST/GET /work-orders`, `PATCH /work-orders/:id/status` | أوامر الشغل ودورة حياتها |
| `POST /work-orders/:id/damage-photos` | صور أضرار الاستلام |
| `POST /work-orders/:id/otp/request|verify|fallback` | رموز تحقق الاستلام/التسليم |
| `POST/GET /work-orders/:id/items` | بنود أمر الشغل (مصنعيات/قطع) |
| `POST /work-orders/:id/diagnose` | مساعد التشخيص بالذكاء الاصطناعي (DTC) |
| `POST /work-orders/:id/invoice` | إصدار فاتورة ZATCA |
| `POST/GET /used-parts/suppliers`, `POST /used-parts/suppliers/:id/reviews` | موردو التشاليح وتقييماتهم |
| `POST/GET /used-parts/listings` | عروض القطع المستعملة (تسعير مزدوج) |
| `POST/GET /parts-catalog` | كتالوج قطع الغيار الجديدة |
| `GET /invoices`, `GET /invoices/:id` | الفواتير |

راجع [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) لتفاصيل العزل بين المستأجرين والتدفق الكامل.
