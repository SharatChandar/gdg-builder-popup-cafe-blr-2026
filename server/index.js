import express from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.js";
import { suggest, validateMedia } from "./ai.js";
import { linkGuestToAccount } from "./identity.js";
import { addMenuNutrition } from "./nutrition.js";
import { verifyPassword, permitted } from "./staff-auth.js";
import {
  AppError,
  insist,
  id,
  priceOrder,
  allocateShares,
  claimTable,
  estimateWait,
  settleShare,
} from "./domain.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const env = await readFile(resolve(root, ".env"), "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]])
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch {}
const deployed = Boolean(process.env.K_SERVICE);
const demo = process.env.DEMO_MODE !== "false";
const currency = (process.env.CURRENCY || "inr").toLowerCase();
insist(
  !deployed || process.env.DATA_STORE === "postgres",
  "Cloud Run requires DATA_STORE=postgres (Cloud SQL).",
);
insist(
  !deployed ||
    Boolean(
      process.env.SESSION_SECRET &&
      (process.env.STAFF_ACCOUNTS_JSON || process.env.STAFF_PIN),
    ),
  "Set SESSION_SECRET and STAFF_ACCOUNTS_JSON before deploying.",
);
insist(
  demo ||
    Boolean(
      process.env.SESSION_SECRET &&
      (process.env.STAFF_ACCOUNTS_JSON || process.env.STAFF_PIN) &&
      process.env.PUBLIC_URL?.startsWith("https://"),
    ),
  "Live mode requires secrets and an HTTPS PUBLIC_URL.",
);
let secret = process.env.SESSION_SECRET;
if (!secret) {
  await mkdir(resolve(root, ".data"), { recursive: true });
  try {
    secret = await readFile(resolve(root, ".data/session-key"), "utf8");
  } catch {
    secret = randomBytes(32).toString("hex");
    await writeFile(resolve(root, ".data/session-key"), secret, {
      mode: 0o600,
    });
  }
}
const staffPin = process.env.STAFF_PIN || (demo ? "2468" : "");
insist(
  !(deployed || !demo) ||
    (secret.length >= 32 &&
      (process.env.STAFF_ACCOUNTS_JSON || staffPin.length >= 6)),
  "Live environments require a 32-character session secret and staff credentials.",
);
const store = await createStore({
  mode: process.env.DATA_STORE || "pglite",
  path: process.env.DATA_PATH || resolve(root, ".data/postgres"),
  legacyPath: process.env.DATA_PATH
    ? undefined
    : resolve(root, ".data/state.json"),
});
await store.transact(addMenuNutrition);
if (process.env.STAFF_ACCOUNTS_JSON) {
  const users = JSON.parse(process.env.STAFF_ACCOUNTS_JSON);
  insist(
    Array.isArray(users) &&
      users.length > 0 &&
      users.every(
        (u) =>
          /^[a-z0-9_-]{2,40}$/.test(u.username) &&
          ["owner", "barista", "floor"].includes(u.role) &&
          /^[a-f0-9]+:[a-f0-9]{128}$/.test(u.passwordHash),
      ),
    "Staff account configuration is invalid.",
  );
  await store.transact((s) => {
    s.staffUsers ||= [];
    for (const user of users) {
      const found = s.staffUsers.find((u) => u.username === user.username);
      if (found) Object.assign(found, user);
      else s.staffUsers.push(user);
    }
  });
}
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", deployed ? 1 : false);
const sign = (data) => {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
};
const verify = (token) => {
  try {
    const [body, sig] = token.split(".");
    const expected = createHmac("sha256", secret)
      .update(body)
      .digest("base64url");
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    )
      return null;
    const data = JSON.parse(Buffer.from(body, "base64url"));
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
};
const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
const origin = () =>
  process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 8080}`;
const shareToken = (bill, share) =>
  sign({
    kind: "payment",
    bill: bill.id,
    share: share.id,
    exp: bill.expiresAt,
  });
const shareLink = (bill, share) => `${origin()}/pay/${shareToken(bill, share)}`;
const safeBill = (b) => ({
  ...b,
  shares: b.shares.map(({ phone, ...s }) => ({
    ...s,
    phone: phone ? `${phone.slice(0, 3)}••••${phone.slice(-4)}` : "",
    link: shareLink(b, s),
  })),
});
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  const { default: Stripe } = await import("stripe");
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}
app.use((req, res, next) => {
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
  next();
});
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncRoute(async (req, res) => {
    insist(
      stripe && process.env.STRIPE_WEBHOOK_SECRET,
      "Payments are not configured.",
      503,
    );
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new AppError("Invalid webhook signature.", 400);
    }
    if (
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type)
    ) {
      const session = event.data.object;
      if (session.payment_status === "paid")
        await store.transact((state) =>
          settleShare(
            state,
            session.metadata.billId,
            session.metadata.shareId,
            session.amount_total,
            session.currency,
            currency,
          ),
        );
    }
    res.json({ received: true });
  }),
);
app.use("/api/ai/suggest", express.json({ limit: "6mb" }));
app.use(express.json({ limit: "32kb" }));
app.use("/api", (req, res, next) => {
  const requestOrigin = req.headers.origin;
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && requestOrigin) {
    const expected = process.env.PUBLIC_URL
      ? new URL(process.env.PUBLIC_URL).origin
      : `${req.protocol}://${req.get("host")}`;
    if (requestOrigin !== expected)
      return res
        .status(403)
        .json({ error: "This request came from another site." });
  }
  const cookie = Object.fromEntries(
    (req.headers.cookie || "").split(";").map((x) => x.trim().split("=")),
  );
  req.guest = verify(cookie.cg_guest || "");
  req.staff = verify(cookie.cg_staff || "");
  next();
});
const requireGuest = (req, res, next) =>
  req.guest?.kind === "guest"
    ? next()
    : res.status(401).json({ error: "Please refresh to start a visit." });
const requireStaff = (req, res, next) =>
  req.staff?.kind === "staff"
    ? next()
    : res.status(401).json({ error: "Staff sign-in required." });
const counters = new Map();
function limit(key, max = 30) {
  const now = Date.now();
  if (counters.size > 10000)
    for (const [k, v] of counters) if (v.until < now) counters.delete(k);
  const count = counters.get(key);
  if (!count || count.until < now) {
    counters.set(key, { n: 1, until: now + 60000 });
    return;
  }
  insist(count.n++ < max, "Too many attempts. Try again in a minute.", 429);
}
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.post("/api/session", (req, res) => {
  limit(`session:${req.ip}`, 60);
  if (req.guest?.kind !== "guest") {
    req.guest = { kind: "guest", id: id(), exp: Date.now() + 30 * 86400000 };
    res.cookie("cg_guest", sign(req.guest), {
      httpOnly: true,
      sameSite: "lax",
      secure: deployed || !demo,
      maxAge: 30 * 86400000,
    });
  }
  res.json({
    guestId: req.guest.id,
    demo,
    localDemoPin:
      demo &&
      !deployed &&
      !process.env.STAFF_PIN &&
      !process.env.STAFF_ACCOUNTS_JSON,
    staffPasswordLogin: Boolean(process.env.STAFF_ACCOUNTS_JSON),
    onlinePayments: Boolean(stripe && process.env.STRIPE_WEBHOOK_SECRET),
    smsEnabled: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM,
    ),
    currency,
    staff: req.staff?.kind === "staff",
    staffAccount:
      req.staff?.kind === "staff"
        ? { username: req.staff.username, role: req.staff.role || "owner" }
        : null,
    account: req.guest.firebaseUid
      ? { verified: true, phoneLast4: req.guest.phoneLast4 }
      : null,
    aiEnabled: Boolean(process.env.GEMINI_API_KEY),
    firebaseConfig:
      process.env.FIREBASE_WEB_API_KEY && process.env.FIREBASE_PROJECT_ID
        ? {
            apiKey: process.env.FIREBASE_WEB_API_KEY,
            authDomain:
              process.env.FIREBASE_AUTH_DOMAIN ||
              `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
            projectId: process.env.FIREBASE_PROJECT_ID,
            appId: process.env.FIREBASE_APP_ID,
          }
        : null,
  });
});
app.post(
  "/api/auth/firebase",
  requireGuest,
  asyncRoute(async (req, res) => {
    limit(`firebase:${req.ip}`, 10);
    insist(
      process.env.FIREBASE_PROJECT_ID,
      "Firebase login is not configured.",
      503,
    );
    insist(
      typeof req.body.idToken === "string" && req.body.idToken.length < 10000,
      "Missing Firebase ID token.",
    );
    const { getApps, initializeApp } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    const admin =
      getApps()[0] ||
      initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    let decoded;
    try {
      decoded = await getAuth(admin).verifyIdToken(req.body.idToken, true);
    } catch {
      throw new AppError(
        "Your login expired. Please verify your phone again.",
        401,
      );
    }
    insist(
      decoded.phone_number && decoded.firebase?.sign_in_provider === "phone",
      "Sign in with a verified phone number.",
      401,
    );
    insist(
      Date.now() / 1000 - decoded.auth_time < 300,
      "Please verify your phone again to sign in.",
      401,
    );
    const accountId = `firebase:${decoded.uid}`;
    await store.transact((s) => linkGuestToAccount(s, req.guest, accountId));
    res.cookie(
      "cg_guest",
      sign({
        kind: "guest",
        id: accountId,
        firebaseUid: decoded.uid,
        phoneLast4: decoded.phone_number.slice(-4),
        exp: Date.now() + 3600000,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: deployed || !demo,
        maxAge: 3600000,
      },
    );
    res.json({ ok: true });
  }),
);
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("cg_guest");
  res.json({ ok: true });
});
app.post(
  "/api/ai/suggest",
  requireGuest,
  asyncRoute(async (req, res) => {
    limit(`ai-ip:${req.ip}`, 10);
    limit(`ai:${req.guest.id}`, 6);
    validateMedia(req.body.media);
    const menu = await store.transact((s) => s.menu);
    res.json(await suggest(req.body, menu));
  }),
);
app.get(
  "/api/state",
  requireGuest,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        const visit = [...s.visits]
          .reverse()
          .find((v) => v.guestId === req.guest.id && v.status !== "ended");
        return {
          menu: s.menu,
          cafe: {
            name: s.settings.name || "",
            location: s.settings.location || "",
            setupComplete: !!s.settings.setupComplete,
            taxRate: s.settings.taxRate ?? 5,
          },
          tables: s.tables.map(({ visitId, ...t }) => ({
            ...t,
            mine: visitId === visit?.id,
          })),
          visit: visit || null,
          orders: s.orders.filter((o) => o.guestId === req.guest.id),
          bills: s.bills
            .filter((b) => b.guestId === req.guest.id)
            .map(safeBill),
          requests: s.requests.filter((r) => r.guestId === req.guest.id),
          waitlist: s.waitlist.filter(
            (w) => w.guestId === req.guest.id && w.status === "waiting",
          ),
          wait: estimateWait(s),
          acceptOrders: s.settings.acceptOrders,
          updatedAt: Date.now(),
          wifi:
            visit?.status === "seated" &&
            (demo || s.settings.wifiSsid || process.env.WIFI_SSID)
              ? {
                  ssid:
                    s.settings.wifiSsid ||
                    process.env.WIFI_SSID ||
                    (demo ? "Common Ground Guest" : "Not configured"),
                  password:
                    s.settings.wifiPassword ||
                    process.env.WIFI_PASSWORD ||
                    (demo ? "goodcoffeegoodcompany" : null),
                }
              : null,
        };
      }),
    ),
  ),
);
app.post(
  "/api/tables/claim",
  requireGuest,
  asyncRoute(async (req, res) => {
    limit(req.guest.id);
    res.json(
      await store.transact((s) =>
        claimTable(s, req.guest.id, req.body.tableId, req.body.partySize),
      ),
    );
  }),
);
app.post(
  "/api/visit/leave",
  requireGuest,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        const v = [...s.visits]
          .reverse()
          .find(
            (v) =>
              v.guestId === req.guest.id &&
              ["held", "seated"].includes(v.status),
          );
        insist(v, "No active table.");
        insist(
          !s.bills.some((b) => b.visitId === v.id && b.status !== "paid"),
          "Please settle your outstanding bill first.",
        );
        insist(
          !s.orders.some((o) => o.visitId === v.id && o.status !== "served"),
          "Please check with staff about your undelivered order.",
        );
        const t = s.tables.find((t) => t.id === v.tableId);
        t.status = v.status === "held" ? "available" : "cleaning";
        t.visitId = null;
        t.updatedAt = Date.now();
        v.status = "ended";
        return { ok: true };
      }),
    ),
  ),
);
app.post(
  "/api/orders",
  requireGuest,
  asyncRoute(async (req, res) => {
    limit(req.guest.id, 20);
    res.json(
      await store.transact((s) => {
        insist(
          s.settings.acceptOrders,
          "The kitchen is paused. Please check with staff.",
          409,
        );
        insist(
          typeof req.body.requestId === "string" &&
            req.body.requestId.length <= 80,
          "Missing order reference.",
        );
        const prior = s.orders.find(
          (o) =>
            o.guestId === req.guest.id && o.requestId === req.body.requestId,
        );
        if (prior) return prior;
        insist(
          ["dine-in", "takeaway"].includes(req.body.service),
          "Choose a service type.",
        );
        const visit = [...s.visits]
          .reverse()
          .find((v) => v.guestId === req.guest.id && v.status === "seated");
        insist(
          req.body.service === "takeaway" || visit,
          "Ask staff to confirm your table before ordering.",
        );
        insist(
          typeof req.body.name === "string" &&
            req.body.name.trim().length > 0 &&
            req.body.name.length <= 60,
          "Enter your name.",
        );
        const totals = priceOrder(s, req.body.items);
        const order = {
          id: id(),
          requestId: req.body.requestId,
          guestId: req.guest.id,
          visitId: req.body.service === "dine-in" ? visit.id : null,
          tableId: req.body.service === "dine-in" ? visit.tableId : null,
          service: req.body.service,
          name: req.body.name.trim(),
          note: String(req.body.note || "").slice(0, 300),
          ...totals,
          status: "accepted",
          code: `CG${String(s.orders.length + 101)}`,
          createdAt: Date.now(),
          estimate: estimateWait(s),
        };
        const bill = {
          id: id(),
          orderId: order.id,
          guestId: req.guest.id,
          visitId: order.visitId,
          total: order.total,
          status: "unpaid",
          expiresAt: Date.now() + 86400000,
          shares: allocateShares(order.total, [{ name: order.name }], "equal"),
        };
        order.billId = bill.id;
        s.orders.push(order);
        s.bills.push(bill);
        return order;
      }),
    );
  }),
);
app.post(
  "/api/bills/:id/split",
  requireGuest,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        const b = s.bills.find(
          (b) => b.id === req.params.id && b.guestId === req.guest.id,
        );
        insist(b, "Bill not found.", 404);
        insist(
          b.shares.every(
            (x) =>
              x.status === "unpaid" &&
              !x.checkoutId &&
              !x.smsSentAt &&
              !x.invited,
          ),
          "This split is locked because a payment or invitation has started.",
          409,
        );
        b.shares = allocateShares(
          b.total,
          req.body.participants,
          req.body.mode,
        );
        b.expiresAt = Date.now() + 86400000;
        return safeBill(b);
      }),
    ),
  ),
);
app.post(
  "/api/bills/:id/share/:shareId/link",
  requireGuest,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        const b = s.bills.find(
          (b) => b.id === req.params.id && b.guestId === req.guest.id,
        );
        const share = b?.shares.find((x) => x.id === req.params.shareId);
        insist(share, "Share not found.", 404);
        share.invited = true;
        return { link: shareLink(b, share) };
      }),
    ),
  ),
);
app.post(
  "/api/bills/:id/invite",
  requireGuest,
  asyncRoute(async (req, res) => {
    limit(`sms:${req.guest.id}`, 3);
    insist(req.body.confirmed === true, "Confirm the recipients first.");
    if (!demo)
      insist(
        process.env.TWILIO_ACCOUNT_SID &&
          process.env.TWILIO_AUTH_TOKEN &&
          process.env.TWILIO_FROM,
        "SMS is not configured. Use the copy-link option.",
        503,
      );
    const jobs = await store.transact((s) => {
      const b = s.bills.find(
        (b) => b.id === req.params.id && b.guestId === req.guest.id,
      );
      insist(b, "Bill not found.", 404);
      return b.shares
        .filter(
          (x) =>
            x.phone &&
            x.status !== "paid" &&
            !["queued", "sent", "demo"].includes(x.smsStatus),
        )
        .map((x) => {
          x.smsStatus = "queued";
          x.invited = true;
          return {
            id: x.id,
            phone: x.phone,
            amount: x.amount,
            link: shareLink(b, x),
          };
        });
    });
    const results = [];
    for (const job of jobs) {
      let status = demo ? "demo" : "failed";
      if (!demo) {
        try {
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: job.phone,
                From: process.env.TWILIO_FROM,
                Body: `Your Common Ground bill share: ${(job.amount / 100).toFixed(2)} ${currency.toUpperCase()}. Review and pay: ${job.link}`,
              }),
              signal: AbortSignal.timeout(10000),
            },
          );
          if (response.ok) status = "sent";
        } catch {}
      }
      await store.transact((s) => {
        const x = s.bills
          .find((b) => b.id === req.params.id)
          .shares.find((x) => x.id === job.id);
        x.smsStatus = status;
        if (status === "sent") x.smsSentAt = Date.now();
      });
      results.push({ id: job.id, status });
    }
    res.json({ demo, results });
  }),
);
const paymentShare = async (token) => {
  const data = verify(token);
  insist(
    data?.kind === "payment",
    "This payment link has expired or is invalid.",
    404,
  );
  return store.transact((s) => {
    const bill = s.bills.find((b) => b.id === data.bill);
    const share = bill?.shares.find((x) => x.id === data.share);
    insist(share, "Payment link not found.", 404);
    return { bill, share };
  });
};
app.get(
  "/api/pay/:token",
  asyncRoute(async (req, res) => {
    const { bill, share } = await paymentShare(req.params.token);
    res.json({
      name: share.name,
      amount: share.amount,
      status: share.status,
      currency,
      demo,
      onlinePayments: Boolean(stripe && process.env.STRIPE_WEBHOOK_SECRET),
      cafe: "Common Ground",
      expiresAt: bill.expiresAt,
    });
  }),
);
app.post(
  "/api/pay/:token",
  asyncRoute(async (req, res) => {
    limit(`pay:${req.ip}`, 20);
    const { bill, share } = await paymentShare(req.params.token);
    insist(share.status !== "paid", "This share is already paid.", 409);
    if (demo) {
      await store.transact((s) =>
        settleShare(s, bill.id, share.id, share.amount, currency, currency),
      );
      return res.json({ paid: true, demo: true });
    }
    insist(
      stripe && process.env.STRIPE_WEBHOOK_SECRET,
      "Online payments are not configured. Please pay with staff.",
      503,
    );
    // Freeze the split before creating a provider session, including across concurrent requests.
    await store.transact((s) => {
      const b = s.bills.find((x) => x.id === bill.id);
      const sh = b.shares.find((x) => x.id === share.id);
      insist(
        sh && sh.status !== "paid",
        "This share changed. Refresh your link.",
        409,
      );
      sh.invited = true;
    });
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: "Common Ground — your bill share" },
              unit_amount: share.amount,
            },
            quantity: 1,
          },
        ],
        metadata: { billId: bill.id, shareId: share.id },
        success_url: `${origin()}/pay/${req.params.token}?returned=1`,
        cancel_url: `${origin()}/pay/${req.params.token}`,
      },
      { idempotencyKey: `share-${share.id}` },
    );
    await store.transact((s) => {
      s.bills
        .find((b) => b.id === bill.id)
        .shares.find((x) => x.id === share.id).checkoutId = session.id;
    });
    res.json({ url: session.url });
  }),
);
app.post(
  "/api/requests",
  requireGuest,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        const v = s.visits.find(
          (v) => v.guestId === req.guest.id && v.status === "seated",
        );
        insist(v, "Please check in at a table first.");
        insist(
          ["Water", "Help with my order", "Please bring the bill"].includes(
            req.body.type,
          ),
          "Choose a request type.",
        );
        const previous = s.requests.find(
          (r) =>
            r.visitId === v.id &&
            r.type === req.body.type &&
            r.status !== "done",
        );
        if (previous) return previous;
        const request = {
          id: id(),
          guestId: req.guest.id,
          visitId: v.id,
          tableId: v.tableId,
          type: req.body.type,
          status: "new",
          createdAt: Date.now(),
        };
        s.requests.push(request);
        return request;
      }),
    ),
  ),
);
app.post(
  "/api/waitlist",
  requireGuest,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        insist(
          Number.isInteger(req.body.partySize) &&
            req.body.partySize >= 1 &&
            req.body.partySize <= 6,
          "Choose 1–6 guests.",
        );
        insist(
          typeof req.body.name === "string" &&
            req.body.name.trim().length > 0 &&
            req.body.name.length <= 60,
          "Enter your name.",
        );
        const old = s.waitlist.find(
          (w) => w.guestId === req.guest.id && w.status === "waiting",
        );
        if (old) return old;
        const w = {
          id: id(),
          guestId: req.guest.id,
          name: req.body.name.trim(),
          partySize: req.body.partySize,
          status: "waiting",
          createdAt: Date.now(),
        };
        s.waitlist.push(w);
        return w;
      }),
    ),
  ),
);
app.post(
  "/api/staff/login",
  asyncRoute(async (req, res) => {
    limit(`staff:${req.ip}`, 5);
    let identity;
    if (demo && !process.env.STAFF_ACCOUNTS_JSON) {
      const pin = String(req.body.pin || "");
      insist(
        pin.length === staffPin.length &&
          timingSafeEqual(Buffer.from(pin), Buffer.from(staffPin)),
        "Incorrect staff PIN.",
        401,
      );
      identity = { username: "demo", role: "owner" };
    } else {
      const username = String(req.body.username || "")
        .toLowerCase()
        .trim();
      const password = String(req.body.password || "");
      insist(password.length <= 200, "Invalid credentials.", 401);
      const user = await store.transact((s) =>
        s.staffUsers?.find(
          (u) => u.username === username && u.active !== false,
        ),
      );
      insist(
        user && verifyPassword(password, user.passwordHash),
        "Invalid staff username or password.",
        401,
      );
      identity = { username: user.username, role: user.role };
    }
    res.cookie(
      "cg_staff",
      sign({ kind: "staff", ...identity, exp: Date.now() + 8 * 3600000 }),
      {
        httpOnly: true,
        sameSite: "strict",
        secure: deployed || !demo,
        maxAge: 8 * 3600000,
      },
    );
    res.json({ ok: true });
  }),
);
app.post("/api/staff/logout", (req, res) => {
  res.clearCookie("cg_staff");
  res.json({ ok: true });
});
app.use("/api/staff", (req, res, next) => {
  if (req.method === "GET") return next();
  if (req.staff?.kind !== "staff")
    return res.status(401).json({ error: "Staff sign-in required." });
  if (!permitted(req.staff.role || "owner", req.path))
    return res
      .status(403)
      .json({ error: "Your staff role cannot perform this action." });
  next();
});
app.get(
  "/api/staff",
  requireStaff,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => ({
        ...s,
        staffUsers: undefined,
        settings: { ...s.settings, wifiPassword: undefined },
        staffAccount: {
          username: req.staff.username,
          role: req.staff.role || "owner",
        },
        staffAccounts:
          req.staff.role === "owner"
            ? (s.staffUsers || []).map(({ username, role, active }) => ({
                username,
                role,
                active,
              }))
            : undefined,
        bills: s.bills.map((b) => ({
          ...b,
          shares: b.shares.map(({ phone, ...x }) => ({
            ...x,
            phone: phone ? `••••${phone.slice(-4)}` : "",
          })),
        })),
        events: undefined,
      })),
    ),
  ),
);
app.post(
  "/api/staff/receipts",
  requireStaff,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        insist(
          req.body.confirmed === true,
          "Confirm that you have received the payment.",
        );
        const bill = s.bills.find((b) => b.id === req.body.billId);
        const share = bill?.shares.find((x) => x.id === req.body.shareId);
        insist(share, "Bill share not found.", 404);
        insist(share.status !== "paid", "Already paid.", 409);
        insist(
          !share.checkoutId,
          "This share has an online checkout. Complete it through the payment provider.",
          409,
        );
        settleShare(s, bill.id, share.id, share.amount, currency, currency);
        share.paymentMethod = "counter";
        share.receivedBy = req.staff.username;
        s.events.push({
          id: id(),
          type: "counter_payment",
          billId: bill.id,
          shareId: share.id,
          amount: share.amount,
          staff: req.staff.username,
          at: Date.now(),
        });
        return { ok: true };
      }),
    ),
  ),
);
app.post(
  "/api/staff/orders/:id",
  requireStaff,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        const o = s.orders.find((o) => o.id === req.params.id);
        insist(o, "Order not found.", 404);
        const next = {
          accepted: "preparing",
          preparing: "ready",
          ready: "served",
        };
        insist(
          next[o.status] === req.body.status,
          "Invalid order transition.",
          409,
        );
        o.status = req.body.status;
        return o;
      }),
    ),
  ),
);
app.post(
  "/api/staff/tables/:id",
  requireStaff,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        const t = s.tables.find((t) => t.id === req.params.id);
        insist(t, "Table not found.", 404);
        const v = s.visits.find((v) => v.id === t.visitId);
        if (req.body.action === "seat") {
          insist(t.status === "held", "No active hold to confirm.", 409);
          t.status = "occupied";
          v.status = "seated";
        } else if (req.body.action === "clear") {
          insist(
            ["occupied", "cleaning"].includes(t.status),
            "Table does not need clearing.",
          );
          if (v) {
            insist(
              !s.bills.some((b) => b.visitId === v.id && b.status !== "paid"),
              "This table has an unpaid bill.",
            );
            insist(
              !s.orders.some(
                (o) => o.visitId === v.id && o.status !== "served",
              ),
              "This table has undelivered orders.",
            );
            v.status = "ended";
          }
          t.status = t.status === "cleaning" ? "available" : "cleaning";
          t.visitId = null;
        } else if (req.body.action === "assign") {
          const w = s.waitlist.find(
            (w) => w.id === req.body.waitlistId && w.status === "waiting",
          );
          insist(w, "Waitlist entry not found.");
          const newVisit = claimTable(s, w.guestId, t.id, w.partySize);
          w.status = "assigned";
          return newVisit;
        } else throw new AppError("Unknown action.");
        t.updatedAt = Date.now();
        return t;
      }),
    ),
  ),
);
app.post(
  "/api/staff/move",
  requireStaff,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        const from = s.tables.find((t) => t.id === req.body.from);
        const to = s.tables.find((t) => t.id === req.body.to);
        const v = s.visits.find((v) => v.id === from?.visitId);
        insist(
          v?.status === "seated" &&
            to?.status === "available" &&
            to.seats >= v.partySize,
          "Choose an occupied visit and an available table with enough seats.",
        );
        v.tableId = to.id;
        Object.assign(to, {
          status: "occupied",
          visitId: v.id,
          updatedAt: Date.now(),
        });
        Object.assign(from, {
          status: "cleaning",
          visitId: null,
          updatedAt: Date.now(),
        });
        s.orders
          .filter((o) => o.visitId === v.id && o.status !== "served")
          .forEach((o) => (o.tableId = to.id));
        s.requests
          .filter((r) => r.visitId === v.id && r.status !== "done")
          .forEach((r) => (r.tableId = to.id));
        return { ok: true };
      }),
    ),
  ),
);
app.post(
  "/api/staff/requests/:id",
  requireStaff,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        const r = s.requests.find((r) => r.id === req.params.id);
        insist(r, "Request not found.", 404);
        insist(
          ["acknowledged", "done"].includes(req.body.status),
          "Invalid status.",
        );
        r.status = req.body.status;
        return r;
      }),
    ),
  ),
);
app.post(
  "/api/staff/menu/:id",
  requireStaff,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        const m = s.menu.find((m) => m.id === req.params.id);
        insist(m, "Item not found.", 404);
        insist(
          typeof req.body.available === "boolean",
          "Invalid availability.",
        );
        m.available = req.body.available;
        return m;
      }),
    ),
  ),
);
app.post(
  "/api/staff/settings",
  requireStaff,
  asyncRoute(async (req, res) =>
    res.json(
      await store.transact((s) => {
        insist(
          typeof req.body.acceptOrders === "boolean",
          "Invalid kitchen setting.",
        );
        insist(
          demo ||
            !req.body.acceptOrders ||
            (s.settings.setupComplete && s.menu.some((m) => m.available)),
          "Enter the café details and actual menu before opening orders.",
        );
        s.settings.acceptOrders = req.body.acceptOrders;
        return s.settings;
      }),
    ),
  ),
);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
app.use((error, req, res, next) => {
  console.error(error.status ? error.message : error);
  res.status(error.status || 500).json({
    error: error.status
      ? error.message
      : "Something went wrong. Please try again.",
  });
});
if (process.env.NODE_ENV !== "production") {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(resolve(root, "dist")));
  app.get("*", (req, res) => res.sendFile(resolve(root, "dist/index.html")));
}
const port = Number(process.env.PORT || 8080);
app.listen(port, "0.0.0.0", () =>
  console.log(
    `Common Ground running at http://localhost:${port} (${demo ? "demo" : "live"} mode)`,
  ),
);
