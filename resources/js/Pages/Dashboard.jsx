import { useEffect, useMemo, useState } from "react";

// Change this to your Laravel route, e.g. Route::get('/api/dashboard', ...)
const API_URL = "/api/dashboard";

const DISPLAY = { fontFamily: '"Bricolage Grotesque", "Trebuchet MS", sans-serif' };
const BODY = { fontFamily: '"Instrument Sans", "Segoe UI", system-ui, sans-serif' };

const STATUSES = ["Pending", "Brewing", "Ready", "Completed", "Cancelled"];

// Shown only if the API cannot be reached.
const SAMPLE = {
  weeklySales: [
    { day: "Mon", total: 420 },
    { day: "Tue", total: 515 },
    { day: "Wed", total: 380 },
    { day: "Thu", total: 610 },
    { day: "Fri", total: 745 },
    { day: "Sat", total: 920 },
    { day: "Sun", total: 830 },
  ],
  orders: [
    { id: 1048, customer: "Maria Santos", items: 3, total: 14.5, status: "Ready" },
    { id: 1047, customer: "John Reyes", items: 1, total: 38.0, status: "Brewing" },
    { id: 1046, customer: "Ana Cruz", items: 6, total: 27.2, status: "Pending" },
  ],
  products: [
    { id: 7, name: "Butter Croissant", stock: 4 },
    { id: 8, name: "Ethiopia Guji, 250 g", stock: 12 },
    { id: 6, name: "Cold Brew", stock: 24 },
  ],
  customers: 128,
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const STATUS_STYLES = {
  Pending: "border-[#e0883e]/40 text-[#e0883e]",
  Brewing: "border-sky-300/40 text-sky-300",
  Ready: "border-emerald-300/40 text-emerald-300",
  Completed: "border-[#3a2a21] text-[#a99889]",
  Cancelled: "border-red-400/40 text-red-300",
};

// Laravel web routes need the CSRF token on PATCH and DELETE requests.
function requestHeaders() {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(match ? { "X-XSRF-TOKEN": decodeURIComponent(match[1]) } : {}),
  };
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-[#2a1d18] bg-[#17100e] p-5">
      <p className="text-sm text-[#a99889]">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-[#f4ebe3]" style={DISPLAY}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[#a99889]">{hint}</p>}
    </div>
  );
}

function SalesChart({ data }) {
  const max = Math.max(...data.map((d) => Number(d.total)), 1);
  return (
    <div className="flex h-56 items-end gap-3" role="img" aria-label="Sales for the last seven days">
      {data.map((d, i) => {
        const isLast = i === data.length - 1;
        const total = Number(d.total);
        return (
          <div key={`${d.day}-${i}`} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-xs tabular-nums text-[#a99889]">{Math.round(total)}</span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={`w-full rounded-t-md ${isLast ? "bg-[#e0883e]" : "bg-[#4a352a]"}`}
                style={{ height: `${(total / max) * 100}%`, minHeight: total > 0 ? 2 : 0 }}
                title={`${d.day}: ${money.format(total)}`}
              />
            </div>
            <span className="text-xs text-[#a99889]">{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState({ weeklySales: [], orders: [], products: [], customers: 0 });
  const [loading, setLoading] = useState(true);
  const [usingSample, setUsingSample] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(API_URL, { headers: { Accept: "application/json" } })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((json) => !cancelled && setData(json.data ?? json))
      .catch(() => {
        if (cancelled) return;
        setData(SAMPLE);
        setUsingSample(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function changeStatus(id, status) {
    const previous = data.orders;
    setError("");
    // Update the table first so it feels instant, then confirm with the server.
    setData((d) => ({ ...d, orders: d.orders.map((o) => (o.id === id ? { ...o, status } : o)) }));
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: requestHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    } catch {
      setData((d) => ({ ...d, orders: previous }));
      setError("Could not update the order status. Please try again.");
    }
  }

  async function removeOrder(order) {
    if (!window.confirm(`Delete order #${order.id} for ${order.customer}? This cannot be undone.`)) return;
    const previous = data.orders;
    setError("");
    setData((d) => ({ ...d, orders: d.orders.filter((o) => o.id !== order.id) }));
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "DELETE",
        headers: requestHeaders(),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    } catch {
      setData((d) => ({ ...d, orders: previous }));
      setError("Could not delete the order. Please try again.");
    }
  }

  const stats = useMemo(() => {
    const revenue = data.orders
      .filter((o) => o.status !== "Cancelled")
      .reduce((sum, o) => sum + Number(o.total), 0);
    const open = data.orders.filter((o) => ["Pending", "Brewing", "Ready"].includes(o.status)).length;
    const lowStock = data.products.filter((p) => Number(p.stock) <= 5);
    const weekTotal = data.weeklySales.reduce((sum, d) => sum + Number(d.total), 0);
    return { revenue, open, lowStock, weekTotal };
  }, [data]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0706] text-[#f4ebe3]" style={BODY}>
      <div
        className="pointer-events-none absolute left-0 top-0 h-[500px] w-[min(700px,90vw)]"
        style={{ background: "radial-gradient(circle at 0% 15%, rgba(224,136,62,.5) 0%, rgba(176,82,26,.3) 20%, rgba(70,28,10,.2) 40%, transparent 66%)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-4 pb-16">
        <header className="flex items-center justify-between py-8">
          <a href="/" className="text-lg font-bold tracking-wide" style={DISPLAY}>Ember &amp; Bean</a>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <a href="/products" className="hover:text-[#e0883e]">Menu</a>
            <a href="/dashboard" className="text-[#e0883e]">Dashboard</a>
          </nav>
        </header>

        <section className="mb-8">
          <h1 className="text-3xl font-bold sm:text-4xl" style={DISPLAY}>Dashboard</h1>
          <p className="mt-2 text-[#a99889]">Sales, orders and stock for the cafe.</p>
        </section>

        {error && (
          <p role="alert" className="mb-6 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Revenue (recent orders)" value={money.format(stats.revenue)} hint="Cancelled orders excluded" />
          <StatCard label="Open orders" value={stats.open} hint="Pending, brewing or ready" />
          <StatCard label="Customers" value={data.customers} />
          <StatCard label="Low stock items" value={stats.lowStock.length} hint="5 or fewer remaining" />
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-[#2a1d18] bg-[#17100e] p-6 lg:col-span-2">
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="text-lg font-bold" style={DISPLAY}>Sales this week</h2>
              <span className="text-sm tabular-nums text-[#f2c28b]">{money.format(stats.weekTotal)}</span>
            </div>
            <SalesChart data={data.weeklySales} />
          </div>

          <div className="rounded-xl border border-[#2a1d18] bg-[#17100e] p-6">
            <h2 className="mb-4 text-lg font-bold" style={DISPLAY}>Stock levels</h2>
            {data.products.length === 0 ? (
              <p className="text-sm text-[#a99889]">No products yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {[...data.products]
                  .sort((a, b) => a.stock - b.stock)
                  .map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{p.name}</span>
                      <span
                        className={`shrink-0 tabular-nums ${
                          p.stock === 0 ? "text-red-300" : p.stock <= 5 ? "text-[#e0883e]" : "text-emerald-300"
                        }`}
                      >
                        {p.stock === 0 ? "Sold out" : `${p.stock} left`}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#2a1d18] bg-[#17100e] p-6">
          <h2 className="mb-4 text-lg font-bold" style={DISPLAY}>Recent orders</h2>
          {data.orders.length === 0 ? (
            <p className="text-sm text-[#a99889]">No orders yet. Place one from the Menu page.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#2a1d18] text-xs uppercase tracking-wider text-[#a99889]">
                    <th className="pb-3 font-medium">Order</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Items</th>
                    <th className="pb-3 font-medium">Total</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id} className="border-b border-[#2a1d18]/60 last:border-0">
                      <td className="py-3 tabular-nums text-[#a99889]">#{o.id}</td>
                      <td className="py-3">{o.customer}</td>
                      <td className="py-3 tabular-nums">{o.items}</td>
                      <td className="py-3 tabular-nums text-[#f2c28b]">{money.format(Number(o.total))}</td>
                      <td className="py-3">
                        <select
                          id={`status-${o.id}`}
                          aria-label={`Status for order ${o.id}`}
                          value={o.status}
                          onChange={(e) => changeStatus(o.id, e.target.value)}
                          className={`cursor-pointer rounded-full border bg-[#17100e] px-2.5 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c28b] ${
                            STATUS_STYLES[o.status] ?? STATUS_STYLES.Completed
                          }`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-[#17100e] text-[#f4ebe3]">
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeOrder(o)}
                          className="rounded-lg border border-red-400/40 px-3 py-1 text-xs text-red-300 transition hover:bg-red-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}