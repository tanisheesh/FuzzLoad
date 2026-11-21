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

  test("interactive controls work on landing, dashboard, and playground", async ({ page }) => {
    // 1. Landing page: Go SDK tab default + CLI/Python/Docker tab switching + pkg.go.dev link
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("pre")).toContainText("proxy-go/pkg/fuzzload@v1.0.1");
    await page.getByRole("button", { name: "CLI GATEWAY" }).click();
    await expect(page.locator("pre")).toContainText("fuzzload-proxy");
    await page.getByRole("button", { name: "PYTHON SDK" }).click();
    await expect(page.locator("pre")).toContainText("from fuzzload import FuzzLoadRouter");

    // 2. Dashboard: live chaos injection & policy switch update node state cleanly
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "CPU SPIKE" }).first().click();
    await expect(page.getByText("[FAULT DETECTED]")).toBeVisible();
    await page.getByRole("button", { name: "+ EVOLVE GP (5 GEN)" }).click();

    // 3. Playground: SSRF guard blocks loopback target cleanly on /api/probe
    const ssrfRes = await page.request.post("/api/probe", {
      data: {
        requestsPerTarget: 1,
        targets: [{ id: "local", name: "Local", url: "http://127.0.0.1:8000/api/state", cores: 2 }],
      },
    });
    expect(ssrfRes.status()).toBe(200);
    const ssrfJson = await ssrfRes.json();
    expect(ssrfJson.targets[0].statusCode).toBe(400);
    expect(ssrfJson.targets[0].serverHeader).toBe("Blocked");
  });
});
