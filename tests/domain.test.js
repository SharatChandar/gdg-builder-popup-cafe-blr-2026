import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  seed,
  priceOrder,
  allocateShares,
  claimTable,
  expireHolds,
  settleShare,
} from "../server/domain.js";
import { createStore } from "../server/store.js";
test("prices come from menu, including options and tax, not client prices", () => {
  const s = seed();
  const o = priceOrder(s, [
    { id: "flat-white", quantity: 2, milk: "Oat", price: 1 },
  ]);
  assert.equal(o.subtotal, 52000);
  assert.equal(o.tax, 2600);
  assert.equal(o.total, 54600);
  assert.throws(() => priceOrder(s, [{ id: "flat-white", quantity: -1 }]));
  s.menu[0].available = false;
  assert.throws(() => priceOrder(s, [{ id: "flat-white", quantity: 1 }]));
});
test("equal splits distribute remainder exactly; custom shares must balance", () => {
  const p = [{ name: "A" }, { name: "B" }, { name: "C" }];
  assert.deepEqual(
    allocateShares(100, p, "equal").map((x) => x.amount),
    [34, 33, 33],
  );
  assert.throws(() =>
    allocateShares(100, [{ name: "A", amount: 90 }], "custom"),
  );
  assert.throws(() =>
    allocateShares(100, [{ name: "A", phone: "98765" }], "equal"),
  );
  assert.throws(() => allocateShares(1, p, "equal"));
});
test("occupied tables and undersized tables cannot be claimed", () => {
  const s = seed();
  claimTable(s, "one", "T01", 2);
  assert.throws(() => claimTable(s, "two", "T01", 2));
  assert.throws(() => claimTable(s, "three", "T02", 4));
  assert.throws(() => claimTable(s, "one", "T02", 2));
});
test("expired holds release only held tables, never occupied tables", () => {
  const s = seed();
  const v = claimTable(s, "one", "T01", 2);
  expireHolds(s, Date.now() + 310000);
  assert.equal(s.tables[0].status, "available");
  assert.equal(v.status, "browsing");
  assert.equal(s.tables[2].status, "occupied");
});
test("settlement is idempotent and validates amount and currency", () => {
  const s = seed();
  const shares = allocateShares(101, [{ name: "A" }, { name: "B" }], "equal");
  s.bills.push({ id: "b", status: "unpaid", shares });
  assert.throws(() => settleShare(s, "b", shares[0].id, 1, "inr", "inr"));
  assert.throws(() => settleShare(s, "b", shares[0].id, 51, "usd", "inr"));
  settleShare(s, "b", shares[0].id, 51, "inr", "inr");
  settleShare(s, "b", shares[0].id, 51, "inr", "inr");
  assert.equal(s.bills[0].status, "partial");
  settleShare(s, "b", shares[1].id, 50, "inr", "inr");
  assert.equal(s.bills[0].status, "paid");
});
test("concurrent table claims admit one guest and preserve durable state", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cafe-test-"));
  try {
    const path = join(dir, "state.json");
    const store = await createStore({ path });
    const results = await Promise.allSettled([
      store.transact((s) => claimTable(s, "a", "T01", 2)),
      store.transact((s) => claimTable(s, "b", "T01", 2)),
    ]);
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    const reopened = await createStore({ path });
    const s = await reopened.transact((s) => s);
    assert.equal(s.visits.length, 1);
    assert.equal(s.tables[0].status, "held");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("failed transactions do not persist partial mutations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cafe-test-"));
  try {
    const store = await createStore({ path: join(dir, "state.json") });
    await assert.rejects(
      store.transact((s) => {
        s.settings.acceptOrders = false;
        throw Error("abort");
      }),
    );
    assert.equal(await store.transact((s) => s.settings.acceptOrders), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
