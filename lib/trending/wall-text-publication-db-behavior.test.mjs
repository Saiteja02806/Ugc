import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createWallTextLayout } from "./wall-text-feed-logic.ts";
import { createAuthoritativeWallTextContent } from "./wall-layout-engine.ts";
import { WALL_TEXT_GENERATOR_VERSION, WALL_TEXT_RENDER_SAFETY_VERSION } from "./wall-text-types.ts";

globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
let rows = [], audio = new Set(), calls = [];
mock.module("@supabase/supabase-js", { namedExports: { createClient: () => ({
  from(table) {
    assert.equal(table, "user_wall_text_assignments");
    const filters = [];
    return {
      select() { return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      then(resolve) {
        calls.push(filters);
        return Promise.resolve({ data: rows.filter(row => filters.every(([key, value]) => row[key] === value)), error: null }).then(resolve);
      },
      async upsert(input, options) {
        assert.equal(options.ignoreDuplicates, true);
        assert.equal(options.onConflict, "user_id,wall_text_creative_id");
        for (const row of input) {
          assert.ok(audio.has(row.wall_text_creative_id), "audio must precede feed publication");
          if (!rows.some(existing => existing.user_id === row.user_id && existing.wall_text_creative_id === row.wall_text_creative_id)) rows.push(row);
        }
        return { error: null };
      },
    };
  },
}) } });
mock.module("@/lib/trending/wall-audio-db", { namedExports: {
  ensureBaseWallTextAudioSelections: async ({ creatives }) => { for (const creative of creatives) audio.add(creative.creativeId); },
  listBaseWallTextAudioSelections: async () => new Map(),
} });
const { listUnassignedWallTextCreatives, publishTrendingWallTextAssignments } = await import("./wall-text-db.ts");

test("real publication queries are owner scoped, idempotent and preserve existing decisions", async () => {
  const environment = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.SUPABASE_URL = "https://offline.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-test";
  try {
    const fitted = await createAuthoritativeWallTextContent({
      content: { kind: "text", text: "After a rushed dinner, tracking every ingredient feels like one chore too many." },
      formatId: "hidden_cause", layout: createWallTextLayout(),
    });
    const scope = { businessProfileId: "profile", businessProfileVersion: 2, userId: "owner" };
    const template = {
      business_profile_id: "profile", business_profile_version: 2, user_id: "owner",
      source_kind: "ugcpilot", generator_version: WALL_TEXT_GENERATOR_VERSION,
      layout: fitted.layout, text_content: { ...fitted.content, renderSafetyVersion: WALL_TEXT_RENDER_SAFETY_VERSION },
      duration_seconds: 6, candidate_index: 0, status: "preview_ready",
    };
    const creatives = ["orphan", "decided"].map(id => ({ ...template, id }));
    rows = [
      { user_id: "owner", business_profile_id: "profile", business_profile_version: 2, wall_text_creative_id: "decided", state: "rejected" },
      { user_id: "another-owner", business_profile_id: "profile", business_profile_version: 2, wall_text_creative_id: "orphan", state: "active" },
    ];
    audio = new Set(); calls = [];
    const missing = await listUnassignedWallTextCreatives({ ...scope, creatives });
    assert.deepEqual(missing.map(row => row.id), ["orphan"]);
    assert.deepEqual(calls[0], [["user_id", "owner"], ["business_profile_id", "profile"], ["business_profile_version", 2]]);
    await publishTrendingWallTextAssignments({ ...scope, creatives });
    await publishTrendingWallTextAssignments({ ...scope, creatives });
    assert.equal(rows.filter(row => row.user_id === "owner").length, 2);
    assert.equal(rows.find(row => row.wall_text_creative_id === "decided").state, "rejected");
    assert.deepEqual(await listUnassignedWallTextCreatives({ ...scope, creatives }), []);
  } finally {
    for (const [name, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
