import assert from "node:assert/strict";
import test from "node:test";
import { auditMigrationHistory, migrationSqlHash } from "./migration-history-audit.mjs";

const version = "20261003122024";
const sql = "-- RLS is intentional\nselect 1;";
const local = [{ path: `${version}_preferences.sql`, sql }];
const evidence = (rows = [{ version, name: "preferences", sql_sha256: migrationSqlHash(sql) }]) => ({ schemaVersion: 1, readOnly: true, rows });

test("matches only line-ending and outer ASCII-whitespace differences", () => {
  assert.equal(migrationSqlHash(sql), migrationSqlHash(` \r\n${sql.replaceAll("\n", "\r\n")}\r\n\t`));
  assert.notEqual(migrationSqlHash(sql), migrationSqlHash(sql.replace("select 1", "select 2")));
  assert.notEqual(migrationSqlHash(sql), migrationSqlHash("select 1;"));
});
test("applied SQL is never scheduled to run again", () => {
  const report = auditMigrationHistory(local, evidence());
  assert.equal(report.rows[0].status, "already-applied-exact");
  assert.equal(report.rows[0].replayAllowed, false);
  assert.equal(report.readyForDeployment, false);
});
test("an identical name does not conceal a text difference, without calling it schema drift", () => {
  const report = auditMigrationHistory(local, evidence([{ version, name: "preferences", sql_sha256: migrationSqlHash("select 2;") }]));
  assert.equal(report.rows[0].status, "applied-text-difference-needs-review");
  assert.equal(report.rows[0].replayAllowed, false);
  assert.match(report.note, /text-hash difference is not proof of a schema or semantic difference/);
});
test("timestamp mismatches are already-applied SQL, not new migrations", () => {
  const report = auditMigrationHistory(local, evidence([{ version: "20261003122025", name: "different_name", sql_sha256: migrationSqlHash(sql) }]));
  assert.equal(report.rows[0].status, "already-applied-under-another-version");
  assert.deepEqual(report.rows[0].hostedVersions, ["20261003122025"]);
  assert.deepEqual(report.hostedOnly[0].matchingGitPaths, [local[0].path]);
});
test("empty historical SQL and unmatched files stay unresolved, not automatically applied", () => {
  assert.equal(auditMigrationHistory(local, evidence([{ version, name: "preferences", sql_sha256: null }])).rows[0].status, "applied-without-sql-evidence");
  assert.equal(auditMigrationHistory(local, evidence([])).rows[0].status, "unverified-not-a-deploy-plan");
});
test("duplicate versions and malformed or unverified evidence are rejected", () => {
  assert.throws(() => auditMigrationHistory([...local, ...local], evidence()), /duplicate/);
  assert.throws(() => auditMigrationHistory(local, evidence([...evidence().rows, ...evidence().rows])), /duplicate/);
  assert.throws(() => auditMigrationHistory(local, { ...evidence(), readOnly: false }), /verified/);
  assert.throws(() => auditMigrationHistory(local, evidence([{ version, name: "preferences", sql_sha256: "not-a-hash" }])), /Invalid/);
});
