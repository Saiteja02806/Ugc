import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { pendingGenerationKey, readPendingGeneration, submitPendingGeneration, generationDiscoveryKey, readGenerationDiscoveries, checkGenerationDiscoveries, mergeStoredGenerationJobIds, GenerationClarificationError } from "./pending-generation.ts";

function fixture(kind = "image", scope = "slideshow") {
  const store = new Map(), calls = [], acknowledgements = [], requestKey = randomUUID(), jobId = randomUUID(), resultId = randomUUID();
  const key = pendingGenerationKey("owner", kind, scope);
  const jobs = [{ jobId, ...(kind === "image" ? { generationId: resultId } : { videoId: resultId }) }];
  const args = { ownerId: "owner", kind, scope, token: "token", input: { prompt: "original", model: "model", quantity: 1, exploreFormat: scope === "studio" ? undefined : scope },
    storage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
    locks: { request: async (_key, _options, callback) => callback({}) }, uuid: () => requestKey, assertActive() {}, onStored() {},
    acknowledge(result, input) { acknowledgements.push({ result, input }); },
    fetch: async (url, init) => {
      calls.push({ url, ...init });
      if (init.method === "POST") { assert.equal(JSON.parse(store.get(key)).requestKey, init.headers["Idempotency-Key"]); return Response.json({ ok: true, jobs, message: "queued" }); }
      return Response.json({ ok: true, requestKey, outcome: "confirmed", jobs });
    },
  };
  return { args, store, calls, acknowledgements, key, requestKey, jobs };
}

test("a slide assignment question preserves the input draft and clears only the rejected submission identity", async () => {
  const h = fixture();
  h.args.input = { ...h.args.input, slideshowContext: { version: 1, sources: [], uploads: [] } };
  h.args.fetch = async () => Response.json({ ok: false, message: "Which slide should use Upload A?", clarifications: ["Which slide should use Upload A?"] }, { status: 422 });
  await assert.rejects(submitPendingGeneration(h.args), error => {
    assert.ok(error instanceof GenerationClarificationError);
    assert.deepEqual(error.clarifications, ["Which slide should use Upload A?"]); return true;
  });
  assert.equal(h.store.has(h.key), false); assert.equal(h.args.input.prompt, "original"); assert.equal(h.acknowledgements.length, 0);
});
test("browser fetch remains detached for image/video submission, saved-request recovery and earlier-batch discovery", async () => {
  for (const [kind, scope] of [["image", "slideshow"], ["image", "studio"], ["video", "hook"], ["video", "wall_text"], ["video", "studio"]]) {
    const h = fixture(kind, scope), network = h.args.fetch;
    h.args.input.quantity = 2;
    h.args.fetch = async function (url, init) {
      assert.equal(this, undefined, "A native browser fetch rejects a request-options object as its receiver");
      return network(url, init);
    };
    const pending = { version: 1, ownerId: "owner", kind, scope, requestKey: h.requestKey, input: { ...h.args.input, idempotencyKey: h.requestKey } };
    await submitPendingGeneration(h.args);
    assert.equal(h.calls[0].method, "POST");
    assert.deepEqual(JSON.parse(h.calls[0].body), JSON.parse(JSON.stringify(pending.input)));
    h.store.set(h.key, JSON.stringify(pending));
    await submitPendingGeneration(h.args);
    assert.equal(h.calls[1].method, undefined);
    const result = await checkGenerationDiscoveries(h.args);
    assert.equal(result.remaining, 1);
    assert.equal(h.calls[2].method, undefined);
    assert.equal(h.calls.filter(call => call.method === "POST").length, 1);
  }
});
test("lost acknowledgement followed by reload recovers a terminal batch with GET and exact original settings", async () => {
  for (const [kind, scope] of [["image", "slideshow"], ["video", "hook"], ["video", "wall_text"], ["image", "studio"]]) {
    const h = fixture(kind, scope), network = h.args.fetch;
    h.args.fetch = async (url, init) => { await network(url, init); throw new Error("lost response"); };
    await assert.rejects(submitPendingGeneration(h.args), /lost response/);
    const saved = readPendingGeneration(h.store.get(h.key), "owner", kind, scope);
    assert.equal(saved.input.prompt, "original");
    h.args.input = { ...h.args.input, prompt: "changed after reload", quantity: 4 };
    h.args.fetch = network;
    await submitPendingGeneration(h.args);
    assert.equal(h.calls.filter(call => call.method === "POST").length, 1);
    assert.equal(h.acknowledgements[0].input.prompt, "original"); assert.equal(h.store.has(h.key), false);
  }
});
test("an unconfirmed request explicitly reuses the original key and payload instead of the edited draft", async () => {
  const h = fixture(), network = h.args.fetch;
  h.args.fetch = async (url, init) => { await network(url, init); throw new Error("lost response"); };
  await assert.rejects(submitPendingGeneration(h.args));
  const first = h.calls[0].body;
  h.args.input = { prompt: "replacement", quantity: 3 };
  h.args.fetch = async (url, init) => init.method === "POST" ? network(url, init) : Response.json({ ok: true, requestKey: h.requestKey, outcome: "unconfirmed", jobs: [] });
  await submitPendingGeneration(h.args);
  assert.equal(h.calls.at(-1).body, first);
});
test("failed recovery and storage failures retain identity and never dispatch replacements", async () => {
  const h = fixture();
  h.args.acknowledge = () => { throw new Error("cache write failed"); };
  await assert.rejects(submitPendingGeneration(h.args), /cache write failed/);
  assert.ok(h.store.has(h.key));
  h.args.fetch = async () => Response.json({ ok: false }, { status: 503 });
  await assert.rejects(submitPendingGeneration(h.args), /Could not check/);
  assert.equal(h.calls.length, 1);
  const blocked = fixture(); blocked.args.storage.setItem = () => { throw new Error("storage blocked"); };
  await assert.rejects(submitPendingGeneration(blocked.args), /storage blocked/); assert.equal(blocked.calls.length, 0);
});
test("cross-tab lock, owner isolation and invalid responses fail before clearing recovery", async () => {
  const h = fixture(); h.args.locks.request = async (_key, _options, callback) => callback(null);
  await assert.rejects(submitPendingGeneration(h.args), /Another tab/); assert.equal(h.calls.length, 0);
  const invalid = fixture(); invalid.args.fetch = async () => Response.json({ ok: true, jobs: [{ jobId: "invalid" }] });
  await assert.rejects(submitPendingGeneration(invalid.args), /Could not verify/); assert.ok(invalid.store.has(invalid.key));
  assert.throws(() => readPendingGeneration(invalid.store.get(invalid.key), "another-owner", "image", "slideshow"), /could not be verified/);
});

test("an in-flight partial GET keeps its base identity and later children merge without replaying paid work", async () => {
  for (const [kind, scope] of [["image", "slideshow"], ["image", "studio"], ["video", "hook"], ["video", "studio"]]) {
    const h = fixture(kind, scope), network = h.args.fetch;
    h.args.input = { ...h.args.input, quantity: 3 };
    h.args.fetch = async (url, init) => { await network(url, init); throw new Error("lost response during admission"); };
    await assert.rejects(submitPendingGeneration(h.args));
    const idKey = "owned-job-hints", metadata = new Map();
    h.args.acknowledge = (result, input) => {
      h.store.set(idKey, JSON.stringify(mergeStoredGenerationJobIds(h.args.storage, idKey, result.jobs)));
      result.jobs.forEach(job => metadata.set(job.jobId, input.prompt));
    };
    h.args.fetch = network;
    await submitPendingGeneration(h.args);
    const archiveKey = generationDiscoveryKey("owner", kind, scope);
    assert.equal(h.store.has(h.key), false, "Partial recovery does not trap a fresh explicit generation");
    assert.equal(readGenerationDiscoveries(h.store.get(archiveKey), "owner", kind, scope)[0].requestKey, h.requestKey);
    const laterJobs = Array.from({ length: 2 }, () => ({ jobId: randomUUID(), [kind === "image" ? "generationId" : "videoId"]: randomUUID() }));
    const newerJob = { jobId: randomUUID(), [kind === "image" ? "generationId" : "videoId"]: randomUUID() };
    h.args.input = { ...h.args.input, quantity: 1, prompt: "newer instructions" };
    h.args.uuid = randomUUID;
    h.args.fetch = async (url, init) => { h.calls.push({ url, ...init }); return Response.json({ ok: true, jobs: [newerJob], message: "new batch" }); };
    await submitPendingGeneration(h.args);
    const before = h.calls.filter(call => call.method === "POST").length;
    const result = await checkGenerationDiscoveries({ ...h.args, fetch: async (url, init) => {
      h.calls.push({ url, ...init });
      assert.equal(init.method, undefined); assert.ok(url.includes(h.requestKey));
      return Response.json({ ok: true, requestKey: h.requestKey, jobs: [...h.jobs, ...laterJobs], outcome: "confirmed" });
    } });
    assert.equal(result.remaining, 0); assert.equal(h.calls.filter(call => call.method === "POST").length, before);
    assert.deepEqual(new Set(JSON.parse(h.store.get(idKey))), new Set([newerJob.jobId, ...h.jobs.map(job => job.jobId), ...laterJobs.map(job => job.jobId)]));
    laterJobs.forEach(job => assert.equal(metadata.get(job.jobId), "original"));
    assert.equal(metadata.get(newerJob.jobId), "newer instructions");
    assert.deepEqual(readGenerationDiscoveries(h.store.get(archiveKey), "owner", kind, scope), []);
  }
});

test("a definitively partial admission remains discoverable without blocking new submissions or filling missing slots", async () => {
  const h = fixture(); h.args.input.quantity = 4;
  await submitPendingGeneration(h.args);
  const archiveKey = generationDiscoveryKey("owner", "image", "slideshow");
  assert.equal(h.store.has(h.key), false);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await checkGenerationDiscoveries(h.args);
    assert.equal(result.remaining, 1);
  }
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1);
  assert.equal(h.calls.length, 3);
  assert.equal(readGenerationDiscoveries(h.store.get(archiveKey), "owner", "image", "slideshow").length, 1);
});

test("partial archive writes and discovery acknowledgments fail safely before clearing their identities", async () => {
  const h = fixture(); h.args.input.quantity = 2;
  const archiveKey = generationDiscoveryKey("owner", "image", "slideshow"), write = h.args.storage.setItem;
  h.args.storage.setItem = (key, value) => { if (key === archiveKey) throw new Error("archive storage blocked"); write(key, value); };
  await assert.rejects(submitPendingGeneration(h.args), /archive storage blocked/);
  assert.equal(h.acknowledgements.length, 0); assert.ok(h.store.has(h.key));
  h.args.storage.setItem = write;
  await submitPendingGeneration(h.args);
  h.args.acknowledge = () => { throw new Error("metadata storage blocked"); };
  await assert.rejects(checkGenerationDiscoveries(h.args), /metadata storage blocked/);
  assert.equal(readGenerationDiscoveries(h.store.get(archiveKey), "owner", "image", "slideshow").length, 1);
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1);
});

test("discovery uses the same cross-tab lock and rejects another owner or scope before any GET", async () => {
  const h = fixture(); h.args.input.quantity = 2; await submitPendingGeneration(h.args);
  const callCount = h.calls.length;
  h.args.locks.request = async (key, options, callback) => { assert.equal(key, h.key); assert.equal(options.ifAvailable, true); return callback(null); };
  await assert.rejects(checkGenerationDiscoveries(h.args), /Another tab/);
  assert.equal(h.calls.length, callCount);
  const raw = h.store.get(generationDiscoveryKey("owner", "image", "slideshow"));
  assert.throws(() => readGenerationDiscoveries(raw, "another-owner", "image", "slideshow"), /could not be verified/);
  assert.throws(() => readGenerationDiscoveries(raw, "owner", "image", "studio"), /could not be verified/);
});

function apiFixture(records, options = {}) {
  const calls = [], exports = {};
  const code = ts.transpileModule(readFileSync(new URL("./generation-request-api.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  class AuthError extends Error { status = 401; }
  const imports = { "server-only": {}, "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError, requireFirebaseUser: async () => { if (options.unauthorized) throw new AuthError("Sign in"); return { uid: "owner" }; } },
    "@/lib/jobs/background-jobs": { getBackgroundJobByIdempotencyKey: async (key, scope) => { calls.push({ key, scope }); return records.shift() ?? null; } } };
  vm.runInNewContext(code, { exports, URL, Response, require: name => imports[name] });
  return { calls, run: query => exports.handleGenerationRequestRecovery(new Request(`https://app.test/api/ai-studio/generation-requests?${query}`)) };
}
test("read-only API recovers terminal and partial jobs through scoped child identities without inputs or output URLs", async () => {
  const key = randomUUID(), id = randomUUID();
  const record = { id, userId: "owner", jobType: "generate_image", status: "completed", input: { exploreFormat: "slideshow", generationId: randomUUID(), prompt: "private prompt" }, output: { url: "private output" } };
  const h = apiFixture([record, null]);
  const r = await h.run(new URLSearchParams({ requestKey: key, kind: "image", scope: "slideshow", quantity: "2" }));
  assert.equal(r.status, 200); const v = await r.json(); assert.equal(v.jobs[0].jobId, id); assert.equal(v.partial, true);
  assert.deepEqual(h.calls.map(call => call.key), [`${key}:1`, `${key}:2`]);
  assert.ok(h.calls.every(call => call.scope.userId === "owner")); assert.doesNotMatch(JSON.stringify(v), /private/);
});
test("API authenticates first and rejects invalid or mismatched provenance without exposing it", async () => {
  const auth = apiFixture([], { unauthorized: true }); assert.equal((await auth.run("kind=image")).status, 401); assert.equal(auth.calls.length, 0);
  const invalid = apiFixture([]); assert.equal((await invalid.run("requestKey=invalid&kind=image&quantity=1&scope=slideshow")).status, 400); assert.equal(invalid.calls.length, 0);
  const mismatch = apiFixture([{ id: randomUUID(), userId: "another-owner", jobType: "generate_image", input: { generationId: randomUUID() } }]);
  assert.equal((await mismatch.run(`requestKey=${randomUUID()}&kind=image&quantity=1&scope=studio`)).status, 503);
});

function slideshowJobs(key, slideCount = 5, versionCount = 2) {
  return Array.from({ length: slideCount * versionCount }, (_, index) => ({
    jobId: randomUUID(), generationId: randomUUID(), slideshowGeneration: {
      version: 1, batchKey: key, slideIndex: index % slideCount + 1, slideCount, versionIndex: Math.floor(index / slideCount) + 1, versionCount,
    },
  }));
}

test("five slides and two versions survive a lost acknowledgement, reload and GET-only later-child discovery", async () => {
  const h = fixture(), jobs = slideshowJobs(h.requestKey);
  h.args.input = { ...h.args.input, quantity: 2, slideshowSlideCount: 5 };
  h.args.fetch = async (url, init) => { h.calls.push({ url, ...init }); throw new Error("lost acknowledgement"); };
  await assert.rejects(submitPendingGeneration(h.args), /lost acknowledgement/);
  assert.equal(readPendingGeneration(h.store.get(h.key), "owner", "image", "slideshow").input.slideshowSlideCount, 5);
  h.args.input = { ...h.args.input, quantity: 4, slideshowSlideCount: 10, prompt: "changed draft" };
  h.args.fetch = async (url, init) => {
    h.calls.push({ url, ...init });
    const query = new URL(url, "https://app.test").searchParams;
    assert.equal(query.get("quantity"), "2"); assert.equal(query.get("slideshowSlideCount"), "5");
    assert.equal(init.method, undefined);
    return Response.json({ ok: true, requestKey: h.requestKey, jobs: jobs.slice(0, 6), outcome: "confirmed" });
  };
  await submitPendingGeneration(h.args);
  assert.equal(h.acknowledgements[0].result.partial, true);
  assert.equal(h.acknowledgements[0].result.jobs.length, 6);
  assert.deepEqual(h.acknowledgements[0].result.jobs[5].slideshowGeneration, jobs[5].slideshowGeneration);
  assert.equal(h.acknowledgements[0].input.prompt, "original");
  h.args.fetch = async (url, init) => {
    h.calls.push({ url, ...init }); assert.equal(init.method, undefined);
    assert.equal(new URL(url, "https://app.test").searchParams.get("slideshowSlideCount"), "5");
    return Response.json({ ok: true, requestKey: h.requestKey, jobs, outcome: "confirmed" });
  };
  const discovered = await checkGenerationDiscoveries(h.args);
  assert.equal(discovered.recovered, 10); assert.equal(discovered.remaining, 0);
  assert.equal(h.acknowledgements.at(-1).result.partial, false);
  assert.deepEqual(h.acknowledgements.at(-1).result.jobs, jobs);
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1);
});

test("all forty outputs are accepted while malformed slideshow requests and group identities retain recovery safely", async () => {
  const h = fixture(), jobs = slideshowJobs(h.requestKey, 10, 4);
  h.args.input = { ...h.args.input, quantity: 4, slideshowSlideCount: 10 };
  h.args.fetch = async () => Response.json({ ok: true, jobs, message: "queued" });
  const result = await submitPendingGeneration(h.args);
  assert.equal(result.result.jobs.length, 40); assert.equal(result.result.partial, false);
  for (const [kind, scope, count] of [["image", "studio", 5], ["video", "hook", 5], ["image", "slideshow", 0], ["image", "slideshow", 11], ["image", "slideshow", 1.5], ["image", "slideshow", "5"], ["image", "slideshow", null]]) {
    const invalid = fixture(kind, scope); invalid.args.input.slideshowSlideCount = count;
    await assert.rejects(submitPendingGeneration(invalid.args), /could not be verified/); assert.equal(invalid.calls.length, 0);
  }
  for (const change of [job => { delete job.slideshowGeneration; }, job => { job.slideshowGeneration.batchKey = randomUUID(); }, job => { job.slideshowGeneration.slideCount = 4; }, job => { job.slideshowGeneration.versionCount = 3; }, job => { job.slideshowGeneration.slideIndex = 0; }]) {
    const invalid = fixture(); invalid.args.input = { ...invalid.args.input, quantity: 2, slideshowSlideCount: 5 };
    const invalidJobs = slideshowJobs(invalid.requestKey); change(invalidJobs[0]);
    invalid.args.fetch = async () => Response.json({ ok: true, jobs: invalidJobs });
    await assert.rejects(submitPendingGeneration(invalid.args), /Could not verify/); assert.ok(invalid.store.has(invalid.key));
  }
  const duplicate = fixture(); duplicate.args.input = { ...duplicate.args.input, quantity: 2, slideshowSlideCount: 5 };
  const repeated = slideshowJobs(duplicate.requestKey); repeated[1].slideshowGeneration = { ...repeated[0].slideshowGeneration };
  duplicate.args.fetch = async () => Response.json({ ok: true, jobs: repeated });
  await assert.rejects(submitPendingGeneration(duplicate.args), /Could not verify/);
});

test("read-only API finds all slideshow children with their validated version and slide identity", async () => {
  const key = randomUUID(), jobs = slideshowJobs(key);
  const records = jobs.map(job => ({ id: job.jobId, userId: "owner", jobType: "generate_image", input: { exploreFormat: "slideshow", generationId: job.generationId, slideshowGeneration: job.slideshowGeneration, prompt: "private instructions" } }));
  records[2] = null;
  const h = apiFixture(records);
  const response = await h.run(new URLSearchParams({ requestKey: key, kind: "image", scope: "slideshow", quantity: "2", slideshowSlideCount: "5" }));
  assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.jobs.length, 9); assert.equal(result.partial, true);
  assert.deepEqual(result.jobs, jobs.filter((_, index) => index !== 2));
  assert.deepEqual(h.calls.map(call => call.key), Array.from({ length: 10 }, (_, index) => `${key}:${index + 1}`));
  assert.ok(h.calls.every(call => call.scope.userId === "owner" && call.scope.jobType === "generate_image"));
  assert.doesNotMatch(JSON.stringify(result), /private instructions/);
  const maximum = slideshowJobs(key, 10, 4);
  const maximumApi = apiFixture(maximum.map(job => ({ id: job.jobId, userId: "owner", jobType: "generate_image", input: { exploreFormat: "slideshow", generationId: job.generationId, slideshowGeneration: job.slideshowGeneration } })));
  const maximumResult = await maximumApi.run(new URLSearchParams({ requestKey: key, kind: "image", scope: "slideshow", quantity: "4", slideshowSlideCount: "10" }));
  assert.equal(maximumResult.status, 200); const maximumBody = await maximumResult.json();
  assert.equal(maximumBody.jobs.length, 40); assert.equal(maximumBody.partial, false);
  assert.equal(maximumApi.calls.at(-1).key, `${key}:40`);
});

test("slideshow recovery validates scope, count, owner and child order without weakening legacy single-job recovery", async () => {
  const key = randomUUID();
  for (const query of ["kind=video&scope=hook&slideshowSlideCount=5", "kind=image&scope=studio&slideshowSlideCount=5", "kind=image&scope=slideshow&slideshowSlideCount=0", "kind=image&scope=slideshow&slideshowSlideCount=11", "kind=image&scope=slideshow&slideshowSlideCount=1.5"]) {
    const h = apiFixture([]); assert.equal((await h.run(`requestKey=${key}&quantity=2&${query}`)).status, 400); assert.equal(h.calls.length, 0);
  }
  const job = slideshowJobs(key, 1, 1)[0];
  const record = { id: job.jobId, userId: "owner", jobType: "generate_image", input: { generationId: job.generationId, exploreFormat: "slideshow", slideshowGeneration: job.slideshowGeneration } };
  const single = apiFixture([record]);
  assert.equal((await single.run(`requestKey=${key}&quantity=1&kind=image&scope=slideshow&slideshowSlideCount=1`)).status, 200);
  assert.equal(single.calls[0].key, key);
  for (const change of [value => { value.userId = "another-owner"; }, value => { value.input.slideshowGeneration.batchKey = randomUUID(); }, value => { value.input.slideshowGeneration.slideIndex = 2; }]) {
    const bad = structuredClone(record); change(bad); const h = apiFixture([bad]);
    assert.equal((await h.run(`requestKey=${key}&quantity=1&kind=image&scope=slideshow&slideshowSlideCount=1`)).status, 503);
  }
  const downgraded = apiFixture([record]);
  assert.equal((await downgraded.run(`requestKey=${key}&quantity=1&kind=image&scope=slideshow`)).status, 503);
  const legacy = structuredClone(record); delete legacy.input.slideshowGeneration;
  const old = apiFixture([legacy]);
  assert.equal((await old.run(`requestKey=${key}&quantity=1&kind=image&scope=slideshow`)).status, 200);
  assert.equal(old.calls[0].key, key);
});
