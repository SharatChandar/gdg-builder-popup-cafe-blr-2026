import { test, expect } from "@playwright/test";

test("all menu items open 3D previews with an AR capability fallback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Menu", exact: true })
    .click();
  for (const name of [
    "Flat white",
    "Iced oat latte",
    "Cappuccino",
    "Slow-steeped cold brew",
    "Butter croissant",
    "Almond croissant",
    "Avocado on sourdough",
    "Eggs on toast",
    "Matcha latte",
    "House masala chai",
  ]) {
    await page
      .getByRole("button", { name: `Add ${name}`, exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name });
    await dialog.getByRole("button", { name: "Explore in 3D / AR" }).click();
    await expect(dialog.locator(".model-canvas canvas")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "View in your space (AR)" }),
    ).toBeDisabled();
    await expect(
      dialog.getByText("AR needs a compatible WebXR device and HTTPS.", {
        exact: false,
      }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
  }
});

test("AR launch requests surface detection and reports device rejection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "xr", {
      configurable: true,
      value: {
        isSessionSupported: async () => true,
        requestSession: async (mode, options) => {
          window.arRequest = {
            mode,
            requiredFeatures: options.requiredFeatures,
          };
          throw new Error("No AR camera available in this test browser");
        },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Add Flat white" }).click();
  const dialog = page.getByRole("dialog", { name: "Flat white" });
  await dialog.getByRole("button", { name: "Explore in 3D / AR" }).click();
  const launch = dialog.getByRole("button", {
    name: "View in your space (AR)",
  });
  await expect(launch).toBeEnabled();
  await launch.click();
  await expect
    .poll(() => page.evaluate(() => window.arRequest))
    .toEqual({
      mode: "immersive-ar",
      requiredFeatures: ["hit-test"],
    });
  await expect(
    dialog.getByText(
      "AR could not start. Please try again or use the 3D preview.",
    ),
  ).toBeVisible();
  await expect(page.locator(".ar-overlay")).toHaveCount(0);
});

test("a lost 3D graphics context shows a recoverable message", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add Flat white" }).click();
  const dialog = page.getByRole("dialog", { name: "Flat white" });
  await dialog.getByRole("button", { name: "Explore in 3D / AR" }).click();
  await dialog
    .locator("canvas")
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
    );
  await expect(
    dialog.getByText(
      "3D graphics stopped on this device. Close this item and try again.",
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});
