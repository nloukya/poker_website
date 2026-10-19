import { createClient } from "@supabase/supabase-js";

const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
export const sharedRequired = import.meta.env?.VITE_SHARED_REQUIRED === "true";
export const cloud = url && key ? createClient(url, key) : null;
export const CLOUD_CHANGE_EVENT = "sobersem3-cloud-change";

export async function readSharedTable() {
  const { data, error } = await cloud
    .from("club_state")
    .select("payload, revision, clip_manifest")
    .eq("id", 1)
    .single();
  if (error)
    throw new Error(
      "Can’t load the shared table. Check your connection. The owner may need to apply the public-view database update.",
    );
  return data;
}

export async function saveSharedTable(payload, revision, clips = {}) {
  const { data, error } = await cloud.rpc("save_club_state", {
    expected_revision: revision,
    new_payload: payload,
    clip_session: clips.sessionId || null,
    new_clips: clips.additions || [],
    removed_clip_ids: clips.removals || [],
  });
  if (error) {
    if (error.message?.includes("TABLE_CHANGED"))
      throw new Error(
        "The table changed on another phone. Close this form and reopen it before saving.",
      );
    throw new Error(
      "Couldn’t save to the shared table. Check your connection and try again.",
    );
  }
  return data;
}

export async function stageCloudClips(sessionId, additions) {
  const uploaded = [];
  try {
    for (const clip of additions) {
      const path = `${crypto.randomUUID()}.${clip.file.name.split(".").pop().toLowerCase()}`;
      const { error } = await cloud.storage
        .from("highlights")
        .upload(path, clip.file, {
          contentType: clip.file.type || "application/octet-stream",
          upsert: false,
        });
      if (error)
        throw new Error(
          "Video upload failed. Check your connection, file size, and storage quota.",
        );
      uploaded.push({
        id: clip.id,
        sessionId,
        name: clip.file.name,
        type: clip.file.type,
        size: clip.file.size,
        createdAt: Date.now(),
        path,
      });
    }
    return uploaded;
  } catch (error) {
    await removeCloudFiles(uploaded);
    throw error;
  }
}

export async function removeCloudFiles(clips) {
  const paths = clips.map((c) => c.path).filter(Boolean);
  if (paths.length) await cloud.storage.from("highlights").remove(paths);
}

// A lost HTTP response can hide a successful database commit. Never delete a
// staged file until a fresh read proves that no saved video references it.
export async function discardStagedClips(clips) {
  if (!clips.length) return;
  try {
    const row = await readSharedTable();
    const saved = new Set(row.clip_manifest.map((c) => c.path));
    await removeCloudFiles(clips.filter((c) => !saved.has(c.path)));
  } catch {
    /* Keep unconfirmed uploads rather than risk deleting saved media. */
  }
}

export function cloudChanged() {
  globalThis.dispatchEvent(new Event(CLOUD_CHANGE_EVENT));
  globalThis.dispatchEvent(new Event("poker-face-media-change"));
}
