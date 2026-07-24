import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { resetDemo } from "./helpers";

const pages = [
  ["/dashboard", "Job profitability dashboard"],
  ["/upload", "Upload transactions"],
  ["/transactions", "Transactions"],
  ["/jobs", "Jobs"],
  ["/reports", "Profitability reports"],
  ["/settings", "Settings & integrations"],
] as const;

test.describe("cross-browser smoke and accessibility", () => {
  test.beforeEach(async ({ request }) => resetDemo(request));
  test.afterEach(async ({ request }) => resetDemo(request));

  for (const [path, heading] of pages) {
    test(`${path} renders without accessibility or runtime failures`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedRequests: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      expect(
        accessibility.violations,
        accessibility.violations.map(({ id, help }) => `${id}: ${help}`).join("\n"),
      ).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(failedRequests).toEqual([]);
    });
  }

  test("application controls expose a visible focus indicator", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator(".focus-ring").first().focus();
    const focus = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      const style = element ? getComputedStyle(element) : null;
      return {
        tag: element?.tagName ?? "",
        visibleFocus: Boolean(style && (style.boxShadow !== "none" || style.outlineStyle !== "none")),
      };
    });

    expect(focus.tag).not.toBe("BODY");
    expect(focus.visibleFocus).toBe(true);
  });
});
