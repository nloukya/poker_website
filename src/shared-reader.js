const FULL_RECORD = "payload, revision, clip_manifest";

// All pages in a browser share one snapshot and one in-flight refresh. Checking
// the small revision column avoids re-reading/serializing photos on every poll.
export function createSharedReader(
  load,
  { now = Date.now, onChange = () => {}, maxAge = 5000 } = {},
) {
  let snapshot = null;
  let checkedAt = -Infinity;
  let pending = null;
  function remember(row) {
    if (!snapshot || row.revision >= snapshot.revision) {
      const changed = !snapshot || row.revision !== snapshot.revision;
      snapshot = row;
      checkedAt = now();
      if (changed) onChange(row);
    }
    return snapshot;
  }
  async function fetchSnapshot(fresh) {
    if (snapshot && !fresh) {
      const { revision } = await load("revision");
      if (revision <= snapshot.revision) {
        checkedAt = now();
        return snapshot;
      }
    }
    return remember(await load(FULL_RECORD));
  }
  return {
    peek: () => snapshot,
    remember,
    read({ fresh = false } = {}) {
      // Confirmation after an uncertain write must bypass cached/in-flight reads.
      if (fresh) return fetchSnapshot(true);
      if (pending) return pending;
      if (snapshot && now() - checkedAt < maxAge)
        return Promise.resolve(snapshot);
      pending = fetchSnapshot(false).finally(() => {
        pending = null;
      });
      return pending;
    },
  };
}
