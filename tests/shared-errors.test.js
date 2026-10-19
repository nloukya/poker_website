import { test } from "node:test";
import assert from "node:assert/strict";
import { sharedReadError } from "../src/shared-errors.js";

test("shared loading errors distinguish invalid keys, missing tables, permissions, service outages, and timeouts", () => {
  assert.match(
    sharedReadError({ message: "Invalid API key" }, 401),
    /connection key/,
  );
  assert.match(
    sharedReadError({ code: "PGRST205" }, 404),
    /hasn’t been set up/,
  );
  assert.match(sharedReadError({ code: "42P01" }, 404), /hasn’t been set up/);
  assert.match(sharedReadError({ code: "42501" }, 403), /denied permission/);
  assert.match(sharedReadError({ code: "PGRST116" }, 406), /empty or hidden/);
  assert.match(sharedReadError({}, 503), /temporarily unavailable/);
  assert.match(sharedReadError({}, 0), /internet connection/);
  assert.match(sharedReadError({}, 0, true), /took too long/);
  assert.doesNotMatch(
    sharedReadError({ message: "Failed to fetch" }, 0),
    /setup.sql|public-view/,
  );
});
