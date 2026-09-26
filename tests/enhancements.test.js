import test from "node:test";
import assert from "node:assert/strict";
import { seed, claimTable } from "../server/domain.js";
import { validateSuggestion, suggest, validateMedia } from "../server/ai.js";
import { linkGuestToAccount } from "../server/identity.js";
import { createSqlStore } from "../server/sql-store.js";
import { createCafeTools } from "../src/webmcp.js";
test("AI suggestions cannot invent menu IDs, quantities, options or availability", () => {
  const s = seed();
  assert.throws(() =>
    validateSuggestion(
      { message: "Try this", items: [{ id: "fake", quantity: 1 }] },
      s.menu,
    ),
  );
  assert.throws(() =>
    validateSuggestion(
      {
        message: "Try this",
        items: [{ id: "croissant", quantity: 1, milk: "Oat" }],
      },
      s.menu,
    ),
  );
  assert.throws(() =>
    validateSuggestion(
      { message: "Try this", items: [{ id: "flat-white", quantity: 100 }] },
      s.menu,
    ),
  );
  assert.equal(
    validateSuggestion(
      {
        message: "Draft",
        items: [{ id: "flat-white", quantity: 2, milk: "Oat" }],
      },
      s.menu,
    ).items[0].quantity,
    2,
  );
  assert.throws(() =>
    validateMedia({ mimeType: "application/javascript", data: "YWJj" }),
  );
});
test("Gemini sends a server-side key and validates provider JSON", async () => {
  const result = await suggest({ text: "One flat white" }, seed().menu, {
    key: "test-key",
    fetcher: async (url, opts) => {
      assert.ok(url.includes("generativelanguage.googleapis.com"));
      assert.equal(opts.headers["x-goog-api-key"], "test-key");
      assert.equal(
        JSON.parse(opts.body).generationConfig.responseMimeType,
        "application/json",
      );
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      message: "Please review",
                      items: [
                        { id: "flat-white", quantity: 1, milk: "Standard" },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    },
  });
  assert.equal(result.items.length, 1);
  await assert.rejects(
    suggest({ text: "coffee" }, seed().menu, { key: "" }),
    /not connected/,
  );
});
test("verified login links only current anonymous records, never another account", () => {
  const s = seed();
  s.orders = [{ guestId: "anonymous" }, { guestId: "other" }];
  linkGuestToAccount(s, { id: "anonymous" }, "firebase:A");
  assert.equal(s.orders[0].guestId, "firebase:A");
  assert.equal(s.orders[1].guestId, "other");
  linkGuestToAccount(s, { id: "firebase:A", firebaseUid: "A" }, "firebase:B");
  assert.equal(s.orders[0].guestId, "firebase:A");
  const conflict = seed();
  claimTable(conflict, "anonymous", "T01", 1);
  claimTable(conflict, "firebase:A", "T02", 1);
  assert.throws(
    () => linkGuestToAccount(conflict, { id: "anonymous" }, "firebase:A"),
    /active table/,
  );
});
test("SQL transactions serialize competing table claims and roll back failures", async () => {
  const store = await createSqlStore({
    mode: "pglite",
    path: ":memory:",
    cafeId: "test",
  });
  try {
    const result = await Promise.allSettled([
      store.transact((s) => claimTable(s, "A", "T01", 1)),
      store.transact((s) => claimTable(s, "B", "T01", 1)),
    ]);
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    await assert.rejects(
      store.transact((s) => {
        s.settings.acceptOrders = false;
        throw Error("rollback");
      }),
    );
    assert.equal(await store.transact((s) => s.settings.acceptOrders), true);
  } finally {
    await store.close();
  }
});
test("WebMCP exposes public reads and product review, never checkout or customer data", async () => {
  const state = seed();
  let opened;
  const tools = createCafeTools(() => ({
    state,
    setProduct: (p) => (opened = p),
  }));
  assert.equal(tools.length, 3);
  const menu = await tools[0].execute();
  assert.ok(menu.items.length);
  assert.equal(
    (await tools[1].execute()).tables.some((t) => t.status === "occupied"),
    false,
  );
  await tools[2].execute({ id: "flat-white" });
  assert.equal(opened.id, "flat-white");
  await assert.rejects(tools[2].execute({ id: "not-a-product" }));
});

test('Gemini overload retries a real fallback model and still validates the draft', async()=>{
 const urls=[];
 const result=await suggest({text:'A coffee'},seed().menu,{key:'test-key',fetcher:async url=>{
  urls.push(url);
  if(urls.length===1)return {ok:false,status:503};
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({message:'Review',items:[{id:'flat-white',quantity:1,milk:'Standard'}]})}]}}]})};
 }});
 assert.equal(urls.length,2);assert.ok(urls[1].includes('gemini-3.7-flash'));assert.equal(result.items[0].id,'flat-white');
});
