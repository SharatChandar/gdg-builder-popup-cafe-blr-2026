import { test, expect } from "@playwright/test";
test("Gemini draft review, two 3D products and phone-login configuration state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Menu", exact: true })
    .click();
  await page.getByRole("button", { name: /A little help choosing/ }).click();
  await page.getByRole("button", { name: "Try sample draft" }).click();
  await expect(
    page.getByText("Sample draft — not generated from your input."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add reviewed items to cart" })
    .click();
  await expect(
    page.getByRole("button", { name: /View your order/ }),
  ).toBeVisible();
  for (const name of ["Flat white", "Iced oat latte"]) {
    await page
      .getByRole("button", { name: `Add ${name}`, exact: true })
      .click();
    await page.getByRole("button", { name: "Explore in 3D / AR" }).click();
    await expect(page.locator(".model-canvas canvas")).toBeVisible();
    await expect(page.getByText(/Illustrative model/)).toBeVisible();
    await page.getByRole("button", { name: "Reset view" }).click();
    await page.screenshot({
      path: `test-results/3d-${name.replaceAll(" ", "-")}.png`,
    });
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByRole("button", { name: "Your profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Your visits, together." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send verification code" }),
  ).toBeDisabled();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
test("AI provider and Firebase fail explicitly without credentials", async ({
  request,
}) => {
  await request.post("/api/session", { data: {} });
  expect(
    (
      await request.post("/api/ai/suggest", { data: { text: "A coffee" } })
    ).status(),
  ).toBe(503);
  expect(
    (
      await request.post("/api/auth/firebase", {
        data: { idToken: "unverified" },
      })
    ).status(),
  ).toBe(503);
  const r = await request.post("/api/ai/suggest", {
    data: { media: { mimeType: "text/html", data: "YWJj" } },
  });
  expect(r.status()).toBe(400);
});
