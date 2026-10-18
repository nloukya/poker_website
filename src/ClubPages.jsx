import React, { useMemo, useState } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  Trophy,
  Pencil,
  CalendarDays,
  Users,
  Wallet,
  Play,
  ChevronRight,
  TrendingUp,
  Zap,
  Target,
  Search,
  X,
  Crown,
} from "lucide-react";
import { getStandings, rankStandings, dateLabel } from "./data";
import { Avatar, PeriodSelect, periods } from "./ui";
import { SessionHighlights, useClipLibrary } from "./SessionMedia";

const cx = (...classes) => classes.filter(Boolean).join(" ");

export function Players({ data, query, fmt, setModal }) {
  const [sort, setSort] = useState("rank");
  const lifetime = useMemo(
    () => rankStandings(getStandings(data.players, data.sessions)),
    [data.players, data.sessions],
  );
  const players = lifetime
    .filter((p) =>
      `${p.name} ${p.tagline} ${p.worstEnemy ?? p.weaknesses ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "sessions"
          ? b.played - a.played || b.profit - a.profit
          : sort === "recent"
            ? Number(a.recentProfit === null) -
                Number(b.recentProfit === null) ||
              (b.recentProfit ?? 0) - (a.recentProfit ?? 0)
            : (a.rank || Infinity) - (b.rank || Infinity),
    );
  const edit = (p) => setModal({ type: "player", player: p });
  return (
    <>
      <div className="list-toolbar collection-toolbar">
        <span className="result-count">{data.players.length} players</span>
        <div className="toolbar-controls">
          <label className="sort-select">
            <select
              aria-label="Sort players"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="rank">Rank</option>
              <option value="name">Name A–Z</option>
              <option value="sessions">Sessions</option>
              <option value="recent">Recent profits</option>
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
      </div>
      <div className="trading-grid">
        {players.map((p) => {
          return (
            <article className="trading-card" key={p.id}>
              <div className="trading-name-row">
                <h2>{p.name}</h2>
                <div
                  className="trading-rank"
                  aria-label={p.rank ? `Lifetime rank ${p.rank}` : "Unranked"}
                >
                  <span>Rank</span>
                  <strong>
                    {p.rank ? `#${String(p.rank).padStart(2, "0")}` : "—"}
                  </strong>
                </div>
              </div>
              <button
                className={cx(
                  "trading-photo",
                  p.photo?.startsWith("/players/") && "illustrated-photo",
                )}
                onClick={() => setModal({ type: "profile", player: p })}
                aria-label={`View ${p.name}'s history`}
              >
                <Avatar player={p} size="trading-portrait" />
              </button>
              <div className="trading-total">
                <span>Total winnings</span>
                <strong className={p.profit < 0 ? "card-loss" : ""}>
                  {fmt(p.profit, true)}
                </strong>
              </div>
              <button
                className="trading-tagline"
                onClick={() => edit(p)}
                aria-label={`Edit tagline for ${p.name}`}
              >
                <span className="tagline-copy">
                  <strong>Tagline</strong>
                  <span>{p.tagline || "Add tagline"}</span>
                </span>
                <Pencil size={13} />
              </button>
              <button
                className="trading-enemy"
                onClick={() => edit(p)}
                aria-label={`Edit worst enemy for ${p.name}`}
              >
                <span>Worst enemy</span>
                <strong>{(p.worstEnemy ?? p.weaknesses) || "—"}</strong>
                <Pencil size={14} />
              </button>
              <div className="trading-stats">
                <div>
                  <span>Recent profits</span>
                  <strong className={p.recentProfit < 0 ? "card-loss" : ""}>
                    {p.recentProfit === null ? "—" : fmt(p.recentProfit, true)}
                  </strong>
                  <small>
                    {p.lastPlayed
                      ? dateLabel(p.lastPlayed, { year: "numeric" })
                      : "No sessions"}
                  </small>
                </div>
                <div>
                  <span>Total sessions</span>
                  <strong>{String(p.played).padStart(2, "0")}</strong>
                  <small>All time</small>
                </div>
              </div>
              <div className="trading-footer">
                <span>
                  {fmt(p.average, true)} <small>/ session</small>
                </span>
                <button onClick={() => edit(p)} aria-label={`Edit ${p.name}`}>
                  <Pencil size={13} />
                  Edit
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!players.length && (
        <div className="empty-state">
          <Users size={26} />
          <h3>{query ? "No players found" : "No players yet"}</h3>
          {!query && (
            <button
              className="button primary"
              onClick={() => setModal({ type: "player" })}
            >
              <Plus size={16} />
              Add player
            </button>
          )}
        </div>
      )}
    </>
  );
}

const METRICS = {
  profit: {
    label: "Total winnings",
    hint: "Net profit, after buy-ins",
    format: (p, fmt) => fmt(p.profit, true),
  },
  played: {
    label: "Sessions played",
    hint: "Every seat taken counts",
    format: (p) => `${p.played} session${p.played === 1 ? "" : "s"}`,
  },
  average: {
    label: "Average winnings",
    hint: "Net profit per session played",
    format: (p, fmt) => fmt(p.average, true),
  },
};

export function LeaderboardPage({
  data,
  standings,
  query,
  fmt,
  period,
  setPeriod,
  setModal,
}) {
  const [metric, setMetric] = useState("profit");
  const ranked = rankStandings(standings, metric);
  const top = ranked.filter((p) => p.played).slice(0, 3);
  const listed = ranked.filter((p) =>
    `${p.name} ${p.tagline}`.toLowerCase().includes(query.toLowerCase()),
  );
  const podiumOrder = [top[1], top[0], top[2]];
  const profile = (p) => setModal({ type: "profile", player: p });
  return (
    <>
      <div className="leaderboard-toolbar">
        <div
          className="metric-switch"
          role="group"
          aria-label="Leaderboard ranking"
        >
          <button
            className={metric === "profit" ? "selected" : ""}
            onClick={() => setMetric("profit")}
          >
            <Wallet size={14} />
            Total winnings
          </button>
          <button
            className={metric === "played" ? "selected" : ""}
            onClick={() => setMetric("played")}
          >
            <CalendarDays size={14} />
            Sessions played
          </button>
          <button
            className={metric === "average" ? "selected" : ""}
            onClick={() => setMetric("average")}
          >
            <TrendingUp size={14} />
            Average winnings
          </button>
        </div>
        <PeriodSelect {...{ period, setPeriod }} />
      </div>
      <section className="podium-panel">
        <div className="podium-title">
          <h2>Top 3</h2>
        </div>
        {top.length ? (
          <div className="podium">
            {podiumOrder.map((p, i) =>
              p ? (
                <div
                  key={p.id}
                  className={`podium-place podium-place-${p.rank}`}
                >
                  <button className="podium-person" onClick={() => profile(p)}>
                    {p.rank === 1 && (
                      <span className="podium-crown">
                        <Crown size={28} strokeWidth={1.4} />
                      </span>
                    )}
                    <Avatar player={p} size="podium-avatar" />
                    <strong>{p.name}</strong>

                    <span className="podium-value">
                      {METRICS[metric].format(p, fmt)}
                    </span>
                  </button>
                  <div className="podium-block">
                    <span className="podium-medal">
                      {p.rank === 1 ? (
                        <Trophy size={22} strokeWidth={1.5} />
                      ) : (
                        String(p.rank).padStart(2, "0")
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  key={`empty-${i}`}
                  className={`podium-place podium-vacant vacant-${i}`}
                >
                  <div className="vacant-person">
                    <span>♠</span>
                    <small>—</small>
                  </div>
                  <div className="podium-block">
                    <span>—</span>
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="podium-empty">
            <Trophy size={38} />
            <h3>No results yet</h3>

            <button
              className="button primary"
              onClick={() => setModal({ type: "session" })}
            >
              <Plus size={15} />
              Add session
            </button>
          </div>
        )}
      </section>
      <section className="panel rankings-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Rankings{" "}
              <span className="rankings-count">{data.players.length}</span>
            </h2>
          </div>
          <span className="rankings-range">{periods[period]}</span>
        </div>
        <div className="rankings-scroll-hint">
          Swipe across for all player stats <span aria-hidden="true">↔</span>
        </div>
        <div
          className="rankings-table-scroll"
          role="region"
          aria-label="Full player rankings; scroll for all statistics"
          tabIndex={0}
        >
          <table className="rankings-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>PLAYER</th>
                <th className={metric === "profit" ? "sorted-column" : ""}>
                  <button onClick={() => setMetric("profit")}>
                    TOTAL WINNINGS
                    {metric === "profit" && <ChevronDown size={11} />}
                  </button>
                </th>
                <th className={metric === "played" ? "sorted-column" : ""}>
                  <button onClick={() => setMetric("played")}>
                    SESSIONS{metric === "played" && <ChevronDown size={11} />}
                  </button>
                </th>
                <th className={metric === "average" ? "sorted-column" : ""}>
                  <button onClick={() => setMetric("average")}>
                    AVG / SESSION
                    {metric === "average" && <ChevronDown size={11} />}
                  </button>
                </th>
                <th>
                  <span className="sr-only">Open player</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {listed.map((p) => (
                <tr
                  key={p.id}
                  className={p.rank === 1 ? "first-place-row" : ""}
                >
                  <td>
                    <span
                      className={cx(
                        "ranking-number",
                        p.rank && p.rank <= 3 && `ranking-top-${p.rank}`,
                      )}
                    >
                      {p.rank === 1 ? (
                        <Trophy size={16} />
                      ) : p.rank ? (
                        `#${String(p.rank).padStart(2, "0")}`
                      ) : (
                        "—"
                      )}
                    </span>
                  </td>
                  <td>
                    <button
                      className="ranking-player"
                      onClick={() => profile(p)}
                    >
                      <Avatar player={p} />
                      <span>
                        <strong>{p.name}</strong>
                      </span>
                    </button>
                  </td>
                  <td
                    className={cx(
                      "rank-money",
                      p.profit < 0 ? "negative" : "positive",
                      metric === "profit" && "sorted-cell",
                    )}
                  >
                    {fmt(p.profit, true)}
                  </td>
                  <td
                    className={cx(
                      "rank-sessions",
                      metric === "played" && "sorted-cell",
                    )}
                  >
                    {p.played}
                  </td>
                  <td
                    className={cx(
                      "rank-money",
                      p.average < 0 ? "negative" : "positive",
                      metric === "average" && "sorted-cell",
                    )}
                  >
                    {p.played ? fmt(p.average, true) : "—"}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`View ${p.name}'s history`}
                      onClick={() => profile(p)}
                    >
                      <ArrowUpRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!listed.length && (
          <div className="empty-state">
            <Search size={23} />
            <h3>No players match this search.</h3>
          </div>
        )}
      </section>
    </>
  );
}

export function Sessions({
  data,
  filteredSessions,
  query,
  fmt,
  period,
  setPeriod,
  setModal,
}) {
  const [sort, setSort] = useState("newest");
  const [date, setDate] = useState("");
  const [onlyVideos, setOnlyVideos] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const { clips, error: mediaError } = useClipLibrary();
  const bySession = useMemo(
    () =>
      clips.reduce((map, c) => {
        (map[c.sessionId] ||= []).push(c);
        return map;
      }, {}),
    [clips],
  );
  const sessions = [...filteredSessions]
    .filter(
      (s) =>
        (!date || s.date === date) &&
        (!onlyVideos || bySession[s.id]?.length) &&
        `${s.title} ${s.notes} ${s.results.map((r) => data.players.find((p) => p.id === r.playerId)?.name || "").join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "newest"
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date),
    );
  const groups = sessions.reduce((map, s) => {
    (map[s.date.slice(0, 7)] ||= []).push(s);
    return map;
  }, {});
  const countWithVideo = filteredSessions.filter(
    (s) => bySession[s.id]?.length,
  ).length;
  return (
    <>
      <div className="list-toolbar archive-toolbar">
        <div className="archive-tabs" role="group" aria-label="Session filter">
          <button
            className={!onlyVideos ? "selected" : ""}
            onClick={() => setOnlyVideos(false)}
          >
            All sessions <span>{filteredSessions.length}</span>
          </button>
          <button
            className={onlyVideos ? "selected" : ""}
            onClick={() => setOnlyVideos(true)}
          >
            <Play size={12} />
            With highlights <span>{countWithVideo}</span>
          </button>
        </div>
        <div className="toolbar-controls">
          <label className="date-filter">
            <input
              type="date"
              aria-label="Filter by exact date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {date && (
              <button
                aria-label="Clear date filter"
                onClick={() => setDate("")}
              >
                <X size={13} />
              </button>
            )}
          </label>
          <label className="sort-select">
            <select
              aria-label="Sort sessions"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <ChevronDown size={13} />
          </label>
          <PeriodSelect {...{ period, setPeriod }} />
        </div>
      </div>
      {mediaError && (
        <p className="media-warning">
          Video storage is unavailable in this browser. Your session records are
          still available.
        </p>
      )}
      {Object.entries(groups).map(([month, list]) => (
        <section className="session-month" key={month}>
          <h2>
            {new Date(`${month}-15T12:00:00`).toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
            <span>
              {list.length} session{list.length === 1 ? "" : "s"}
            </span>
          </h2>
          <div className="session-rows">
            {list.map((session) => {
              const winnerResult = [...session.results].sort(
                (a, b) => b.cashOut - b.buyIn - (a.cashOut - a.buyIn),
              )[0];
              const winner = data.players.find(
                (p) => p.id === winnerResult?.playerId,
              );
              const net = winnerResult
                ? winnerResult.cashOut - winnerResult.buyIn
                : 0;
              const pot = session.results.reduce((s, r) => s + r.buyIn, 0);
              const sessionClips = bySession[session.id] || [];
              return (
                <article
                  className={cx(
                    "session-row-card",
                    expanded === session.id && "session-row-expanded",
                  )}
                  key={session.id}
                >
                  <div className="session-row-main">
                    <div className="session-calendar">
                      <span>
                        {dateLabel(session.date, {
                          day: undefined,
                          month: "short",
                        }).toUpperCase()}
                      </span>
                      <strong>{session.date.slice(8)}</strong>
                      <small>{session.date.slice(0, 4)}</small>
                    </div>
                    <div className="session-row-info">
                      <button
                        className="session-row-title"
                        onClick={() => setModal({ type: "detail", session })}
                      >
                        <h3>{session.title}</h3>
                        <ArrowUpRight size={15} />
                      </button>
                      <div className="session-row-meta">
                        <span>
                          <Users size={12} />
                          {session.results.length} players
                        </span>
                        <span className="row-meta-dot">·</span>
                        <span>
                          <Wallet size={12} />
                          {fmt(pot)} pot
                        </span>
                      </div>
                      <div className="row-player-stack">
                        {session.results.slice(0, 5).map((r) => (
                          <Avatar
                            key={r.playerId}
                            player={data.players.find(
                              (p) => p.id === r.playerId,
                            )}
                            size="tiny"
                          />
                        ))}
                        {session.results.length > 5 && (
                          <span>+{session.results.length - 5}</span>
                        )}
                      </div>
                    </div>
                    <div className="session-row-winner">
                      <span>
                        <Trophy size={11} />
                        WINNER
                      </span>
                      <strong>{winner?.name || "—"}</strong>
                      <small className={net < 0 ? "negative" : "positive"}>
                        {fmt(net, true)}
                      </small>
                    </div>
                    <div className="session-row-actions">
                      {sessionClips.length ? (
                        <button
                          className={cx(
                            "highlight-chip",
                            expanded === session.id && "selected",
                          )}
                          onClick={() =>
                            setExpanded(
                              expanded === session.id ? null : session.id,
                            )
                          }
                          aria-expanded={expanded === session.id}
                        >
                          <Play size={12} />
                          {sessionClips.length} highlight
                          {sessionClips.length === 1 ? "" : "s"}
                          <ChevronDown size={12} />
                        </button>
                      ) : (
                        <button
                          className="add-highlight-button"
                          onClick={() => setModal({ type: "session", session })}
                        >
                          <Plus size={12} />
                          Add highlights
                        </button>
                      )}
                      <div>
                        <button
                          className="row-edit"
                          aria-label={`Edit ${session.title}`}
                          onClick={() => setModal({ type: "session", session })}
                        >
                          <Pencil size={13} />
                          <span>Edit session</span>
                        </button>
                        <button
                          className="row-open"
                          aria-label={`View ${session.title}`}
                          onClick={() => setModal({ type: "detail", session })}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {expanded === session.id && (
                    <div className="row-highlights">
                      <SessionHighlights
                        sessionId={session.id}
                        onEdit={() => setModal({ type: "session", session })}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {!sessions.length && (
        <div className="empty-state">
          <CalendarDays size={26} />
          <h3>{onlyVideos ? "No videos yet" : "No sessions found"}</h3>
          <p>
            {onlyVideos
              ? "Add videos in Edit session."
              : "Change the date filter or add a session."}
          </p>
          {!onlyVideos && (
            <button
              className="button primary"
              onClick={() => setModal({ type: "session" })}
            >
              <Plus size={15} />
              Add session
            </button>
          )}
        </div>
      )}
    </>
  );
}
