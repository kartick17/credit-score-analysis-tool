import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [360, 768, 1440])
  test(`shell is accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/customers");
    await expect(
      page.getByText("Mock mode · Synthetic data only"),
    ).toBeVisible();
    await expect(
      page.getByText("Sample Customer 001", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `test-results/shell-${width}.png`,
      fullPage: true,
    });
    if (width < 1024) {
      const trigger = page.getByRole("button", { name: "Open navigation" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await trigger.click();
      await page
        .getByRole("dialog")
        .getByRole("link", { name: "Assessments", exact: true })
        .click();
    } else {
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "Assessments", exact: true })
        .click();
    }
    await expect(
      page.getByRole("heading", { name: "Assessments", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Assessments", exact: true }),
    ).toBeVisible();
  });
test("search, empty, error, retry, forbidden and pagination work", async ({
  page,
}) => {
  await page.goto("/customers");
  await expect(
    page.getByText("Sample Customer 001", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(
    page.getByText("Sample Customer 021", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search customers").fill("DEMO-003");
  await expect(
    page.getByText("Sample Customer 003", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Preview states").selectOption("empty");
  await expect(page.getByText("No customers found")).toBeVisible();
  await page.getByLabel("Preview states").selectOption("error");
  await expect(page.getByRole("alert")).toContainText(
    "Customers could not be loaded",
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Preview states").selectOption("forbidden");
  await expect(page.getByRole("alert")).toContainText("Access denied");
  await page.getByLabel("Preview states").selectOption("slow");
  await expect(page.getByText("Loading synthetic customers…")).toBeVisible();
  await expect(
    page.getByText("Sample Customer 003", { exact: true }),
  ).toBeVisible();
});

test("API mode requires sign-in and never shows sample records", async ({
  page,
}) => {
  await page.route("**/realms/credit-risk/**", (route) => route.abort());
  await page.goto("http://127.0.0.1:5174/customers");
  await expect(
    page.getByRole("heading", { name: "Credit Risk Assessment Platform" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sample Customer 001", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Preview states")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(
    "Sign-in could not finish",
  );
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length,
    ),
  ).toBe(0);
});
