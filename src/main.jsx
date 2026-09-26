import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Coffee,
  Armchair,
  ReceiptText,
  UserRound,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  X,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Wifi,
  ChevronRight,
  ShoppingBag,
  Search,
  SlidersHorizontal,
  Leaf,
  Heart,
  Sparkles,
  Users,
  Plug,
  Zap,
  Sun,
  Volume2,
  Copy,
  Send,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Bell,
  GlassWater,
  ChefHat,
  LayoutGrid,
  Settings2,
  ExternalLink,
  LoaderCircle,
  Menu as MenuIcon,
} from "lucide-react";
import QRCode from "qrcode";
import { api, images } from "./api";
import "./styles.css";
import { SmartOrder, PhoneLogin } from "./enhancements.jsx";
import { useCafeWebMCP } from "./webmcp.js";
const Product3D = React.lazy(() => import("./product3d.jsx"));
const CoffeeRunner = React.lazy(() => import("./coffee-runner.jsx"));
const money = (
  amount,
  currency = document.documentElement.dataset.currency || "INR",
) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: amount % 100 ? 2 : 0,
  }).format(amount / 100);
const steps = ["accepted", "preparing", "ready", "served"];
const labels = {
  accepted: "Order received",
  preparing: "In the making",
  ready: "Ready for you",
  served: "Enjoy your order",
};
function IconButton({ label, children, ...props }) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
function Modal({ open, onClose, title, description, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <div className="modal-title">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close">
                <X size={21} />
              </IconButton>
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Coffee size={23} />
      </span>
      <span>
        common ground<span className="brand-sub">YOUR EVERYDAY CAFÉ</span>
      </span>
    </div>
  );
}
function App() {
  const [session, setSession] = useState(null),
    [state, setState] = useState(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [tab, setTab] = useState("visit"),
    [cart, setCart] = useState([]),
    [cartOpen, setCartOpen] = useState(false),
    [product, setProduct] = useState(null),
    [wifiOpen, setWifiOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [gameOpen, setGameOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [lastSync, setLastSync] = useState(0);
  const [prefs, setPrefs] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("cg-prefs")) || {
          name: "",
          favorites: [],
        }
      );
    } catch {
      return { name: "", favorites: [] };
    }
  });
  const staffRoute = location.pathname.startsWith("/staff"),
    paymentToken = location.pathname.startsWith("/pay/")
      ? location.pathname.slice(5)
      : null;
  const notify = useCallback((text) => {
    setToast(text);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const result = await api("/state");
      setState(result);
      setLastSync(Date.now());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    api("/session", {})
      .then((s) => {
        document.documentElement.dataset.currency = s.currency;
        setSession(s);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (session && !paymentToken && !staffRoute) {
      refresh();
      const timer = setInterval(refresh, 5000);
      return () => clearInterval(timer);
    }
  }, [session, refresh, paymentToken, staffRoute]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("cg-prefs", JSON.stringify(prefs));
  }, [prefs]);
  useEffect(() => {
    if (new URLSearchParams(location.search).has("table")) setTab("seats");
  }, []);
  async function act(path, body, message) {
    setBusy(true);
    try {
      const result = await api(path, body);
      await refresh();
      if (message) notify(message);
      return result;
    } catch (e) {
      notify(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const toggleFavorite = (id) =>
    setPrefs((p) => ({
      ...p,
      favorites: p.favorites.includes(id)
        ? p.favorites.filter((x) => x !== id)
        : [...p.favorites, id],
    }));
  const add = (item, milk = "Standard", quantity = 1) => {
    setCart((c) => {
      const existing = c.find((x) => x.id === item.id && x.milk === milk);
      return existing
        ? c.map((x) =>
            x === existing
              ? { ...x, quantity: Math.min(20, x.quantity + quantity) }
              : x,
          )
        : [...c, { ...item, milk, quantity }];
    });
    setProduct(null);
    notify(`${item.name} added to your order`);
  };
  useCafeWebMCP(state, setProduct, !staffRoute && !paymentToken);
  const changeQuantity = (index, delta) =>
    setCart((c) =>
      c
        .map((x, i) =>
          i === index
            ? { ...x, quantity: Math.min(20, x.quantity + delta) }
            : x,
        )
        .filter((x) => x.quantity > 0),
    );
  if (paymentToken) return <Payment token={paymentToken} />;
  if (staffRoute)
    return <Staff session={session} notify={notify} toast={toast} />;
  if (!state)
    return (
      <div className="loading-page">
        <Brand />
        <LoaderCircle className="spin" />
        <p>{error || "Making a little room for you…"}</p>
        {error && (
          <button className="primary" onClick={() => location.reload()}>
            Try again
          </button>
        )}
      </div>
    );
  const count = cart.reduce((n, x) => n + x.quantity, 0),
    subtotal = cart.reduce(
      (n, x) => n + (x.price + (x.milk === "Oat" ? 4000 : 0)) * x.quantity,
      0,
    );
  const activeOrder = [...state.orders]
    .reverse()
    .find((o) => o.status !== "served");
  const common = {
    state,
    prefs,
    setPrefs,
    setTab,
    notify,
    act,
    busy,
    session,
    onSession: setSession,
  };
  return (
    <div className="app-shell">
      <header className="header">
        <a href="/" className="brand-link" aria-label="Common Ground home">
          <Brand />
        </a>
        <div className="location">
          <MapPin size={16} />
          <span>Indiranagar, Bengaluru</span>
          <span className="open-badge">Open now</span>
        </div>
        <div className="header-actions">
          <button
            className="text-button staff-link"
            onClick={() => location.assign("/staff")}
          >
            <ShieldCheck size={16} /> Staff space
          </button>
          <button
            className="avatar"
            aria-label="Your profile"
            onClick={() => setTab("profile")}
          >
            {prefs.name ? prefs.name[0].toUpperCase() : <UserRound size={18} />}
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="side-intro">MAKE YOURSELF AT HOME</div>
          <nav aria-label="Main navigation">
            {[
              ["visit", Coffee, "Your visit"],
              ["menu", MenuIcon, "Explore menu"],
              ["seats", Armchair, "Find a seat"],
              ["orders", ReceiptText, "Orders & bills"],
              ["profile", UserRound, "Your favorites"],
            ].map(([key, Icon, label]) => (
              <button
                key={key}
                className={`nav-item ${tab === key ? "active" : ""}`}
                onClick={() => setTab(key)}
              >
                <Icon size={20} />
                {label}
                {key === "orders" && activeOrder && (
                  <span className="nav-dot" />
                )}
              </button>
            ))}
          </nav>
          <div className="side-bottom">
            <div className="side-card">
              <Wifi size={22} />
              <strong>A good connection.</strong>
              <p>
                Settle in. Get online.
                <br />
                Stay a little longer.
              </p>
              <button onClick={() => setWifiOpen(true)}>
                Connect to Wi-Fi <ArrowUpRight size={16} />
              </button>
            </div>
            <button className="text-button" onClick={() => setHelpOpen(true)}>
              <Bell size={17} /> Need a hand?
            </button>
            <div className="side-footer">GOOD COFFEE. BETTER COMPANY.</div>
          </div>
        </aside>
        <main className="main">
          <div className="mobile-location">
            <MapPin size={14} /> Indiranagar{" "}
            <span className="open-badge">Open now</span>
          </div>
          {session.demo && (
            <div className="demo-banner">
              <span>Preview café</span> Sample menu, seating and simulated
              payments. No SMS is sent.
            </div>
          )}
          {(!online || error) && (
            <div className="connection-banner" role="alert">
              {!online
                ? "You’re offline. Reconnect before ordering or paying."
                : `Updates paused: ${error}`}{" "}
              {lastSync
                ? `Last synced ${new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
                : ""}
            </div>
          )}
          {tab === "visit" && (
            <Visit
              {...common}
              setProduct={setProduct}
              activeOrder={activeOrder}
              setWifiOpen={setWifiOpen}
              setHelpOpen={setHelpOpen}
            />
          )}
          {tab === "menu" && (
            <MenuView
              {...common}
              onAdd={add}
              setProduct={setProduct}
              toggleFavorite={toggleFavorite}
            />
          )}
          {tab === "seats" && <Seats {...common} />}
          {tab === "orders" && <Orders {...common} add={add} />}
          {tab === "profile" && (
            <Profile
              {...common}
              setProduct={setProduct}
              toggleFavorite={toggleFavorite}
            />
          )}
          <footer className="page-footer">
            <button
              className="coffee-game-trigger"
              aria-label="Play the coffee break game"
              title="A little coffee break?"
              onClick={() => setGameOpen(true)}
            >
              <Coffee size={15} />
            </button>{" "}
            Made for unhurried moments.
            <span>Common Ground · Est. 2024</span>
          </footer>
        </main>
        <aside className="right-rail">
          <VisitCard state={state} setTab={setTab} />
          <div className="rail-note">
            <Leaf size={21} />
            <p>Good things take a little care.</p>
            <span>We prepare every order fresh, just for you.</span>
          </div>
          {count > 0 && (
            <button
              className="primary cart-rail"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag size={18} /> Your order ({count})
              <span>{money(subtotal, session.currency)}</span>
            </button>
          )}
        </aside>
      </div>
      {count > 0 && (
        <button className="floating-cart" onClick={() => setCartOpen(true)}>
          <span className="cart-count">{count}</span>
          <span>View your order</span>
          <strong>{money(subtotal, session.currency)}</strong>
          <ArrowRight size={18} />
        </button>
      )}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[
          ["visit", Coffee, "Visit"],
          ["menu", MenuIcon, "Menu"],
          ["seats", Armchair, "Seats"],
          ["orders", ReceiptText, "Orders"],
        ].map(([key, Icon, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <ProductModal
        product={product}
        onClose={() => setProduct(null)}
        onAdd={add}
        currency={session.currency}
      />
      <Modal
        open={gameOpen}
        onClose={() => setGameOpen(false)}
        title="The coffee run"
        description="A tiny break between good cups."
      >
        {gameOpen && (
          <React.Suspense fallback={<p className="muted">Brewing the game…</p>}>
            <CoffeeRunner />
          </React.Suspense>
        )}
      </Modal>
      <Cart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        changeQuantity={changeQuantity}
        subtotal={subtotal}
        {...common}
        onOrdered={() => {
          setCart([]);
          setCartOpen(false);
          setTab("orders");
        }}
      />
      <Modal
        open={wifiOpen}
        onClose={() => setWifiOpen(false)}
        title="A good connection"
        description="Wi-Fi for your time at Common Ground."
      >
        <div className="wifi-panel">
          <Wifi size={44} />
          {state.wifi ? (
            <>
              <h3>{state.wifi.ssid}</h3>
              <p>Open your device’s Wi-Fi settings and choose this network.</p>
              {state.wifi.password ? (
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(state.wifi.password);
                      notify("Wi-Fi password copied");
                    } catch {
                      notify("Copy is unavailable on this browser");
                    }
                  }}
                >
                  <Copy size={16} /> Copy password
                </button>
              ) : (
                <p>Ask your waiter for the connection password.</p>
              )}
              <code>{state.wifi.password}</code>
            </>
          ) : (
            <>
              <h3>
                {state.visit?.status === "seated"
                  ? "Ask our team for Wi-Fi."
                  : "First, make yourself comfortable."}
              </h3>
              <p>
                {state.visit?.status === "seated"
                  ? "The café has not added its network details yet."
                  : "Wi-Fi details appear once staff confirms your table."}
              </p>
              <button
                className="primary"
                onClick={() => {
                  setWifiOpen(false);
                  setTab("seats");
                }}
              >
                Find a seat
              </button>
            </>
          )}
        </div>
      </Modal>
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="A little help?"
        description="Your request goes directly to our café team."
      >
        <div className="stack">
          {["Water", "Help with my order", "Please bring the bill"].map(
            (type) => (
              <button
                className="request-option"
                key={type}
                disabled={busy || state.visit?.status !== "seated"}
                onClick={() =>
                  act("/requests", { type }, "Your request is with the team.")
                }
              >
                <GlassWater size={19} />
                {type}
                <ArrowRight size={18} />
              </button>
            ),
          )}
          {state.visit?.status !== "seated" && (
            <p className="muted">
              Please check in at a table first, or ask at the counter.
            </p>
          )}
          {state.requests
            .filter((r) => r.status !== "done")
            .map((r) => (
              <p key={r.id} className="status-line">
                <Check size={16} />
                {r.type} ·{" "}
                {r.status === "new" ? "Sent to staff" : "Acknowledged by staff"}
              </p>
            ))}
        </div>
      </Modal>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function VisitCard({ state, setTab }) {
  const visit = state.visit;
  return (
    <div className="visit-card">
      <div className="eyebrow">YOUR LITTLE CORNER</div>
      <div className="visit-card-icon">
        <Armchair size={32} />
      </div>
      <h3>
        {visit?.tableId
          ? `Table ${Number(visit.tableId.slice(1))}`
          : "There’s a seat for you."}
      </h3>
      <p>
        {visit?.status === "seated"
          ? `${visit.partySize} ${visit.partySize === 1 ? "guest" : "guests"} · Make yourself at home`
          : visit?.status === "held"
            ? "Your table request is with our team."
            : "Find a spot that feels just right."}
      </p>
      <button className="secondary" onClick={() => setTab("seats")}>
        {visit?.tableId ? "View your table" : "Explore seating"}
        <ArrowUpRight size={16} />
      </button>
      <div className="visit-card-bottom">
        <Clock size={15} /> Orders ready in {state.wait.low}–{state.wait.high}{" "}
        min
      </div>
    </div>
  );
}
function Visit({
  state,
  prefs,
  setTab,
  setProduct,
  activeOrder,
  setWifiOpen,
  setHelpOpen,
}) {
  const available = state.tables.filter((t) => t.status === "available").length;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE PAUSE IN YOUR DAY</div>
          <h1>
            {prefs.name ? `Hello, ${prefs.name}.` : "Hello, coffee person."}
          </h1>
          <p>Your coffee, your corner, your kind of day.</p>
        </div>
        <span className="date-chip">
          <Sun size={16} /> Take it slow
        </span>
      </div>
      <div className="quick-actions">
        <button onClick={() => setTab("seats")}>
          <span className="quick-icon">
            <Armchair />
          </span>
          <span>
            <strong>Find your spot</strong>
            <small>{available} tables available</small>
          </span>
          <ArrowUpRight size={18} />
        </button>
        <button onClick={() => setWifiOpen(true)}>
          <span className="quick-icon">
            <Wifi />
          </span>
          <span>
            <strong>Get connected</strong>
            <small>Guest Wi-Fi, made easy</small>
          </span>
          <ArrowUpRight size={18} />
        </button>
        <button onClick={() => setHelpOpen(true)}>
          <span className="quick-icon">
            <Bell />
          </span>
          <span>
            <strong>A little help?</strong>
            <small>We’re right here</small>
          </span>
          <ArrowUpRight size={18} />
        </button>
      </div>
      <section className="feature-card">
        <div className="feature-copy">
          <span className="pill-light">
            <Sparkles size={13} /> YOUR NEXT GOOD THING
          </span>
          <h2>
            Stay a little.
            <br />
            Sip something
            <br />
            <em>lovely.</em>
          </h2>
          <p>
            Freshly brewed. Thoughtfully made.
            <br />A little moment, all yours.
          </p>
          <button onClick={() => setTab("menu")}>
            Find your favorite <ArrowUpRight size={18} />
          </button>
        </div>
        <img
          className="feature-image"
          src={images.coffee}
          alt="Fresh latte with leaf-shaped latte art"
        />
        <span className="image-stamp">
          BREWED WITH
          <br />
          <Heart size={18} />
          <br />A LITTLE LOVE
        </span>
      </section>
      {activeOrder && (
        <button className="active-order" onClick={() => setTab("orders")}>
          <span className="pulse-icon">
            <Coffee size={22} />
          </span>
          <span>
            <strong>{labels[activeOrder.status]}</strong>
            <small>
              {activeOrder.code} ·{" "}
              {activeOrder.lines.map((l) => l.name).join(", ")}
            </small>
          </span>
          <ChevronRight />
        </button>
      )}
      <div className="section-heading">
        <div>
          <div className="eyebrow">TRIED, LOVED, REORDERED</div>
          <h2>The usual favorites</h2>
        </div>
        <button className="text-button" onClick={() => setTab("menu")}>
          Full menu <ArrowRight size={17} />
        </button>
      </div>
      <div className="favorites-grid">
        {state.menu
          .filter((m) =>
            ["flat-white", "iced-latte", "croissant"].includes(m.id),
          )
          .map((m) => (
            <ProductCard key={m.id} item={m} onClick={() => setProduct(m)} />
          ))}
      </div>
      <div className="bottom-note">
        <span className="line-art-icon">
          <Leaf size={24} />
        </span>
        <div>
          <strong>Small rituals. Thoughtfully made.</strong>
          <p>
            Seasonal ingredients, carefully sourced coffee, and a space to just
            be.
          </p>
        </div>
      </div>
    </>
  );
}
function Calories({ item, details = false }) {
  const nutrition = item.nutrition;
  if (!Number.isFinite(nutrition?.calories))
    return <p className="nutrition-label">Calories not available</p>;
  return (
    <div className={details ? "nutrition-details" : "nutrition-label"}>
      <span>
        {nutrition.estimated ? "≈ " : ""}
        {nutrition.calories} kcal{nutrition.estimated ? " · est." : ""}
      </span>
      {details && (
        <small>
          Per serving · {nutrition.serving} · original recipe.{" "}
          {nutrition.estimated ? "Illustrative estimate. " : ""}Milk swaps and
          other customizations change calories.
        </small>
      )}
    </div>
  );
}
function ProductCard({ item, onClick, favorite, onFavorite }) {
  return (
    <article className={`product-card ${!item.available ? "unavailable" : ""}`}>
      <button
        className="product-image-button"
        onClick={onClick}
        aria-label={`Customize ${item.name}`}
      >
        <img
          src={images[item.image] || images.pastry}
          alt={item.name}
          loading="lazy"
        />
        {item.tags[0] && <span className="product-tag">{item.tags[0]}</span>}
      </button>
      {onFavorite && (
        <button
          aria-label={`${favorite ? "Unsave" : "Save"} ${item.name}`}
          className={`favorite-button ${favorite ? "saved" : ""}`}
          onClick={onFavorite}
        >
          <Heart size={17} fill={favorite ? "currentColor" : "none"} />
        </button>
      )}
      <div className="product-copy">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <Calories item={item} />
        <div className="product-bottom">
          <strong>{money(item.price)}</strong>
          <IconButton
            label={`Add ${item.name}`}
            onClick={onClick}
            disabled={!item.available}
          >
            {item.available ? <Plus size={20} /> : <X size={19} />}
          </IconButton>
        </div>
      </div>
    </article>
  );
}
function MenuView({
  state,
  setProduct,
  prefs,
  toggleFavorite,
  session,
  onAdd,
  notify,
}) {
  const [category, setCategory] = useState("All"),
    [query, setQuery] = useState(""),
    [plant, setPlant] = useState(false);
  const items = state.menu.filter(
    (m) =>
      (category === "All" || m.category === category) &&
      (!plant || m.tags.includes("Plant based")) &&
      `${m.name} ${m.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MADE FRESH, JUST FOR YOU</div>
          <h1>What sounds good?</h1>
          <p>Something familiar. Or a new favorite.</p>
        </div>
        <div className="wait-chip">
          <Clock size={16} />
          {state.wait.low}–{state.wait.high} min
        </div>
      </div>
      <SmartOrder
        session={session}
        menu={state.menu}
        onAdd={onAdd}
        notify={notify}
      />
      <div className="menu-search">
        <Search size={19} />
        <input
          aria-label="Search menu"
          placeholder="Find your coffee, comfort food, little treat…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className={plant ? "filter active" : "filter"}
          onClick={() => setPlant(!plant)}
          aria-pressed={plant}
        >
          <Leaf size={17} />
          <span>Plant based</span>
        </button>
      </div>
      <div className="category-tabs">
        {["All", "Coffee", "Bakery", "Kitchen", "Tea & more"].map((c) => (
          <button
            className={category === c ? "selected" : ""}
            key={c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {!state.acceptOrders && (
        <div className="connection-banner">
          The kitchen is taking a short pause. You can still browse.
        </div>
      )}
      <div className="menu-grid">
        {items.map((m) => (
          <ProductCard
            key={m.id}
            item={m}
            onClick={() => setProduct(m)}
            favorite={prefs.favorites.includes(m.id)}
            onFavorite={() => toggleFavorite(m.id)}
          />
        ))}
      </div>
      {!items.length && (
        <Empty
          icon={Search}
          title="Nothing brewing here."
          text="Try another search or category."
        />
      )}
      <p className="allergen-note">
        Calories are illustrative estimates per serving of the original recipe.
        Allergens are listed on each item. Please speak to our team about
        allergies and cross-contact.
      </p>
    </>
  );
}
function ProductModal({ product, onClose, onAdd, currency }) {
  const [milk, setMilk] = useState("Standard"),
    [quantity, setQuantity] = useState(1),
    [view3d, setView3d] = useState(false);
  useEffect(() => {
    setMilk("Standard");
    setQuantity(1);
    setView3d(false);
  }, [product]);
  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={product?.name || "Customize your order"}
      description={product?.description || ""}
    >
      {product && (
        <>
          <div className="choice-row">
            <button
              className={!view3d ? "choice selected" : "choice"}
              onClick={() => setView3d(false)}
            >
              Photo
            </button>
            <button
              className={view3d ? "choice selected" : "choice"}
              onClick={() => setView3d(true)}
            >
              Explore in 3D / AR
            </button>
          </div>
          {view3d ? (
            <React.Suspense
              fallback={<p className="muted">Loading 3D preview…</p>}
            >
              <Product3D productId={product.id} productName={product.name} />
            </React.Suspense>
          ) : (
            <img
              className="modal-product-image"
              src={images[product.image] || images.pastry}
              alt={product.name}
            />
          )}
          <Calories item={product} details />
          {(product.category === "Coffee" || product.id === "matcha") && (
            <fieldset>
              <legend>Your milk</legend>
              <div className="choice-row">
                {["Standard", "Whole", "Oat", "None"].map((m) => (
                  <button
                    key={m}
                    className={milk === m ? "choice selected" : "choice"}
                    onClick={() => setMilk(m)}
                  >
                    {m}
                    {m === "Oat" && <small>+{money(4000, currency)}</small>}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <p className="allergen-note">
            Contains:{" "}
            {product.allergens.length
              ? product.allergens.join(", ")
              : "no declared allergens"}
            . Customizations may change allergens. Ask staff about
            cross-contact.
          </p>
          <div className="modal-actions">
            <div className="quantity">
              <IconButton
                label="Decrease quantity"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={16} />
              </IconButton>
              <span>{quantity}</span>
              <IconButton
                label="Increase quantity"
                disabled={quantity >= 20}
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus size={16} />
              </IconButton>
            </div>
            <button
              className="primary"
              disabled={!product.available}
              onClick={() => onAdd(product, milk, quantity)}
            >
              {product.available ? "Add to order" : "Currently unavailable"} ·{" "}
              {money(
                (product.price + (milk === "Oat" ? 4000 : 0)) * quantity,
                currency,
              )}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
function Seats({ state, prefs, setPrefs, act, busy }) {
  const [party, setParty] = useState(2),
    [outlet, setOutlet] = useState(false),
    [quiet, setQuiet] = useState(false),
    [selected, setSelected] = useState(null);
  const ranked = state.tables
    .filter(
      (t) =>
        t.status === "available" &&
        t.seats >= party &&
        (!outlet || t.outlet) &&
        (!quiet || t.quiet),
    )
    .sort((a, b) => a.seats - b.seats);
  const best = ranked[0];
  const requested = new URLSearchParams(location.search).get("table");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FIND YOUR LITTLE CORNER</div>
          <h1>A seat that suits you.</h1>
          <p>By the window, with a friend, or in your own world.</p>
        </div>
        <span className="live-label">Updated live</span>
      </div>
      {state.visit?.tableId && (
        <div className="active-order">
          <Armchair />
          <div>
            <strong>
              {state.visit.tableId} ·{" "}
              {state.visit.status === "held"
                ? "Waiting for staff confirmation"
                : "Your table"}
            </strong>
            <small>
              {state.visit.status === "held"
                ? "Your request is held for 5 minutes. Check with our team."
                : "Your orders will arrive here. Ask staff if you would like to move."}
            </small>
          </div>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              act(
                "/visit/leave",
                {},
                state.visit.status === "held"
                  ? "Table request released."
                  : "Thanks for stopping by. See you soon!",
              )
            }
          >
            {state.visit.status === "held" ? "Cancel request" : "I’m leaving"}
          </button>
        </div>
      )}
      {requested && (
        <p className="info-line">
          You scanned table {requested}. Select it below to request seating.
        </p>
      )}
      <div className="seating-filters">
        <label>
          <Users size={17} />
          <select
            aria-label="Party size"
            value={party}
            onChange={(e) => setParty(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "person" : "people"}
              </option>
            ))}
          </select>
        </label>
        <button
          className={outlet ? "filter active" : "filter"}
          onClick={() => setOutlet(!outlet)}
        >
          <Plug size={16} />
          Power outlet
        </button>
        <button
          className={quiet ? "filter active" : "filter"}
          onClick={() => setQuiet(!quiet)}
        >
          <Leaf size={16} />
          Quiet corner
        </button>
      </div>
      {best && !state.visit?.tableId && (
        <div className="seat-recommendation">
          <Sparkles size={21} />
          <span>
            <strong>{best.id} looks like your kind of spot.</strong>
            <small>
              {best.zone} · Seats {best.seats}
              {best.outlet ? " · Power outlet" : ""}
            </small>
          </span>
          <button className="text-button" onClick={() => setSelected(best)}>
            Take a look <ArrowRight size={16} />
          </button>
        </div>
      )}
      <section className="floor-plan">
        <div className="floor-top">
          <span>COMMON GROUND · FLOOR PLAN</span>
          <span>
            <Sun size={15} /> WINDOWS
          </span>
        </div>
        <div className="floor-tables">
          {state.tables.map((t) => (
            <button
              aria-label={`Table ${t.number}, ${t.status}, ${t.seats} seats`}
              key={t.id}
              className={`table-spot ${t.status} ${ranked.some((r) => r.id === t.id) ? "matches" : ""} ${t.mine ? "mine" : ""}`}
              onClick={() => setSelected(t)}
            >
              <span className="chair chair-top" />
              <span className="chair chair-bottom" />
              <strong>{t.id}</strong>
              <span>{t.seats} seats</span>
              {t.outlet && <Plug size={13} />}
              <span className="table-status">
                {t.mine
                  ? "Yours"
                  : t.status === "cleaning"
                    ? "Preparing"
                    : t.status}
              </span>
            </button>
          ))}
        </div>
        <div className="floor-bottom">
          <span>
            <Coffee size={17} /> COFFEE BAR
          </span>
          <span>ENTRANCE ↑</span>
          <span>PATIO →</span>
        </div>
      </section>
      <div className="map-legend">
        <span>
          <i className="legend-available" />
          Available
        </span>
        <span>
          <i className="legend-occupied" />
          Occupied
        </span>
        <span>
          <i className="legend-held" />
          Held
        </span>
        <span>
          <i className="legend-cleaning" />
          Preparing
        </span>
      </div>
      <p className="allergen-note">
        Availability can change. Your table is confirmed when our team seats
        you. Unused chairs at occupied tables aren’t available separately.
      </p>
      {state.waitlist.length ? (
        <div className="seat-recommendation">
          <Clock />
          <div>
            <strong>You’re on the list.</strong>
            <small>
              We’ll update this screen when a suitable table is assigned.
            </small>
          </div>
        </div>
      ) : (
        <div className="waitlist-card">
          <div>
            <h3>Waiting for the perfect spot?</h3>
            <p>Join the list for a table for {party}.</p>
          </div>
          <input
            aria-label="Waitlist name"
            placeholder="Your name"
            value={prefs.name}
            maxLength={60}
            onChange={(e) => setPrefs({ ...prefs, name: e.target.value })}
          />
          <button
            className="secondary"
            disabled={busy || !prefs.name.trim() || !!state.visit?.tableId}
            onClick={() =>
              act(
                "/waitlist",
                { partySize: party, name: prefs.name },
                "You’re on the waiting list.",
              )
            }
          >
            Join waitlist
          </button>
        </div>
      )}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Table ${selected.number}` : "Table"}
        description={
          selected ? `${selected.zone} · ${selected.seats} seats` : ""
        }
      >
        {selected && (
          <div className="stack">
            <div className="table-features">
              {selected.outlet && (
                <span>
                  <Plug />
                  Power outlet
                </span>
              )}
              {selected.quiet && (
                <span>
                  <Leaf />
                  Quiet corner
                </span>
              )}
              {selected.accessible && <span>Accessible seating</span>}
            </div>
            <p>
              Status:{" "}
              <strong>
                {state.tables.find((t) => t.id === selected.id)?.status}
              </strong>
            </p>
            <button
              className="primary"
              disabled={
                busy ||
                selected.status !== "available" ||
                selected.seats < party ||
                !!state.visit?.tableId
              }
              onClick={async () => {
                const result = await act(
                  "/tables/claim",
                  { tableId: selected.id, partySize: party },
                  "Table requested. Our team will confirm your seat.",
                );
                if (result) setSelected(null);
              }}
            >
              Request for {party} {party === 1 ? "person" : "people"}
            </button>
            <p className="muted">
              Our team confirms seating. This request holds the table for 5
              minutes.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
function Cart({
  open,
  onClose,
  cart,
  changeQuantity,
  subtotal,
  state,
  prefs,
  setPrefs,
  act,
  busy,
  onOrdered,
  session,
}) {
  const [service, setService] = useState("takeaway"),
    [note, setNote] = useState(""),
    [requestId, setRequestId] = useState(crypto.randomUUID());
  useEffect(() => {
    if (open) {
      setService(state.visit?.status === "seated" ? "dine-in" : "takeaway");
    }
  }, [open]);
  useEffect(
    () => setRequestId(crypto.randomUUID()),
    [JSON.stringify(cart.map((x) => [x.id, x.milk, x.quantity]))],
  );
  const tax = Math.round((subtotal * (state.cafe?.taxRate ?? 5)) / 100);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your little order"
      description="A few good things, freshly made."
    >
      {cart.length ? (
        <>
          <div className="cart-lines">
            {cart.map((x, i) => (
              <div className="cart-line" key={`${x.id}-${x.milk}`}>
                <img src={images[x.image] || images.pastry} alt="" />
                <div>
                  <strong>{x.name}</strong>
                  <small>
                    {x.milk === "Standard"
                      ? "Original recipe"
                      : `${x.milk} milk`}
                  </small>
                  <span>
                    {money(
                      (x.price + (x.milk === "Oat" ? 4000 : 0)) * x.quantity,
                      session.currency,
                    )}
                  </span>
                </div>
                <div className="quantity">
                  <IconButton
                    label={`Remove one ${x.name}`}
                    onClick={() => changeQuantity(i, -1)}
                  >
                    <Minus size={14} />
                  </IconButton>
                  <span>{x.quantity}</span>
                  <IconButton
                    label={`Add one ${x.name}`}
                    onClick={() => changeQuantity(i, 1)}
                  >
                    <Plus size={14} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
          <div className="choice-row">
            <button
              className={service === "dine-in" ? "choice selected" : "choice"}
              disabled={state.visit?.status !== "seated"}
              onClick={() => setService("dine-in")}
            >
              <Armchair size={17} />
              At my table
            </button>
            <button
              className={service === "takeaway" ? "choice selected" : "choice"}
              onClick={() => setService("takeaway")}
            >
              <ShoppingBag size={17} />
              Takeaway
            </button>
          </div>
          {state.visit?.status !== "seated" && (
            <p className="muted">
              For table delivery, have our team confirm your seat first.
            </p>
          )}
          <label className="field">
            Name for your order
            <input
              required
              maxLength={60}
              value={prefs.name}
              onChange={(e) => setPrefs({ ...prefs, name: e.target.value })}
              placeholder="What should we call you?"
            />
          </label>
          <label className="field">
            A note for our team <span>(optional)</span>
            <textarea
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything we should know?"
            />
          </label>
          <div className="totals">
            <span>
              Subtotal<strong>{money(subtotal, session.currency)}</strong>
            </span>
            <span>
              Tax ({state.cafe?.taxRate ?? 5}%)
              <strong>{money(tax, session.currency)}</strong>
            </span>
            <span className="total">
              Total<strong>{money(subtotal + tax, session.currency)}</strong>
            </span>
          </div>
          <button
            className="primary full"
            disabled={
              busy ||
              !prefs.name.trim() ||
              !state.acceptOrders ||
              !navigator.onLine
            }
            onClick={async () => {
              const o = await act(
                "/orders",
                {
                  requestId,
                  service,
                  name: prefs.name,
                  note,
                  items: cart.map((x) => ({
                    id: x.id,
                    milk: x.milk,
                    quantity: x.quantity,
                  })),
                },
                "Your order is with the café.",
              );
              if (o) onOrdered();
            }}
          >
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <ShoppingBag size={18} />
            )}
            Place order · {money(subtotal + tax, session.currency)}
          </button>
          <p className="muted center">
            Pay or split the bill after placing your order.
          </p>
        </>
      ) : (
        <Empty
          icon={ShoppingBag}
          title="A little room for something good."
          text="Add a favorite from the menu."
        />
      )}
    </Modal>
  );
}
function Orders({ state, session, act, notify, setTab, add }) {
  const [split, setSplit] = useState(null);
  const orders = [...state.orders].reverse();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FROM OUR COUNTER TO YOUR CORNER</div>
          <h1>Your orders & bills.</h1>
          <p>Follow the brew. Share the good stuff.</p>
        </div>
      </div>
      {!orders.length && (
        <Empty
          icon={ReceiptText}
          title="Your next favorite is waiting."
          text="Once you order, you can follow its progress and split the bill here."
          action={
            <button className="primary" onClick={() => setTab("menu")}>
              Explore the menu <ArrowRight size={17} />
            </button>
          }
        />
      )}
      <div className="orders-stack">
        {orders.map((o) => {
          const bill = state.bills.find((b) => b.id === o.billId);
          return (
            <article className="order-card" key={o.id}>
              <div className="order-top">
                <div>
                  <span className="eyebrow">
                    {o.code} · {o.tableId || "TAKEAWAY"}
                  </span>
                  <h2>{labels[o.status]}</h2>
                </div>
                <span
                  className={`badge ${bill.status === "paid" ? "green" : "amber"}`}
                >
                  {bill.status === "paid"
                    ? "Paid"
                    : bill.status === "partial"
                      ? "Partially paid"
                      : "Payment due"}
                </span>
              </div>
              <div className="order-progress">
                {steps.map((step, i) => (
                  <div
                    key={step}
                    className={i <= steps.indexOf(o.status) ? "complete" : ""}
                  >
                    <span>
                      {i < steps.indexOf(o.status) ? (
                        <Check size={13} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <small>
                      {["Received", "Preparing", "Ready", "Served"][i]}
                    </small>
                  </div>
                ))}
              </div>
              {o.status !== "served" && (
                <p className="muted">
                  Estimated preparation: {o.estimate.low}–{o.estimate.high}{" "}
                  minutes from ordering. Check live status above.
                </p>
              )}
              <div className="order-items">
                {o.lines.map((l, i) => (
                  <div key={i}>
                    <span>
                      <b>{l.quantity}×</b> {l.name}
                      {l.milk !== "Standard" && <small> · {l.milk}</small>}
                    </span>
                    <strong>{money(l.total, session.currency)}</strong>
                  </div>
                ))}
              </div>
              <div className="order-total">
                <span>
                  Total{" "}
                  <small>including {money(o.tax, session.currency)} tax</small>
                </span>
                <strong>{money(o.total, session.currency)}</strong>
              </div>
              {bill.shares.length > 1 && (
                <div className="share-list">
                  {bill.shares.map((s) => (
                    <div key={s.id}>
                      <span className="share-avatar">{s.name[0]}</span>
                      <div>
                        <strong>{s.name}</strong>
                        <small>
                          {s.phone || "Payment link"} ·{" "}
                          {s.status === "paid"
                            ? "Paid"
                            : s.smsStatus === "demo"
                              ? "Demo invite prepared"
                              : s.smsStatus === "sent"
                                ? "SMS submitted"
                                : "Unpaid"}
                        </small>
                      </div>
                      <strong>{money(s.amount, session.currency)}</strong>
                      {s.status !== "paid" && (
                        <IconButton
                          label={`Copy payment link for ${s.name}`}
                          onClick={async () => {
                            const result = await act(
                              `/bills/${bill.id}/share/${s.id}/link`,
                              {},
                            );
                            if (result)
                              try {
                                await navigator.clipboard.writeText(
                                  result.link,
                                );
                                notify("Private payment link copied.");
                              } catch {
                                notify(
                                  "Clipboard unavailable. Open the payment link to share it.",
                                );
                              }
                          }}
                        >
                          <Copy size={16} />
                        </IconButton>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="order-actions">
                {bill.status !== "paid" && (
                  <>
                    <a className="primary" href={bill.shares[0].link}>
                      {bill.shares.length > 1 ? "Pay first share" : "Pay bill"}{" "}
                      <ArrowUpRight size={17} />
                    </a>
                    <button
                      className="secondary"
                      onClick={() => setSplit(bill)}
                    >
                      <Users size={17} />
                      {bill.shares.length > 1
                        ? "Manage split"
                        : "Split with friends"}
                    </button>
                  </>
                )}
                {o.status === "served" && (
                  <button
                    className="secondary"
                    onClick={() => {
                      for (const line of o.lines) {
                        const m = state.menu.find((m) => m.id === line.id);
                        if (m?.available) add(m, line.milk, line.quantity);
                      }
                      notify("Available items added to your order.");
                    }}
                  >
                    <RefreshCw size={16} />
                    Order again
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <SplitBill
        bill={split && state.bills.find((b) => b.id === split.id)}
        onClose={() => setSplit(null)}
        session={session}
        act={act}
        notify={notify}
      />
    </>
  );
}
function SplitBill({ bill, onClose, session, act, notify }) {
  const [mode, setMode] = useState("equal"),
    [people, setPeople] = useState([]),
    [saving, setSaving] = useState(false),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (bill) {
      setPeople(
        bill.shares.length > 1
          ? bill.shares.map((s) => ({
              name: s.name,
              phone: "",
              amount: (s.amount / 100).toFixed(2),
            }))
          : [
              { name: bill.shares[0].name, phone: "", amount: "" },
              { name: "", phone: "", amount: "" },
            ],
      );
      setMode("equal");
      setConfirm(false);
    }
  }, [bill?.id]);
  const locked = bill?.shares.some(
    (s) => s.status === "paid" || s.checkoutId || s.invited,
  );
  const update = (i, key, val) =>
    setPeople((p) => p.map((x, n) => (i === n ? { ...x, [key]: val } : x)));
  return (
    <Modal
      open={!!bill}
      onClose={onClose}
      title="Good company. Shared bill."
      description="Split fairly and send each friend a private payment link."
    >
      {bill && (
        <>
          <div className="split-total">
            <span>Bill total</span>
            <strong>{money(bill.total, session.currency)}</strong>
          </div>
          {!locked && (
            <>
              <div className="choice-row">
                <button
                  className={mode === "equal" ? "choice selected" : "choice"}
                  onClick={() => setMode("equal")}
                >
                  Split equally
                </button>
                <button
                  className={mode === "custom" ? "choice selected" : "choice"}
                  onClick={() => setMode("custom")}
                >
                  Custom amounts
                </button>
              </div>
              <div className="split-people">
                {people.map((p, i) => (
                  <div key={i} className="split-person">
                    <span className="share-avatar">{i + 1}</span>
                    <div>
                      <input
                        aria-label={`Person ${i + 1} name`}
                        placeholder="Name"
                        maxLength={60}
                        value={p.name}
                        onChange={(e) => update(i, "name", e.target.value)}
                      />
                      <input
                        aria-label={`Person ${i + 1} phone`}
                        type="tel"
                        placeholder="+91… (optional for SMS)"
                        value={p.phone}
                        onChange={(e) =>
                          update(
                            i,
                            "phone",
                            e.target.value.replace(/[\s()-]/g, ""),
                          )
                        }
                      />
                      {mode === "custom" ? (
                        <input
                          aria-label={`Person ${i + 1} amount`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Amount"
                          value={p.amount}
                          onChange={(e) => update(i, "amount", e.target.value)}
                        />
                      ) : (
                        <small>
                          {money(
                            Math.floor(bill.total / people.length) +
                              (i < bill.total % people.length ? 1 : 0),
                            session.currency,
                          )}
                        </small>
                      )}
                    </div>
                    {people.length > 1 && (
                      <IconButton
                        label={`Remove person ${i + 1}`}
                        onClick={() =>
                          setPeople(people.filter((_, n) => n !== i))
                        }
                      >
                        <X size={16} />
                      </IconButton>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="text-button"
                disabled={people.length >= 12}
                onClick={() =>
                  setPeople([...people, { name: "", phone: "", amount: "" }])
                }
              >
                <Plus size={16} />
                Add a friend
              </button>
              <button
                className="primary full"
                disabled={saving || people.some((p) => !p.name.trim())}
                onClick={async () => {
                  setSaving(true);
                  const result = await act(
                    `/bills/${bill.id}/split`,
                    {
                      mode,
                      participants: people.map((p) => ({
                        ...p,
                        amount: Math.round(Number(p.amount) * 100),
                      })),
                    },
                    "Split saved. Review the recipients below.",
                  );
                  setSaving(false);
                  if (result) setConfirm(true);
                }}
              >
                Save split
              </button>
            </>
          )}
          {locked && (
            <p className="info-line">
              This split is locked because a payment or invitation has started.
              Paid shares stay protected.
            </p>
          )}
          {(confirm || locked || bill.shares.length > 1) && (
            <div className="invite-review">
              <h3>Review payment invitations</h3>
              {bill.shares.map((s) => (
                <div key={s.id}>
                  <span>
                    <strong>{s.name}</strong>
                    <small>{s.phone || "Share link manually"}</small>
                  </span>
                  <span>{money(s.amount, session.currency)}</span>
                  <a className="text-button" href={s.link}>
                    Open <ExternalLink size={14} />
                  </a>
                </div>
              ))}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />
                I’ve checked the recipients and want to send these payment
                invitations.
              </label>
              <button
                className="primary full"
                disabled={
                  !confirm || saving || (!session.demo && !session.smsEnabled)
                }
                onClick={async () => {
                  setSaving(true);
                  const result = await act(`/bills/${bill.id}/invite`, {
                    confirmed: true,
                  });
                  if (result)
                    notify(
                      result.demo
                        ? "Demo invitations prepared. No SMS was sent."
                        : result.results.some((r) => r.status === "failed")
                          ? "Some invitations failed. Share the links manually."
                          : "Payment invitations submitted.",
                    );
                  setSaving(false);
                }}
              >
                <Send size={17} />
                {session.demo
                  ? "Preview SMS invitations"
                  : "Send SMS invitations"}
              </button>
            </div>
          )}
          {!session.demo && !session.smsEnabled && (
            <p className="info-line">
              SMS delivery is not configured. Share each payment link directly;
              guests can settle with staff.
            </p>
          )}
          <p className="muted">
            Phone numbers invite people to pay; they never authorize a charge.
            Links expire after 24 hours. Tax is included in each share.
          </p>
        </>
      )}
    </Modal>
  );
}
function Profile({
  prefs,
  setPrefs,
  state,
  setProduct,
  toggleFavorite,
  session,
  onSession,
  notify,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE MORE YOU</div>
          <h1>Your everyday favorites.</h1>
          <p>Small preferences that make your next visit easier.</p>
        </div>
      </div>
      <PhoneLogin session={session} onSession={onSession} notify={notify} />
      <section className="profile-card">
        <span className="large-avatar">
          <UserRound size={28} />
        </span>
        <div>
          <h2>Nice to have you here.</h2>
          <label className="field">
            Name for your orders
            <input
              value={prefs.name}
              maxLength={60}
              onChange={(e) => setPrefs({ ...prefs, name: e.target.value })}
              placeholder="Your name"
            />
          </label>
          <p className="muted">
            Your name and favorites are saved on this device. Clearing browser
            data removes them.
          </p>
        </div>
      </section>
      <div className="section-heading">
        <h2>Saved for next time</h2>
      </div>
      <div className="menu-grid">
        {state.menu
          .filter((m) => prefs.favorites.includes(m.id))
          .map((m) => (
            <ProductCard
              key={m.id}
              item={m}
              favorite
              onFavorite={() => toggleFavorite(m.id)}
              onClick={() => setProduct(m)}
            />
          ))}
      </div>
      {!prefs.favorites.length && (
        <Empty
          icon={Heart}
          title="Keep your favorites close."
          text="Tap the heart on a menu item to save it here."
        />
      )}
      <a className="text-button" href="/staff">
        <ShieldCheck size={17} />
        Staff sign-in <ArrowUpRight size={16} />
      </a>
    </>
  );
}
function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      <span>
        <Icon size={30} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Payment({ token }) {
  const [share, setShare] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const refresh = () =>
      api(`/pay/${token}`)
        .then(setShare)
        .catch((e) => setError(e.message));
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [token]);
  return (
    <div className="payment-page">
      <a href="/" className="brand-link">
        <Brand />
      </a>
      <section className="payment-card">
        {share ? (
          <>
            <span className="payment-icon">
              {share.status === "paid" ? (
                <CheckCircle2 size={42} />
              ) : (
                <Users size={42} />
              )}
            </span>
            <div className="eyebrow">A LITTLE LESS BILL MATH</div>
            <h1>
              {share.status === "paid"
                ? "All settled."
                : `Your share, ${share.name}.`}
            </h1>
            <p>
              {share.status === "paid"
                ? "Thanks for sharing a little good company."
                : "A private payment invitation from Common Ground."}
            </p>
            <strong className="payment-amount">
              {money(share.amount, share.currency)}
            </strong>
            {share.demo && (
              <div className="demo-banner">
                Demo payment · no money will be charged.
              </div>
            )}
            {share.status !== "paid" && (
              <button
                className="primary full"
                disabled={busy || (!share.demo && !share.onlinePayments)}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const result = await api(`/pay/${token}`, {});
                    if (result.url) location.assign(result.url);
                    else setShare({ ...share, status: "paid" });
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <ShieldCheck size={18} />
                )}{" "}
                {share.demo
                  ? "Simulate payment"
                  : share.onlinePayments
                    ? "Continue to secure payment"
                    : "Pay at the café counter"}
              </button>
            )}
            <a className="text-button" href="/">
              Back to the café <ArrowRight size={16} />
            </a>
          </>
        ) : !error ? (
          <LoaderCircle className="spin" />
        ) : null}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
function Staff({ session, notify, toast }) {
  const [data, setData] = useState(null),
    [pin, setPin] = useState(""),
    [username, setUsername] = useState(""),
    [receipt, setReceipt] = useState(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("orders"),
    [busy, setBusy] = useState(false),
    [qr, setQr] = useState(null),
    [moveFrom, setMoveFrom] = useState(""),
    [moveTo, setMoveTo] = useState("");
  const refresh = useCallback(
    () =>
      api("/staff")
        .then((d) => {
          setData(d);
          setError("");
        })
        .catch((e) => {
          setError(e.message);
        }),
    [],
  );
  useEffect(() => {
    if (session?.staff) refresh();
  }, [session, refresh]);
  useEffect(() => {
    if (!data) return;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [!!data, refresh]);
  const action = async (path, body) => {
    setBusy(true);
    try {
      await api(`/staff${path}`, body);
      await refresh();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return (
      <div className="payment-page">
        <a href="/" className="brand-link">
          <Brand />
        </a>
        <form
          className="payment-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(
                "/staff/login",
                session?.staffPasswordLogin
                  ? { username, password: pin }
                  : { pin },
              );
              await refresh();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <ShieldCheck size={38} />
          <h1>Behind the counter.</h1>
          <p>Your café, running a little smoother.</p>
          {session?.staffPasswordLogin && (
            <label className="field">
              Staff username
              <input
                aria-label="Staff username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
          )}
          <label className="field">
            {session?.staffPasswordLogin ? "Password" : "Staff PIN"}
            <input
              aria-label={
                session?.staffPasswordLogin ? "Password" : "Staff PIN"
              }
              type="password"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </label>
          {session?.localDemoPin && (
            <p className="demo-banner">Local demo PIN: 2468</p>
          )}
          <button className="primary full" disabled={busy}>
            Open staff space <ArrowRight size={17} />
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <a className="text-button" href="/">
            Back to guest view
          </a>
        </form>
      </div>
    );
  return (
    <div className="staff-shell">
      <header className="header">
        <Brand />
        <span className="staff-title">
          <ShieldCheck size={18} />
          Staff space · {data.staffAccount?.username} ({data.staffAccount?.role}
          )
        </span>
        <div className="header-actions">
          <a className="text-button" href="/">
            Guest view <ExternalLink size={16} />
          </a>
          <IconButton
            label="Sign out"
            onClick={async () => {
              await api("/staff/logout", {});
              setData(null);
            }}
          >
            <LogOut size={19} />
          </IconButton>
        </div>
      </header>
      <main className="staff-main">
        <div className="page-heading">
          <div>
            <div className="eyebrow">GOOD SERVICE STARTS HERE</div>
            <h1>On the floor.</h1>
            <p>Orders, tables, and little requests. All together.</p>
          </div>
          <button
            className={data.settings.acceptOrders ? "secondary" : "primary"}
            disabled={busy || data.staffAccount?.role === "floor"}
            onClick={() =>
              action("/settings", { acceptOrders: !data.settings.acceptOrders })
            }
          >
            {data.settings.acceptOrders ? "Pause kitchen" : "Resume kitchen"}
          </button>
        </div>
        {session?.demo && (
          <div className="demo-banner">
            Demo café · payments are simulated and SMS is not sent.
          </div>
        )}
        {error && (
          <div className="connection-banner" role="alert">
            Updates paused: {error}
          </div>
        )}
        <div className="staff-stats">
          <div>
            <Coffee />
            <strong>
              {data.orders.filter((o) => !["served"].includes(o.status)).length}
            </strong>
            <span>Active orders</span>
          </div>
          <div>
            <Armchair />
            <strong>
              {data.tables.filter((t) => t.status === "available").length}
            </strong>
            <span>Available tables</span>
          </div>
          <div>
            <Bell />
            <strong>
              {data.requests.filter((r) => r.status !== "done").length}
            </strong>
            <span>Guest requests</span>
          </div>
          <div>
            <Users />
            <strong>
              {data.waitlist.filter((w) => w.status === "waiting").length}
            </strong>
            <span>Waiting parties</span>
          </div>
        </div>
        <div className="category-tabs">
          {(data.staffAccount?.role === "barista"
            ? ["orders", "menu"]
            : data.staffAccount?.role === "floor"
              ? ["orders", "tables", "requests", "waitlist"]
              : ["orders", "tables", "requests", "menu", "waitlist", "team"]
          ).map((t) => (
            <button
              className={tab === t ? "selected" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {tab === "team" && (
          <section className="waitlist-card">
            <h2>Staff accounts</h2>
            <p>
              Each person signs in with their own password. Share credentials
              privately.
            </p>
            {(data.staffAccounts || []).map((u) => (
              <p key={u.username}>
                <strong>{u.username}</strong> · {u.role} ·{" "}
                {u.active === false ? "Disabled" : "Active"}
              </p>
            ))}
            <p className="muted">
              Owner: all operations. Barista: order preparation, menu
              availability, kitchen pause. Floor: seating, service requests, and
              counter receipts.
            </p>
          </section>
        )}
        {tab === "orders" && (
          <div className="staff-order-grid">
            {[...data.orders].reverse().map((o) => {
              const b = data.bills.find((b) => b.id === o.billId);
              return (
                <article className="order-card" key={o.id}>
                  <div className="order-top">
                    <div>
                      <span className="eyebrow">
                        {o.code} · {o.tableId || "TAKEAWAY"}
                      </span>
                      <h2>{o.name}</h2>
                    </div>
                    <span
                      className={`badge ${b.status === "paid" ? "green" : "amber"}`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <p className="muted">
                    {new Date(o.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {labels[o.status]}
                  </p>
                  {o.lines.map((l, i) => (
                    <p key={i}>
                      {l.quantity}× {l.name}{" "}
                      {l.milk !== "Standard" ? `(${l.milk})` : ""}
                    </p>
                  ))}
                  {o.note && <p className="info-line">Note: {o.note}</p>}
                  {!session.demo &&
                    ["owner", "floor"].includes(data.staffAccount?.role) &&
                    b.shares
                      .filter((sh) => sh.status !== "paid" && !sh.checkoutId)
                      .map((sh) => (
                        <button
                          key={sh.id}
                          className="secondary full"
                          disabled={busy}
                          onClick={() =>
                            setReceipt({
                              billId: b.id,
                              shareId: sh.id,
                              name: sh.name,
                              amount: sh.amount,
                            })
                          }
                        >
                          Record counter payment · {sh.name} ·{" "}
                          {money(sh.amount, session.currency)}
                        </button>
                      ))}
                  <div className="order-total">
                    <span>Outstanding</span>
                    <strong>
                      {money(
                        b.shares
                          .filter((s) => s.status !== "paid")
                          .reduce((n, s) => n + s.amount, 0),
                        session?.currency,
                      )}
                    </strong>
                  </div>
                  {o.status !== "served" &&
                    data.staffAccount?.role !== "floor" && (
                      <button
                        className="primary full"
                        disabled={busy}
                        onClick={() =>
                          action(`/orders/${o.id}`, {
                            status: steps[steps.indexOf(o.status) + 1],
                          })
                        }
                      >
                        {
                          {
                            accepted: "Start preparing",
                            preparing: "Mark ready",
                            ready: "Mark served",
                          }[o.status]
                        }
                        <ArrowRight size={17} />
                      </button>
                    )}
                </article>
              );
            })}
            {!data.orders.length && (
              <Empty
                icon={Coffee}
                title="A fresh start."
                text="Guest orders appear here as they arrive."
              />
            )}
          </div>
        )}
        {tab === "tables" && (
          <>
            <div className="staff-table-grid">
              {data.tables.map((t) => (
                <article className="staff-table" key={t.id}>
                  <div className="order-top">
                    <h2>{t.id}</h2>
                    <span
                      className={`badge ${t.status === "available" ? "green" : "amber"}`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p>
                    {t.seats} seats · {t.zone}
                  </p>
                  <div className="stack">
                    {t.status === "held" && (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          action(`/tables/${t.id}`, { action: "seat" })
                        }
                      >
                        Confirm seating
                      </button>
                    )}
                    {["occupied", "cleaning"].includes(t.status) && (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          action(`/tables/${t.id}`, { action: "clear" })
                        }
                      >
                        {t.status === "cleaning"
                          ? "Clean & available"
                          : "Guests have left"}
                      </button>
                    )}
                    <button
                      className="text-button"
                      onClick={async () =>
                        setQr({
                          table: t.id,
                          image: await QRCode.toDataURL(
                            `${location.origin}/?table=${t.id}`,
                            {
                              width: 320,
                              margin: 2,
                              color: { dark: "#174f43" },
                            },
                          ),
                        })
                      }
                    >
                      Table QR code <ArrowUpRight size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="waitlist-card">
              <h3>Move a seated party</h3>
              <select
                aria-label="Move from table"
                value={moveFrom}
                onChange={(e) => setMoveFrom(e.target.value)}
              >
                <option value="">From table</option>
                {data.tables
                  .filter((t) => t.status === "occupied" && t.visitId)
                  .map((t) => (
                    <option key={t.id}>{t.id}</option>
                  ))}
              </select>
              <select
                aria-label="Move to table"
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
              >
                <option value="">To table</option>
                {data.tables
                  .filter((t) => t.status === "available")
                  .map((t) => (
                    <option key={t.id}>{t.id}</option>
                  ))}
              </select>
              <button
                className="secondary"
                disabled={!moveFrom || !moveTo || busy}
                onClick={() => action("/move", { from: moveFrom, to: moveTo })}
              >
                Move party
              </button>
            </div>
          </>
        )}
        {tab === "requests" && (
          <div className="staff-order-grid">
            {data.requests
              .filter((r) => r.status !== "done")
              .map((r) => (
                <article className="order-card" key={r.id}>
                  <span className="eyebrow">{r.tableId}</span>
                  <h2>{r.type}</h2>
                  <p className="muted">
                    {r.status === "new"
                      ? "Waiting for acknowledgment"
                      : "Acknowledged"}
                  </p>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      action(`/requests/${r.id}`, {
                        status: r.status === "new" ? "acknowledged" : "done",
                      })
                    }
                  >
                    {r.status === "new" ? "Acknowledge" : "Mark done"}
                  </button>
                </article>
              ))}
            {!data.requests.some((r) => r.status !== "done") && (
              <Empty
                icon={Bell}
                title="Everyone’s taken care of."
                text="New guest requests appear here."
              />
            )}
          </div>
        )}
        {tab === "menu" && (
          <div className="staff-menu-list">
            {data.menu.map((m) => (
              <div key={m.id}>
                <span>
                  <strong>{m.name}</strong>
                  <small>
                    {m.category} · {money(m.price, session?.currency)}
                  </small>
                </span>
                <button
                  className={m.available ? "secondary" : "primary"}
                  disabled={busy}
                  onClick={() =>
                    action(`/menu/${m.id}`, { available: !m.available })
                  }
                >
                  {m.available ? "Mark sold out" : "Make available"}
                </button>
              </div>
            ))}
          </div>
        )}
        {tab === "waitlist" && (
          <div className="staff-order-grid">
            {data.waitlist
              .filter((w) => w.status === "waiting")
              .map((w) => (
                <article className="order-card" key={w.id}>
                  <h2>{w.name}</h2>
                  <p>
                    Party of {w.partySize} · Joined{" "}
                    {new Date(w.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <select
                    aria-label={`Assign table for ${w.name}`}
                    defaultValue=""
                    disabled={busy}
                    onChange={(e) =>
                      e.target.value &&
                      action(`/tables/${e.target.value}`, {
                        action: "assign",
                        waitlistId: w.id,
                      })
                    }
                  >
                    <option value="">Assign an available table</option>
                    {data.tables
                      .filter(
                        (t) =>
                          t.status === "available" && t.seats >= w.partySize,
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.id} · {t.seats} seats
                        </option>
                      ))}
                  </select>
                </article>
              ))}
            {!data.waitlist.some((w) => w.status === "waiting") && (
              <Empty
                icon={Users}
                title="No one’s waiting."
                text="Guests can join the list from the seating screen."
              />
            )}
          </div>
        )}
      </main>
      <Modal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title="Confirm money received"
        description="Only record this after you have collected this payment at the counter."
      >
        {receipt && (
          <>
            <p>
              {receipt.name} ·{" "}
              <strong>{money(receipt.amount, session.currency)}</strong>
            </p>
            <button
              className="primary full"
              disabled={busy}
              onClick={async () => {
                await action("/receipts", {
                  billId: receipt.billId,
                  shareId: receipt.shareId,
                  confirmed: true,
                });
                setReceipt(null);
              }}
            >
              I have received this payment
            </button>
          </>
        )}
      </Modal>
      <Modal
        open={!!qr}
        onClose={() => setQr(null)}
        title={`Table ${qr?.table || ""}`}
        description="Print this code and place it on the matching table."
      >
        {qr && (
          <div className="qr-panel">
            <img src={qr.image} alt={`QR code for ${qr.table}`} />
            <a
              className="primary"
              download={`common-ground-${qr.table}.png`}
              href={qr.image}
            >
              Download QR code
            </a>
            <p className="muted">
              Scanning opens the table request. Staff still confirms seating.
            </p>
          </div>
        )}
      </Modal>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
