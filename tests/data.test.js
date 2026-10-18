import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSeed,
  getStandings,
  inPeriod,
  validateSession,
  money,
  rankStandings,
} from "../src/data.js";

test("each demo game balances, and standings preserve the sum of all results", () => {
  const data = createSeed();
  for (const s of data.sessions) {
    assert.equal(validateSession(s), "");
    assert.equal(
      s.results.reduce((sum, r) => sum + r.cashOut - r.buyIn, 0),
      0,
    );
  }
  const standings = getStandings(data.players, data.sessions);
  assert.equal(
    standings.reduce((sum, p) => sum + p.profit, 0),
    0,
  );
  assert.equal(standings[0].name, "Rohan Mehta");
  assert.equal(standings[0].profit, 6900);
  assert.ok(standings.every((p) => p.played === 8));
});

test("standings handle partial attendance, same-day sessions, and empty histories", () => {
  const players = [
    { id: "a", name: "Ada" },
    { id: "b", name: "Ben" },
    { id: "c", name: "Cam" },
  ];
  const sessions = [
    {
      date: "2026-10-02",
      results: [
        { playerId: "a", buyIn: 100, cashOut: 140 },
        { playerId: "b", buyIn: 100, cashOut: 60 },
      ],
    },
    {
      date: "2026-10-02",
      results: [
        { playerId: "a", buyIn: 100, cashOut: 80 },
        { playerId: "b", buyIn: 100, cashOut: 120 },
      ],
    },
  ];
  const standings = getStandings(players, sessions);
  assert.equal(standings[0].profit, 20);
  assert.equal(standings[0].winRate, 50);
  assert.deepEqual(
    standings[0].history.map((h) => h.total),
    [40, 20],
  );
  const cam = standings.find((p) => p.id === "c");
  assert.equal(cam.played, 0);
  assert.equal(cam.winRate, 0);
  assert.deepEqual(getStandings([], []), []);
});

test("date ranges respect month, year, and the last 30 calendar days", () => {
  const now = new Date("2026-10-19T23:00:00");
  assert.equal(inPeriod("2026-10-01", "month", now), true);
  assert.equal(inPeriod("2026-09-30", "month", now), false);
  assert.equal(inPeriod("2025-10-19", "year", now), false);
  assert.equal(inPeriod("2026-09-20", "30days", now), true);
  assert.equal(inPeriod("2026-09-19", "30days", now), false);
  assert.equal(inPeriod("2026-10-20", "30days", now), false);
  assert.equal(inPeriod("2000-01-01", "all", now), true);
});

test("session validation rejects missing, duplicate, and invalid results", () => {
  const valid = {
    title: "Home game",
    date: "2026-10-19",
    results: [
      { playerId: "a", buyIn: 20, cashOut: 40 },
      { playerId: "b", buyIn: 20, cashOut: 0 },
    ],
  };
  assert.equal(validateSession(valid), "");
  assert.ok(validateSession({ ...valid, title: " " }));
  assert.ok(validateSession({ ...valid, date: "not-a-date" }));
  assert.ok(validateSession({ ...valid, date: "2026-02-31" }));
  assert.ok(validateSession({ ...valid, results: valid.results.slice(0, 1) }));
  assert.ok(
    validateSession({
      ...valid,
      results: [valid.results[0], valid.results[0]],
    }),
  );
  assert.ok(
    validateSession({
      ...valid,
      results: [{ ...valid.results[0], buyIn: -1 }, valid.results[1]],
    }),
  );
  assert.ok(
    validateSession({
      ...valid,
      results: [{ ...valid.results[0], cashOut: NaN }, valid.results[1]],
    }),
  );
});

test("money formatting distinguishes profit, loss and zero across currencies", () => {
  assert.equal(money(1200, "INR", true), "+₹1,200");
  assert.equal(money(-1200, "USD", true), "−$1,200");
  assert.equal(money(0, "INR", true), "₹0");
  assert.equal(money(100, "EUR"), "€100");
  assert.equal(money(100.25, "INR"), "₹100.25");
});

test("fractional winnings accumulate without floating-point drift", () => {
  const players = [{ id: "a", name: "Ada" }];
  const sessions = Array.from({ length: 10 }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    results: [{ playerId: "a", buyIn: 0.2, cashOut: 0.3 }],
  }));
  const [player] = getStandings(players, sessions);
  assert.equal(player.profit, 1);
  assert.equal(player.best, 0.1);
  assert.equal(player.winRate, 100);
});

test("average winnings use sessions the player actually attended", () => {
  const players = [
    { id: "a", name: "Ada" },
    { id: "b", name: "Ben" },
    { id: "c", name: "Cam" },
  ];
  const sessions = [
    {
      date: "2026-10-01",
      results: [
        { playerId: "a", buyIn: 100, cashOut: 250 },
        { playerId: "b", buyIn: 100, cashOut: 50 },
      ],
    },
    {
      date: "2026-10-02",
      results: [{ playerId: "b", buyIn: 100, cashOut: 200 }],
    },
  ];
  const stats = getStandings(players, sessions);
  assert.equal(stats.find((p) => p.id === "a").average, 150);
  assert.equal(stats.find((p) => p.id === "b").average, 25);
  assert.equal(stats.find((p) => p.id === "c").average, 0);
});

test("leaderboard ranking changes with each metric, has stable ties, and leaves new players unranked", () => {
  const standings = [
    { id: "a", name: "Ada", played: 2, profit: 100, average: 50 },
    { id: "b", name: "Ben", played: 5, profit: 80, average: 16 },
    { id: "c", name: "Cam", played: 1, profit: 70, average: 70 },
    { id: "d", name: "Dee", played: 0, profit: 0, average: 0 },
    { id: "e", name: "Eli", played: 2, profit: -40, average: -20 },
  ];
  assert.deepEqual(
    rankStandings(standings, "profit")
      .slice(0, 3)
      .map((p) => p.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    rankStandings(standings, "played")
      .slice(0, 3)
      .map((p) => p.id),
    ["b", "a", "e"],
  );
  assert.deepEqual(
    rankStandings(standings, "average")
      .slice(0, 3)
      .map((p) => p.id),
    ["c", "a", "b"],
  );
  const ranked = rankStandings(standings, "profit");
  assert.equal(ranked.find((p) => p.id === "d").rank, null);
  assert.equal(ranked.find((p) => p.id === "e").rank, 4);
  assert.equal(ranked.filter((p) => p.id === "c")[0].rank, 3);
  assert.equal(standings[0].rank, undefined);
});

test("recent profits use the last session each player attended, including losses and zero", () => {
  const players = [
    { id: "a", name: "Ada" },
    { id: "b", name: "Ben" },
    { id: "c", name: "Cam" },
  ];
  const sessions = [
    {
      date: "2026-10-03",
      results: [{ playerId: "a", buyIn: 100, cashOut: 75 }],
    },
    {
      date: "2026-10-01",
      results: [{ playerId: "a", buyIn: 100, cashOut: 150 }],
    },
    {
      date: "2026-10-04",
      results: [{ playerId: "b", buyIn: 100, cashOut: 110 }],
    },
  ];
  const stats = getStandings(players, sessions);
  const ada = stats.find((p) => p.id === "a");
  assert.equal(ada.profit, 25);
  assert.equal(ada.recentProfit, -25);
  assert.equal(ada.lastPlayed, "2026-10-03");
  assert.equal(stats.find((p) => p.id === "b").recentProfit, 10);
  assert.equal(stats.find((p) => p.id === "c").recentProfit, null);
  assert.equal(stats.find((p) => p.id === "c").lastPlayed, null);
  const withAnotherSameDayGame = [
    ...sessions,
    {
      date: "2026-10-03",
      results: [{ playerId: "a", buyIn: 100, cashOut: 100 }],
    },
  ];
  assert.equal(
    getStandings(players, withAnotherSameDayGame).find((p) => p.id === "a")
      .recentProfit,
    0,
  );
});
