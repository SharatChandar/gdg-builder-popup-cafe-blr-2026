import test from "node:test";
import assert from "node:assert/strict";
import { addMenuNutrition } from "../server/nutrition.js";
test("nutrition backfill preserves existing nutrition, prices and live operations and is repeatable", () => {
  const state = {
    menu: [
      { id: "flat-white", price: 22000, available: false },
      { id: "croissant", nutrition: { calories: 305, estimated: false } },
      { id: "custom-product" },
    ],
    orders: [{ id: "real-order" }],
    tables: [{ id: "T01", status: "occupied" }],
  };
  const operations = JSON.stringify({
    orders: state.orders,
    tables: state.tables,
  });
  addMenuNutrition(state);
  assert.equal(state.menu[0].nutrition.calories, 120);
  assert.equal(state.menu[0].nutrition.estimated, true);
  assert.equal(state.menu[0].price, 22000);
  assert.equal(state.menu[0].available, false);
  assert.deepEqual(state.menu[1].nutrition, {
    calories: 305,
    estimated: false,
  });
  assert.equal(state.menu[2].nutrition, undefined);
  assert.equal(
    JSON.stringify({ orders: state.orders, tables: state.tables }),
    operations,
  );
  const once = JSON.stringify(state);
  addMenuNutrition(state);
  assert.equal(JSON.stringify(state), once);
});
