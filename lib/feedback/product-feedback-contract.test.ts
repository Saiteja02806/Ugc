import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readProjectFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const migration = readProjectFile(
  "supabase/migrations/20260824123801_create_product_feedback.sql",
);
const submissionRoute = readProjectFile("app/api/feedback/route.ts");
const adminRoute = readProjectFile("app/api/admin/feedback/route.ts");
const store = readProjectFile("lib/feedback/product-feedback-store.ts");
const settings = readProjectFile("components/settings/settings-workspace.tsx");
const support = readProjectFile(
  "components/settings/support-feedback-settings.tsx",
);

test("stores tickets and feature requests in one durable service-only table", () => {
  assert.match(migration, /create table if not exists public\.product_feedback/);
  assert.match(
    migration,
    /feedback_type in \('support_ticket', 'feature_request'\)/,
  );
  assert.match(migration, /char_length\(title\) between 3 and 120/);
  assert.match(migration, /char_length\(description\) between 10 and 4000/);
  assert.match(migration, /alter table public\.product_feedback enable row level security/);
  assert.match(
    migration,
    /revoke all privileges on table public\.product_feedback[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.match(
    migration,
    /grant select, insert, update[\s\S]*on table public\.product_feedback to service_role/,
  );
});

test("requires verified Firebase identity and validates every submission", () => {
  assert.match(submissionRoute, /requireFirebaseUser\(request\)/);
  assert.match(submissionRoute, /ProductFeedbackSchema\.safeParse/);
  assert.match(submissionRoute, /z\.enum\(PRODUCT_FEEDBACK_TYPES\)/);
  assert.match(submissionRoute, /sourcePath:[\s\S]*startsWith\("\/"\)/);
  assert.match(store, /\(count \?\? 0\) >= 10/);
  assert.match(store, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("keeps the owner inbox behind the verified email allowlist", () => {
  assert.match(adminRoute, /requireFirebaseUser\(request\)/);
  assert.match(adminRoute, /isProductFeedbackAdmin\(user\)/);
  assert.match(adminRoute, /canReview: false/);
  assert.match(adminRoute, /listProductFeedback\(100\)/);
});

test("adds two separate Settings sections and an owner-only request inbox", () => {
  assert.match(settings, /id: "raised-ticket"/);
  assert.match(settings, /label: "Raised Ticket"/);
  assert.match(settings, /id: "request-feature"/);
  assert.match(settings, /label: "Request Feature"/);
  assert.doesNotMatch(settings, /Support & feedback/);
  assert.match(
    settings,
    /<SupportFeedbackSettings type="support_ticket" showOwnerInbox \/>/,
  );
  assert.match(
    settings,
    /<SupportFeedbackSettings type="feature_request" \/>/,
  );
  assert.match(support, /isTicket \? "Raised Ticket" : "Request Feature"/);
  assert.match(support, /What went wrong\?/);
  assert.match(support, /Describe the feature/);
  assert.match(support, /Customer requests/);
  assert.match(support, /getCurrentUserIdToken\(\)/);
  assert.match(support, /response\.status === 401 \|\| response\.status === 403/);
});
