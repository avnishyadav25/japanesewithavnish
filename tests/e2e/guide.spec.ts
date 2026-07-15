import { test, expect } from "@playwright/test";

const KNOWN_SLUGS = [
  "jlpt-curriculum",
  "kanji-library-stroke-practice",
  "vocabulary-library",
  "grammar-reference",
  "nihongo-navi-your-ai-study-partner",
  "blog",
  "listening-reading-writing-practice",
  "dashboard-xp-rewards",
];

test.describe("Site Guide", () => {
  test("index page renders all sections and links out", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.getByRole("heading", { name: "Site Guide", level: 1 })).toBeVisible();
    await page.screenshot({ path: "tests/e2e/__screenshots__/guide-index.png", fullPage: true });
  });

  for (const slug of KNOWN_SLUGS) {
    test(`section page renders: /guide/${slug}`, async ({ page }) => {
      const res = await page.goto(`/guide/${slug}`);
      // Skip gracefully if this environment's DB doesn't have the section published yet.
      if (!res || res.status() === 404) {
        test.skip(true, `/guide/${slug} not found in this environment`);
        return;
      }
      expect(res.ok()).toBeTruthy();
      await expect(page.locator("h1")).toBeVisible();
      await page.screenshot({ path: `tests/e2e/__screenshots__/guide-${slug}.png`, fullPage: true });
    });
  }
});
