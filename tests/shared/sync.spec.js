import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const fixture = new URL("../fixtures/highlight.webm", import.meta.url);

async function backend(browser) {
  let state = {
    revision: 0,
    clip_manifest: [],
    payload: {
      version: 1,
      currency: "INR",
      demo: false,
      players: [
        { id: "p1", name: "Alex", tagline: "", photo: "/players/01.png" },
        { id: "p2", name: "Sam", tagline: "" },
      ],
      sessions: [
        {
          id: "s1",
          title: "Friday",
          date: "2026-10-19",
          notes: "",
          results: [
            { playerId: "p1", buyIn: 100, cashOut: 150 },
            { playerId: "p2", buyIn: 100, cashOut: 50 },
          ],
        },
      ],
    },
  };
  const files = new Map();
  const pages = [];
  let failWrites = false;
  let loseReply = false;
  async function phone(viewport = { width: 390, height: 844 }) {
    const context = await browser.newContext({ viewport });
    await context.route("https://shared-table.test/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const json = (body, status = 200) =>
        route.fulfill({ status, json: body });
      if (url.pathname === "/auth/v1/token") {
        return json({
          access_token: "header.payload.signature",
          token_type: "bearer",
          refresh_token: "fixture-refresh",
          expires_in: 3600,
          user: {
            id: "00000000-0000-0000-0000-000000000001",
            email: "friend@example.com",
            aud: "authenticated",
            role: "authenticated",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        });
      }
      if (url.pathname === "/auth/v1/logout") return json({});
      if (url.pathname === "/rest/v1/club_state")
        return json(structuredClone(state));
      if (url.pathname === "/rest/v1/rpc/save_club_state") {
        const args = request.postDataJSON();
        if (failWrites)
          return json({ message: "Offline", code: "NETWORK_ERROR" }, 503);
        if (args.expected_revision !== state.revision)
          return json({ message: "TABLE_CHANGED", code: "40001" }, 409);
        state = {
          revision: state.revision + 1,
          payload: args.new_payload,
          clip_manifest: state.clip_manifest
            .filter(
              (c) =>
                args.new_payload.sessions.some((s) => s.id === c.sessionId) &&
                !(
                  c.sessionId === args.clip_session &&
                  args.removed_clip_ids.includes(c.id)
                ),
            )
            .concat(args.new_clips),
        };
        if (loseReply) return route.abort("failed");
        return json(structuredClone(state));
      }
      const prefix = "/storage/v1/object/highlights/";
      if (url.pathname.startsWith(prefix)) {
        const path = url.pathname.slice(prefix.length);
        if (request.method() === "POST") {
          files.set(path, request.postDataBuffer());
          return json({ Key: path });
        }
        if (request.method() === "GET")
          return route.fulfill({
            body: await readFile(fixture),
            contentType: "video/webm",
          });
      }
      const authPrefix = "/storage/v1/object/authenticated/highlights/";
      if (url.pathname.startsWith(authPrefix))
        return route.fulfill({
          body: await readFile(fixture),
          contentType: "video/webm",
        });
      if (
        request.method() === "DELETE" &&
        url.pathname === "/storage/v1/object/highlights"
      ) {
        for (const path of request.postDataJSON().prefixes) files.delete(path);
        return json([]);
      }
      throw new Error(
        `Unexpected fixture request: ${request.method()} ${url.pathname}`,
      );
    });
    const page = await context.newPage();
    pages.push(page);
    await page.goto("/#players");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill("friend@example.com");
    await page.getByLabel("Password", { exact: true }).fill("fixture-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".trading-card")).toHaveCount(2);
    return page;
  }
  return {
    phone,
    state: () => state,
    files,
    loseReply: (value) => { loseReply = value; },
    fail: (value) => {
      failWrites = value;
    },
    close: async () => {
      for (const page of pages) await page.context().close();
    },
  };
}

const edit = async (page) => {
  await page.getByRole("button", { name: "Edit tagline for Alex" }).click();
  return page.getByRole("dialog");
};
const refresh = (page) =>
  page.evaluate(() => window.dispatchEvent(new Event("focus")));

test("two phones share records; stale forms and failed writes cannot overwrite saved results", async ({
  browser,
}) => {
  const table = await backend(browser);
  try {
    const a = await table.phone();
    const b = await table.phone();
    const stale = await edit(b);
    await stale.getByPlaceholder("Add a tagline").fill("Stale edit");
    const form = await edit(a);
    await form.getByPlaceholder("Add a tagline").fill("Shared tagline");
    await form
      .getByRole("button", { name: "Save player", exact: true })
      .click();
    await expect(form).not.toBeVisible();
    expect(table.state().payload.players[0].tagline).toBe("Shared tagline");
    await stale
      .getByRole("button", { name: "Save player", exact: true })
      .click();
    await expect(stale.getByRole("alert")).toContainText(
      "changed on another phone",
    );
    expect(table.state().payload.players[0].tagline).toBe("Shared tagline");
    await stale.getByRole("button", { name: "Cancel", exact: true }).click();
    await refresh(b);
    await expect(b.locator(".trading-card").first()).toContainText(
      "Shared tagline",
    );
    const retryForm = await edit(b);
    await retryForm.getByPlaceholder("Add a tagline").fill("Should fail");
    table.fail(true);
    await retryForm
      .getByRole("button", { name: "Save player", exact: true })
      .click();
    await expect(retryForm.getByRole("alert")).toContainText("Couldn’t save");
    expect(table.state().payload.players[0].tagline).toBe("Shared tagline");
    await retryForm
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(b.locator(".trading-card").first()).toContainText(
      "Shared tagline",
    );
    expect(
      await b.evaluate(() => localStorage.getItem("poker-face-v1")),
    ).toBeNull();
    expect(
      await b.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await b.getByRole("button", { name: "Settings", exact: true }).click();
    await b.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      b.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
  } finally {
    await table.close();
  }
});

test("shared session videos upload with results and are available on a second phone", async ({
  browser,
}) => {
  const table = await backend(browser);
  try {
    const a = await table.phone({ width: 1440, height: 1000 });
    const b = await table.phone({ width: 1440, height: 1000 });
    await a.goto("/#sessions");
    await a.getByRole("button", { name: /Edit Friday/ }).click();
    const form = a.getByRole("dialog");
    await form.locator('input[type="file"]').setInputFiles(fixture.pathname);
    await form
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(form).not.toBeVisible();
    expect(table.state().clip_manifest).toHaveLength(1);
    expect(table.files.size).toBe(1);
    await b.goto("/#sessions");
    await b.getByRole("button", { name: /View Friday/ }).click();
    await expect(b.getByRole("dialog")).toContainText("Shared with your table");
    await expect(b.locator("video")).toHaveAttribute("src", /^blob:/);
  } finally {
    await table.close();
  }
});


test("a lost save response does not delete a video already committed to the shared table", async ({ browser }) => {
  const table = await backend(browser);
  try {
    const a = await table.phone({ width: 1440, height: 1000 });
    await a.goto("/#sessions");
    await a.getByRole("button", { name: "Edit Friday", exact: true }).click();
    const form = a.getByRole("dialog");
    await form.locator('input[type="file"]').setInputFiles(fixture.pathname);
    table.loseReply(true);
    await form.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Couldn’t save");
    expect(table.state().clip_manifest).toHaveLength(1);
    expect(table.files.has(table.state().clip_manifest[0].path)).toBe(true);
    await form.getByRole("button", { name: "Cancel", exact: true }).click();
    await refresh(a);
    await a.getByRole("button", { name: "View Friday", exact: true }).click();
    await expect(a.locator("video")).toHaveAttribute("src", /^blob:/);
  } finally { await table.close(); }
});
