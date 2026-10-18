import { test } from "node:test";
import assert from "node:assert/strict";
import { validateVideoFile, MAX_CLIP_SIZE } from "../src/media.js";

test("highlight uploads accept supported videos and reject invalid or oversized files", () => {
  assert.equal(
    validateVideoFile({
      name: "great-bluff.mp4",
      type: "video/mp4",
      size: 1024,
    }),
    "",
  );
  assert.equal(
    validateVideoFile({
      name: "river.WEBM",
      type: "video/webm",
      size: MAX_CLIP_SIZE,
    }),
    "",
  );
  assert.equal(
    validateVideoFile({ name: "phone.mov", type: "", size: 1024 }),
    "",
  );
  assert.ok(
    validateVideoFile({ name: "photo.png", type: "image/png", size: 1024 }),
  );
  assert.ok(
    validateVideoFile({
      name: "fake.mp4",
      type: "application/pdf",
      size: 1024,
    }),
  );
  assert.ok(
    validateVideoFile({ name: "empty.mp4", type: "video/mp4", size: 0 }),
  );
  assert.ok(
    validateVideoFile({
      name: "large.mp4",
      type: "video/mp4",
      size: MAX_CLIP_SIZE + 1,
    }),
  );
  assert.ok(validateVideoFile(null));
});
