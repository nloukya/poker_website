import { test, expect } from "@playwright/test";

for (const failure of [
  {
    status: 401,
    error: { message: "Invalid API key" },
    message: "connection key",
  },
  { status: 404, error: { code: "PGRST205" }, message: "hasn’t been set up" },
  { status: 406, error: { code: "PGRST116" }, message: "empty or hidden" },
]) {
  test(`shared loading explains HTTP ${failure.status} instead of blaming every failure on public-view SQL`, async ({
    page,
  }) => {
    await page.route("https://shared-table.test/rest/v1/**", (route) =>
      route.fulfill({ status: failure.status, json: failure.error }),
    );
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText(failure.message);
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible();
  });
}

test("a stalled shared request times out and retry can recover", async ({
  page,
}) => {
  await page.clock.install();
  let requests = 0;
  await page.route("https://shared-table.test/rest/v1/**", async (route) => {
    requests++;
    if (requests === 1) return; // Leave the first response pending until the client aborts.
    return route.fulfill({
      json: {
        revision: 0,
        clip_manifest: [],
        payload: {
          version: 1,
          currency: "INR",
          players: [],
          sessions: [],
          demo: false,
        },
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Loading shared table");
  await page.clock.fastForward(12001);
  await expect(page.getByRole("alert")).toContainText("took too long");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
});

test("public viewing loads while an expired editor session is waiting to refresh", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "sb-shared-table-auth-token",
      JSON.stringify({
        access_token: "expired.fixture.token",
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_at: 1,
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "friend@example.com",
          app_metadata: {},
          user_metadata: {},
        },
      }),
    );
  });
  let refreshRequests = 0;
  await page.route("https://shared-table.test/auth/v1/token**", () => {
    refreshRequests++;
  });
  await page.route("https://shared-table.test/rest/v1/**", (route) =>
    route.fulfill({
      json: {
        revision: 0,
        clip_manifest: [],
        payload: {
          version: 1,
          currency: "INR",
          players: [],
          sessions: [],
          demo: false,
        },
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  expect(refreshRequests).toBeGreaterThan(0);
});

test("an overloaded database receives slower automatic retries while manual retry stays available", async ({
  page,
}) => {
  await page.clock.install();
  let requests = 0;
  let overloaded = true;
  await page.route("https://shared-table.test/rest/v1/**", (route) => {
    requests++;
    if (overloaded)
      return route.fulfill({ status: 503, json: { message: "Unavailable" } });
    return route.fulfill({
      json: {
        revision: 0,
        clip_manifest: [],
        payload: {
          version: 1,
          currency: "INR",
          players: [],
          sessions: [],
          demo: false,
        },
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  expect(requests).toBe(1);
  await page.clock.fastForward(15000);
  expect(requests).toBe(1);
  await page.clock.fastForward(60001);
  await expect.poll(() => requests).toBe(2);
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await page.clock.fastForward(30000);
  expect(requests).toBe(2);
  overloaded = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(3);
  await page.clock.fastForward(60001);
  await expect.poll(() => requests).toBe(4);
});
