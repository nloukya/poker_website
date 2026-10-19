export const POLL_INTERVAL_MS = 60000;

// Failed checks slow down further, up to one attempt every five minutes.
export function createPollingSchedule(now = Date.now) {
  let failures = 0;
  let retryAt = 0;
  return {
    ready: () => now() >= retryAt,
    succeeded() {
      failures = 0;
      retryAt = 0;
    },
    failed() {
      retryAt =
        now() + Math.min(300000, POLL_INTERVAL_MS * 2 ** Math.min(failures, 4));
      failures++;
    },
  };
}
