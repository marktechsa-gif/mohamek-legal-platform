# backend

Express + TypeScript API.

```bash
npm install
cp .env.example .env
npm run dev
```

## المسارات

| المسار | الوصف |
|---|---|
| `POST /auth/register`, `POST /auth/login` | حساب العميل |
| `GET /subscriptions/packages` | الباقات المتاحة |
| `POST /subscriptions/subscribe` | اشتراك (بدون بوابة دفع فعلية بعد) |
| `POST /cases`, `GET /cases`, `GET /cases/:id` | إدارة القضايا |
| `GET /cases/:id/intake/next` | السؤال التالي في محادثة الاستقصاء |
| `POST /cases/:id/intake/answer` | تسجيل إجابة |
| `POST /cases/:id/documents` (multipart) | رفع مستند داعم |
| `POST /cases/:id/documents/generate` | توليد لائحة الدعوى (يفشل بـ `NO_GROUNDED_ARTICLES_FOUND` إن كانت قاعدة المعرفة فارغة من الأنظمة المطلوبة) |
| `GET /cases/:id/documents/:docId` | بيانات المستند المولَّد |
| `GET /cases/:id/documents/:docId/download` | تنزيل ملف Word |
| `GET /legal-kb/regulations` | الأنظمة المحمَّلة في قاعدة المعرفة وعدد موادها |

راجع [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) لتفاصيل التدفق الكامل.
