import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = read(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260817203000_add_carousel_phase8_admin_analytics.sql",
);
const route = read("app/api/admin/carousel/route.ts");
const serverAccess = read("lib/carousel/server-admin-access.ts");
const adminStore = read("lib/carousel/admin-store.ts");
const settingsUi = read("components/settings/carousel-admin-settings.tsx");
const settingsWorkspace = read("components/settings/settings-workspace.tsx");
const structure2Selector = read("lib/carousel/structure-2-selector.ts");

test("the owner can atomically select exactly one approved routing mode", () => {
  assert.match(
    migration,
    /create or replace function public\.set_carousel_structure_mode/i,
  );
  assert.match(
    migration,
    /p_structure_mode not in \([\s\S]*'rotate'[\s\S]*'structure_1_only'[\s\S]*'structure_2_only'/i,
  );
  assert.match(
    migration,
    /structure_config_version = settings\.structure_config_version \+ 1/i,
  );
  assert.match(
    migration,
    /settings\.structure_mode is distinct from p_structure_mode/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.set_carousel_structure_mode\(text, text\)[\s\S]*to service_role/i,
  );
  assert.match(route, /z\.enum\(CAROUSEL_STRUCTURE_MODES\)/);
});

test("admin APIs fail closed behind a dedicated verified-email allowlist", () => {
  assert.match(serverAccess, /CAROUSEL_ADMIN_EMAILS/);
  assert.match(serverAccess, /requireFirebaseUser\(request\)/);
  assert.match(serverAccess, /FirebaseAuthRequestError\([\s\S]*?403/);
  assert.match(route, /requireCarouselAdmin\(request\)/g);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.match(route, /"X-Content-Type-Options": "nosniff"/);
  assert.match(adminStore, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("Phase 8 analytics use authoritative lifecycle and view records", () => {
  assert.match(migration, /from public\.carousel_generations as generation/i);
  assert.match(migration, /from public\.library_items as item/i);
  assert.match(migration, /from public\.scheduled_posts as scheduled/i);
  assert.match(migration, /from public\.scheduled_post_targets as target/i);
  assert.match(
    migration,
    /from public\.carousel_performance_observations as observation/i,
  );
  assert.match(migration, /observation\.evaluated_at is not null/i);
  assert.match(migration, /target\.status = 'published'/i);
  assert.match(migration, /scheduled\.scheduled_for is not null/i);
  assert.match(migration, /percentile_cont\(0\.5\)/i);
});

test("analytics keep structure and format identities paired", () => {
  assert.match(
    migration,
    /group by generated_events\.structure_id, generated_events\.content_format_id/i,
  );
  assert.match(
    migration,
    /views\.structure_id = key\.structure_id[\s\S]*views\.content_format_id = key\.content_format_id/i,
  );
  assert.match(settingsUi, /row\.scope === "format"/);
  assert.match(settingsUi, /row\.structureId === structureId/);
  assert.match(settingsUi, /Eight-format story system/);
  assert.match(settingsUi, /CAROUSEL_STRUCTURE_2_FORMAT_IDS/);
  assert.match(adminStore, /isCarouselStructure2FormatId/);
  assert.match(adminStore, /isCarouselContentFormatId/);
});

test("the Carousel control is not mounted in customer Settings", () => {
  assert.doesNotMatch(settingsWorkspace, /CarouselAdminSettings/);
  assert.match(settingsUi, /Rotate 50\/50/);
  assert.match(settingsUi, /Structure 1 only/);
  assert.match(settingsUi, /Structure 2 only/);
  assert.match(settingsUi, /complete five-carousel batches/i);
  assert.match(settingsUi, /histories remain unchanged/i);
  assert.match(settingsUi, /Last \{dashboard\.windowDays\} days/);
});

test("performance weighting preserves Structure 2 controlled exploration", () => {
  assert.match(structure2Selector, /performance_weighted/);
  assert.match(structure2Selector, /exploration/i);
  assert.match(
    structure2Selector,
    /CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY\.formats/,
  );
});

test("the Phase 8 migration is additive and service-only", () => {
  assert.doesNotMatch(
    migration,
    /^\s*(?:delete\s+from|truncate(?:\s+table)?|drop\s+table)\b/im,
  );
  assert.match(
    migration,
    /revoke all on function public\.get_carousel_admin_analytics\(integer\)[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_carousel_admin_analytics\(integer\)[\s\S]*to service_role/i,
  );
  assert.match(migration, /select pg_notify\('pgrst', 'reload schema'\)/i);
});

function read(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
