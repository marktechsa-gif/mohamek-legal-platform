# web

واجهة Next.js (App Router) بسيطة تستهلك الـ `backend` عبر REST.

```bash
npm install
cp .env.example .env.local
npm run dev
```

## الصفحات

| المسار | الوصف |
|---|---|
| `/` | تسجيل دخول / تسجيل ورشة جديدة (Self-service onboarding) |
| `/dashboard` | عملاء ومركبات، فتح أمر شغل، قائمة أوامر الشغل |
| `/work-orders/[workOrderId]` | تفاصيل أمر الشغل: الحالة، صور الأضرار، OTP الاستلام/التسليم، البنود، مساعد التشخيص، الفاتورة |

التوكن يُخزَّن في `localStorage` (مقبول للـ MVP فقط).
