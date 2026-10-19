import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Trophy,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Check,
  TrendingUp,
  Wallet,
  Dices,
  Download,
  Upload,
  Pencil,
  Trash2,
  Info,
  Menu,
  Spade,
  Heart,
  ArrowDownLeft,
  ShieldCheck,
  ImagePlus,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import {
  STORAGE_KEY,
  createSeed,
  getStandings,
  money,
  today,
  dateLabel,
  inPeriod,
  validateSession,
} from "./data";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "@fontsource-variable/fredoka";
import "./styles.css";
import "./club.css";
import "./player-cards.css";
import "./graduation.css";
import { Avatar, PeriodSelect } from "./ui";
import { cloud, stageCloudClips, discardStagedClips } from "./cloud";
import { useTableRecords } from "./useTableRecords";
import { SharedAccess, SignInForm, useTableAccess } from "./SharedAccess";
import "./shared.css";
import { Players, LeaderboardPage, Sessions } from "./ClubPages";
import { SessionHighlights, ClipEditor } from "./SessionMedia";
import {
  saveSessionClips,
  deleteSessionClips,
  clearSessionClips,
  pruneSessionClips,
} from "./media";

const NAV = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "players", name: "Players", icon: Users },
  { id: "leaderboard", name: "Leaderboard", icon: TrendingUp },
  { id: "sessions", name: "Sessions", icon: CalendarDays },
  { id: "awards", name: "Awards", icon: Trophy },
];
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const cx = (...classes) => classes.filter(Boolean).join(" ");

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      saved?.version === 1 &&
      Array.isArray(saved.players) &&
      Array.isArray(saved.sessions)
    )
      return saved;
  } catch {
    /* A new or restricted browser can still use the app. */
  }
  return createSeed();
}

function App() {
  const { canEdit } = useTableAccess();
  const store = useTableRecords(loadData);
  const { data } = store;
  const setData = (updater, clips) => {
    if (!canEdit) throw new Error("Sign in to edit the shared table.");
    return store.update(updater, modal?.revision, clips);
  };
  const [page, setPage] = useState(() =>
    NAV.some((n) => n.id === location.hash.slice(1))
      ? location.hash.slice(1)
      : "overview",
  );
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const [modal, setModalState] = useState(null);
  const setModal = (requested) => {
    const next =
      requested &&
      !canEdit &&
      ["player", "session", "delete", "settings"].includes(requested.type)
        ? { type: "signin" }
        : requested;
    setModalState(
      next
        ? {
            ...next,
            ...(next.player
              ? {
                  player:
                    data.players.find((p) => p.id === next.player.id) ||
                    next.player,
                }
              : {}),
            ...(next.session
              ? {
                  session:
                    data.sessions.find((s) => s.id === next.session.id) ||
                    next.session,
                }
              : {}),
            revision: store.getRevision(),
          }
        : null,
    );
  };
  useEffect(() => {
    if (!canEdit)
      setModalState((current) =>
        current &&
        ["player", "session", "delete", "settings"].includes(current.type)
          ? null
          : current,
      );
  }, [canEdit]);
  const [toast, setToast] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    if (cloud) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [data]);
  useEffect(() => {
    const onHash = () => {
      const next = location.hash.slice(1);
      if (NAV.some((n) => n.id === next)) {
        setPage(next);
        setQuery("");
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const go = (id) => {
    setPage(id);
    location.hash = id;
    setQuery("");
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const notify = (text) => setToast(text);
  const filteredSessions = useMemo(
    () => data.sessions.filter((s) => inPeriod(s.date, period)),
    [data.sessions, period],
  );
  const standings = useMemo(
    () => getStandings(data.players, filteredSessions),
    [data.players, filteredSessions],
  );
  const fmt = (n, signed = false) => money(n, data.currency, signed);
  const savePlayer = async (player) => {
    await setData((d) => ({
      ...d,
      players: d.players.some((p) => p.id === player.id)
        ? d.players.map((p) => (p.id === player.id ? player : p))
        : [...d.players, player],
    }));
    setModal(null);
    notify("Player saved.");
  };
  const saveSession = async (session, changes = {}) => {
    let uploaded = [];
    let committed = false;
    try {
      if (cloud)
        uploaded = await stageCloudClips(session.id, changes.additions || []);
      else if (changes.additions?.length || changes.removals?.length)
        await saveSessionClips(session.id, changes.additions, changes.removals);
      await setData(
        (d) => ({
          ...d,
          sessions: d.sessions.some((s) => s.id === session.id)
            ? d.sessions.map((s) => (s.id === session.id ? session : s))
            : [...d.sessions, session],
        }),
        {
          sessionId: session.id,
          additions: uploaded,
          removals: changes.removals || [],
        },
      );
      committed = true;
      setModal(null);
      notify("Session saved.");
    } finally {
      if (cloud && !committed) await discardStagedClips(uploaded);
    }
  };
  const removeSession = async (id) => {
    try {
      if (!cloud) await deleteSessionClips(id);
      await setData((d) => ({
        ...d,
        sessions: d.sessions.filter((s) => s.id !== id),
      }));
      setModal(null);
      notify("Session deleted.");
    } catch (error) {
      notify(error.message || "Couldn’t delete the session. Please try again.");
    }
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `soberSem3-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notify("Backup exported.");
  };

  if (cloud && !store.ready)
    return (
      <main className="access-screen">
        <section className="access-card">
          <h1>soberSem3</h1>
          {store.error ? (
            <>
              <p role="alert">{store.error}</p>
              <button className="button primary" onClick={store.refresh}>
                Try again
              </button>
              <button
                className="text-button"
                onClick={() => cloud.auth.signOut()}
              >
                Sign out
              </button>
            </>
          ) : (
            <p role="status">Loading shared table…</p>
          )}
        </section>
      </main>
    );

  return (
    <div className="app-shell">
      {mobileOpen && (
        <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />
      )}
      <header className={cx("sidebar", mobileOpen && "is-open")}>
        <div className="header-brand">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu size={20} />
          </button>
          <a
            className="brand"
            href="#overview"
            onClick={() => go("overview")}
            aria-label="soberSem3 home"
          >
            <span className="brand-icon">♠</span>
            <span>soberSem3</span>
          </a>
        </div>
        <nav aria-label="Main navigation">
          {NAV.map(({ id, name }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                go(id);
              }}
              className={cx("nav-item", page === id && "active")}
              aria-current={page === id ? "page" : undefined}
            >
              {name}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <label className="global-search">
            <Search size={16} />
            <input
              aria-label="Search players and sessions"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className="icon-button"
            onClick={() => setModal({ type: "settings" })}
            aria-label="Settings"
          >
            <Settings size={19} />
          </button>
        </div>
      </header>
      <div className="main-shell">
        <main>
          {cloud && store.error && (
            <div className="storage-alert shared-status" role="alert">
              {store.error} <button onClick={store.refresh}>Retry</button>
            </div>
          )}
          {storageError && (
            <div className="storage-alert">
              <AlertCircle size={17} /> Browser storage is full or unavailable.
              Export a backup before closing this page.{" "}
              <button onClick={exportData}>Export data</button>
            </div>
          )}
          <div
            className={cx(
              "page-heading",
              page === "overview" && "overview-heading",
            )}
          >
            <h1>{NAV.find((n) => n.id === page)?.name}</h1>
            <button
              className="button primary"
              onClick={() =>
                setModal({ type: page === "players" ? "player" : "session" })
              }
            >
              {canEdit && <Plus size={16} />}
              {!canEdit
                ? "Sign in to edit"
                : page === "players"
                  ? "Add player"
                  : "Add session"}
            </button>
          </div>
          {page === "overview" && (
            <Overview
              {...{
                data,
                standings,
                filteredSessions,
                query,
                fmt,
                period,
                setPeriod,
                go,
                setModal,
              }}
            />
          )}
          {page === "players" && (
            <Players
              {...{ data, standings, query, fmt, period, setPeriod, setModal }}
            />
          )}
          {page === "leaderboard" && (
            <LeaderboardPage
              {...{ data, standings, query, fmt, period, setPeriod, setModal }}
            />
          )}
          {page === "sessions" && (
            <Sessions
              {...{
                data,
                filteredSessions,
                query,
                fmt,
                period,
                setPeriod,
                setModal,
              }}
            />
          )}
          {page === "awards" && (
            <Awards
              {...{ data, standings, fmt, period, setPeriod, query, setModal }}
            />
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          onClose={() => setModal(null)}
          wide={["session", "detail"].includes(modal.type)}
        >
          {modal.type === "signin" && (
            <SignInForm onSuccess={() => setModal(null)} />
          )}
          {modal.type === "player" && (
            <PlayerForm
              player={modal.player}
              onSave={savePlayer}
              onCancel={() => setModal(null)}
            />
          )}
          {modal.type === "session" && (
            <SessionForm
              session={modal.session}
              players={data.players}
              currency={data.currency}
              onSave={saveSession}
              onCancel={() => setModal(null)}
              onAddPlayer={() => setModal({ type: "player" })}
            />
          )}
          {modal.type === "detail" && (
            <SessionDetail
              session={modal.session}
              players={data.players}
              fmt={fmt}
              onEdit={() =>
                setModal({ type: "session", session: modal.session })
              }
              onDelete={() =>
                setModal({ type: "delete", session: modal.session })
              }
            />
          )}
          {modal.type === "profile" && (
            <PlayerProfile
              player={modal.player}
              data={data}
              fmt={fmt}
              onEdit={() => setModal({ type: "player", player: modal.player })}
              onSession={(session) => setModal({ type: "detail", session })}
            />
          )}
          {modal.type === "delete" && (
            <>
              <div className="modal-icon danger">
                <Trash2 size={23} />
              </div>
              <h2>Delete session?</h2>
              <p className="modal-description">
                “{modal.session.title}” and its results will be permanently
                removed from the ledger. This can’t be undone.
              </p>
              <div className="form-actions">
                <button
                  className="button secondary"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button
                  className="button danger-button"
                  onClick={() => removeSession(modal.session.id)}
                >
                  Delete session
                </button>
              </div>
            </>
          )}
          {modal.type === "settings" && (
            <SettingsPanel
              {...{ data, setData, exportData, notify }}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "guide" && (
            <>
              <h2>How to use</h2>
              <p className="modal-description">
                {cloud
                  ? "Anyone with the link can view players, sessions, photos, and videos. Sign in with an approved account to edit. Changes refresh within 15 seconds."
                  : "Add players, record sessions, and track net winnings. Records and videos are stored in this browser. Export records in Settings and download videos separately."}
              </p>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Overview({
  data,
  standings,
  filteredSessions,
  query,
  fmt,
  period,
  setPeriod,
  go,
  setModal,
}) {
  const leader = standings.find((p) => p.played);
  const recent = [...filteredSessions].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const winnings = filteredSessions.reduce(
    (sum, s) =>
      sum + s.results.reduce((a, r) => a + Math.max(0, r.cashOut - r.buyIn), 0),
    0,
  );
  const buyIns = filteredSessions.reduce(
    (sum, s) => sum + s.results.reduce((a, r) => a + r.buyIn, 0),
    0,
  );
  return (
    <>
      <div className="section-toolbar">
        <h2>Summary</h2>
        <PeriodSelect {...{ period, setPeriod }} />
      </div>
      <section className="stats-grid" aria-label="Statistics">
        <Stat
          icon={Wallet}
          label="Total winnings"
          value={fmt(winnings)}
          foot={<span className="stat-muted">{fmt(buyIns)} total buy-ins</span>}
        />
        <Stat
          icon={Trophy}
          label="Top player"
          value={leader ? leader.name.split(" ")[0] : "—"}
          player={leader}
          foot={
            <span className="positive">
              {leader ? fmt(leader.profit, true) : "No results"}
            </span>
          }
        />
        <Stat
          icon={CalendarDays}
          label="Sessions"
          value={String(filteredSessions.length).padStart(2, "0")}
          foot={
            <span className="stat-muted">
              {recent[0]
                ? `Last played ${dateLabel(recent[0].date)}`
                : "No sessions"}
            </span>
          }
        />
        <Stat
          icon={Users}
          label="Players"
          value={String(data.players.length).padStart(2, "0")}
          foot={
            <span className="stat-muted">
              {standings.filter((p) => p.played).length} active
            </span>
          }
        />
      </section>
      <div className="dashboard-columns">
        <section className="panel leaderboard-panel">
          <div className="panel-heading">
            <h2>Leaderboard</h2>
            <button className="text-button" onClick={() => go("leaderboard")}>
              View all <ArrowUpRight size={15} />
            </button>
          </div>
          <Leaderboard
            standings={standings.filter((p) =>
              `${p.name} ${p.tagline}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )}
            fmt={fmt}
            onPlayer={(player) => setModal({ type: "profile", player })}
          />
        </section>
        <ProfitChart
          standings={standings}
          sessions={filteredSessions}
          fmt={fmt}
        />
      </div>
      <section className="recent-section">
        <div className="section-toolbar">
          <h2>Recent sessions</h2>
          <button className="text-button" onClick={() => go("sessions")}>
            View all <ArrowRight size={15} />
          </button>
        </div>
        <div className="recent-grid">
          {recent
            .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3)
            .map((session) => (
              <SessionCard
                key={session.id}
                {...{ session, data, fmt }}
                onClick={() => setModal({ type: "detail", session })}
              />
            ))}
          {!recent.length && (
            <EmptyState
              icon={CalendarDays}
              title="No sessions yet"
              text=""
              action="Add session"
              onClick={() => setModal({ type: "session" })}
            />
          )}
        </div>
      </section>
    </>
  );
}

function Stat({ icon: Icon, label, value, foot, tone, player }) {
  return (
    <article className={cx("stat-card", tone && `stat-${tone}`)}>
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={16} strokeWidth={1.7} />
      </div>
      <div className={cx("stat-value", player && "stat-player")}>
        {value}
        {player && <Avatar player={player} size="small" />}
      </div>
      <div className="stat-foot">{foot}</div>
    </article>
  );
}

function Sparkline({ history, positive }) {
  const values = [0, ...history.map((h) => h.total)];
  const low = Math.min(...values),
    high = Math.max(...values);
  const points = values
    .map(
      (n, i) =>
        `${(i * 74) / Math.max(1, values.length - 1)},${25 - ((n - low) / (high - low || 1)) * 21}`,
    )
    .join(" ");
  return (
    <svg
      className={cx("sparkline", positive ? "up" : "down")}
      viewBox="0 0 76 29"
      aria-label={positive ? "Net winnings trend" : "Net losses trend"}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Leaderboard({ standings, fmt, onPlayer }) {
  return (
    <div className="leaderboard-scroll">
      <table className="leaderboard">
        <thead>
          <tr>
            <th className="rank-cell">#</th>
            <th>PLAYER</th>
            <th className="games-cell">GAMES</th>
            <th className="trend-cell">FORM</th>
            <th className="align-right">NET WINNINGS</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((p, i) => (
            <tr
              key={p.id}
              onClick={() => onPlayer(p)}
              className={i === 0 && p.profit > 0 ? "leader-row" : ""}
            >
              <td className="rank-cell">
                <span
                  className={cx(
                    "rank",
                    i === 0 && p.profit > 0 && "first-rank",
                  )}
                >
                  {i === 0 && p.profit > 0 ? (
                    <Trophy size={15} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
              </td>
              <td>
                <button
                  className="player-cell"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayer(p);
                  }}
                >
                  <Avatar player={p} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.tagline}</small>
                  </span>
                </button>
              </td>
              <td className="games-cell">{p.played}</td>
              <td className="trend-cell">
                <Sparkline history={p.history} positive={p.profit >= 0} />
              </td>
              <td
                className={cx(
                  "align-right",
                  "net-amount",
                  p.profit >= 0 ? "positive" : "negative",
                )}
              >
                {fmt(p.profit, true)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!standings.length && (
        <EmptyState
          icon={Search}
          title="No players found"
          text="Add a player or change your search."
        />
      )}
    </div>
  );
}

function ProfitChart({ standings, sessions, fmt }) {
  const top = standings.filter((p) => p.played).slice(0, 3);
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const series = top.map((player) => {
    let total = 0;
    return [
      0,
      ...sorted.map((s) => {
        const r = s.results.find((r) => r.playerId === player.id);
        total += r ? r.cashOut - r.buyIn : 0;
        return total;
      }),
    ];
  });
  const max = Math.max(1000, ...series.flat());
  const min = Math.min(0, ...series.flat());
  const x = (i) => 42 + (i / Math.max(sorted.length, 1)) * 288;
  const y = (n) => 135 - ((n - min) / (max - min || 1)) * 110;
  const colors = ["#8d4bb5", "#ec6b9c", "#65b8d1"];
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Winnings</h2>
          <p></p>
        </div>
        <span className="chart-icon">
          <TrendingUp size={19} />
        </span>
      </div>
      <div className="chart-wrap">
        <svg
          viewBox="0 0 350 164"
          className="profit-chart"
          role="img"
          aria-label="Cumulative net winnings for the top three players across sessions"
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity=".12" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((f, i) => {
            const val = min + (max - min) * f;
            return (
              <g key={i}>
                <line
                  x1="42"
                  x2="330"
                  y1={y(val)}
                  y2={y(val)}
                  stroke="#eeeaf4"
                  strokeDasharray="3 4"
                />
                <text
                  x="32"
                  y={y(val) + 3}
                  textAnchor="end"
                  fill="#9a94a6"
                  fontSize="9"
                >
                  {Math.abs(val) >= 1000
                    ? `${Math.round(val / 100) / 10}k`
                    : Math.round(val)}
                </text>
              </g>
            );
          })}
          {series[0] && (
            <polygon
              points={`${x(0)},${y(0)} ${series[0].map((v, i) => `${x(i)},${y(v)}`).join(" ")} ${x(sorted.length)},${y(min)}`}
              fill="url(#chart-fill)"
            />
          )}
          {series.map((values, i) => (
            <g key={i}>
              <polyline
                points={values.map((v, j) => `${x(j)},${y(v)}`).join(" ")}
                fill="none"
                stroke={colors[i]}
                strokeWidth={i === 0 ? 2.3 : 1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle
                cx={x(values.length - 1)}
                cy={y(values.at(-1))}
                r="3"
                fill={colors[i]}
                stroke="#fff"
                strokeWidth="2"
              />
            </g>
          ))}
          {sorted.length > 0 &&
            [0, Math.floor((sorted.length - 1) / 2), sorted.length - 1]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((i) => (
                <text
                  key={i}
                  x={x(i + 1)}
                  y="158"
                  textAnchor="middle"
                  fill="#9a94a6"
                  fontSize="9"
                >
                  {dateLabel(sorted[i].date)}
                </text>
              ))}
          {!sorted.length && (
            <text
              x="186"
              y="90"
              textAnchor="middle"
              fill="#929b8a"
              fontSize="11"
            >
              No sessions yet
            </text>
          )}
        </svg>
      </div>
      <div className="chart-legend">
        {top.map((p, i) => (
          <span
            className="legend-item"
            key={p.id}
            title={`${p.name}: ${fmt(p.profit, true)}`}
          >
            <span style={{ background: colors[i] }} />
            {p.name.split(" ")[0]}
          </span>
        ))}
      </div>
    </section>
  );
}

function SessionCard({ session, data, fmt, onClick }) {
  const winnerResult = [...session.results].sort(
    (a, b) => b.cashOut - b.buyIn - (a.cashOut - a.buyIn),
  )[0];
  const winner = data.players.find((p) => p.id === winnerResult?.playerId);
  const pot = session.results.reduce((sum, r) => sum + r.buyIn, 0);
  return (
    <button className="session-card" onClick={onClick}>
      <div className="session-card-top">
        <span className="session-date">
          <CalendarDays size={13} />
          {dateLabel(session.date, { year: "numeric" })}
        </span>
        <ArrowUpRight size={17} />
      </div>
      <h3>{session.title}</h3>
      <div className="session-card-meta">
        <div className="avatar-stack">
          {session.results.slice(0, 4).map((r) => (
            <Avatar
              key={r.playerId}
              player={data.players.find((p) => p.id === r.playerId)}
              size="tiny"
            />
          ))}
        </div>
        <span>
          {session.results.length} players<span className="meta-dot">·</span>
          {fmt(pot)} pot
        </span>
      </div>
      <div className="session-winner">
        <span>
          <Trophy size={13} />
          {winner?.name.split(" ")[0] || "Unknown"} won
        </span>
        <strong
          className={
            winnerResult?.cashOut - winnerResult?.buyIn >= 0
              ? "positive"
              : "negative"
          }
        >
          {fmt(
            winnerResult ? winnerResult.cashOut - winnerResult.buyIn : 0,
            true,
          )}
        </strong>
      </div>
    </button>
  );
}

function Awards({ data, standings, fmt, period, setPeriod, query, setModal }) {
  const played = standings.filter((p) => p.played > 0);
  const best = [...played].sort((a, b) => b.best - a.best)[0];
  const consistent = [...played].sort(
    (a, b) => b.winRate - a.winRate || b.wins - a.wins,
  )[0];
  const loyal = [...played].sort((a, b) => b.played - a.played)[0];
  const unlucky = [...played].sort((a, b) => a.profit - b.profit)[0];
  const awards = [
    {
      title: "Highest winnings",
      text: "",
      icon: Trophy,
      player: played[0],
      stat: played[0] ? fmt(played[0].profit, true) : "",
      label: "total net winnings",
      tone: "lime",
    },
    {
      title: "Largest single win",
      text: "",
      icon: Dices,
      player: best,
      stat: best ? fmt(best.best, true) : "",
      label: "largest session win",
      tone: "peach",
    },
    {
      title: "Highest win rate",
      text: "",
      icon: Spade,
      player: consistent,
      stat: consistent ? `${consistent.winRate}%` : "",
      label: "winning sessions",
      tone: "purple",
    },
    {
      title: "Most sessions",
      text: "",
      icon: CalendarDays,
      player: loyal,
      stat: loyal ? loyal.played : "",
      label: "sessions",
      tone: "blue",
    },
    {
      title: "Lowest net winnings",
      text: "",
      icon: Heart,
      player: unlucky?.profit < 0 ? unlucky : undefined,
      stat: unlucky?.profit < 0 ? fmt(Math.abs(unlucky.profit)) : "",
      label: "net loss",
      tone: "pink",
    },
  ];
  return (
    <>
      <div className="list-toolbar">
        <span className="result-count">Awards</span>
        <PeriodSelect {...{ period, setPeriod }} />
      </div>
      <div className="awards-grid">
        {awards
          .filter((a) =>
            `${a.title} ${a.player?.name || ""}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map(({ title, text, icon: Icon, player, stat, label, tone }) => (
            <article key={title} className={`award-card award-${tone}`}>
              <div className="award-medal">
                <Icon size={28} strokeWidth={1.5} />
              </div>
              <span className="award-category"></span>
              <h2>{title}</h2>
              <p>{text}</p>
              {player ? (
                <>
                  <button
                    className="award-player"
                    onClick={() => setModal({ type: "profile", player })}
                  >
                    <Avatar player={player} size="large" />
                    <strong>{player.name}</strong>
                  </button>
                  <div className="award-stat">{stat}</div>
                  <span className="award-stat-label">{label}</span>
                </>
              ) : (
                <div className="award-empty">
                  <span>♠</span>
                  <strong>No results</strong>
                  <p>Add session to claim this one.</p>
                </div>
              )}
            </article>
          ))}
      </div>
    </>
  );
}

function EmptyState({ icon: Icon, title, text, action, onClick }) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button primary" onClick={onClick}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}

function Modal({ children, onClose, wide }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const getFocusables = () =>
      [
        ...dialog.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex="0"]',
        ),
      ].filter((el) => !el.disabled && el.getClientRects().length);
    const focusables = getFocusables();
    (focusables.find((el) => el.tagName === "INPUT") || focusables[0])?.focus();
    const keydown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = getFocusables();
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", keydown);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="soberSem3 dialog"
        className={cx("modal", wide && "modal-wide")}
        ref={dialogRef}
      >
        <button
          className="modal-close icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        {children}
      </section>
    </div>
  );
}

function PlayerForm({ player, onSave, onCancel }) {
  const [name, setName] = useState(player?.name || "");
  const [tagline, setTagline] = useState(player?.tagline || "");
  const [photo, setPhoto] = useState(player?.photo || "");
  const [worstEnemy, setWorstEnemy] = useState(
    player?.worstEnemy ?? player?.weaknesses ?? "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const upload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        file.type,
      )
    ) {
      setError("Choose a JPG, PNG, WebP, or GIF photo.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Choose a photo smaller than 8 MB.");
      return;
    }
    setBusy(true);
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 240;
        canvas.height = 240;
        const ctx = canvas.getContext("2d");
        const crop = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - crop) / 2,
          (img.height - crop) / 2,
          crop,
          crop,
          0,
          0,
          240,
          240,
        );
        setPhoto(canvas.toDataURL("image/jpeg", 0.82));
        setBusy(false);
      };
      img.onerror = () => {
        setError("This photo couldn’t be opened. Try another image.");
        setBusy(false);
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      setError("Couldn’t read this photo. Please try again.");
      setBusy(false);
    };
    reader.readAsDataURL(file);
  };
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Enter a player name.");
        setBusy(true);
        setError("");
        try {
          await onSave({
            ...(player?.strengths !== undefined
              ? { strengths: player.strengths }
              : {}),
            ...(player?.weaknesses !== undefined
              ? { weaknesses: player.weaknesses }
              : {}),
            worstEnemy: worstEnemy.trim(),
            id: player?.id || uid(),
            name: name.trim(),
            tagline: tagline.trim(),
            photo,
            color:
              player?.color ||
              ["#b4c5a0", "#c7a994", "#b5abd0"][Math.floor(Math.random() * 3)],
          });
        } catch (err) {
          setError(err.message || "Couldn’t save player.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{player ? "Edit player" : "Add player"}</h2>

      <div className="photo-upload">
        <Avatar player={{ name: name || "?", photo }} size="upload-avatar" />
        <div>
          <label className="button secondary small-button">
            <ImagePlus size={15} />
            {busy ? "Preparing photo…" : "Upload photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={upload}
              className="file-input"
              disabled={busy}
            />
          </label>
          <small>JPG, PNG, WebP or GIF · up to 8 MB</small>
          {photo && (
            <button
              className="remove-photo"
              type="button"
              onClick={() => setPhoto("")}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
      <label className="form-label">
        Player name <span>*</span>
        <input
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name"
          required
        />
      </label>
      <label className="form-label">
        Tagline
        <textarea
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={100}
          placeholder="Add a tagline"
          rows={2}
        />
        <span className="input-hint">{tagline.length}/100</span>
      </label>
      <label className="form-label">
        Worst enemy <span className="optional">(optional)</span>
        <textarea
          value={worstEnemy}
          onChange={(e) => setWorstEnemy(e.target.value)}
          placeholder="Add worst enemy"
          maxLength={140}
          rows={2}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          <AlertCircle size={15} />
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button primary" disabled={busy}>
          <Check size={16} />
          {player ? "Save player" : "Add player"}
        </button>
      </div>
    </form>
  );
}

function SessionForm({
  session,
  players,
  currency,
  onSave,
  onCancel,
  onAddPlayer,
}) {
  const [title, setTitle] = useState(session?.title || "");
  const [date, setDate] = useState(session?.date || today());
  const [notes, setNotes] = useState(session?.notes || "");
  const [newClips, setNewClips] = useState([]);
  const [removedClipIds, setRemovedClipIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState(
    session?.results.map((r) => ({ ...r, selected: true })) ||
      players.map((p) => ({
        playerId: p.id,
        buyIn: "",
        cashOut: "",
        selected: false,
      })),
  );
  const [error, setError] = useState("");
  const selected = results.filter((r) => r.selected);
  const totalIn = selected.reduce((s, r) => s + (Number(r.buyIn) || 0), 0);
  const totalOut = selected.reduce((s, r) => s + (Number(r.cashOut) || 0), 0);
  const diff = totalOut - totalIn;
  const update = (id, field, value) =>
    setResults((prev) =>
      prev.map((r) => (r.playerId === id ? { ...r, [field]: value } : r)),
    );
  const allResults = players.map(
    (p) =>
      results.find((r) => r.playerId === p.id) || {
        playerId: p.id,
        buyIn: "",
        cashOut: "",
        selected: false,
      },
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const picked = allResults.filter((r) => r.selected);
        if (picked.some((r) => r.buyIn === "" || r.cashOut === ""))
          return setError(
            "Add both a buy-in and a cash-out for every selected player. Use 0 when needed.",
          );
        const saved = {
          id: session?.id || uid(),
          title: title.trim(),
          date,
          notes: notes.trim(),
          results: picked.map((r) => ({
            playerId: r.playerId,
            buyIn: Number(r.buyIn),
            cashOut: Number(r.cashOut),
          })),
        };
        const validation = validateSession(saved);
        if (validation) return setError(validation);
        setSaving(true);
        try {
          await onSave(saved, {
            additions: newClips,
            removals: removedClipIds,
          });
        } catch (err) {
          setError(
            err.message ||
              "Couldn’t save these highlights. Your game and existing videos haven’t changed.",
          );
          setSaving(false);
        }
      }}
    >
      <h2>{session ? "Edit session" : "Add session"}</h2>

      <div className="form-row">
        <label className="form-label">
          Session name <span>*</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session name"
            maxLength={70}
            required
          />
        </label>
        <label className="form-label date-field">
          Date <span>*</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="session-form-heading">
        <h3>Players</h3>
        <button
          type="button"
          onClick={() =>
            setResults(
              allResults.map((r) => ({
                ...r,
                selected: !allResults.every((r) => r.selected),
              })),
            )
          }
          className="text-button"
        >
          {allResults.every((r) => r.selected) && players.length
            ? "Deselect all"
            : "Select all"}
        </button>
      </div>
      {players.length < 2 && (
        <div className="info-box">
          <Info size={18} />
          <span>
            You need at least two players.{" "}
            <button type="button" onClick={onAddPlayer}>
              Add a player first
            </button>
            .
          </span>
        </div>
      )}
      <div className="entry-table-wrap">
        <table className="entry-table">
          <thead>
            <tr>
              <th>PLAYER</th>
              <th>BUY-IN ({currency})</th>
              <th>CASH-OUT ({currency})</th>
              <th className="align-right">NET</th>
            </tr>
          </thead>
          <tbody>
            {allResults.map((r) => {
              const p = players.find((p) => p.id === r.playerId);
              return (
                <tr
                  key={r.playerId}
                  className={!r.selected ? "unselected" : ""}
                >
                  <td>
                    <label className="player-checkbox">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        onChange={(e) => {
                          const exists = results.some(
                            (x) => x.playerId === r.playerId,
                          );
                          if (!exists)
                            setResults((prev) => [
                              ...prev,
                              { ...r, selected: e.target.checked },
                            ]);
                          else update(r.playerId, "selected", e.target.checked);
                        }}
                      />
                      <Avatar player={p} size="small" />
                      <span>{p.name}</span>
                    </label>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label={`${p.name} buy-in`}
                      placeholder="0"
                      value={r.buyIn}
                      disabled={!r.selected}
                      onChange={(e) =>
                        update(r.playerId, "buyIn", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label={`${p.name} cash-out`}
                      placeholder="0"
                      value={r.cashOut}
                      disabled={!r.selected}
                      onChange={(e) =>
                        update(r.playerId, "cashOut", e.target.value)
                      }
                    />
                  </td>
                  <td
                    className={cx(
                      "entry-net",
                      "align-right",
                      Number(r.cashOut) - Number(r.buyIn) < 0
                        ? "negative"
                        : "positive",
                    )}
                  >
                    {r.selected
                      ? money(
                          Number(r.cashOut) - Number(r.buyIn),
                          currency,
                          true,
                        )
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="session-totals">
        <span>
          Total buy-in<strong>{money(totalIn, currency)}</strong>
        </span>
        <span>
          Total cash-out<strong>{money(totalOut, currency)}</strong>
        </span>
        <span className={Math.abs(diff) < 0.01 ? "positive" : "warning"}>
          {Math.abs(diff) < 0.01 ? (
            <>
              <Check size={15} /> Balanced
            </>
          ) : (
            <>
              <AlertCircle size={15} />
              {money(Math.abs(diff), currency)} {diff > 0 ? "extra" : "short"}
            </>
          )}
        </span>
      </div>
      {Math.abs(diff) >= 0.01 && (
        <p className="balance-note">
          Cash-outs and buy-ins don’t match. Check the amounts, or save as-is if
          a fee or an outside adjustment explains the difference.
        </p>
      )}
      <label className="form-label">
        Notes <span className="optional">(optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes"
          maxLength={500}
          rows={2}
        />
      </label>
      {session ? (
        <ClipEditor
          sessionId={session.id}
          newClips={newClips}
          setNewClips={setNewClips}
          removedClipIds={removedClipIds}
          setRemovedClipIds={setRemovedClipIds}
          disabled={saving}
        />
      ) : (
        <p className="new-session-video-note">
          Add videos after saving, in <strong>Edit session</strong>.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          <AlertCircle size={16} />
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="button secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="button primary"
          disabled={players.length < 2 || saving}
        >
          <Check size={16} />
          {saving ? "Saving…" : session ? "Save changes" : "Add session"}
        </button>
      </div>
    </form>
  );
}

function SessionDetail({ session, players, fmt, onEdit, onDelete }) {
  const results = [...session.results].sort(
    (a, b) => b.cashOut - b.buyIn - (a.cashOut - a.buyIn),
  );
  const total = results.reduce((s, r) => s + r.buyIn, 0);
  const imbalance = results.reduce((s, r) => s + r.cashOut - r.buyIn, 0);
  return (
    <>
      <div className="eyebrow">
        <CalendarDays size={13} />{" "}
        {dateLabel(session.date, { year: "numeric" }).toUpperCase()}
      </div>
      <h2>{session.title}</h2>
      <p className="modal-description">
        {session.results.length} players · {fmt(total)} total buy-in
      </p>
      <div className="detail-table-wrap">
        <table className="detail-table">
          <thead>
            <tr>
              <th>PLAYER</th>
              <th>BUY-IN</th>
              <th>CASH-OUT</th>
              <th className="align-right">NET RESULT</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const p = players.find((p) => p.id === r.playerId);
              const net = r.cashOut - r.buyIn;
              return (
                <tr key={r.playerId}>
                  <td>
                    <div className="detail-player">
                      <Avatar player={p} />
                      <span>
                        {p?.name || "Unknown player"}
                        {i === 0 && net > 0 && (
                          <small>
                            <Trophy size={10} /> TOP WINNER
                          </small>
                        )}
                      </span>
                    </div>
                  </td>
                  <td>{fmt(r.buyIn)}</td>
                  <td>{fmt(r.cashOut)}</td>
                  <td
                    className={cx(
                      "align-right",
                      net >= 0 ? "positive" : "negative",
                    )}
                  >
                    {fmt(net, true)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {Math.abs(imbalance) >= 0.01 && (
        <div className="info-box warning">
          <AlertCircle size={17} />
          <span>
            Buy-ins and cash-outs differ by {fmt(Math.abs(imbalance))}. This
            session includes an adjustment or unbalanced amounts.
          </span>
        </div>
      )}
      {session.notes && (
        <div className="session-notes">
          <span>NOTES</span>
          <p>“{session.notes}”</p>
        </div>
      )}
      <SessionHighlights sessionId={session.id} onEdit={onEdit} />
      <div className="form-actions split-actions">
        <button className="text-button danger-text" onClick={onDelete}>
          <Trash2 size={15} />
          Delete session
        </button>
        <button className="button primary" onClick={onEdit}>
          <Pencil size={15} />
          Edit session
        </button>
      </div>
    </>
  );
}

function PlayerProfile({ player, data, fmt, onEdit, onSession }) {
  const stats = getStandings([player], data.sessions)[0];
  const sessions = [...data.sessions]
    .filter((s) => s.results.some((r) => r.playerId === player.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="profile-heading">
        <Avatar player={player} size="large" />
        <div>
          <h2>{player.name}</h2>
          {player.tagline && <p>{player.tagline}</p>}
        </div>
      </div>
      <div className="profile-traits">
        <div>
          <span>Worst enemy</span>
          <p>{(player.worstEnemy ?? player.weaknesses) || "—"}</p>
        </div>
      </div>
      <div className="profile-stats">
        <div>
          <span>TOTAL WINNINGS</span>
          <strong className={stats.profit >= 0 ? "positive" : "negative"}>
            {fmt(stats.profit, true)}
          </strong>
        </div>
        <div>
          <span>SESSIONS</span>
          <strong>{stats.played}</strong>
        </div>
        <div>
          <span>WIN RATE</span>
          <strong>{stats.winRate}%</strong>
        </div>
      </div>
      <h3 className="profile-history-title">
        Session history <span></span>
      </h3>
      <div className="profile-history">
        {sessions.map((s) => {
          const r = s.results.find((r) => r.playerId === player.id);
          const net = r.cashOut - r.buyIn;
          return (
            <button key={s.id} onClick={() => onSession(s)}>
              <span
                className={cx(
                  "history-result-icon",
                  net >= 0 ? "profit" : "loss",
                )}
              >
                {net >= 0 ? (
                  <ArrowUpRight size={17} />
                ) : (
                  <ArrowDownLeft size={17} />
                )}
              </span>
              <span>
                <strong>{s.title}</strong>
                <small>{dateLabel(s.date, { year: "numeric" })}</small>
              </span>
              <strong className={net >= 0 ? "positive" : "negative"}>
                {fmt(net, true)}
              </strong>
              <ChevronRight size={15} />
            </button>
          );
        })}
        {!sessions.length && <p className="history-empty">No sessions yet.</p>}
      </div>
      <div className="form-actions">
        <button className="button secondary" onClick={onEdit}>
          <Pencil size={15} />
          Edit player
        </button>
      </div>
    </>
  );
}

function SettingsPanel({ data, setData, exportData, notify, onClose }) {
  const [currency, setCurrency] = useState(data.currency);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState("");
  const importFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Backup must be smaller than 10 MB.");
      const imported = JSON.parse(await file.text());
      const validPlayers =
        Array.isArray(imported.players) &&
        imported.players.every(
          (p) =>
            typeof p.id === "string" &&
            typeof p.name === "string" &&
            p.name.trim() &&
            typeof p.tagline === "string" &&
            (p.strengths == null || typeof p.strengths === "string") &&
            (p.weaknesses == null || typeof p.weaknesses === "string") &&
            (p.worstEnemy == null || typeof p.worstEnemy === "string") &&
            (!p.photo ||
              (typeof p.photo === "string" &&
                /^(https?:\/\/|data:image\/|\/players\/)/.test(p.photo))),
        );
      const ids = new Set(imported.players?.map((p) => p.id));
      if (
        imported.version !== 1 ||
        !validPlayers ||
        ids.size !== imported.players.length ||
        !Array.isArray(imported.sessions) ||
        !["INR", "USD", "EUR", "GBP"].includes(imported.currency) ||
        imported.sessions.some(
          (s) =>
            typeof s.id !== "string" ||
            typeof s.title !== "string" ||
            typeof s.date !== "string" ||
            !Array.isArray(s.results) ||
            validateSession(s) ||
            s.results.some((r) => !ids.has(r.playerId)),
        )
      )
        throw new Error(
          "This isn’t a valid soberSem3 backup. Your current records haven’t changed.",
        );
      // Shared writes must be acknowledged before reporting success.
      if (!cloud) localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      await setData(imported);
      if (!cloud)
        pruneSessionClips(imported.sessions.map((s) => s.id)).catch(() => {});
      notify("Backup restored.");
      onClose();
    } catch (err) {
      setError(
        err.name === "QuotaExceededError"
          ? "Not enough browser storage for this backup. Try a smaller file."
          : err.message || "Couldn’t read that backup.",
      );
    }
    e.target.value = "";
  };
  return (
    <>
      <h2>Settings</h2>
      {cloud && (
        <div className="settings-section">
          <button className="text-button" onClick={() => cloud.auth.signOut()}>
            Sign out
          </button>
        </div>
      )}

      <label className="form-label">
        Table currency
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="INR">₹ — Indian Rupee (INR)</option>
          <option value="USD">$ — US Dollar (USD)</option>
          <option value="EUR">€ — Euro (EUR)</option>
          <option value="GBP">£ — British Pound (GBP)</option>
        </select>
        <span className="input-hint">
          Changes the display symbol. Existing amounts aren’t converted.
        </span>
      </label>
      <div className="settings-section">
        <h3>Backup</h3>
        <p>
          {cloud
            ? "Records are shared with your table. Export a backup before replacing or clearing them."
            : "Records live in this browser, not on a server. Export regularly and before clearing browser data."}
        </p>
        <div className="backup-actions">
          <button className="button secondary" onClick={exportData}>
            <Download size={15} />
            Export backup
          </button>
          <label className="button secondary">
            <Upload size={15} />
            Restore backup
            <input
              type="file"
              accept="application/json,.json"
              className="file-input"
              onChange={importFile}
            />
          </label>
        </div>
        <small className="input-hint">
          Restoring a backup replaces the current players and sessions. Video
          files aren’t included in JSON backups; download them individually from
          the session highlights.
        </small>
      </div>
      <div className="settings-section">
        <h3>{data.demo ? "Demo data" : "Clear data"}</h3>
        <p>
          {data.demo
            ? "Remove sample players and sessions."
            : "Remove all players, sessions, and videos. Export a backup first."}
        </p>
        {confirmClear ? (
          <div className="clear-confirm">
            <p>
              {cloud
                ? "This permanently removes all players, sessions, and videos for everyone at your table."
                : "This permanently removes all players, sessions, and uploaded videos from this browser."}
            </p>
            <button
              className="button danger-button small-button"
              onClick={async () => {
                try {
                  if (!cloud) await clearSessionClips();
                  await setData({
                    version: 1,
                    players: [],
                    sessions: [],
                    currency,
                    demo: false,
                  });
                } catch (error) {
                  setError(
                    error.message ||
                      "Couldn’t clear records. Please try again.",
                  );
                  return;
                }
                notify("Records cleared.");
                onClose();
              }}
            >
              Yes, clear everything
            </button>
            <button
              className="text-button"
              onClick={() => setConfirmClear(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="text-button danger-text"
            onClick={() => setConfirmClear(true)}
          >
            <RotateCcw size={14} />
            {data.demo ? "Clear demo data" : "Clear all records"}
          </button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          <AlertCircle size={15} />
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          className="button primary"
          onClick={async () => {
            try {
              await setData((d) => ({ ...d, currency }));
              notify("Settings saved.");
              onClose();
            } catch (error) {
              setError(error.message);
            }
          }}
        >
          <Check size={15} />
          Save settings
        </button>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SharedAccess>
      <App />
    </SharedAccess>
  </React.StrictMode>,
);
