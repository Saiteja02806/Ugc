import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, URL, console, process: { env: {} },
    require: name => {
      assert.ok(name in imports, `Unexpected import ${name}`);
      return imports[name];
    },
  });
  return exports;
}

const edit = load("worker/src/lib/explore-format-edit.ts", { "./explore-inline-symbols.ts": load("worker/src/lib/explore-inline-symbols.ts"),
  "./explore-text-fonts.ts": load("worker/src/lib/explore-text-fonts.ts", { "./explore-text-font-metrics.json": { default: JSON.parse(readFileSync(new URL("../../worker/src/lib/explore-text-font-metrics.json", import.meta.url), "utf8")) } }),
  "./edit-overlay-render-spec.ts": load("worker/src/lib/edit-overlay-render-spec.ts"),
});
const subtitleStyles = load("worker/src/subtitles/styles.ts");
const subtitleContracts = load("worker/src/subtitles/contracts.ts", { "./styles.ts": subtitleStyles });
const corrections = load("worker/src/subtitles/corrections.ts", { "./contracts.ts": subtitleContracts });
const contract = load("worker/src/lib/explore-finishing-contract.ts", {
  "./explore-format-edit.ts": edit,
  "../subtitles/styles.ts": subtitleStyles,
  "../subtitles/contracts.ts": subtitleContracts,
  "../subtitles/corrections.ts": corrections,
});
const errors = load("lib/scheduling/errors.ts");
const owner = "owner-a";
const requestKey = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const outputId = "33333333-3333-4333-8333-333333333333";
const sourceId = "44444444-4444-4444-8444-444444444444";
const accountId = "55555555-5555-4555-8555-555555555555";
const scheduleId = "66666666-6666-4666-8666-666666666666";
const fingerprint = "a".repeat(64);
const draft = {
  version: 1, kind: "hook", sourceAssetId: sourceId, demoAssetId: null,
  demoAudioAssetId: null, demoAudioPlayback: "once", backgroundAssetId: null,
  backgroundPlayback: "once", subtitles: null,
};
function validAsset() {
  return {
    id: outputId, user_id: owner, collection: "video", source_type: "combined_render",
    source_record_id: jobId, parent_asset_id: sourceId, project_id: "explore",
    status: "ready", deleted_at: null, mime_type: "video/mp4", title: "Finished Explore video",
    storage_key: contract.exploreFinishOutputKey(outputId), url: "https://media.example/video.mp4",
    duration_seconds: 12, file_size_bytes: 450000, width: 720, height: 1280, ratio: "9:16",
    metadata: { exploreFinish: true, requestKey, fingerprint, draft: structuredClone(draft) },
  };
}
function validReceipt() {
  return {
    user_id: owner, request_key: requestKey, fingerprint,
    job_id: jobId, output_asset_id: outputId, status: "completed", draft: structuredClone(draft),
  };
}
function captionedFixture(durationMs, kind = "phone") {
  const asset = validAsset(), receipt = validReceipt();
  asset.metadata.draft = receipt.draft = { ...draft, kind, subtitles: { language: "en", style: "clean", version: 2 } };
  asset.duration_seconds = durationMs === 9567 ? 9.566667 : durationMs / 1000;
  receipt.speech_duration_ms = durationMs;
  receipt.transcript = { schemaVersion: 1, provider: "elevenlabs", model: "scribe_v2", language: "en", durationMs,
    words: [{ text: "Hello", startMs: 100, endMs: 500 }, { text: "captions", startMs: 600, endMs: durationMs - 100 }] };
  return { asset, receipt };
}
/** Exercise the real store projection and parser before the policy reparses its receipt. */
function storedValidator(row) {
  const reads = [];
  const database = {
    from(table) {
      assert.equal(table, "explore_video_finishes");
      let fields;
      const filters = [], query = {
        select(value) { fields = value.split(","); return query; },
        eq(name, value) { filters.push([name, value]); return query; },
        async maybeSingle() {
          reads.push({ userId: filters.find(([name]) => name === "user_id")?.[1], key: filters.find(([name]) => name === "request_key")?.[1] });
          const matches = row && filters.every(([name, value]) => row[name] === value);
          return { data: matches ? Object.fromEntries(fields.filter(name => name in row).map(name => [name, row[name]])) : null, error: null };
        },
      };
      return query;
    },
  };
  const { ExploreFinishingRequestStore } = load("lib/explore/workflow-finishing-store.ts", {
    "server-only": {}, "@supabase/supabase-js": {}, "@/worker/src/lib/explore-finishing-contract": contract,
  });
  return { ...load("lib/scheduling/explore-finished-video.ts", {
    "server-only": {}, "@/worker/src/lib/explore-finishing-contract": contract, "@/lib/scheduling/errors": errors,
    "@/lib/explore/workflow-finishing-store": {
      ExploreFinishingRequestStore: class extends ExploreFinishingRequestStore { constructor() { super(database); } },
    },
  }), reads };
}
function validator(options = {}) {
  const reads = [];
  const policy = load("lib/scheduling/explore-finished-video.ts", {
    "server-only": {},
    "@/worker/src/lib/explore-finishing-contract": contract,
    "@/lib/scheduling/errors": errors,
    "@/lib/explore/workflow-finishing-store": {
      ExploreFinishingRequestStore: class {
        async read(userId, key) {
          reads.push({ userId, key });
          if (options.readError) throw options.readError;
          return options.receipt === undefined ? validReceipt() : options.receipt;
        }
      },
    },
  });
  return { ...policy, reads };
}

test("a completed owned Explore export is a single schedulable video", async () => {
  const policy = validator();
  assert.equal(await policy.isVerifiedExploreFinishedVideo(validAsset(), owner), true);
  assert.deepEqual(policy.reads, [{ userId: owner, key: requestKey }]);
  const phoneAsset = validAsset(), phoneReceipt = validReceipt();
  phoneAsset.metadata.draft.kind = phoneReceipt.draft.kind = "phone";
  assert.equal(policy.isCompletedExploreFinishedVideo(phoneAsset, phoneReceipt, owner), true);
});

test("unready, deleted, foreign and placeholder assets fail before receipt lookup", async () => {
  for (const change of [
    { status: "uploading" }, { deleted_at: "2026-10-12T00:00:00Z" }, { user_id: "owner-b" },
    { source_type: "catalog_influencer" }, { project_id: "other" }, { collection: "influencer" },
    { storage_key: "local-preview/video.mp4" }, { url: "blob:https://example/local-preview" },
    { url: "https://" }, { ratio: "invalid" },
    { duration_seconds: null }, { file_size_bytes: 0 }, { width: 0 }, { mime_type: "image/png" },
    { metadata: { exploreFinish: true } },
  ]) {
    const policy = validator();
    assert.equal(await policy.isVerifiedExploreFinishedVideo({ ...validAsset(), ...change }, owner), false,
      JSON.stringify(change));
    assert.equal(policy.reads.length, 0);
  }
});

test("only the matching completed owner-bound receipt verifies an export", async () => {
  for (const receipt of [
    null, { ...validReceipt(), status: "queued" }, { ...validReceipt(), status: "uncertain" },
    { ...validReceipt(), user_id: "owner-b" }, { ...validReceipt(), request_key: sourceId },
    { ...validReceipt(), output_asset_id: sourceId }, { ...validReceipt(), job_id: sourceId },
    { ...validReceipt(), fingerprint: "b".repeat(64) },
    { ...validReceipt(), draft: { ...draft, sourceAssetId: outputId } },
  ]) {
    const policy = validator({ receipt });
    assert.equal(await policy.isVerifiedExploreFinishedVideo(validAsset(), owner), false);
  }
  const altered = validAsset();
  altered.metadata.draft.backgroundAssetId = sourceId;
  assert.equal(validator().isCompletedExploreFinishedVideo(altered, validReceipt(), owner), false);
});

test("a storage outage remains recoverable and never bypasses verification", async () => {
  const policy = validator({ readError: new contract.ExploreFinishError("Storage unavailable", 503) });
  await assert.rejects(policy.isVerifiedExploreFinishedVideo(validAsset(), owner), {
    status: 503, code: "explore_finish_verification_unavailable",
  });
  const invalid = validator({ readError: new contract.ExploreFinishError("Invalid receipt", 409) });
  assert.equal(await invalid.isVerifiedExploreFinishedVideo(validAsset(), owner), false);
});

test("completed captions retain their saved speech timeline through parsing and real-store verification", async () => {
  for (const durationMs of [9567, 19200]) {
    for (const kind of ["phone", "hook"]) {
      const { asset, receipt } = captionedFixture(durationMs, kind);
      const parsed = contract.parseExploreFinishReceipt(receipt, owner, requestKey);
      assert.equal(parsed.speech_duration_ms, durationMs);
      assert.deepEqual(contract.parseExploreFinishReceipt(parsed, owner, requestKey), parsed);
      const policy = storedValidator(receipt);
      assert.equal(await policy.isVerifiedExploreFinishedVideo(asset, owner), true);
      assert.deepEqual(policy.reads, [{ userId: owner, key: requestKey }]);
    }
  }
});

test("invalid saved transcript timelines fail closed with a typed receipt error", async () => {
  const { asset, receipt } = captionedFixture(9567);
  for (const duration of [undefined, null, "9567", 0, -1, 120001, 9567.5, 19200]) {
    const malformed = { ...receipt, speech_duration_ms: duration };
    assert.throws(() => contract.parseExploreFinishReceipt(malformed, owner, requestKey),
      error => error instanceof contract.ExploreFinishError && error.status === 409 && error.code === "explore_finish_transcript_invalid");
    assert.equal(await storedValidator(malformed).isVerifiedExploreFinishedVideo(asset, owner), false);
  }
  for (const transcript of [
    { ...receipt.transcript, durationMs: 19200 },
    { ...receipt.transcript, words: [{ text: "forged", startMs: 100, endMs: 19200 }] },
    { ...receipt.transcript, words: [] },
  ]) {
    const malformed = { ...receipt, transcript };
    assert.throws(() => contract.parseExploreFinishReceipt(malformed, owner, requestKey),
      error => error instanceof contract.ExploreFinishError && error.code === "explore_finish_transcript_invalid");
    assert.equal(await storedValidator(malformed).isVerifiedExploreFinishedVideo(asset, owner), false);
  }
});

test("the real receipt store queries the owner and request together", async () => {
  const queries = [];
  let rows = [
    { ...validReceipt(), user_id: "owner-b" },
    { ...validReceipt(), request_key: sourceId },
    validReceipt(),
  ];
  const database = {
    from(table) {
      assert.equal(table, "explore_video_finishes");
      const filters = [], query = {
        select() { return query; },
        eq(name, value) { filters.push([name, value]); return query; },
        async maybeSingle() {
          queries.push(filters);
          const matching = rows.filter(row => filters.every(([name, value]) => row[name] === value));
          assert.ok(matching.length <= 1);
          return { data: matching[0] ?? null, error: null };
        },
      };
      return query;
    },
  };
  const { ExploreFinishingRequestStore } = load("lib/explore/workflow-finishing-store.ts", {
    "server-only": {}, "@supabase/supabase-js": {},
    "@/worker/src/lib/explore-finishing-contract": contract,
  });
  const policy = load("lib/scheduling/explore-finished-video.ts", {
    "server-only": {}, "@/worker/src/lib/explore-finishing-contract": contract,
    "@/lib/scheduling/errors": errors,
    "@/lib/explore/workflow-finishing-store": {
      ExploreFinishingRequestStore: class extends ExploreFinishingRequestStore {
        constructor() { super(database); }
      },
    },
  });
  assert.equal(await policy.isVerifiedExploreFinishedVideo(validAsset(), owner), true);
  rows = rows.slice(0, 2);
  assert.equal(await policy.isVerifiedExploreFinishedVideo(validAsset(), owner), false);
  assert.deepEqual(queries, [
    [["user_id", owner], ["request_key", requestKey]],
    [["user_id", owner], ["request_key", requestKey]],
  ]);
});

function serviceHarness(options = {}) {
  const calls = [], writes = [], policy = options.policy ?? validator(options);
  const asset = options.asset === undefined ? validAsset() : options.asset;
  const connection = {
    id: accountId, status: "connected", platform: "instagram", revoked_at: null,
    expires_at: null, refresh_token_ciphertext: null, scopes: ["instagram_business_content_publish"],
    ...options.connection,
  };
  const scheduledFor = new Date(Date.now() + 86400000).toISOString();
  let schedule = {
    id: scheduleId, userId: owner, sourceKind: "media_asset", mediaAssetId: outputId,
    projectId: "explore", title: "Finished Explore video", caption: "Caption", timezone: "UTC",
    status: "draft", targets: [], updatedAt: "2026-10-12T00:00:00Z",
    metadata: { mediaMode: "single_video" }, scheduledFor: null,
    ...options.schedule,
  };
  const service = load("lib/scheduling/service.ts", {
    "server-only": {}, "node:crypto": { createHash },
    "@/lib/scheduling/social-scheduler": {},
    "@/lib/queues/job-queue": { getQueueNameForJobType: jobType => {
      assert.equal(jobType, "publish_social_post"); return "social-publish";
    } }, "@/lib/jobs/background-jobs": {},
    "@/lib/billing/free-trial": {
      FreeTrialAccessError: class extends Error {},
      assertFreeTrialInstagramSchedulingAccess: async () => {
        calls.push("instagram-access");
        if (options.trialError) throw options.trialError;
      },
    },
    "@/lib/media/media-storage": {
      getMediaAssetForOwner: async params => {
        calls.push("owned-media");
        assert.equal(params.userId, owner); assert.equal(params.assetId, outputId);
        return asset;
      },
    },
    "@/lib/scheduling/db": {
      getScheduledPostByIdempotency: async () => null,
      getSchedulableMediaAsset: async params => {
        calls.push("schedule-media");
        assert.equal(params.userId, owner); assert.equal(params.assetId, outputId);
        return asset;
      },
      getConnectedSocialConnection: async params => {
        calls.push("owned-account");
        assert.equal(params.userId, owner); assert.equal(params.connectionId, accountId);
        return options.missingAccount ? null : connection;
      },
      insertScheduledPost: async row => {
        writes.push("schedule");
        assert.equal(row.media_asset_id, outputId); assert.equal(row.user_id, owner);
        schedule = { ...schedule, metadata: row.metadata, status: row.status };
        return { id: scheduleId, project_id: "explore" };
      },
      insertDirectScheduledPost: async ({ post, targets, queueName, requestHash }) => {
        assert.equal(post.media_asset_id, outputId); assert.equal(post.user_id, owner);
        assert.equal(queueName, "social-publish"); assert.ok(requestHash);
        writes.push("schedule", "targets");
        schedule = { ...schedule, metadata: post.metadata, status: "scheduling",
          targets: targets.map((row, index) => ({ ...row, id: `target-${index}`, status: "scheduling",
            scheduledFor, publishJobId: `publish-${index}` })) };
        return { created: true, post: { id: scheduleId, project_id: "explore" } };
      },
      getScheduledPostForUser: async () => schedule,
      insertScheduledPostTargets: async rows => {
        writes.push("targets"); return rows.map((row, index) => ({ ...row, id: `target-${index}` }));
      },
      markScheduledPostStatus: async params => { writes.push("status"); schedule.status = params.status; },
      prepareScheduledPostForPublishing: async params => {
        writes.push("prepare"); assert.equal(params.mediaAssetId, outputId);
        schedule.metadata = { ...schedule.metadata, ...params.metadata };
        return { id: scheduleId, project_id: "explore" };
      },
    },
    "@/lib/scheduling/render-asset-resolution": {},
    "@/lib/scheduling/platform-settings": {
      SchedulePlatformSettingsError: class extends Error {}, normalizeScheduleTargetSettings: () => ({}),
    },
    "@/lib/scheduling/schedule-time": load("lib/scheduling/schedule-time.ts"),
    "@/lib/scheduling/schedule-action-policy": load("lib/scheduling/schedule-action-policy.ts"),
    "@/lib/scheduling/errors": errors,
    "@/lib/scheduling/explore-finished-video": policy,
    "@/lib/scheduling/social-connection-policy": load("lib/scheduling/social-connection-policy.ts"),
    "@/lib/scheduling/tiktok-preflight": { assertTikTokScheduleEligibility: async () => { calls.push("tiktok-preflight"); } },
    "@/lib/scheduling/schedule-target-requirement": load("lib/scheduling/schedule-target-requirement.ts"),
    "@/lib/scheduling/render-finalization-policy": load("lib/scheduling/render-finalization-policy.ts"),
    "@/lib/scheduling/schedule-metadata": load("lib/scheduling/schedule-metadata.ts"),
    "@/lib/scheduling/target-scheduling": {
      scheduleTargetRowsWithDependencies: async params => {
        calls.push("schedule-provider"); assert.equal(params.targetRows.length, 1);
        schedule.targets = schedule.targets.map(target => ({ ...target, status: "scheduled" }));
        return { failedCount: 0, scheduledCount: 1 };
      },
    },
    "@/lib/scheduling/publish-retry": {},
    "@/lib/social/types": load("lib/social/types.ts"),
  });
  return {
    calls, writes, reads: policy.reads,
    create: inputChanges => service.createUserSchedule({
      userId: owner, allowTikTokTargets: options.allowTikTokTargets,
      allowYouTubeTargets: options.allowYouTubeTargets,
      input: {
        source: { kind: "media_asset", id: outputId }, timezone: "UTC", scheduledFor,
        metadata: { mediaMode: "single_video" }, targets: [{ connectionId: accountId }],
        ...inputChanges,
      },
    }),
    publish: () => service.scheduleRenderedPost({
      userId: owner, postId: scheduleId, input: { connectionIds: [accountId], scheduledFor, timezone: "UTC" },
    }),
  };
}

test("real schedule creation accepts the verified finished Explore video", async () => {
  const h = serviceHarness();
  const result = await h.create();
  assert.equal(result.created, true);
  assert.equal(result.schedule.status, "scheduled");
  assert.deepEqual(h.reads, [{ userId: owner, key: requestKey }]);
  assert.deepEqual(h.writes, ["schedule", "targets", "status"]);
  assert.ok(h.calls.includes("instagram-access"));
  assert.ok(h.calls.indexOf("owned-account") < h.calls.indexOf("owned-media"));
});

test("schedule creation and finalization accept completed captions through the actual receipt store", async () => {
  for (const durationMs of [9567, 19200]) {
    const { asset, receipt } = captionedFixture(durationMs);
    const h = serviceHarness({ asset, policy: storedValidator(receipt) });
    assert.equal((await h.create()).schedule.status, "scheduled");
    assert.deepEqual(h.writes, ["schedule", "targets", "status"]);
    assert.deepEqual(h.reads, [{ userId: owner, key: requestKey }]);
    const finalizing = serviceHarness({ asset, policy: storedValidator(receipt) });
    assert.equal((await finalizing.publish()).schedule.status, "scheduled");
    assert.deepEqual(finalizing.writes, ["prepare", "targets", "status"]);
  }
});

test("missing or forged speech durations cannot create a schedule or publishing targets", async () => {
  for (const duration of [undefined, null, "9567", 19200]) {
    const { asset, receipt } = captionedFixture(9567);
    receipt.speech_duration_ms = duration;
    const h = serviceHarness({ asset, policy: storedValidator(receipt) });
    await assert.rejects(h.create(), { status: 409, code: "publishable_media_required" });
    assert.deepEqual(h.writes, []);
    const finalizing = serviceHarness({ asset, policy: storedValidator(receipt) });
    await assert.rejects(finalizing.publish(), { status: 409, code: "scheduled_video_unavailable" });
    assert.deepEqual(finalizing.writes, []);
  }
});

test("unready, foreign, unverified or forged renders do not create scheduling rows", async () => {
  for (const options of [
    { asset: { ...validAsset(), status: "uploading" }, code: "media_not_ready" },
    { asset: { ...validAsset(), user_id: "owner-b" }, code: "publishable_media_required" },
    { receipt: null, code: "publishable_media_required" },
    { receipt: { ...validReceipt(), status: "queued" }, code: "publishable_media_required" },
    { asset: { ...validAsset(), metadata: { exploreFinish: true, requestKey } }, code: "publishable_media_required" },
  ]) {
    const h = serviceHarness(options);
    await assert.rejects(h.create(), { code: options.code });
    assert.deepEqual(h.writes, []);
  }
});

test("existing single-video drafts verify completed Explore output before publishing", async () => {
  const valid = serviceHarness();
  const result = await valid.publish();
  assert.equal(result.schedule.status, "scheduled");
  assert.deepEqual(valid.writes, ["prepare", "targets", "status"]);
  for (const options of [
    { receipt: null }, { receipt: { ...validReceipt(), status: "queued" } },
    { asset: { ...validAsset(), status: "uploading" } },
    { asset: { ...validAsset(), user_id: "owner-b" } },
  ]) {
    const h = serviceHarness(options);
    await assert.rejects(h.publish(), { code: "scheduled_video_unavailable" });
    assert.deepEqual(h.writes, []);
  }
});

test("the exception preserves account, scope, platform, time and historical hook guards", async () => {
  for (const [options, changes, code] of [
    [{ missingAccount: true }, {}, "invalid_schedule_request"],
    [{ connection: { status: "revoked" } }, {}, "social_connection_unavailable"],
    [{ connection: { scopes: [] } }, {}, "provider_permission_missing"],
    [{ connection: { platform: "youtube", scopes: ["https://www.googleapis.com/auth/youtube.upload"], refresh_token_ciphertext: "refresh-token" }, allowYouTubeTargets: false }, {}, "youtube_beta_access_required"],
    [{ connection: { platform: "tiktok", scopes: ["video.publish"] }, allowTikTokTargets: false }, {}, "tiktok_beta_access_required"],
    [{}, { targets: [{ connectionId: accountId, platform: "youtube" }] }, "invalid_schedule_request"],
    [{}, { scheduledFor: new Date(Date.now() - 60000).toISOString() }, "schedule_time_too_soon"],
    [{}, { targets: [] }, "schedule_target_required"],
    [{}, { metadata: { mediaMode: "combined_video" } }, "invalid_schedule_request"],
  ]) {
    const h = serviceHarness(options);
    await assert.rejects(h.create(changes), { code });
    assert.deepEqual(h.writes, []);
    assert.equal(h.reads.length, 0);
  }
});

test("existing direct video sources keep their whitelist behavior without a finishing lookup", async () => {
  for (const source_type of ["upload", "generated_video", "edit_export", "wall_text_render", "reaction_render", "demo_upload", "influencer_upload"]) {
    const h = serviceHarness({ asset: { ...validAsset(), source_type }, receipt: null });
    assert.equal((await h.create()).schedule.status, "scheduled");
    assert.equal(h.reads.length, 0);
    const draftHarness = serviceHarness({ asset: { ...validAsset(), source_type }, receipt: null });
    assert.equal((await draftHarness.publish()).schedule.status, "scheduled");
    assert.equal(draftHarness.reads.length, 0);
  }
});
