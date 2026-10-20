import assert from "node:assert/strict";
import test from "node:test";

import {
  parseTryUgcPilotBrowserSession,
  serializeTryUgcPilotBrowserSession,
} from "./browser-session.ts";

const now = Date.UTC(2026, 8, 20, 12, 0, 0);

const session = {
  url: "https://example.com",
  cards: [
    {
      id: "post-1",
      topic: "Persistence",
      hook: "your work should still be here",
      wallOfText: "Restore the deck after a refresh.",
    },
  ],
  businessContext: {
    brand: "Example",
    url: "https://example.com",
    title: "Example",
    description: "Example description",
    markdown: "# Example",
  },
  nextPostNumber: 17,
  recentHooks: ["your work should still be here"],
  swipedCount: 3,
  generatedCount: 16,
  postedCount: 2,
  skippedCount: 1,
  notice: "Restored your saved Wall-of-Text deck.",
};

test("round-trips a valid Try UGC Pilot browser session", () => {
  const raw = serializeTryUgcPilotBrowserSession(session, now);

  assert.deepEqual(parseTryUgcPilotBrowserSession(raw, now), {
    ...session,
    savedAt: now,
  });
});

test("does not restore expired or malformed browser sessions", () => {
  const expired = serializeTryUgcPilotBrowserSession(session, now - 31 * 24 * 60 * 60 * 1000);

  assert.equal(parseTryUgcPilotBrowserSession(expired, now), null);
  assert.equal(parseTryUgcPilotBrowserSession('{"version":1,"cards":"not-an-array"}', now), null);
});
