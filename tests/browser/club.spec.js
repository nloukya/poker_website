import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const fixture = fileURLToPath(
  new URL("../fixtures/highlight.webm", import.meta.url),
);
const saved = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("poker-face-v1")));
const storedKeys = (page, store = "clips") =>
  page.evaluate(
    (storeName) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("poker-face-highlights", 1);
        req.onsuccess = () => {
          const db = req.result;
          const request = db
            .transaction(storeName, "readonly")
            .objectStore(storeName)
            .getAllKeys();
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          request.onerror = () => reject(request.error);
        };
        req.onerror = () => reject(req.error);
      }),
    store,
  );

test("player cards use two columns, preserve old profiles, and display the last session result", async ({
  page,
}) => {
  await page.goto("/#players");
  await expect(page.locator(".trading-card")).toHaveCount(6);
  const cards = page.locator(".trading-card");
  const boxes = await cards.evaluateAll((els) =>
    els
      .slice(0, 3)
      .map((el) => ({
        x: el.getBoundingClientRect().x,
        y: el.getBoundingClientRect().y,
      })),
  );
  expect(boxes[0].y).toBe(boxes[1].y);
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
  expect(boxes[2].y).toBeGreaterThan(boxes[1].y);
  // An old exported profile must still show its weakness as the new worst enemy.
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("poker-face-v1"));
    data.players[0].strengths = "Reading the table";
    data.players[0].weaknesses = "Chasing the river";
    localStorage.setItem("poker-face-v1", JSON.stringify(data));
  });
  await page.reload();
  const search = page.getByRole("textbox", {
    name: "Search players and sessions",
  });
  await search.fill("Kabir");
  await expect(cards).toHaveCount(1);
  await expect(page.locator(".trading-rank strong")).toHaveText("#05");
  await search.fill("");
  const card = cards.first();
  await expect(card.locator(".trading-enemy")).toContainText(
    "Chasing the river",
  );
  await expect(card).not.toContainText("Strengths");
  await expect(card).not.toContainText("Weaknesses");
  await page
    .getByRole("button", { name: "Edit tagline for Rohan Mehta" })
    .click();
  await expect(page.getByRole("textbox", { name: /Strengths/ })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /Worst enemy/ })).toHaveValue(
    "Chasing the river",
  );
  await page
    .getByRole("textbox", { name: "Tagline" })
    .fill("All bluffs. No brakes.");
  await page
    .getByRole("textbox", { name: /Worst enemy/ })
    .fill("Losing the river");
  await page.getByRole("button", { name: "Save player", exact: true }).click();
  await page.reload();
  await expect(card).toContainText("All bluffs. No brakes.");
  await expect(card.locator(".trading-enemy")).toContainText(
    "Losing the river",
  );
  await expect(card.locator(".trading-total strong")).toHaveText("+₹6,900");
  await expect(card.locator(".trading-stats strong").first()).toHaveText(
    "+₹1,600",
  );
  await expect(card.locator(".trading-stats")).toContainText("Recent profits");
  await expect(card.locator(".trading-rank strong")).toHaveText("#01");
  await expect(page.getByLabel("Date range", { exact: true })).toHaveCount(0);
  expect((await saved(page)).players[0].strengths).toBe("Reading the table");
  expect((await saved(page)).players[0].worstEnemy).toBe("Losing the river");
  await page.getByLabel("Sort players", { exact: true }).selectOption("recent");
  await expect(cards.nth(1).locator("h2")).toHaveText("Arjun Shah");
  await expect(cards.nth(1).locator(".trading-rank strong")).toHaveText("#03");
  await page.getByRole("button", { name: "Add player", exact: true }).click();
  await page.getByRole("textbox", { name: /Player name/ }).fill("New player");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add player", exact: true })
    .click();
  const fresh = cards.filter({
    has: page.getByRole("heading", { name: "New player", exact: true }),
  });
  await expect(fresh.locator(".trading-stats strong").first()).toHaveText("—");
  await expect(fresh.locator(".trading-stats")).toContainText("No sessions");
});

test("podium and list follow total winnings, sessions played, and average winnings", async ({
  page,
}) => {
  const data = {
    version: 1,
    currency: "INR",
    demo: false,
    players: [
      { id: "a", name: "Ada", tagline: "Steady." },
      { id: "b", name: "Ben", tagline: "Here every night." },
      { id: "c", name: "Cam", tagline: "One great hand." },
    ],
    sessions: [
      {
        id: "1",
        title: "First game",
        date: "2026-10-01",
        results: [
          { playerId: "a", buyIn: 100, cashOut: 200 },
          { playerId: "b", buyIn: 100, cashOut: 0 },
        ],
      },
      {
        id: "2",
        title: "Second game",
        date: "2026-10-02",
        results: [
          { playerId: "a", buyIn: 100, cashOut: 100 },
          { playerId: "b", buyIn: 100, cashOut: 30 },
          { playerId: "c", buyIn: 100, cashOut: 170 },
        ],
      },
      {
        id: "3",
        title: "Third game",
        date: "2026-10-03",
        results: [{ playerId: "b", buyIn: 100, cashOut: 100 }],
      },
    ],
  };
  await page.addInitScript(
    (data) => localStorage.setItem("poker-face-v1", JSON.stringify(data)),
    data,
  );
  await page.goto("/#leaderboard");
  const top = page.locator(".podium-place-1 .podium-person>strong");
  await expect(top).toHaveText("Ada");
  await page
    .getByRole("button", { name: "Sessions played", exact: true })
    .click();
  await expect(top).toHaveText("Ben");
  await expect(page.locator(".rankings-table tbody tr").first()).toContainText(
    "Ben",
  );
  await page
    .getByRole("button", { name: "Average winnings", exact: true })
    .click();
  await expect(top).toHaveText("Cam");
  await expect(page.locator(".rankings-table tbody tr").first()).toContainText(
    "Cam",
  );
  await page
    .getByRole("textbox", { name: "Search players and sessions" })
    .fill("Ada");
  await expect(page.locator(".rankings-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".ranking-number")).toHaveText("#02");
});

test("session videos save only on edit submission, play, download, and clean up with the session", async ({
  page,
}) => {
  await page.goto("/#sessions");
  await expect(page.locator(".session-row-card")).toHaveCount(8);
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  await expect(
    page.getByRole("dialog").locator("input[type=file]"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const row = page.locator(".session-row-card").first();
  await row.locator(".row-edit").click();
  await page.getByLabel("Upload session videos").setInputFiles(fixture);
  await expect(page.locator(".new-clip")).toHaveCount(1);
  expect(await storedKeys(page)).toHaveLength(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await storedKeys(page)).toHaveLength(0);
  await row.locator(".row-edit").click();
  await page.getByLabel("Upload session videos").setInputFiles(fixture);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(row.locator(".highlight-chip")).toContainText("1 highlight");
  expect(await storedKeys(page)).toHaveLength(1);
  await page.reload();
  await row.locator(".highlight-chip").click();
  const video = row.locator("video");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((v) => v.readyState))
    .toBeGreaterThanOrEqual(1);
  await video.evaluate((v) => v.play());
  await expect
    .poll(() => video.evaluate((v) => v.currentTime))
    .toBeGreaterThan(0);
  await video.evaluate((v) => v.pause());
  const downloadPromise = page.waitForEvent("download");
  await row.getByRole("link", { name: "Download highlight.webm" }).click();
  const download = await downloadPromise;
  expect(await readFile(await download.path())).toEqual(
    await readFile(fixture),
  );
  await row.locator(".row-edit").click();
  await page
    .getByRole("button", { name: "Remove highlight.webm", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await storedKeys(page)).toHaveLength(1);
  await row.locator(".row-open").click();
  await page
    .getByRole("button", { name: "Delete session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete session", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(await storedKeys(page)).toHaveLength(0);
  expect(await storedKeys(page, "files")).toHaveLength(0);
  expect((await saved(page)).sessions).toHaveLength(7);
});

test("mobile navigation, cards, podium sorting, and session rows fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["players", "leaderboard", "sessions"]) {
    await page.goto(`/#${route}`);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Leaderboard", exact: true }).click();
  await page
    .getByRole("button", { name: "Average winnings", exact: true })
    .click();
  await expect(page.locator(".metric-switch .selected")).toHaveText(
    "Average winnings",
  );
});
