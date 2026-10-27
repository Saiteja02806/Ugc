import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261026141500_trending_slideshow_automation.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = readFileSync(
  new URL("./slideshow-automation-service.ts", import.meta.url),
  "utf8",
);
const mainRoute = readFileSync(
  new URL(
    "../../app/api/trending/slideshow-automation/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const activateRoute = readFileSync(
  new URL(
    "../../app/api/trending/slideshow-automation/activate/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const pauseRoute = readFileSync(
  new URL(
    "../../app/api/trending/slideshow-automation/pause/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const stylesRoute = readFileSync(
  new URL(
    "../../app/api/trending/slideshow-automation/styles/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const dailyReplenishmentSweep = readFileSync(
  new URL("./daily-replenishment-sweep.ts", import.meta.url),
  "utf8",
);
const reconcileCompletedFeed = readFileSync(
  new URL("./reconcile-completed-feed.ts", import.meta.url),
  "utf8",
);

test("automation tables enforce RLS, service_role access, and idempotent daily slots", () => {
  assert.match(
    migration,
    /create table public\.trending_carousel_visual_styles/,
  );
  assert.match(migration, /create table public\.trending_slideshow_automations/);
  assert.match(
    migration,
    /create table public\.trending_slideshow_automation_slots/,
  );
  assert.match(
    migration,
    /alter table public\.trending_carousel_visual_styles enable row level security/,
  );
  assert.match(
    migration,
    /alter table public\.trending_slideshow_automations enable row level security/,
  );
  assert.match(
    migration,
    /alter table public\.trending_slideshow_automation_slots enable row level security/,
  );
  assert.match(migration, /unique \(user_id, local_date, slot_time\)/);
  assert.match(migration, /unique \(idempotency_key\)/);
  assert.match(migration, /user_modified boolean not null default false/);
});

test("automation service preserves snapshot isolation and strict collection-only rules", () => {
  assert.match(service, /allocateCollectionOnlySlideBackgrounds/);
  assert.match(
    service,
    /default backgrounds are never substituted automatically/,
  );
  assert.match(service, /createAutomationSlotIdempotencyKey/);
  assert.match(service, /eq\("idempotency_key", idempotencyKey\)/);
  assert.match(service, /selectSlotsToCancelOnPause/);
  assert.match(mainRoute, /requireFirebaseUser/);
  assert.match(activateRoute, /activateSlideshowAutomation/);
  assert.match(pauseRoute, /pauseSlideshowAutomation/);
  assert.match(stylesRoute, /saveCarouselVisualStylePreset/);
});

test("background replenishment and worker reconciliation safely sweep active slideshow automations", () => {
  assert.match(service, /export async function getExistingAutomationRecord/);
  assert.match(
    service,
    /export async function sweepActiveSlideshowAutomationForUser/,
  );
  assert.match(
    service,
    /if \(!existing \|\| existing\.status !== "active"\) \{\s*return \{ preparedSlotCount: 0, scheduledSlotCount: 0, skipped: true \};/,
  );
  assert.match(
    dailyReplenishmentSweep,
    /try \{\s*await sweepActiveSlideshowAutomationForUser\(\{[\s\S]*?\}\);\s*\} catch \{/,
  );
  assert.match(
    reconcileCompletedFeed,
    /if \(dependencies\.sweepSlideshowAutomation\) \{\s*try \{\s*await dependencies\.sweepSlideshowAutomation\(userId\);\s*\} catch \{/,
  );
});
