"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, setToken } from "../lib/api";

interface Package {
  id: string;
  nameAr: string;
  descriptionAr: string | null;
  priceSar: number;
  billingPeriod: string;
  documentsIncludedPerPeriod: number;
}

export default function HomePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [packages, setPackages] = useState<Package[]>([]);
  const [subscribedPackageId, setSubscribedPackageId] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(Boolean(getToken()));
    apiFetch<{ packages: Package[] }>("/subscriptions/packages")
      .then((data) => setPackages(data.packages))
      .catch(() => setPackages([]));
  }, []);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path = tab === "register" ? "/auth/register" : "/auth/login";
      const body = tab === "register" ? { fullName, email, password } : { email, password };
      const data = await apiFetch<{ token: string }>(path, { method: "POST", body });
      setToken(data.token);
      setAuthed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(packageId: string) {
    setError(null);
    try {
      await apiFetch("/subscriptions/subscribe", {
        method: "POST",
        auth: true,
        body: { packageId },
      });
      setSubscribedPackageId(packageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الاشتراك");
    }
  }

  async function handleStartCase() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ id: string }>("/cases", {
        method: "POST",
        auth: true,
        body: { caseType: "general" },
      });
      router.push(`/intake?caseId=${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إنشاء القضية");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>أسانيد</h1>
      <p className="muted">
        محادثة استقصائية موجَّهة عن قضيتك، ثم صياغة لائحة دعوى مستندة لنصوص الأنظمة السعودية.
      </p>

      <div className="disclaimer">
        ⚠️ المخرجات مسودة داعمة أولية وليست استشارة قانونية، ويجب مراجعتها واعتمادها من محامٍ مرخّص قبل أي استخدام فعلي.
      </div>

      {!authed && (
        <div className="card">
          <div className="tabs">
            <button
              className={tab === "login" ? "active" : ""}
              onClick={() => setTab("login")}
              type="button"
            >
              تسجيل الدخول
            </button>
            <button
              className={tab === "register" ? "active" : ""}
              onClick={() => setTab("register")}
              type="button"
            >
              حساب جديد
            </button>
          </div>

          <form onSubmit={handleAuthSubmit}>
            {tab === "register" && (
              <>
                <label>الاسم الكامل</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </>
            )}
            <label>البريد الإلكتروني</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label>كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            {error && <div className="error">{error}</div>}
            <button className="btn" type="submit" disabled={loading}>
              {tab === "register" ? "إنشاء الحساب" : "دخول"}
            </button>
          </form>
        </div>
      )}

      {authed && (
        <>
          <div className="card">
            <h2>الباقات</h2>
            {packages.length === 0 && <p className="muted">لا توجد باقات متاحة حاليًا.</p>}
            <div className="package-list">
              {packages.map((pkg) => (
                <div className="package-card" key={pkg.id}>
                  <div>
                    <strong>{pkg.nameAr}</strong>
                    <div className="muted">{pkg.descriptionAr}</div>
                    <div className="muted">{pkg.priceSar} ﷼ / {pkg.billingPeriod === "monthly" ? "شهريًا" : pkg.billingPeriod}</div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => handleSubscribe(pkg.id)}
                    disabled={subscribedPackageId === pkg.id}
                  >
                    {subscribedPackageId === pkg.id ? "مُشترك" : "اشترك"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>ابدأ قضيتك</h2>
            <p className="muted">سنبدأ بمحادثة استقصائية عن تفاصيل قضيتك.</p>
            {error && <div className="error">{error}</div>}
            <button className="btn" type="button" onClick={handleStartCase} disabled={loading}>
              ابدأ قضية جديدة
            </button>
          </div>
        </>
      )}
    </main>
  );
}
