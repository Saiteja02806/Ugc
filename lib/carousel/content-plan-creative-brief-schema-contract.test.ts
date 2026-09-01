import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260825110000_add_carousel_creative_briefs.sql",
    import.meta.url,
  ),
  "utf8",
);
const structure1Planner = readFileSync(
  new URL(
    "../../worker/src/lib/carousel-llm-slide-plan.ts",
    import.meta.url,
  ),
  "utf8",
);
const structure2Planner = readFileSync(
  new URL(
    "../../worker/src/lib/carousel-structure-2-story-plan.ts",
    import.meta.url,
  ),
  "utf8",
);
const contentPlanPlanner = readFileSync(
  new URL(
    "../../worker/src/lib/carousel-content-plan.ts",
    import.meta.url,
  ),
  "utf8",
);
const appContentPlan = readFileSync(
  new URL("./content-plan.ts", import.meta.url),
  "utf8",
);
const continuityMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260831103952_enforce_30_day_content_plan_continuity.sql",
    import.meta.url,
  ),
  "utf8",
);
const itemContextMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260831173300_add_per_idea_private_context.sql",
    import.meta.url,
  ),
  "utf8",
);

test("adds a private six-field creative-brief layer without changing the 150-item Carousel pool", () => {
  assert.match(
    migration,
    /create table if not exists public\.carousel_content_plan_briefs/i,
  );
  assert.match(migration, /brief_index smallint not null[\s\S]*between 1 and 30/i);

  for (const field of [
    "creative_seed",
    "audience_context",
    "human_moment",
    "emotional_tension",
    "supported_angle",
    "preferred_format_family",
  ]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`, "i"));
  }

  assert.match(
    migration,
    /p_target_item_count <> 150/i,
  );
  assert.match(
    migration,
    /jsonb_array_length\(p_items\) <> v_brief_count \* 5/i,
  );
});

test("links each new item to a parent brief while preserving legacy items", () => {
  assert.match(migration, /add column if not exists creative_brief_id uuid/i);
  assert.match(
    migration,
    /foreign key \(creative_brief_id, plan_id, user_id\)[\s\S]*references public\.carousel_content_plan_briefs/i,
  );
  assert.match(
    migration,
    /legacy items remain null and keep their original seed-plus-emotion behavior/i,
  );
});

test("keeps the creative brief private and treats its format family as a soft hint", () => {
  assert.match(
    migration,
    /Private, source-grounded six-field creative context/i,
  );
  assert.match(
    migration,
    /Private parent brief that may inform final writing/i,
  );
  assert.match(
    migration,
    /preferred_format_family in \([\s\S]*relatable_situation/i,
  );
  assert.doesNotMatch(
    migration,
    /^\s*(?:delete\s+from|truncate(?:\s+table)?|drop\s+table)\b/im,
  );
});

test("defines every private creative-brief field for the Carousel planner", () => {
  for (const definition of [
    /creativeSeed: The central human observation or tension\. It is not final copy/i,
    /audienceContext: The supported audience segment experiencing that situation\. It must not mean everyone/i,
    /humanMoment: One concrete, recognisable everyday event or situation/i,
    /emotionalTension: The inner feeling or conflict created by that moment/i,
    /supportedAngle: The factual connection to the business, based only on approved facts\. It is not a sales claim or a promise/i,
    /preferredFormatFamily: A soft storytelling direction, such as relatable situation or contrast\. It gives variety, but never overrides the backend-selected Carousel format/i,
  ]) {
    assert.match(contentPlanPlanner, definition);
  }

  assert.match(
    contentPlanPlanner,
    /For every child return creativeSeed, emotion, audienceContext/i,
  );
  assert.match(
    contentPlanPlanner,
    /children are not generated from the parent creativeSeed alone/i,
  );
  assert.match(
    contentPlanPlanner,
    /carousel-content-plan-creative-briefs-v6-item-context-concept-lanes/i,
  );
  assert.match(
    appContentPlan,
    /carousel-content-plan-creative-briefs-v6-item-context-concept-lanes/i,
  );
  assert.match(
    itemContextMigration,
    /private_context jsonb/i,
  );
});

test("uses private concept lanes and prior-cycle exclusions to keep related ideas broad", () => {
  assert.match(contentPlanPlanner, /getContentPlanItemConceptLanes/);
  assert.match(contentPlanPlanner, /conceptLanes: getCarouselItemConceptLanes/);
  assert.match(
    contentPlanPlanner,
    /Previous items are guidance, not a ban on a broad topic/i,
  );
  assert.match(
    contentPlanPlanner,
    /repair exactly one private Carousel plan idea/i,
  );
});

test("stores an individual private writing context without changing legacy parent-brief items", () => {
  assert.match(itemContextMigration, /add column if not exists private_context jsonb/i);
  assert.match(itemContextMigration, /private_context, status/i);
  assert.match(
    contentPlanPlanner,
    /identical text after normalizing case, punctuation, and spacing/i,
  );
  assert.doesNotMatch(contentPlanPlanner, /isNearVerbatimCopy/);
  assert.match(contentPlanPlanner, /MAX_SINGLE_IDEA_REPAIR_ATTEMPTS = 3/);
});

test("supplies the parent brief to both Carousel writers without overriding their selected format", () => {
  assert.match(structure1Planner, /privateCreativeBrief: item\.planningBrief/i);
  assert.match(
    structure1Planner,
    /backend-selected format and hook family remain authoritative/i,
  );
  assert.match(
    structure2Planner,
    /privateCreativeBrief: assignment\.planningBrief/i,
  );
  assert.match(
    structure2Planner,
    /preferredFormatFamily must never override the backend-selected format reference/i,
  );
});
