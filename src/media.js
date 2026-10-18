export const MAX_CLIP_SIZE = 100 * 1024 * 1024;
export const MEDIA_CHANGE_EVENT = "poker-face-media-change";
const DB_NAME = "poker-face-highlights";
let opening;

export function validateVideoFile(file) {
  if (
    !file ||
    !/\.(mp4|webm|mov|m4v|ogv|ogg)$/i.test(file.name || "") ||
    (file.type && !file.type.startsWith("video/"))
  )
    return "Choose a video file: MP4, WebM, MOV, M4V, or Ogg.";
  if (!file.size) return "This video is empty. Choose another file.";
  if (file.size > MAX_CLIP_SIZE) return "Each video must be 100 MB or smaller.";
  return "";
}

function database() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB)
        return reject(
          new Error("Video storage is unavailable in this browser."),
        );
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const clips = db.createObjectStore("clips", { keyPath: "id" });
        clips.createIndex("sessionId", "sessionId", { unique: false });
        db.createObjectStore("files", { keyPath: "id" });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(
          new Error(
            "Close other soberSem3 tabs and try again to unlock video storage.",
          ),
        );
    }).catch((error) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}

function changed() {
  globalThis.dispatchEvent(new Event(MEDIA_CHANGE_EVENT));
}
function storageError(error) {
  return new Error(
    error?.name === "QuotaExceededError"
      ? "This browser has run out of video storage. Remove an old clip or choose a smaller video. Your existing videos are unchanged."
      : error?.message || "Couldn’t save your videos. Please try again.",
  );
}

export async function listSessionClips(sessionId) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const store = db.transaction("clips", "readonly").objectStore("clips");
    const request = sessionId
      ? store.index("sessionId").getAll(sessionId)
      : store.getAll();
    request.onsuccess = () =>
      resolve(request.result.sort((a, b) => a.createdAt - b.createdAt));
    request.onerror = () => reject(request.error);
  });
}

export async function getClipBlob(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("files", "readonly")
      .objectStore("files")
      .get(id);
    request.onsuccess = () =>
      request.result?.blob
        ? resolve(request.result.blob)
        : reject(new Error("This clip is no longer in browser storage."));
    request.onerror = () => reject(request.error);
  });
}

export async function saveSessionClips(
  sessionId,
  additions = [],
  removals = [],
) {
  if (!additions.length && !removals.length) return;
  if (!sessionId)
    throw new Error("Save a game night before adding highlights.");
  for (const clip of additions) {
    const error = validateVideoFile(clip.file);
    if (error) throw new Error(error);
  }
  try {
    const db = await database();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["clips", "files"], "readwrite");
      const clips = tx.objectStore("clips"),
        files = tx.objectStore("files");
      removals.forEach((id) => {
        const request = clips.get(id);
        request.onsuccess = () => {
          if (request.result?.sessionId === sessionId) {
            clips.delete(id);
            files.delete(id);
          }
        };
      });
      additions.forEach((clip, i) => {
        clips.put({
          id: clip.id,
          sessionId,
          name: clip.file.name,
          type: clip.file.type,
          size: clip.file.size,
          createdAt: Date.now() + i,
        });
        files.put({ id: clip.id, blob: clip.file });
      });
      tx.oncomplete = resolve;
      tx.onabort = () =>
        reject(tx.error || new Error("Video changes could not be saved."));
      tx.onerror = () => {};
    });
    changed();
  } catch (error) {
    throw storageError(error);
  }
}

async function removeIds(ids) {
  if (!ids.length) return;
  const db = await database();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(["clips", "files"], "readwrite");
    ids.forEach((id) => {
      tx.objectStore("clips").delete(id);
      tx.objectStore("files").delete(id);
    });
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  changed();
}
export async function deleteSessionClips(sessionId) {
  const clips = await listSessionClips(sessionId);
  await removeIds(clips.map((c) => c.id));
}
export async function pruneSessionClips(sessionIds) {
  const ids = new Set(sessionIds);
  const clips = await listSessionClips();
  await removeIds(clips.filter((c) => !ids.has(c.sessionId)).map((c) => c.id));
}
export async function clearSessionClips() {
  const db = await database();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(["clips", "files"], "readwrite");
    tx.objectStore("clips").clear();
    tx.objectStore("files").clear();
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  changed();
}
