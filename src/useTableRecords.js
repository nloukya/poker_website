import { useState, useRef, useEffect, useCallback } from "react";
import { createPollingSchedule } from "./polling";
import {
  cloud,
  readSharedTable,
  saveSharedTable,
  removeCloudFiles,
  cloudChanged,
  CLOUD_CHANGE_EVENT,
} from "./cloud";

const empty = {
  version: 1,
  currency: "INR",
  players: [],
  sessions: [],
  demo: false,
};

export function useTableRecords(loadLocal) {
  const [data, setData] = useState(() => (cloud ? empty : loadLocal()));
  const [ready, setReady] = useState(!cloud);
  const [error, setError] = useState("");
  const current = useRef(null);
  const writing = useRef(false);
  const refreshing = useRef(false);
  const active = useRef(false);
  const polling = useRef(null);
  if (!polling.current) polling.current = createPollingSchedule();
  const refresh = useCallback(async () => {
    if (!cloud || writing.current || refreshing.current) return;
    refreshing.current = true;
    try {
      const row = await readSharedTable();
      if (!active.current || writing.current) return;
      if (!current.current || row.revision >= current.current.revision) {
        current.current = row;
        setData(row.payload);
        setReady(true);
      }
      polling.current.succeeded();
      setError("");
    } catch (err) {
      polling.current.failed();
      if (active.current) setError(err.message);
    } finally {
      refreshing.current = false;
    }
  }, []);
  useEffect(() => {
    if (!cloud) return;
    active.current = true;
    refresh();
    const interval = setInterval(() => {
      if (!document.hidden && polling.current.ready()) refresh();
    }, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener(CLOUD_CHANGE_EVENT, refresh);
    return () => {
      active.current = false;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener(CLOUD_CHANGE_EVENT, refresh);
    };
  }, [refresh]);
  const update = async (updater, revision, clips) => {
    if (!cloud) {
      setData(updater);
      return;
    }
    if (writing.current)
      throw new Error("Another save is in progress. Please wait.");
    if (!current.current) throw new Error("Wait for the shared table to load.");
    writing.current = true;
    try {
      const before = current.current;
      const next =
        typeof updater === "function" ? updater(before.payload) : updater;
      const row = await saveSharedTable(
        next,
        revision ?? before.revision,
        clips,
      );
      current.current = row;
      setData(row.payload);
      setError("");
      const kept = new Set(row.clip_manifest.map((c) => c.path));
      // Metadata and results commit together. Cleanup can safely happen afterwards.
      removeCloudFiles(
        before.clip_manifest.filter((c) => !kept.has(c.path)),
      ).catch(() => {});
      cloudChanged();
    } finally {
      writing.current = false;
    }
  };
  return {
    data,
    update,
    ready,
    error,
    refresh,
    getRevision: () => current.current?.revision,
  };
}
