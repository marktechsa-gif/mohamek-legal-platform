"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Nav } from "../../components/Nav";

interface Invoice {
  id: string;
  invoice_number: string;
  work_order_id: string;
  subtotal_sar: string;
  vat_sar: string;
  total_sar: string;
  status: string;
  issued_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  unpaid: "غير مسدّدة",
  paid: "مسدّدة",
  void: "ملغاة",
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push("/");
      return;
    }
    apiFetch<{ invoices: Invoice[] }>("/invoices")
      .then((data) => setInvoices(data.invoices))
      .catch((err) => setError(err instanceof Error ? err.message : "تعذّر تحميل الفواتير"));
  }, [router]);

  return (
    <main className="container">
      <Nav />
      <h1>الفواتير</h1>
      {error && <div className="error">{error}</div>}

      <div className="card">
        {invoices.length === 0 && <p className="muted">لا توجد فواتير بعد.</p>}
        {invoices.map((inv) => (
          <Link
            href={`/work-orders/${inv.work_order_id}`}
            key={inv.id}
            className="list-item"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            <span>
              {inv.invoice_number} — {new Date(inv.issued_at).toLocaleDateString("ar-SA")}
            </span>
            <span className="row">
              <span className="muted">{inv.total_sar} ﷼</span>
              <span className="badge">{STATUS_LABELS[inv.status] ?? inv.status}</span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
