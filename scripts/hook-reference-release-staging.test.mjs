import assert from "node:assert/strict";
import { mock, test } from "node:test";
import release from "../worker/src/lib/explore-hook-reference-release.json" with { type: "json" };
import additions from "../worker/src/lib/explore-hook-reference-addition-release.json" with { type: "json" };
import { validateHookRelease } from "./hook-reference-release-readiness.mjs";
import textCatalog from "../lib/explore/reference-text-catalog.json" with { type: "json" };

process.env.GCP_STORAGE_BUCKET = "hook-staging-offline-fixture";
process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://catalogue.example.test";
// An uploaded release is still invisible until its explicit activation step.
mock.module(new URL("../worker/src/lib/explore-hook-reference-release.json", import.meta.url), { defaultExport: { ...release, mediaStatus: "published", activation: "pending" } });
mock.module(new URL("../worker/src/lib/explore-hook-reference-addition-release.json", import.meta.url), { defaultExport: { ...additions, mediaStatus: "published", activation: "pending" } });
const { getRecreateReferences, getRecreateReference, getArchivedHookReferences } = await import("../lib/explore/recreate-catalog.ts");
const { getReferenceText } = await import("../lib/explore/reference-text-store.ts");
const { filterReferences } = await import("../lib/explore/recreate-types.ts");
test("uploaded but inactive hooks cannot enter the gallery or retire the current cards", () => {
  const refs = getRecreateReferences();
  assert.ok(refs.some(item => item.id === "explore-hook-01"));
  assert.equal(refs.some(item => [...release.items, ...additions.items].some(next => next.id === item.id)), false);
  const archived = getArchivedHookReferences();
  assert.equal(archived.length, release.items.length + additions.items.length);
  assert.equal(filterReferences([...refs, ...archived], "hook", []).some(item => archived.some(hidden => hidden.id === item.id)), false);
  for (const item of [...release.items.filter(item => !release.excludedReferenceIds.includes(item.id)), ...additions.items]) {
    assert.equal(getRecreateReference(item.id)?.videoUrl.endsWith(`${item.videoSha256}.mp4`), true);
    assert.equal(getReferenceText(item.id, null, "hook")?.status, "ready", "saved new-hook remix survives gallery rollback");
  }
  assert.equal(validateHookRelease({ ...release, mediaStatus: "staged", activation: "pending" }, textCatalog).eligible.length, 45);
});
