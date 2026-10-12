import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { atomicJsonSync, renameWithRetrySync } from "./reference-text-atomic-write.mjs";
const testRoot = fileURLToPath(new URL("../.tmp/", import.meta.url));
mkdirSync(testRoot, { recursive: true });

function cleanTemporaryDirectory(directory) {
  assert.equal(path.dirname(directory), path.resolve(testRoot));
  assert.ok(path.basename(directory).startsWith("remix-atomic-"));
  for (const name of readdirSync(directory)) unlinkSync(path.join(directory, name));
  rmdirSync(directory);
}

test("transient destination locks retry without deleting approved data", () => {
  const directory = mkdtempSync(path.join(testRoot, "remix-atomic-"));
  try {
    const destination = path.join(directory, "catalog.json"), staged = destination + ".part";
    writeFileSync(destination, "approved"); writeFileSync(staged, "replacement");
    let attempts = 0; const delays = [];
    renameWithRetrySync(staged, destination, { sleep: ms => delays.push(ms), rename: (from, to) => {
      assert.equal(readFileSync(destination, "utf8"), "approved");
      if (++attempts < 3) throw Object.assign(new Error("locked"), { code: "EPERM" });
      renameSync(from, to);
    } });
    assert.equal(readFileSync(destination, "utf8"), "replacement");
    assert.deepEqual(delays, [50, 100]);
  } finally { cleanTemporaryDirectory(directory); }
});

test("persistent locks stop after bounded retries and retain both files", () => {
  const directory = mkdtempSync(path.join(testRoot, "remix-atomic-"));
  try {
    const destination = path.join(directory, "catalog.json"), staged = destination + ".part";
    writeFileSync(destination, "approved"); writeFileSync(staged, "replacement");
    let attempts = 0; const delays = [];
    assert.throws(() => renameWithRetrySync(staged, destination, { sleep: ms => delays.push(ms), rename: () => {
      attempts++; throw Object.assign(new Error("locked"), { code: "EBUSY" });
    } }), /locked/);
    assert.equal(attempts, 6); assert.equal(delays.reduce((a,b)=>a+b,0), 1550);
    assert.equal(readFileSync(destination, "utf8"), "approved");
    assert.equal(readFileSync(staged, "utf8"), "replacement");
  } finally { cleanTemporaryDirectory(directory); }
});

test("non-lock filesystem errors fail immediately", () => {
  let attempts = 0;
  assert.throws(() => renameWithRetrySync("missing", "destination", { sleep: () => assert.fail("unexpected delay"), rename: () => {
    attempts++; throw Object.assign(new Error("missing"), { code: "ENOENT" });
  } }), /missing/);
  assert.equal(attempts, 1);
});

test("atomic JSON replacement saves a complete parseable document", () => {
  const directory = mkdtempSync(path.join(testRoot, "remix-atomic-"));
  try {
    const file = path.join(directory, "catalog.json");
    atomicJsonSync(file, { items: ["first"] });
    atomicJsonSync(file, { items: ["second", "third"] }, true);
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { items: ["second", "third"] });
  } finally { cleanTemporaryDirectory(directory); }
});
