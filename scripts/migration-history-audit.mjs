import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Match the read-only database evidence normalization exactly. Do not erase
// SQL comments, inner whitespace, clauses or grants to manufacture equivalence.
export function migrationSqlHash(sql) {
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n").replace(/^[\r\n\t ]+|[\r\n\t ]+$/g, ""), "utf8").digest("hex");
}

export function auditMigrationHistory(local, evidence) {
  if (evidence?.schemaVersion !== 1 || evidence.readOnly !== true || !Array.isArray(evidence.rows)) throw new Error("Use a verified read-only ledger evidence file");
  const remote = new Map(), versions = new Set();
  for (const row of evidence.rows) {
    if (!/^\d{14}$/.test(row.version) || remote.has(row.version) || typeof row.name !== "string" || (row.sql_sha256 !== null && !/^[a-f0-9]{64}$/.test(row.sql_sha256))) throw new Error("Invalid or duplicate hosted migration evidence");
    remote.set(row.version, row);
  }
  const rows = local.map((file) => {
    const match = /^(\d{14})_(.+)\.sql$/.exec(file.path);
    if (!match || versions.has(match[1]) || typeof file.sql !== "string") throw new Error("Invalid or duplicate canonical migration version");
    const [, version, name] = match;
    versions.add(version);
    const sqlSha256 = migrationSqlHash(file.sql), applied = remote.get(version);
    if (applied) return { path: file.path, version, name, sqlSha256, status: !applied.sql_sha256 ? "applied-without-sql-evidence" : sqlSha256 === applied.sql_sha256 ? "already-applied-exact" : "applied-text-difference-needs-review", replayAllowed: false, hostedVersions: [version] };
    const matches = evidence.rows.filter((row) => row.sql_sha256 === sqlSha256);
    return { path: file.path, version, name, sqlSha256, status: matches.length ? "already-applied-under-another-version" : "unverified-not-a-deploy-plan", replayAllowed: false, hostedVersions: matches.map((row) => row.version) };
  });
  const hostedOnly = evidence.rows.filter((row) => !versions.has(row.version)).map((row) => ({ version: row.version, name: row.name, sqlSha256: row.sql_sha256, matchingGitPaths: rows.filter((file) => file.sqlSha256 === row.sql_sha256).map((file) => file.path) }));
  const counts = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return { schemaVersion: 1, readOnly: true, projectRef: evidence.projectRef, observedAt: evidence.observedAt, counts, rows, hostedOnly,
    readyForDeployment: false, note: "This is an evidence audit, not a command to apply SQL or repair the production ledger. A text-hash difference is not proof of a schema or semantic difference: comments, statement splitting and formatting need review. Review every history mismatch and schema/permission equivalence before deployment." };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const evidencePath = process.argv[2];
  if (!evidencePath) throw new Error("Pass the read-only migration ledger evidence path");
  const root = path.resolve(import.meta.dirname, "../supabase/migrations");
  const local = readdirSync(root).filter((name) => name.endsWith(".sql")).sort().map((name) => ({ path: name, sql: readFileSync(path.join(root, name), "utf8") }));
  console.log(JSON.stringify(auditMigrationHistory(local, JSON.parse(readFileSync(evidencePath, "utf8"))), null, 2));
}
