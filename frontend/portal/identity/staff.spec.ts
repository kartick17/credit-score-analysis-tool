import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const values = Object.fromEntries(
  readFileSync(new URL("../../../infra/compose/.env", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => line.split("=")),
);
async function login(page: Page, username: string) {
  await page.goto("/customers");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect(page.url()).toContain("code_challenge_method=S256");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page
    .getByLabel("Password", { exact: true })
    .fill(values.STAFF_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

test("officer signs in, reaches all services and signs out", async ({
  page,
  request,
}) => {
  let bearer = "";
  page.on("request", (req) => {
    if (req.url().includes("/api/v1/customers/access"))
      bearer = req.headers()["authorization"] || "";
  });
  await page.goto("/sign-in");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await login(page, "officer-one");
  await expect(
    page.getByRole("heading", { name: "Access is ready" }),
  ).toBeVisible();
  await expect(page.getByText("BR-001", { exact: true }).last()).toBeVisible();
  expect(bearer.startsWith("Bearer ")).toBe(true);
  for (const [route, port] of [
    ["customers", 8081],
    ["assessments", 8082],
    ["reports", 8083],
  ] as const) {
    for (const target of [8080, port]) {
      const reply = await request.get(
        `http://127.0.0.1:${target}/api/v1/${route}/access`,
        {
          headers: {
            Authorization: bearer,
            "X-User-Id": "forged",
            "X-Branch-Id": "BR-002",
          },
        },
      );
      expect(reply.status()).toBe(200);
      expect(await reply.json()).toMatchObject({
        roles: ["OFFICER"],
        branchId: "BR-001",
        canRead: true,
      });
      expect(
        (
          await request.get(`http://127.0.0.1:${target}/api/v1/${route}`, {
            headers: { "X-User-Roles": "CREDIT_MANAGER" },
          })
        ).status(),
      ).toBe(401);
    }
  }
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `test-results/staff-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
  await page.goto("/customers");
  await expect(
    page.getByRole("heading", { name: "Access is ready" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("BR-001", { exact: true })).toHaveCount(0);
  await page.goto("/customers");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      [...Object.values(localStorage), ...Object.values(sessionStorage)].some(
        (value) =>
          value.includes("access_token") || value.includes("refresh_token"),
      ),
    ),
  ).toBe(false);
});

for (const [name, heading, branch] of [
  ["officer-two", "Access is ready", "BR-002"],
  ["manager-one", "Access is ready", "Across branches"],
  ["admin-one", "Access denied", ""],
] as const) {
  test(`${name} has its own access state`, async ({ page }) => {
    await login(page, name);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    if (branch)
      await expect(
        page.getByText(branch, { exact: true }).last(),
      ).toBeVisible();
    if (name === "manager-one")
      await expect(page.getByText("Read only", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Sample Customer 001", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
  });
}

test("staff client rejects password grants and foreign callbacks", async ({
  request,
}) => {
  const token = await request.post(
    "http://localhost:8180/realms/credit-risk/protocol/openid-connect/token",
    {
      form: {
        client_id: "credit-risk-portal",
        grant_type: "password",
        username: "officer-one",
        password: values.STAFF_PASSWORD,
      },
    },
  );
  expect(token.status()).toBe(400);
  const reply = await request.get(
    "http://localhost:8180/realms/credit-risk/protocol/openid-connect/auth",
    {
      params: {
        client_id: "credit-risk-portal",
        response_type: "code",
        scope: "openid",
        redirect_uri: "https://wrong.invalid/sign-in",
        code_challenge: "x".repeat(43),
        code_challenge_method: "S256",
      },
    },
  );
  expect(reply.status()).toBe(400);
});

test("service failure stays visible and retry restores the staff session", async ({
  page,
}) => {
  await login(page, "officer-one");
  await page.route("**/api/v1/customers/access", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Sign-in could not finish",
  );
  await expect(
    page.getByText("Sample Customer 001", { exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/v1/customers/access");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Access is ready" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
