// Keep an unavailable database from receiving a fresh retry every 15 seconds.
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
      retryAt = now() + Math.min(300000, 30000 * 2 ** Math.min(failures, 4));
      failures++;
    },
  };
}
