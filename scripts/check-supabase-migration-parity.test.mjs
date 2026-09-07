import assert from "node:assert/strict";
import test from "node:test";
import { compareMigrationVersions, validateLedgerExport } from "./check-supabase-migration-parity.mjs";

const first = "20260906091416";
const second = "20260906091911";
test("matching versions pass even when historical ledger names differ", () => {
  assert.deepEqual(compareMigrationVersions([`${first}_fix.sql`], [{ version: first, name: "older_name" }]), []);
});
test("renumbered migration reports both sides of the drift", () => {
  const failures = compareMigrationVersions([`${first}_fix.sql`], [{ version: second }]);
  assert.equal(failures.length, 2);
  assert.match(failures[0], /Missing production history/);
  assert.match(failures[1], /missing from Git/);
});
test("unrecorded migration is detected", () => {
  assert.equal(compareMigrationVersions([`${first}_fix.sql`, `${second}_next.sql`], [{ version: first }]).length, 1);
});
test("duplicate timestamps and malformed SQL filenames fail", () => {
  const failures = compareMigrationVersions([`${first}_one.sql`, `${first}_two.sql`, "no_timestamp.sql"], [{ version: first }]);
  assert.equal(failures.length, 2);
});
test("empty or duplicate remote histories cannot pass", () => {
  assert.ok(compareMigrationVersions([], []).length);
  assert.match(compareMigrationVersions([`${first}_one.sql`], [{version:first}, {version:first}])[0], /Duplicate production/);
});
test("export must be complete, fresh, and from the expected project", () => {
  const now = Date.parse("2026-09-07T05:00:00Z");
  const ledger = {format:"ugc-supabase-migration-ledger-v1", expectedProjectRef:"production", exportedAt:new Date(now).toISOString(), migrations:[]};
  assert.doesNotThrow(() => validateLedgerExport(ledger, "production", now));
  assert.throws(() => validateLedgerExport(ledger, "another", now), /project/);
  assert.throws(() => validateLedgerExport(ledger, "production", now+3_600_001), /last hour/);
  assert.throws(() => validateLedgerExport({...ledger, migrations:null}, "production", now), /complete/);
});
