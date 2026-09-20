"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setToken } from "../lib/api";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [workshopName, setWorkshopName] = useState("");
  const [city, setCity] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string }>("/auth/login", {
        method: "POST",
        auth: false,
        body: { email, password },
      });
      setToken(data.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string }>("/auth/register-workshop", {
        method: "POST",
        auth: false,
        body: {
          workshopName,
          city,
          ownerFullName,
          ownerEmail: email,
          ownerPassword: password,
        },
      });
      setToken(data.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>Smart MRO & Garage ERP</h1>
      <p className="muted">نظام إدارة الورش والصيانة الذكي — سجّل ورشتك وابدأ خلال دقائق.</p>

      <div className="card">
        <div className="tabs">
          <button className={tab === "login" ? "active" : ""} onClick={() => setTab("login")} type="button">
            تسجيل الدخول
          </button>
          <button className={tab === "register" ? "active" : ""} onClick={() => setTab("register")} type="button">
            تسجيل ورشة جديدة
          </button>
        </div>

        {tab === "login" ? (
          <form onSubmit={handleLogin}>
            <label>البريد الإلكتروني</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label>كلمة المرور</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <div className="error">{error}</div>}
            <button className="btn" type="submit" disabled={loading}>
              دخول
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <label>اسم الورشة</label>
            <input type="text" value={workshopName} onChange={(e) => setWorkshopName(e.target.value)} required />
            <label>المدينة</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} />
            <label>اسم المالك الكامل</label>
            <input type="text" value={ownerFullName} onChange={(e) => setOwnerFullName(e.target.value)} required />
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
              إنشاء حساب الورشة
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
