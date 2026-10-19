import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const fixture = new URL("../fixtures/highlight.webm", import.meta.url);

test("session views share one snapshot and unchanged minute polls fetch only the revision", async ({
  page,
}) => {
  await page.clock.install();
  const selections = [];
  const state = {
    revision: 0,
    clip_manifest: [],
    payload: {
      version: 1,
      currency: "INR",
      demo: false,
      players: [
        { id: "p1", name: "Alex", tagline: "" },
        { id: "p2", name: "Sam", tagline: "" },
      ],
      sessions: [
        {
          id: "s1",
          title: "Friday",
          date: "2026-10-19",
          results: [
            { playerId: "p1", buyIn: 100, cashOut: 150 },
            { playerId: "p2", buyIn: 100, cashOut: 50 },
          ],
        },
      ],
    },
  };
  await page.route("https://shared-table.test/rest/v1/**", (route) => {
    const columns = new URL(route.request().url()).searchParams.get("select");
    selections.push(columns);
    return route.fulfill({
      json:
        columns === "revision"
          ? { revision: state.revision }
          : structuredClone(state),
    });
  });
  await page.goto("/#sessions");
  await expect(
    page.getByRole("button", { name: "View Friday", exact: true }),
  ).toBeVisible();
  expect(selections).toEqual(["payload,revision,clip_manifest"]);
  await page.getByRole("button", { name: "View Friday", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("No videos");
  expect(selections).toHaveLength(1);
  await page.clock.fastForward(60001);
  await expect.poll(() => selections.length).toBe(2);
  expect(selections[1]).toBe("revision");
  // A change on another phone is picked up by the central poll and published
  // to the already-open session without a separate video metadata request.
  state.revision = 1;
  state.clip_manifest.push({
    id: "c1",
    sessionId: "s1",
    name: "round.webm",
    type: "video/webm",
    size: 1024,
    createdAt: 1,
    path: "round.webm",
  });
  await page.route("https://shared-table.test/storage/v1/**", async (route) =>
    route.fulfill({ body: await readFile(fixture), contentType: "video/webm" }),
  );
  await page.clock.fastForward(60001);
  await expect(page.getByRole("dialog")).toContainText(
    "Shared with your table",
  );
  await expect(page.locator("video")).toHaveAttribute("src", /^blob:/);
  expect(selections).toEqual([
    "payload,revision,clip_manifest",
    "revision",
    "revision",
    "payload,revision,clip_manifest",
  ]);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "1 highlight", exact: true }).click();
  await expect(page.locator(".row-highlights video")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  expect(selections).toHaveLength(4);
});
