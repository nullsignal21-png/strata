import { expect, test } from "@playwright/test";
import { resetDemo } from "./helpers";

const viewports = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

test.describe("responsive layout", () => {
  test.beforeEach(async ({ request }) => resetDemo(request));
  test.afterEach(async ({ request }) => resetDemo(request));

  test("navigation and primary pages avoid viewport overflow at required sizes", async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const path of ["/dashboard", "/upload", "/transactions", "/jobs", "/reports", "/settings"]) {
        await page.goto(path);
        await expect(page.locator("main")).toBeVisible();
        const overflow = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.body.clientWidth,
        }));
        expect(overflow.document, `${path} at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(1);
        expect(overflow.body, `${path} at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(1);
      }

      if (viewport.width < 1024) {
        await page.goto("/dashboard");
        const menu = page.getByRole("button", { name: "Open navigation" });
        const box = await menu.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
        await menu.click();
        await expect(page.locator("header").getByRole("link", { name: "Reports" })).toBeVisible();
      } else {
        await page.goto("/dashboard");
        await expect(page.locator("aside").getByRole("link", { name: "Reports" })).toBeVisible();
      }
    }
  });
});
