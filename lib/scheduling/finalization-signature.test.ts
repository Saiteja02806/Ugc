import assert from "node:assert/strict";
import test from "node:test";

import {
  createScheduleFinalizationSignature,
  deriveScheduleFinalizationSecret,
  verifyScheduleFinalizationSignature,
} from "./finalization-signature.ts";
import {
  createWorkerScheduleFinalizationSignature,
  deriveWorkerScheduleFinalizationSecret,
} from "../../worker/src/lib/schedule-finalization.ts";

const secret = "test-only-internal-finalization-secret-123456";
const now = Date.UTC(2026, 6, 15, 12, 0, 0);
const timestamp = now.toString();
const body = JSON.stringify({
  renderId: "9a691b80-42bb-4ca9-8f76-b089492fa88e",
  scheduleId: "791a0eb3-51eb-4fc6-a788-a66d57ed7a11",
  userId: "firebase-user-1",
});

test("derives the same isolated key in the app and worker", () => {
  const sourceSecret = "existing-service-credential-used-only-for-derivation";

  assert.equal(
    deriveWorkerScheduleFinalizationSecret(sourceSecret),
    deriveScheduleFinalizationSecret(sourceSecret),
  );
  assert.notEqual(
    deriveScheduleFinalizationSecret(sourceSecret),
    sourceSecret,
  );
});

test("accepts the render worker signature", () => {
  const signature = createWorkerScheduleFinalizationSignature({
    body,
    secret,
    timestamp,
  });

  assert.equal(
    signature,
    createScheduleFinalizationSignature({ body, secret, timestamp }),
  );
  assert.equal(
    verifyScheduleFinalizationSignature({
      body,
      now,
      secret,
      signature,
      timestamp,
    }),
    true,
  );
});

test("rejects a modified request body", () => {
  const signature = createScheduleFinalizationSignature({
    body,
    secret,
    timestamp,
  });

  assert.equal(
    verifyScheduleFinalizationSignature({
      body: `${body} `,
      now,
      secret,
      signature,
      timestamp,
    }),
    false,
  );
});

test("rejects expired timestamps", () => {
  const staleTimestamp = (now - 5 * 60 * 1000 - 1).toString();
  const signature = createScheduleFinalizationSignature({
    body,
    secret,
    timestamp: staleTimestamp,
  });

  assert.equal(
    verifyScheduleFinalizationSignature({
      body,
      now,
      secret,
      signature,
      timestamp: staleTimestamp,
    }),
    false,
  );
});

test("rejects signatures created with another secret", () => {
  const signature = createScheduleFinalizationSignature({
    body,
    secret: "another-test-only-secret-that-is-long-enough",
    timestamp,
  });

  assert.equal(
    verifyScheduleFinalizationSignature({
      body,
      now,
      secret,
      signature,
      timestamp,
    }),
    false,
  );
});

test("rejects malformed or missing signatures", () => {
  assert.equal(
    verifyScheduleFinalizationSignature({
      body,
      now,
      secret,
      signature: "v1=invalid",
      timestamp,
    }),
    false,
  );
  assert.equal(
    verifyScheduleFinalizationSignature({
      body,
      now,
      secret,
      signature: null,
      timestamp,
    }),
    false,
  );
});
