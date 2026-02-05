import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /get paid faster/i })
  ).toBeVisible();
});

test("login page loads", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /stay on top of overdue invoices/i })
  ).toBeVisible();
});
