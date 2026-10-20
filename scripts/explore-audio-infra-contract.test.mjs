import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
test("private Audio provisioning is opt-in, separate, server-only and cannot delete an existing media bucket", () => {
  const source = read("infra/gcp/foundation/private-audio.tf");
  assert.match(source, /public_access_prevention\s*=\s*"enforced"/);
  assert.match(source, /uniform_bucket_level_access\s*=\s*true/);
  assert.match(source, /force_destroy\s*=\s*false/); assert.match(source, /prevent_destroy\s*=\s*true/);
  assert.match(source, /var.private_audio_bucket_name != var.media_bucket_name/);
  assert.doesNotMatch(source, /member\s*=\s*"all(?:Users|AuthenticatedUsers)"|cors\s*\{/);
  assert.match(source, /"storage.buckets.get"/); assert.match(source, /"storage.objects.create"/);
  assert.doesNotMatch(source, /"storage.objects.list"|roles\/storage.admin/);
});
test("AI worker Audio activation adds its job type without replacing existing types or exposing plaintext credentials", () => {
  const locals = read("infra/gcp/ai-generation-worker/locals.tf"), main = read("infra/gcp/ai-generation-worker/main.tf");
  assert.match(locals, /distinct\(concat\(/); assert.match(locals, /split\(",", var.worker_job_types\)/); assert.match(locals, /\["generate_audio"\]/);
  assert.match(main, /value = local.effective_worker_job_types/);
  assert.match(main, /Use enable_audio_generation to admit Audio jobs/);
  assert.match(main, /var.private_audio_bucket_name != var.gcp_storage_bucket/);
  assert.match(main, /name = "ELEVENLABS_VOICE_API_KEY"[\s\S]*?secret_key_ref/);
  assert.match(main, /google_secret_manager_secret_iam_member" "audio_worker_accessor/);
  assert.match(main, /depends_on\s*=\s*\[google_secret_manager_secret_iam_member\.audio_worker_accessor\]/);
  for (const [file, flag] of [["infra/gcp/ai-generation-worker/variables.tf", "enable_audio_generation"], ["infra/gcp/video-render-worker/variables.tf", "explore_subtitle_transcription_enabled"]]) assert.match(read(file), new RegExp(`variable "${flag}"[^}]*default\\s*=\\s*false`));
});
test("both the compatibility video service and one-shot render job receive the gated Scribe secret", () => {
  const main = read("infra/gcp/video-render-worker/main.tf");
  assert.equal((main.match(/for_each = local.explore_transcription_secrets/g) ?? []).length, 2);
  assert.match(main, /google_secret_manager_secret_iam_member" "explore_scribe_accessor/);
  assert.match(main, /var.enable_video_render_worker && var.explore_subtitle_transcription_enabled/);
  for (const resource of ["google_cloud_run_v2_service", "google_cloud_run_v2_job"]) {
    const start = main.indexOf(`resource "${resource}" "video_render_worker"`);
    assert.ok(start >= 0);
    const next = main.indexOf('\nresource "', start + 1);
    const block = main.slice(start, next < 0 ? undefined : next);
    assert.match(block, /depends_on\s*=\s*\[google_secret_manager_secret_iam_member\.explore_scribe_accessor\]/);
  }
  assert.match(read("infra/gcp/video-render-worker/locals.tf"), /EXPLORE_SUBTITLE_TRANSCRIPTION_ENABLED/);
});
