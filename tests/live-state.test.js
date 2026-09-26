import test from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { emptyCafe } from "../server/live-state.js";
import { verifyPassword, permitted } from "../server/staff-auth.js";
test("live café keeps fictional catalog but never seeds activity or occupied tables", () => {
  const state = emptyCafe();
  assert.equal(state.menu.length, 10);
  assert.equal(state.tables.length, 10);
  for (const key of [
    "orders",
    "visits",
    "bills",
    "requests",
    "waitlist",
    "events",
  ])
    assert.deepEqual(state[key], []);
  assert.ok(
    state.tables.every((t) => t.status === "available" && t.visitId === null),
  );
});
test("staff passwords are checked against salted hashes and roles restrict mutations", () => {
  const salt = "0123456789abcdef";
  const hash =
    salt + ":" + scryptSync("a-private-password", salt, 64).toString("hex");
  assert.equal(verifyPassword("a-private-password", hash), true);
  assert.equal(verifyPassword("wrong", hash), false);
  assert.equal(permitted("barista", "/orders/123"), true);
  assert.equal(permitted("barista", "/receipts"), false);
  assert.equal(permitted("floor", "/tables/T01"), true);
  assert.equal(permitted("floor", "/receipts"), true);
  assert.equal(permitted("floor", "/settings"), false);
  assert.equal(permitted("unknown", "/settings"), false);
});
