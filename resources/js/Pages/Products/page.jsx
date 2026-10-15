import { useEffect, useMemo, useState } from "react";

// Data comes from these Laravel routes
const API_URL = "/api/products";
const ORDERS_URL = "/api/orders";

// Optional: add this to your app.blade.php <head> for the brand fonts:
// <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
const DISPLAY = { fontFamily: '"Bricolage Grotesque", "Trebuchet MS", sans-serif' };
const BODY = { fontFamily: '"Instrument Sans", "Segoe UI", system-ui, sans-serif' };

// Shown only if the API cannot be reached.
const SAMPLE_PRODUCTS = [
  { id: 1, name: "Espresso", category: "Espresso", description: "Double shot, rich crema.", price: 2.8, stock: 50, from: "#c98b55", to: "#2a140a" },
  { id: 2, name: "Flat White", category: "Espresso", description: "Silky microfoam over a double ristretto.", price: 4.2, stock: 50, from: "#f2c28b", to: "#7a4a24" },
  { id: 3, name: "Butter Croissant", category: "Pastry", description: "Flaky layers, baked this morning.", price: 3.5, stock: 4, from: "#ffd98a", to: "#c7822b" },
];

const COLORS = [
  { name: "Espresso", from: "#c98b55", to: "#2a140a" },
  { name: "Caramel", from: "#f5c98a", to: "#b5651d" },
  { name: "Latte", from: "#f2c28b", to: "#7a4a24" },
  { name: "Gold", from: "#ffd98a", to: "#c7822b" },
  { name: "Mocha", from: "#b98a68", to: "#3b1f12" },
  { name: "Matcha", from: "#e3f2c4", to: "#7aa646" },
];

const EMPTY_FORM = { name: "", category: "", description: "", price: "", stock: "", color: 0 };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Laravel web routes need the CSRF token on POST requests.
function requestHeaders() {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(match ? { "X-XSRF-TOKEN": decodeURIComponent(match[1]) } : {}),
  };
}

async function send(url, body) {
  const res = await fetch(url, { method: "POST", headers: requestHeaders(), body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const firstError = json.errors ? Object.values(json.errors)[0]?.[0] : null;
    const fallback = res.status === 401 ? "Please log in first." : `Request failed (${res.status}).`;
    throw new Error(firstError || json.message || fallback);
  }
  return json;
}

const inputClass =
  "w-full rounded-lg border border-[#2a1d18] bg-[#100a08] px-3 py-2 text-sm text-[#f4ebe3] placeholder-[#7d6a5d] focus:border-[#e0883e] focus:outline-none";

function Cup({ from, to }) {
  return (
    <div
      className="h-20 w-20 rounded-full shadow-[inset_0_-10px_16px_rgba(0,0,0,0.35)] ring-1 ring-white/10"
      style={{ background: `radial-gradient(circle at 30% 30%, ${from}, ${to})` }}
      aria-hidden="true"
    />
  );
}

function StockBadge({ stock }) {
  if (stock === 0) {
    return <span className="rounded-full border border-red-400/40 px-2 py-0.5 text-xs text-red-300">Sold out</span>;
  }
  if (stock <= 5) {
    return <span className="rounded-full border border-[#e0883e]/40 px-2 py-0.5 text-xs text-[#e0883e]">Only {stock} left</span>;
  }
  return <span className="rounded-full border border-[#3a2a21] px-2 py-0.5 text-xs text-[#a99889]">Available</span>;
}

function ProductCard({ product, inCart, onAdd }) {
  const soldOut = product.stock === 0 || inCart >= product.stock;
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-[#2a1d18] bg-[#17100e] p-5 transition hover:-translate-y-0.5 hover:border-[#5a3a24]">
      <div className="flex items-start justify-between gap-3">
        <Cup from={product.from} to={product.to} />
        <StockBadge stock={product.stock} />
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wider text-[#a99889]">{product.category}</p>
        <h3 className="mt-1 text-lg font-bold text-[#f4ebe3]" style={DISPLAY}>{product.name}</h3>
        {product.description && <p className="mt-1 text-sm text-[#a99889]">{product.description}</p>}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold tabular-nums text-[#f2c28b]">{money.format(product.price)}</span>
        <button
          type="button"
          disabled={soldOut}
          onClick={() => onAdd(product)}
          className="rounded-lg bg-[#e0883e] px-4 py-2 text-sm font-semibold text-[#0b0706] transition hover:bg-[#f09a50] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c28b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17100e] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {product.stock === 0 ? "Unavailable" : inCart >= product.stock ? "All in order" : "Add to order"}
        </button>
      </div>
    </article>
  );
}

function AddProductForm({ categories, onCreated, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const color = COLORS[form.color];
      const product = await send(API_URL, {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim() || null,
        price: form.price,
        stock: form.stock,
        from: color.from,
        to: color.to,
      });
      onCreated({ ...product, price: Number(product.price) });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-8 rounded-xl border border-[#5a3a24] bg-[#17100e] p-5" aria-label="Add a product">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold" style={DISPLAY}>Add product</h2>
        <button type="button" onClick={onClose} className="text-sm text-[#a99889] hover:text-[#f4ebe3]">Close</button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-[#a99889]">Name</span>
          <input id="new-name" required maxLength={255} value={form.name} onChange={set("name")} placeholder="Cortado" className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[#a99889]">Category</span>
          <input id="new-category" required list="category-options" maxLength={100} value={form.category} onChange={set("category")} placeholder="Espresso" className={inputClass} />
          <datalist id="category-options">
            {categories.filter((c) => c !== "All").map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[#a99889]">Price (USD)</span>
          <input id="new-price" required type="number" min="0" step="0.01" value={form.price} onChange={set("price")} placeholder="3.60" className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[#a99889]">Stock</span>
          <input id="new-stock" required type="number" min="0" step="1" value={form.stock} onChange={set("stock")} placeholder="20" className={inputClass} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-[#a99889]">Description (optional)</span>
          <input id="new-description" maxLength={500} value={form.description} onChange={set("description")} placeholder="Espresso with a splash of steamed milk." className={inputClass} />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm text-[#a99889]">Cup color</legend>
        <div className="flex flex-wrap gap-3">
          {COLORS.map((c, i) => (
            <button
              key={c.name}
              type="button"
              aria-label={c.name}
              aria-pressed={form.color === i}
              onClick={() => setForm((f) => ({ ...f, color: i }))}
              className={`h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-[#17100e] transition ${form.color === i ? "ring-[#f2c28b]" : "ring-transparent"}`}
              style={{ background: `radial-gradient(circle at 30% 30%, ${c.from}, ${c.to})` }}
            />
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={saving}
        className="mt-5 rounded-lg bg-[#e0883e] px-5 py-2 text-sm font-semibold text-[#0b0706] transition hover:bg-[#f09a50] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c28b] disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save product"}
      </button>
    </form>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingSample, setUsingSample] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");
  const [cart, setCart] = useState({}); // { [productId]: quantity }
  const [showForm, setShowForm] = useState(false);
  const [customer, setCustomer] = useState("");
  const [placing, setPlacing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function normalize(list) {
    return list.map((p) => ({ from: "#c98b55", to: "#2a140a", ...p, price: Number(p.price), stock: Number(p.stock) }));
  }

  async function loadProducts() {
    try {
      const res = await fetch(API_URL, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setProducts(normalize(Array.isArray(data) ? data : data.data));
      setUsingSample(false);
    } catch {
      setProducts(SAMPLE_PRODUCTS);
      setUsingSample(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const categories = useMemo(() => ["All", ...new Set(products.map((p) => p.category))], [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (q === "" || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
    );
    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products, query, category, sort]);

  const lines = products.filter((p) => cart[p.id]).map((p) => ({ product: p, qty: cart[p.id] }));
  const cartCount = lines.reduce((sum, l) => sum + l.qty, 0);
  const cartTotal = lines.reduce((sum, l) => sum + l.qty * l.product.price, 0);

  function changeQty(product, delta) {
    setCart((current) => {
      const next = Math.max(0, Math.min(product.stock, (current[product.id] || 0) + delta));
      const copy = { ...current };
      if (next === 0) delete copy[product.id];
      else copy[product.id] = next;
      return copy;
    });
  }

  function handleCreated(product) {
    setProducts((list) => [...list, product]);
    setShowForm(false);
    setError("");
    setNotice(`Added "${product.name}" to the menu.`);
  }

  async function placeOrder(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setPlacing(true);
    try {
      const order = await send(ORDERS_URL, {
        customer: customer.trim(),
        items: lines.map((l) => ({ id: l.product.id, qty: l.qty })),
      });
      setCart({});
      setCustomer("");
      setNotice(`Order #${order.id} placed for ${order.customer}. It now shows on the dashboard.`);
      await loadProducts(); // stock changed
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0706] text-[#f4ebe3]" style={BODY}>
      <div
        className="pointer-events-none absolute left-0 top-0 h-[600px] w-[min(720px,90vw)]"
        style={{ background: "radial-gradient(circle at 0% 20%, rgba(224,136,62,.6) 0%, rgba(176,82,26,.35) 20%, rgba(70,28,10,.22) 40%, transparent 66%)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-4 pb-16">
        <header className="flex items-center justify-between py-8">
          <a href="/" className="text-lg font-bold tracking-wide" style={DISPLAY}>Ember &amp; Bean</a>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <a href="/products" className="text-[#e0883e]">Menu</a>
            <a href="/dashboard" className="hover:text-[#e0883e]">Dashboard</a>
            <span className="rounded-full bg-[#17100e] px-3 py-1 text-[#f2c28b] ring-1 ring-[#2a1d18]" aria-live="polite">
              Order {cartCount} · {money.format(cartTotal)}
            </span>
          </nav>
        </header>

        <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl" style={DISPLAY}>Our Menu</h1>
            <p className="mt-2 max-w-xl text-[#a99889]">Every drink is pulled to order from beans we roast ourselves each week.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            aria-expanded={showForm}
            className="rounded-lg border border-[#e0883e] px-4 py-2 text-sm font-semibold text-[#e0883e] transition hover:bg-[#e0883e] hover:text-[#0b0706] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c28b]"
          >
            {showForm ? "Hide form" : "+ Add product"}
          </button>
        </section>

        {notice && (
          <p role="status" className="mb-6 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-300">{notice}</p>
        )}
        {error && (
          <p role="alert" className="mb-6 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-2 text-sm text-red-300">{error}</p>
        )}

        {showForm && <AddProductForm categories={categories} onCreated={handleCreated} onClose={() => setShowForm(false)} />}

        {lines.length > 0 && (
          <form onSubmit={placeOrder} className="mb-8 rounded-xl border border-[#5a3a24] bg-[#17100e] p-5" aria-label="Your order">
            <h2 className="mb-4 text-lg font-bold" style={DISPLAY}>Your order</h2>
            <ul className="mb-4 flex flex-col gap-3">
              {lines.map(({ product, qty }) => (
                <li key={product.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{product.name}</span>
                  <span className="flex items-center gap-2">
                    <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => changeQty(product, -1)} className="h-7 w-7 rounded-full border border-[#3a2a21] text-[#f2c28b] hover:border-[#e0883e]">−</button>
                    <span className="w-5 text-center tabular-nums">{qty}</span>
                    <button type="button" aria-label={`Add one ${product.name}`} onClick={() => changeQty(product, 1)} disabled={qty >= product.stock} className="h-7 w-7 rounded-full border border-[#3a2a21] text-[#f2c28b] hover:border-[#e0883e] disabled:opacity-40">+</button>
                  </span>
                  <span className="w-20 text-right tabular-nums text-[#f2c28b]">{money.format(qty * product.price)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 border-t border-[#2a1d18] pt-4 sm:flex-row sm:items-center">
              <label className="flex-1">
                <span className="sr-only">Customer name</span>
                <input id="customer-name" required maxLength={255} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name" className={inputClass} />
              </label>
              <span className="text-lg font-semibold tabular-nums text-[#f2c28b]">{money.format(cartTotal)}</span>
              <button
                type="submit"
                disabled={placing}
                className="rounded-lg bg-[#e0883e] px-5 py-2 text-sm font-semibold text-[#0b0706] transition hover:bg-[#f09a50] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c28b] disabled:opacity-50"
              >
                {placing ? "Placing..." : "Place order"}
              </button>
            </div>
          </form>
        )}

        <section className="mb-8 flex flex-col gap-4 rounded-xl border border-[#2a1d18] bg-[#17100e] p-4 sm:flex-row sm:items-center">
          <label className="flex-1">
            <span className="sr-only">Search the menu</span>
            <input id="product-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search latte, cold brew, beans..." className={inputClass} />
          </label>
          <label>
            <span className="sr-only">Sort the menu</span>
            <select id="product-sort" value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputClass} sm:w-auto`}>
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">Name</option>
            </select>
          </label>
        </section>

        <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                category === c ? "border-[#e0883e] bg-[#e0883e] font-semibold text-[#0b0706]" : "border-[#3a2a21] text-[#f2c28b] hover:border-[#e0883e]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {usingSample && !loading && (
          <p className="mb-6 rounded-lg border border-[#e0883e]/30 bg-[#e0883e]/10 px-4 py-2 text-sm text-[#e0883e]">
            Could not reach {API_URL}. Showing sample items. Adding products and orders will not work until the server responds.
          </p>
        )}

        {loading ? (
          <p className="text-[#a99889]">Loading the menu...</p>
        ) : products.length === 0 ? (
          <p className="text-[#a99889]">The menu is empty. Use "Add product" to create your first item.</p>
        ) : visible.length === 0 ? (
          <p className="text-[#a99889]">Nothing on the menu matches your search.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} inCart={cart[p.id] || 0} onAdd={(prod) => changeQty(prod, 1)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}