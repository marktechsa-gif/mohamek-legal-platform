"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken, uploadDamagePhoto } from "../../../lib/api";

interface WorkOrder {
  id: string;
  status: string;
  checkin_otp_verified_at: string | null;
  pickup_otp_verified_at: string | null;
}

interface WorkOrderItem {
  id: string;
  item_type: string;
  description_ar: string;
  quantity: number;
  unit_price_sar: string;
}

interface DiagnosticSuggestion {
  dtc_code: string;
  likely_causes: string[];
  recommended_steps: string[];
  confidence: string;
}

interface Invoice {
  invoiceNumber: string;
  subtotal: number;
  vat: number;
  total: number;
  zatcaQrBase64: string;
}

const STATUS_LABELS: Record<string, string> = {
  checked_in: "تحت الفحص",
  awaiting_part: "بانتظار القطعة",
  in_progress: "جارِ الإصلاح",
  ready_for_pickup: "جاهزة للاستلام",
  closed: "مغلق",
};

export default function WorkOrderDetailPage() {
  const params = useParams<{ workOrderId: string }>();
  const router = useRouter();
  const workOrderId = params.workOrderId;

  const [error, setError] = useState<string | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [items, setItems] = useState<WorkOrderItem[]>([]);

  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");

  const [itemType, setItemType] = useState<"labor" | "new_part" | "used_part">("labor");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemQty, setItemQty] = useState("1");

  const [dtcInput, setDtcInput] = useState("");
  const [suggestions, setSuggestions] = useState<DiagnosticSuggestion[]>([]);
  const [diagnosing, setDiagnosing] = useState(false);

  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push("/");
      return;
    }
    loadWorkOrder();
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  async function loadWorkOrder() {
    try {
      const data = await apiFetch<{ workOrder: WorkOrder }>(`/work-orders/${workOrderId}`);
      setWorkOrder(data.workOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل أمر الشغل");
    }
  }

  async function loadItems() {
    try {
      const data = await apiFetch<{ items: WorkOrderItem[] }>(`/work-orders/${workOrderId}/items`);
      setItems(data.items);
    } catch {
      // ignore
    }
  }

  async function updateStatus(status: string) {
    setError(null);
    try {
      await apiFetch(`/work-orders/${workOrderId}/status`, { method: "PATCH", body: { status } });
      loadWorkOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحديث الحالة");
    }
  }

  async function requestOtp(purpose: "checkin" | "pickup") {
    setError(null);
    try {
      const data = await apiFetch<{ code: string }>(`/work-orders/${workOrderId}/otp/request`, {
        method: "POST",
        body: { purpose },
      });
      setOtpCode(data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إنشاء رمز التحقق");
    }
  }

  async function verifyOtp(purpose: "checkin" | "pickup") {
    setError(null);
    try {
      await apiFetch(`/work-orders/${workOrderId}/otp/verify`, {
        method: "POST",
        body: { purpose, code: otpInput },
      });
      setOtpInput("");
      setOtpCode(null);
      loadWorkOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "رمز التحقق غير صحيح");
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/work-orders/${workOrderId}/items`, {
        method: "POST",
        body: {
          itemType,
          description: itemDescription,
          unitPriceSar: Number(itemPrice),
          quantity: Number(itemQty),
        },
      });
      setItemDescription("");
      setItemPrice("");
      setItemQty("1");
      loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إضافة البند");
    }
  }

  async function handleUploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await uploadDamagePhoto(workOrderId, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر رفع الصورة");
    }
  }

  async function handleDiagnose() {
    setError(null);
    setDiagnosing(true);
    try {
      const dtcCodes = dtcInput.split(",").map((c) => c.trim()).filter(Boolean);
      const data = await apiFetch<{ suggestions: DiagnosticSuggestion[] }>(
        `/work-orders/${workOrderId}/diagnose`,
        { method: "POST", body: { dtcCodes } }
      );
      setSuggestions(data.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر التشخيص");
    } finally {
      setDiagnosing(false);
    }
  }

  async function handleGenerateInvoice() {
    setError(null);
    try {
      const data = await apiFetch<{ invoice: Invoice }>(`/work-orders/${workOrderId}/invoice`, {
        method: "POST",
      });
      setInvoice(data.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إصدار الفاتورة");
    }
  }

  if (!workOrder) {
    return (
      <main className="container">
        {error ? <div className="error">{error}</div> : <p className="muted">جارٍ التحميل...</p>}
      </main>
    );
  }

  return (
    <main className="container">
      <h1>أمر شغل #{workOrder.id.slice(0, 8)}</h1>
      <span className="badge">{STATUS_LABELS[workOrder.status] ?? workOrder.status}</span>
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="card">
        <h2>الحالة</h2>
        <div className="row">
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <button key={value} className="btn btn-secondary" type="button" onClick={() => updateStatus(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>صور الأضرار عند الاستلام</h2>
        <input type="file" accept="image/*" onChange={handleUploadPhoto} />
      </div>

      <div className="card">
        <h2>رموز التحقق (استلام / تسليم)</h2>
        <p className="muted">
          استلام: {workOrder.checkin_otp_verified_at ? "✅ تم التحقق" : "لم يتم"} — تسليم:{" "}
          {workOrder.pickup_otp_verified_at ? "✅ تم التحقق" : "لم يتم"}
        </p>
        <div className="row">
          <button className="btn btn-secondary" type="button" onClick={() => requestOtp("checkin")}>
            إنشاء رمز استلام
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => requestOtp("pickup")}>
            إنشاء رمز تسليم
          </button>
        </div>
        {otpCode && <p>الرمز (لأغراض الاختبار فقط، يُرسل عبر SMS في الإنتاج): <strong>{otpCode}</strong></p>}
        <div className="row" style={{ marginTop: 10 }}>
          <input
            type="text"
            placeholder="أدخل الرمز"
            style={{ marginBottom: 0, maxWidth: 150 }}
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value)}
          />
          <button className="btn btn-secondary" type="button" onClick={() => verifyOtp("checkin")}>
            تحقق (استلام)
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => verifyOtp("pickup")}>
            تحقق (تسليم)
          </button>
        </div>
      </div>

      <div className="card">
        <h2>بنود أمر الشغل</h2>
        {items.map((item) => (
          <div className="list-item" key={item.id}>
            <span>{item.description_ar} × {item.quantity}</span>
            <span>{item.unit_price_sar} ﷼</span>
          </div>
        ))}
        <form onSubmit={handleAddItem} style={{ marginTop: 14 }}>
          <div className="row">
            <select value={itemType} onChange={(e) => setItemType(e.target.value as typeof itemType)} style={{ maxWidth: 150 }}>
              <option value="labor">مصنعية</option>
              <option value="new_part">قطعة جديدة</option>
              <option value="used_part">قطعة مستعملة</option>
            </select>
            <input
              type="text"
              placeholder="الوصف"
              style={{ marginBottom: 0, flex: 1 }}
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              required
            />
            <input
              type="number"
              placeholder="الكمية"
              style={{ marginBottom: 0, maxWidth: 90 }}
              value={itemQty}
              onChange={(e) => setItemQty(e.target.value)}
            />
            <input
              type="number"
              placeholder="السعر"
              style={{ marginBottom: 0, maxWidth: 110 }}
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              required
            />
            <button className="btn" type="submit">
              إضافة
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>مساعد التشخيص الذكي (OBD-II)</h2>
        <div className="row">
          <input
            type="text"
            placeholder="أكواد الأعطال مفصولة بفاصلة، مثال: P0301, P0420"
            style={{ marginBottom: 0, flex: 1 }}
            value={dtcInput}
            onChange={(e) => setDtcInput(e.target.value)}
          />
          <button className="btn btn-secondary" type="button" onClick={handleDiagnose} disabled={diagnosing}>
            تشخيص
          </button>
        </div>
        {suggestions.map((s) => (
          <div key={s.dtc_code} className="card" style={{ background: "#0b1220" }}>
            <strong>{s.dtc_code}</strong> <span className="badge">{s.confidence}</span>
            <p><strong>الأسباب المحتملة:</strong> {s.likely_causes.join("، ")}</p>
            <p><strong>خطوات الإصلاح:</strong> {s.recommended_steps.join("، ")}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>الفاتورة</h2>
        <button className="btn" type="button" onClick={handleGenerateInvoice}>
          إصدار فاتورة ZATCA
        </button>
        {invoice && (
          <div style={{ marginTop: 14 }}>
            <p>رقم الفاتورة: {invoice.invoiceNumber}</p>
            <p>المجموع الفرعي: {invoice.subtotal} ﷼ — ضريبة القيمة المضافة: {invoice.vat} ﷼ — الإجمالي: {invoice.total} ﷼</p>
            <p className="muted">حمولة QR (TLV مُرمّزة Base64):</p>
            <code className="qr-payload">{invoice.zatcaQrBase64}</code>
          </div>
        )}
      </div>
    </main>
  );
}
