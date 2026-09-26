import { test, expect } from "@playwright/test";
test("mobile guest orders, splits, pays and staff completes service", async ({
  browser,
}) => {
  const guest = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await guest.newPage();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hello, coffee person." }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.locator("img").evaluateAll(async (images) => {
    for (const img of images) img.loading = "eager";
    await Promise.all(images.map((img) => img.decode()));
  });
  await page.screenshot({
    path: "test-results/mobile-home.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Seats", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Table 1, available, 2 seats", exact: true })
    .click();
  await page.getByRole("button", { name: "Request for 2 people" }).click();
  await expect(
    page.getByText("Waiting for staff confirmation", { exact: false }),
  ).toBeVisible();
  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await staffPage.goto("/staff");
  await staffPage.getByLabel("Staff PIN").fill("2468");
  await staffPage.getByRole("button", { name: "Open staff space" }).click();
  await staffPage.getByRole("button", { name: "Tables", exact: true }).click();
  await staffPage
    .locator(".staff-table")
    .filter({
      has: staffPage.getByRole("heading", { name: "T01", exact: true }),
    })
    .getByRole("button", { name: "Confirm seating" })
    .click();
  await expect(
    page.getByText("Your table", { exact: false }).first(),
  ).toBeVisible({ timeout: 12000 });
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Menu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Flat white", exact: true })
    .click();
  await page.getByRole("button", { name: /Add to order ·/ }).click();
  await page.getByRole("button", { name: /View your order/ }).click();
  await page.getByLabel("Name for your order", { exact: true }).fill("Alex");
  await page.getByRole("button", { name: /Place order ·/ }).click();
  await expect(
    page.getByRole("heading", { name: "Order received", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Split with friends" }).click();
  await page.getByLabel("Person 2 name").fill("Sam");
  await page.getByLabel("Person 2 phone").fill("+919876543210");
  await page.getByRole("button", { name: "Save split" }).click();
  await expect(page.getByText("Review payment invitations")).toBeVisible();
  await page.getByRole("button", { name: "Preview SMS invitations" }).click();
  await expect(
    page.getByText("Demo invitations prepared. No SMS was sent."),
  ).toBeVisible();
  const links = await page
    .locator(".invite-review a")
    .evaluateAll((els) => els.map((e) => e.href));
  expect(links).toHaveLength(2);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  for (const link of links) {
    const pay = await guest.newPage();
    await pay.goto(link);
    await pay.getByRole("button", { name: "Simulate payment" }).click();
    await expect(
      pay.getByRole("heading", { name: "All settled." }),
    ).toBeVisible();
    await pay.close();
  }
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible({
    timeout: 12000,
  });
  await staffPage.getByRole("button", { name: "Orders", exact: true }).click();
  await staffPage.getByRole("button", { name: "Start preparing" }).click();
  await staffPage.getByRole("button", { name: "Mark ready" }).click();
  await staffPage.getByRole("button", { name: "Mark served" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Seats", exact: true })
    .click();
  await page.getByRole("button", { name: "I’m leaving" }).click();
  await expect(
    page.getByRole("button", {
      name: "Table 1, cleaning, 2 seats",
      exact: true,
    }),
  ).toBeVisible();
  await guest.close();
  await staff.close();
});
test("API rejects unauthenticated staff access, forged prices and foreign origins", async ({
  request,
}) => {
  expect((await request.get("/api/staff")).status()).toBe(401);
  expect(
    (
      await request.post("/api/session", {
        headers: { Origin: "https://other.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await request.post("/api/session", { data: {} });
  const payload = {
    requestId: "integration-idempotency",
    service: "takeaway",
    name: "Test guest",
    items: [{ id: "flat-white", quantity: 1, price: 1 }],
  };
  const a = await request.post("/api/orders", { data: payload });
  expect(a.status()).toBe(200);
  const order = await a.json();
  expect(order.total).toBe(23100);
  const b = await request.post("/api/orders", { data: payload });
  expect((await b.json()).id).toBe(order.id);
});

test("guest data and payment links remain scoped", async ({ playwright }) => {
  const a = await playwright.request.newContext({
    baseURL: "http://localhost:8082",
  });
  const b = await playwright.request.newContext({
    baseURL: "http://localhost:8082",
  });
  await a.post("/api/session", { data: {} });
  await b.post("/api/session", { data: {} });
  const order = await (
    await a.post("/api/orders", {
      data: {
        requestId: "privacy-order",
        service: "takeaway",
        name: "Private guest",
        items: [{ id: "croissant", quantity: 1 }],
      },
    })
  ).json();
  const state = await (await b.get("/api/state")).json();
  expect(state.orders).toHaveLength(0);
  expect(state.bills).toHaveLength(0);
  expect(
    (
      await b.post(`/api/bills/${order.billId}/split`, {
        data: { mode: "equal", participants: [{ name: "Attacker" }] },
      })
    ).status(),
  ).toBe(404);
  expect((await a.get("/api/pay/forged-token")).status()).toBe(404);
  await a.dispose();
  await b.dispose();
});
test("desktop screens fit and images load", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hello, coffee person." }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 1440);
  await page.locator(".feature-image").evaluate((img) => img.decode());
  await page.screenshot({
    path: "test-results/desktop-home.png",
    fullPage: true,
  });
});
