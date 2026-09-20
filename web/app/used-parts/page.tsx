"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Nav } from "../../components/Nav";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  rating_average: string;
  on_time_rate: string | null;
  return_rate: string | null;
}

interface Listing {
  id: string;
  description_ar: string;
  used_price_sar: string;
  condition_grade: string;
  warranty_days: number;
  new_price_sar: string | null;
  supplier_name: string;
  supplier_rating: string;
}

const CONDITION_LABELS: Record<string, string> = {
  excellent: "ممتازة",
  good: "جيدة",
  fair: "مقبولة",
};

export default function UsedPartsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);

  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierCity, setSupplierCity] = useState("");

  const [listingSupplierId, setListingSupplierId] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingCondition, setListingCondition] = useState<"excellent" | "good" | "fair">("good");
  const [listingWarranty, setListingWarranty] = useState("30");

  const [reviewStars, setReviewStars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!getToken()) {
      router.push("/");
      return;
    }
    loadSuppliers();
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSuppliers() {
    try {
      const data = await apiFetch<{ suppliers: Supplier[] }>("/used-parts/suppliers");
      setSuppliers(data.suppliers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل الموردين");
    }
  }

  async function loadListings() {
    try {
      const data = await apiFetch<{ listings: Listing[] }>("/used-parts/listings");
      setListings(data.listings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل العروض");
    }
  }

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/used-parts/suppliers", {
        method: "POST",
        body: { name: supplierName, phone: supplierPhone || undefined, city: supplierCity || undefined },
      });
      setSupplierName("");
      setSupplierPhone("");
      setSupplierCity("");
      loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إضافة المورد");
    }
  }

  async function handleAddListing(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/used-parts/listings", {
        method: "POST",
        body: {
          supplierId: listingSupplierId,
          description: listingDescription,
          usedPriceSar: Number(listingPrice),
          conditionGrade: listingCondition,
          warrantyDays: Number(listingWarranty),
        },
      });
      setListingDescription("");
      setListingPrice("");
      loadListings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إضافة العرض");
    }
  }

  async function handleRate(supplierId: string) {
    const stars = Number(reviewStars[supplierId] ?? "5");
    setError(null);
    try {
      await apiFetch(`/used-parts/suppliers/${supplierId}/reviews`, {
        method: "POST",
        body: { stars },
      });
      loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تسجيل التقييم");
    }
  }

  return (
    <main className="container">
      <Nav />
      <h1>سوق التشاليح</h1>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2>إضافة مورّد</h2>
        <form onSubmit={handleAddSupplier}>
          <div className="row">
            <input
              type="text"
              placeholder="اسم المورّد"
              style={{ marginBottom: 0, flex: 2 }}
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="الجوال"
              style={{ marginBottom: 0, flex: 1 }}
              value={supplierPhone}
              onChange={(e) => setSupplierPhone(e.target.value)}
            />
            <input
              type="text"
              placeholder="المدينة"
              style={{ marginBottom: 0, flex: 1 }}
              value={supplierCity}
              onChange={(e) => setSupplierCity(e.target.value)}
            />
            <button className="btn" type="submit">
              إضافة
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>الموردون وتقييماتهم</h2>
        {suppliers.length === 0 && <p className="muted">لا يوجد موردون بعد.</p>}
        {suppliers.map((s) => (
          <div className="list-item" key={s.id}>
            <span>
              {s.name} {s.city && `— ${s.city}`} — تقييم: {Number(s.rating_average).toFixed(1)} ★
            </span>
            <div className="row">
              <select
                style={{ marginBottom: 0, maxWidth: 80 }}
                value={reviewStars[s.id] ?? "5"}
                onChange={(e) => setReviewStars((prev) => ({ ...prev, [s.id]: e.target.value }))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} ★
                  </option>
                ))}
              </select>
              <button className="btn-secondary btn" type="button" onClick={() => handleRate(s.id)}>
                تقييم
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>إضافة عرض قطعة مستعملة</h2>
        <form onSubmit={handleAddListing}>
          <label>المورّد</label>
          <select
            value={listingSupplierId}
            onChange={(e) => setListingSupplierId(e.target.value)}
            required
          >
            <option value="" disabled>
              اختر موردًا...
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label>الوصف</label>
          <input
            type="text"
            value={listingDescription}
            onChange={(e) => setListingDescription(e.target.value)}
            required
          />
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>السعر (ريال)</label>
              <input
                type="number"
                value={listingPrice}
                onChange={(e) => setListingPrice(e.target.value)}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>الحالة</label>
              <select
                value={listingCondition}
                onChange={(e) => setListingCondition(e.target.value as typeof listingCondition)}
              >
                <option value="excellent">ممتازة</option>
                <option value="good">جيدة</option>
                <option value="fair">مقبولة</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>أيام الضمان</label>
              <input
                type="number"
                value={listingWarranty}
                onChange={(e) => setListingWarranty(e.target.value)}
              />
            </div>
          </div>
          <button className="btn" type="submit" disabled={!listingSupplierId}>
            إضافة العرض
          </button>
        </form>
      </div>

      <div className="card">
        <h2>العروض المتاحة — تسعير مزدوج</h2>
        {listings.length === 0 && <p className="muted">لا توجد عروض بعد.</p>}
        {listings.map((l) => (
          <div className="list-item" key={l.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{l.description_ar}</strong>
              <span className="badge">{CONDITION_LABELS[l.condition_grade] ?? l.condition_grade}</span>
            </div>
            <div className="muted">
              المورّد: {l.supplier_name} ({Number(l.supplier_rating).toFixed(1)} ★) — ضمان {l.warranty_days} يوم
            </div>
            <div className="row">
              <span>مستعملة: <strong>{l.used_price_sar} ﷼</strong></span>
              {l.new_price_sar && <span className="muted">جديدة: {l.new_price_sar} ﷼</span>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
