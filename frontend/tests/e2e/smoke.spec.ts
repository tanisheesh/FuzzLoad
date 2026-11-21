import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/dashboard", "/playground", "/how-it-works"];

test.describe("smoke, layout, and accessibility", () => {
  for (const route of ROUTES) {
    test(`renders ${route} cleanly without errors or overflow`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const serverErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (err) => {
        pageErrors.push(err.message);
      });
      page.on("response", (res) => {
        if (res.status() >= 500) {
          serverErrors.push(`${res.status()} ${res.url()}`);
        }
      });

      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response).not.toBeNull();
      expect(response?.status()).toBeLessThan(400);

      // Wait briefly for client hydration & charts to settle
      await page.waitForTimeout(400);

      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      const a11y = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const severe = a11y.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(severe).toEqual([]);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(serverErrors).toEqual([]);
    });
  }
});
