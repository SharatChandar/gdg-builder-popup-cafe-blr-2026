import { test, expect } from "@playwright/test";

test("coffee runner opens from the footer and responds to keyboard controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play the coffee break game" })
    .click();
  const dialog = page.getByRole("dialog", { name: "The coffee run" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ready to roll?")).toBeVisible();
  await dialog.getByRole("button", { name: "Start run" }).click();
  await page.keyboard.press("Space");
  await expect(dialog.locator("canvas")).toBeVisible();
  await expect
    .poll(async () =>
      Number(
        await dialog
          .locator(".coffee-runner-scores strong")
          .first()
          .textContent(),
      ),
    )
    .toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("coffee runner can start and jump on a touch screen", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Play the coffee break game" }).tap();
  const dialog = page.getByRole("dialog", { name: "The coffee run" });
  await dialog.locator("canvas").tap();
  await expect(dialog.getByRole("button", { name: "Jump" })).toBeVisible();
  await dialog.getByRole("button", { name: "Jump" }).tap();
  await expect
    .poll(async () =>
      Number(
        await dialog
          .locator(".coffee-runner-scores strong")
          .first()
          .textContent(),
      ),
    )
    .toBeGreaterThan(0);
  await context.close();
});
