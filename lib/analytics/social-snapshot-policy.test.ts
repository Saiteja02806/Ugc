import assert from "node:assert/strict";
import test from "node:test";
import { selectSocialSnapshot, preserveSavedSocialAnalytics } from "./social-snapshot-policy.ts";

const connectedAt = "2026-09-01T00:00:00Z";
const completedAt = "2026-09-23T00:00:00Z";
const connection = { id: "owner-channel", status: "connected", connectedAt };
const account = { connectionId: connection.id, lastSyncedAt: completedAt, videos: [{ viewCount: 0 }] };
const job = { completedAt, output: { accounts: [account] } };

test("saved analytics preserves genuine zero metrics", () => {
  assert.deepEqual(selectSocialSnapshot([job], [connection]), {
    data: { accounts: [account] }, savedAt: Date.parse(completedAt),
  });
});
test("disconnected, other-owner, and pre-reconnect data cannot be reused", () => {
  assert.equal(selectSocialSnapshot([job], []), null);
  assert.equal(selectSocialSnapshot([job], [{ ...connection, id: "other" }]), null);
  assert.equal(selectSocialSnapshot([job], [{ ...connection, status: "revoked" }]), null);
  assert.equal(selectSocialSnapshot([job], [{ ...connection, connectedAt: "2026-09-24T00:00:00Z" }]), null);
});
test("partial cached accounts remain visible but require refresh", () => {
  assert.equal(selectSocialSnapshot([job], [connection, { ...connection, id: "new" }])?.savedAt, 0);
});
test("failed provider output does not remove the previous usable snapshot", () => {
  assert.deepEqual(selectSocialSnapshot([
    { ...job, output: { accounts: [{ connectionId: connection.id, lastSyncedAt: null, status: "error" }] } }, job,
  ], [connection])?.data.accounts, [account]);
});
test("malformed outputs and dates are ignored", () => {
  assert.equal(selectSocialSnapshot([{ completedAt, output: null }, { ...job, completedAt: "bad" }], [connection]), null);
});

test("provider failure keeps last successful metrics but successful empty results clear deleted videos", () => {
  const previous = { accounts: [account] };
  const error = { accounts: [{ connectionId: connection.id, status: "error", lastSyncedAt: null }] };
  assert.deepEqual((preserveSavedSocialAnalytics(previous, error) as typeof previous).accounts[0].videos, [{ viewCount: 0 }]);
  const empty = { accounts: [{ ...account, status: "ready", videos: [] }] };
  assert.deepEqual(preserveSavedSocialAnalytics(previous, empty), empty);
});
