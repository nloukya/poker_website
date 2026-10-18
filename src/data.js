export const STORAGE_KEY = "poker-face-v1";

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function createSeed() {
  const players = [
    {
      id: "rohan",
      name: "Rohan Mehta",
      tagline: "",
      photo: "/players/01.png",
      color: "#a9c4a1",
    },
    {
      id: "ananya",
      name: "Ananya Rao",
      tagline: "",
      photo: "/players/02.png",
      color: "#d7b195",
    },
    {
      id: "arjun",
      name: "Arjun Shah",
      tagline: "",
      photo: "/players/03.png",
      color: "#b4add3",
    },
    {
      id: "priya",
      name: "Priya Nair",
      tagline: "",
      photo: "/players/04.png",
      color: "#c6b880",
    },
    {
      id: "kabir",
      name: "Kabir Sethi",
      tagline: "",
      photo: "/players/05.png",
      color: "#99bac3",
    },
    {
      id: "vikram",
      name: "Vikram Singh",
      tagline: "",
      photo: "/players/06.png",
      color: "#c4a297",
    },
  ];
  const outcomes = [
    [1200, 500, -300, 200, -600, -1000],
    [800, -200, 600, -400, -500, -300],
    [-600, 1400, -500, 800, -400, -700],
    [1800, 600, -800, -200, 100, -1500],
    [400, -300, 1200, -500, -600, -200],
    [2200, 500, -700, 300, -1300, -1000],
    [-500, 1800, 400, -200, -600, -900],
    [1600, -400, 700, -300, -500, -1100],
  ];
  const sessions = outcomes.map((profits, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (7 - i) * 4 - 1);
    return {
      id: `session-${i}`,
      title: `Session ${String(i + 1).padStart(2, "0")}`,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      notes: "",
      results: players.map((p, j) => ({
        playerId: p.id,
        buyIn: 2000,
        cashOut: 2000 + profits[j],
      })),
    };
  });
  return { version: 1, players, sessions, currency: "INR", demo: true };
}

export function inPeriod(date, period, now = new Date()) {
  if (period === "all") return true;
  const d = new Date(`${date}T12:00:00`);
  if (period === "month")
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  if (period === "year") return d.getFullYear() === now.getFullYear();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - 29);
  return d >= start && d <= now;
}

export function getStandings(players, sessions) {
  return players
    .map((player) => {
      let profit = 0,
        played = 0,
        wins = 0,
        best = 0;
      const history = [];
      [...sessions]
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach((session) => {
          const result = session.results.find((r) => r.playerId === player.id);
          if (!result) return;
          const net =
            (Math.round(result.cashOut * 100) -
              Math.round(result.buyIn * 100)) /
            100;
          profit = Math.round((profit + net) * 100) / 100;
          played++;
          if (net > 0) wins++;
          best = Math.max(best, net);
          history.push({ date: session.date, net, total: profit });
        });
      return {
        ...player,
        profit,
        played,
        wins,
        best,
        history,
        recentProfit: history.length ? history.at(-1).net : null,
        lastPlayed: history.at(-1)?.date || null,
        winRate: played ? Math.round((wins / played) * 100) : 0,
        average: played ? Math.round((profit / played) * 100) / 100 : 0,
      };
    })
    .sort(
      (a, b) =>
        b.profit - a.profit || b.wins - a.wins || a.name.localeCompare(b.name),
    );
}

export function money(amount, currency = "INR", signed = false) {
  const formatted = new Intl.NumberFormat(
    currency === "INR" ? "en-IN" : "en-US",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(Math.abs(amount));
  return `${amount < 0 ? "−" : signed && amount > 0 ? "+" : ""}${formatted}`;
}

export function dateLabel(date, options = {}) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...options,
  });
}

export function validateSession(session) {
  if (!session.title.trim()) return "Enter a session name.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(session.date) ||
    Number.isNaN(new Date(session.date).getTime()) ||
    new Date(session.date).toISOString().slice(0, 10) !== session.date
  )
    return "Choose a valid session date.";
  if (session.results.length < 2) return "Select at least two players.";
  if (
    new Set(session.results.map((r) => r.playerId)).size !==
    session.results.length
  )
    return "Each player can appear only once.";
  if (
    session.results.some(
      (r) =>
        !Number.isFinite(r.buyIn) ||
        !Number.isFinite(r.cashOut) ||
        r.buyIn < 0 ||
        r.cashOut < 0,
    )
  )
    return "Buy-ins and cash-outs must be valid amounts of zero or more.";
  return "";
}

// Ranking always happens before searching, so filtering cannot turn #6 into #1.
export function rankStandings(standings, metric = "profit") {
  const allowed = ["profit", "played", "average"];
  const key = allowed.includes(metric) ? metric : "profit";
  return [...standings]
    .sort(
      (a, b) =>
        Number(b.played > 0) - Number(a.played > 0) ||
        (b[key] || 0) - (a[key] || 0) ||
        b.profit - a.profit ||
        a.name.localeCompare(b.name),
    )
    .map((player, index) => ({
      ...player,
      rank: player.played ? index + 1 : null,
    }));
}
