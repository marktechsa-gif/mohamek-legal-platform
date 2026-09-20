"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Nav } from "../../components/Nav";

interface Customer {
  id: string;
  kind: string;
  name: string;
  phone: string;
}

interface Vehicle {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
}

interface WorkOrder {
  id: string;
  status: string;
  opened_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  checked_in: "تحت الفحص",
  awaiting_part: "بانتظار القطعة",
  in_progress: "جارِ الإصلاح",
  ready_for_pickup: "جاهزة للاستلام",
  closed: "مغلق",
};

export default function DashboardPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehiclesByCustomer, setVehiclesByCustomer] = useState<Record<string, Vehicle[]>>({});
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerKind, setCustomerKind] = useState<"individual" | "company" | "fleet">("individual");

  const [vehicleForms, setVehicleForms] = useState<Record<string, { plate: string; make: string; model: string }>>({});

  useEffect(() => {
    if (!getToken()) {
      router.push("/");
      return;
    }
    loadCustomers();
    loadWorkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCustomers() {
    try {
      const data = await apiFetch<{ customers: Customer[] }>("/customers");
      setCustomers(data.customers);
      for (const c of data.customers) {
        loadVehicles(c.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل العملاء");
    }
  }

  async function loadVehicles(customerId: string) {
    try {
      const data = await apiFetch<{ vehicles: Vehicle[] }>(`/customers/${customerId}/vehicles`);
      setVehiclesByCustomer((prev) => ({ ...prev, [customerId]: data.vehicles }));
    } catch {
      // ignore
    }
  }

  async function loadWorkOrders() {
    try {
      const data = await apiFetch<{ workOrders: WorkOrder[] }>("/work-orders");
      setWorkOrders(data.workOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل أوامر الشغل");
    }
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/customers", {
        method: "POST",
        body: { name: customerName, phone: customerPhone, kind: customerKind },
      });
      setCustomerName("");
      setCustomerPhone("");
      loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إضافة العميل");
    }
  }

  async function handleAddVehicle(customerId: string) {
    const form = vehicleForms[customerId];
    if (!form?.plate) return;
    setError(null);
    try {
      await apiFetch(`/customers/${customerId}/vehicles`, {
        method: "POST",
        body: { plateNumber: form.plate, make: form.make, model: form.model },
      });
      setVehicleForms((prev) => ({ ...prev, [customerId]: { plate: "", make: "", model: "" } }));
      loadVehicles(customerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إضافة المركبة");
    }
  }

  async function handleOpenWorkOrder(customerId: string, vehicleId: string) {
    setError(null);
    try {
      const data = await apiFetch<{ id: string }>("/work-orders", {
        method: "POST",
        body: { customerId, vehicleId },
      });
      router.push(`/work-orders/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر فتح أمر الشغل");
    }
  }

  return (
    <main className="container">
      <Nav />
      <h1>لوحة التحكم</h1>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2>إضافة عميل</h2>
        <form onSubmit={handleAddCustomer}>
          <div className="row">
            <div style={{ flex: 2 }}>
              <label>الاسم</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label>الجوال</label>
              <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label>النوع</label>
              <select value={customerKind} onChange={(e) => setCustomerKind(e.target.value as typeof customerKind)}>
                <option value="individual">فرد</option>
                <option value="company">شركة</option>
                <option value="fleet">أسطول</option>
              </select>
            </div>
          </div>
          <button className="btn" type="submit">
            إضافة
          </button>
        </form>
      </div>

      <div className="card">
        <h2>العملاء والمركبات</h2>
        {customers.length === 0 && <p className="muted">لا يوجد عملاء بعد.</p>}
        {customers.map((customer) => (
          <div key={customer.id} className="card" style={{ background: "var(--surface-2)" }}>
            <strong>{customer.name}</strong> <span className="muted">({customer.phone})</span>

            {(vehiclesByCustomer[customer.id] ?? []).map((vehicle) => (
              <div className="list-item" key={vehicle.id}>
                <span>
                  {vehicle.plate_number} — {vehicle.make} {vehicle.model}
                </span>
                <button className="btn btn-secondary" type="button" onClick={() => handleOpenWorkOrder(customer.id, vehicle.id)}>
                  فتح أمر شغل
                </button>
              </div>
            ))}

            <div className="row" style={{ marginTop: 10 }}>
              <input
                type="text"
                placeholder="رقم اللوحة"
                style={{ marginBottom: 0 }}
                value={vehicleForms[customer.id]?.plate ?? ""}
                onChange={(e) =>
                  setVehicleForms((prev) => ({
                    ...prev,
                    [customer.id]: { ...prev[customer.id], plate: e.target.value, make: prev[customer.id]?.make ?? "", model: prev[customer.id]?.model ?? "" },
                  }))
                }
              />
              <input
                type="text"
                placeholder="الماركة"
                style={{ marginBottom: 0 }}
                value={vehicleForms[customer.id]?.make ?? ""}
                onChange={(e) =>
                  setVehicleForms((prev) => ({
                    ...prev,
                    [customer.id]: { ...prev[customer.id], make: e.target.value, plate: prev[customer.id]?.plate ?? "", model: prev[customer.id]?.model ?? "" },
                  }))
                }
              />
              <input
                type="text"
                placeholder="الموديل"
                style={{ marginBottom: 0 }}
                value={vehicleForms[customer.id]?.model ?? ""}
                onChange={(e) =>
                  setVehicleForms((prev) => ({
                    ...prev,
                    [customer.id]: { ...prev[customer.id], model: e.target.value, plate: prev[customer.id]?.plate ?? "", make: prev[customer.id]?.make ?? "" },
                  }))
                }
              />
              <button className="btn btn-secondary" type="button" onClick={() => handleAddVehicle(customer.id)}>
                إضافة مركبة
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>أوامر الشغل</h2>
        {workOrders.length === 0 && <p className="muted">لا توجد أوامر شغل بعد.</p>}
        {workOrders.map((wo) => (
          <Link href={`/work-orders/${wo.id}`} key={wo.id} className="list-item" style={{ color: "inherit", textDecoration: "none" }}>
            <span>أمر #{wo.id.slice(0, 8)}</span>
            <span className="badge">{STATUS_LABELS[wo.status] ?? wo.status}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
