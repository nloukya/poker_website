import React, { useState, useEffect } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
const cx = (...classes) => classes.filter(Boolean).join(" ");
export const periods = {
  all: "All time",
  month: "This month",
  "30days": "Last 30 days",
  year: "This year",
};

export function Avatar({ player, size = "", crown = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [player?.photo]);
  return (
    <span
      className={cx("avatar", size, crown && "crowned")}
      style={{ "--avatar-color": player?.color || "#b8c8a0" }}
    >
      {player?.photo && !failed ? (
        <img
          src={
            player.photo.startsWith("/players/")
              ? `${import.meta.env.BASE_URL}${player.photo.slice(1)}`
              : player.photo
          }
          alt={player.name}
          onError={() => setFailed(true)}
        />
      ) : (
        <span>
          {(player?.name || "?")
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </span>
      )}
      {crown && <span className="avatar-crown">♛</span>}
    </span>
  );
}

export function PeriodSelect({ period, setPeriod }) {
  return (
    <label className="period-select">
      <CalendarDays size={14} />
      <select
        value={period}
        aria-label="Date range"
        onChange={(e) => setPeriod(e.target.value)}
      >
        {Object.entries(periods).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown size={13} />
    </label>
  );
}
