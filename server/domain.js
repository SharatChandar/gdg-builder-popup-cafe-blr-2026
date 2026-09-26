import { randomUUID } from "node:crypto";
export const id = () => randomUUID();
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const insist = (condition, message, status = 400) => {
  if (!condition) throw new AppError(message, status);
};
export const menu = [
  {
    id: "flat-white",
    name: "Flat white",
    category: "Coffee",
    price: 22000,
    description: "Double espresso, silky steamed milk. A little daily ritual.",
    image: "coffee",
    tags: ["Bestseller"],
    allergens: ["Milk"],
    prep: 3,
  },
  {
    id: "iced-latte",
    name: "Iced oat latte",
    category: "Coffee",
    price: 28000,
    description: "Our house espresso over ice, finished with creamy oat milk.",
    image: "iced",
    tags: ["Plant based"],
    allergens: ["Oats"],
    prep: 3,
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    category: "Coffee",
    price: 24000,
    description: "Rich espresso beneath a cloud of velvety milk foam.",
    image: "coffee",
    tags: [],
    allergens: ["Milk"],
    prep: 3,
  },
  {
    id: "cold-brew",
    name: "Slow-steeped cold brew",
    category: "Coffee",
    price: 26000,
    description:
      "Steeped for 18 hours. Chocolatey, mellow, beautifully simple.",
    image: "iced",
    tags: ["Plant based"],
    allergens: [],
    prep: 2,
  },
  {
    id: "croissant",
    name: "Butter croissant",
    category: "Bakery",
    price: 19000,
    description: "Golden, flaky layers. Baked fresh for your coffee break.",
    image: "pastry",
    tags: ["Freshly baked"],
    allergens: ["Wheat", "Milk", "Egg"],
    prep: 3,
  },
  {
    id: "almond-croissant",
    name: "Almond croissant",
    category: "Bakery",
    price: 25000,
    description: "Almond cream, toasted flakes, a dusting of sugar.",
    image: "pastry",
    tags: [],
    allergens: ["Wheat", "Milk", "Egg", "Almond"],
    prep: 3,
  },
  {
    id: "avocado-toast",
    name: "Avocado on sourdough",
    category: "Kitchen",
    price: 38000,
    description:
      "Smashed avocado, lemon, chilli and seeds on toasted sourdough.",
    image: "toast",
    tags: ["Plant based"],
    allergens: ["Wheat", "Sesame"],
    prep: 8,
  },
  {
    id: "breakfast-toast",
    name: "Eggs on toast",
    category: "Kitchen",
    price: 34000,
    description: "Soft scrambled eggs, cultured butter and sourdough.",
    image: "toast",
    tags: [],
    allergens: ["Wheat", "Milk", "Egg"],
    prep: 8,
  },
  {
    id: "matcha",
    name: "Matcha latte",
    category: "Tea & more",
    price: 29000,
    description: "Earthy ceremonial-style matcha with your choice of milk.",
    image: "coffee",
    tags: [],
    allergens: ["Milk"],
    prep: 4,
  },
  {
    id: "tea",
    name: "House masala chai",
    category: "Tea & more",
    price: 16000,
    description: "Black tea, warming spices and steamed milk.",
    image: "coffee",
    tags: [],
    allergens: ["Milk"],
    prep: 4,
  },
];
export function seed() {
  return {
    version: 1,
    menu: menu.map((m) => ({ ...m, available: true })),
    tables: Array.from({ length: 10 }, (_, i) => ({
      id: `T${String(i + 1).padStart(2, "0")}`,
      number: i + 1,
      seats: [2, 2, 4, 2, 4, 2, 6, 2, 4, 2][i],
      zone: i < 4 ? "Window" : i < 8 ? "Main room" : "Patio",
      outlet: [0, 1, 4, 5].includes(i),
      quiet: [0, 1, 8, 9].includes(i),
      accessible: [2, 4, 6].includes(i),
      status: [2, 4, 6].includes(i)
        ? "occupied"
        : i === 3
          ? "cleaning"
          : "available",
      visitId: null,
      updatedAt: Date.now(),
    })),
    visits: [],
    orders: [],
    bills: [],
    requests: [],
    waitlist: [],
    settings: { acceptOrders: true, staffCount: 2 },
    events: [],
  };
}
export function priceOrder(state, items) {
  insist(
    Array.isArray(items) && items.length > 0 && items.length <= 30,
    "Add between 1 and 30 items.",
  );
  const lines = items.map((line) => {
    const item = state.menu.find((m) => m.id === line.id);
    insist(item?.available, "An item is unavailable. Please refresh the menu.");
    insist(
      Number.isInteger(line.quantity) &&
        line.quantity >= 1 &&
        line.quantity <= 20,
      "Invalid quantity.",
    );
    const milk = line.milk || "Standard";
    insist(
      ["Standard", "Oat", "Whole", "None"].includes(milk),
      "Invalid milk choice.",
    );
    insist(
      item.category === "Coffee" || item.id === "matcha" || milk === "Standard",
      "Milk customization is only available for coffee and matcha.",
    );
    const unitPrice =
      item.price + (milk === "Oat" ? (item.oatSurcharge ?? 4000) : 0);
    return {
      id: item.id,
      name: item.name,
      quantity: line.quantity,
      milk,
      unitPrice,
      total: unitPrice * line.quantity,
    };
  });
  const subtotal = lines.reduce((sum, x) => sum + x.total, 0);
  const tax = Math.round((subtotal * (state.settings.taxRate ?? 5)) / 100);
  return { lines, subtotal, tax, total: subtotal + tax };
}
export function allocateShares(total, participants, mode) {
  insist(Number.isSafeInteger(total) && total > 0, "Invalid bill total.");
  insist(
    Array.isArray(participants) &&
      participants.length >= 1 &&
      participants.length <= 12,
    "Choose 1–12 people.",
  );
  insist(
    ["equal", "custom"].includes(mode),
    "Choose equal or custom splitting.",
  );
  const shares = participants.map((p, i) => {
    insist(
      typeof p.name === "string" &&
        p.name.trim().length > 0 &&
        p.name.length <= 60,
      "Enter a name for each person.",
    );
    insist(
      !p.phone || /^\+[1-9]\d{7,14}$/.test(p.phone),
      "Use international phone format, for example +919876543210.",
    );
    const amount =
      mode === "equal"
        ? Math.floor(total / participants.length) +
          (i < total % participants.length ? 1 : 0)
        : p.amount;
    insist(
      Number.isSafeInteger(amount) && amount > 0,
      "Each share must be greater than zero.",
    );
    return {
      id: id(),
      name: p.name.trim(),
      phone: p.phone || "",
      amount,
      status: "unpaid",
      smsStatus: "not_sent",
    };
  });
  insist(
    shares.reduce((a, b) => a + b.amount, 0) === total,
    "The shares must add up to the bill total.",
  );
  return shares;
}
export function expireHolds(state, now = Date.now()) {
  for (const table of state.tables)
    if (table.status === "held" && table.holdUntil < now) {
      const visit = state.visits.find((v) => v.id === table.visitId);
      if (visit) {
        visit.tableId = null;
        visit.status = "browsing";
      }
      Object.assign(table, {
        status: "available",
        visitId: null,
        holdUntil: null,
        updatedAt: now,
      });
    }
}
export function claimTable(state, guestId, tableId, partySize) {
  insist(
    Number.isInteger(partySize) && partySize >= 1 && partySize <= 6,
    "Party size must be 1–6.",
  );
  const table = state.tables.find((t) => t.id === tableId);
  insist(table, "Table not found.", 404);
  insist(
    table.status === "available",
    "That table has just been taken. Choose another.",
    409,
  );
  insist(table.seats >= partySize, "Choose a table with enough seats.");
  insist(
    !state.visits.some(
      (v) => v.guestId === guestId && ["held", "seated"].includes(v.status),
    ),
    "You already have a table. Ask staff to move you.",
    409,
  );
  const visit = {
    id: id(),
    guestId,
    tableId,
    partySize,
    status: "held",
    createdAt: Date.now(),
  };
  state.visits.push(visit);
  Object.assign(table, {
    status: "held",
    visitId: visit.id,
    holdUntil: Date.now() + 300000,
    updatedAt: Date.now(),
  });
  return visit;
}
export const estimateWait = (state) => {
  const workload = state.orders
    .filter((o) => ["accepted", "preparing"].includes(o.status))
    .reduce(
      (n, o) =>
        n +
        o.lines.reduce(
          (sum, l) =>
            sum +
            (state.menu.find((m) => m.id === l.id)?.prep || 3) * l.quantity,
          0,
        ),
      0,
    );
  const low = Math.max(
    4,
    Math.ceil(workload / Math.max(1, state.settings.staffCount)),
  );
  return { low, high: low + 4 };
};
export function settleShare(
  state,
  billId,
  shareId,
  amount,
  currency,
  expectedCurrency,
) {
  const bill = state.bills.find((b) => b.id === billId);
  const share = bill?.shares.find((s) => s.id === shareId);
  insist(share, "Payment share not found.", 404);
  insist(
    share.amount === amount && currency === expectedCurrency,
    "Payment amount or currency mismatch.",
    409,
  );
  share.status = "paid";
  share.paidAt = share.paidAt || Date.now();
  bill.status = bill.shares.every((s) => s.status === "paid")
    ? "paid"
    : "partial";
  return bill;
}
