import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Execute the real UI hand-off functions with controlled persistence and state.
const source = readFileSync(new URL("../../components/trending/trending-workspace.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["requestCreativeDecision", "completeCreativeDecision", "openAcceptedCandidate"];
const declarations = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) declarations.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule(declarations.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function candidate(format) {
  return { format, item: { id: `${format}-post`, assignmentId: `${format}-assignment`, creativeId: `${format}-creative`, format,
    creative: { title: "A useful post", thumbnailUrl: "/cover.webp" } },
    carousel: { carouselId: "carousel-id" }, slides: [{ renderedUrl: "/slide.webp" }] };
}

function fixture(format, overrides = {}) {
  const item = candidate(format);
  const events = [];
  const transitions = [];
  const lock = { current: false };
  const scope = {
    activeCandidate: item, visibleCandidates: [item, candidate("next")], activeItemIndex: 0,
    postHistory: { browsing: false, remember: value => events.push(["history", value]) },
    decisionLockRef: lock, exitDirection: null, editorCandidate: null, scheduleContext: null,
    actionCandidate: null, wallTextCandidate: null, editByCreativeId: {}, activeHookPreviewStatus: "ready", userId: "owner",
    dismissSwipeGuide: () => false,
    showActionNotice: value => events.push(["notice", value]),
    setExitDirection: value => events.push(["busy", value]),
    getErrorMessage: error => error.message,
    reconsiderSkippedCandidate: async value => events.push(["reconsider", value]),
    saveCarouselToLibrary: async () => { events.push(["save"]); return { item: { id: "saved-library-item", coverUrl: "/saved-cover.webp" } }; },
    advancePastActiveItem: (direction, completion) => { events.push(["transition", direction]); transitions.push(completion); },
    dismissCandidate: value => events.push(["dismiss", value]),
    setActiveItemId: value => events.push(["active", value]),
    enqueueDecision: value => events.push(["decision", value]),
    onHookCompose: (...args) => events.push(["compose", ...args]),
    setPendingWallTextScheduleCandidate: value => events.push(["wall", value]),
    setPendingReactionScheduleCandidate: value => events.push(["reaction", value]),
    setPendingScheduleCandidate: value => events.push(["carousel", value]),
    setScheduleContext: value => events.push(["schedule", value]),
    setActionCandidate: value => events.push(["recovery", value]),
    setActionState: value => events.push(["action", value]),
    getCarouselTitle: () => "A useful post",
    ...overrides,
  };
  const api = new Function(...Object.keys(scope), `${code}\nreturn { ${names.join(", ")} };`)(...Object.values(scope));
  return { api, events, item, lock, transitions };
}

test("a Carousel like saves the exact post before dismissal and opens scheduling with that saved item", async () => {
  const { api, events, item, lock, transitions } = fixture("carousel");
  assert.equal(api.requestCreativeDecision("accepted"), true);
  assert.equal(api.requestCreativeDecision("accepted"), false);
  assert.equal(lock.current, true);
  assert.equal(events.some(event => event[0] === "dismiss"), false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(transitions.length, 1);
  transitions[0]();
  assert.equal(events.filter(event => event[0] === "save").length, 1);
  assert.equal(events.filter(event => event[0] === "decision").length, 1);
  assert.equal(events.find(event => event[0] === "dismiss")[1], item);
  const schedule = events.find(event => event[0] === "schedule")[1];
  assert.equal(schedule.libraryItemId, "saved-library-item");
  assert.equal(schedule.coverUrl, "/saved-cover.webp");
  assert.equal(schedule.assignmentId, item.item.assignmentId);
  assert.equal(schedule.idempotencyKey, "trending-carousel-schedule:carousel-assignment");
});

test("a failed Carousel save leaves the post in Trending and releases the interaction lock", async () => {
  const { api, events, lock, transitions } = fixture("carousel", { saveCarouselToLibrary: async () => { throw new Error("Save failed"); } });
  api.requestCreativeDecision("accepted");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(lock.current, false);
  assert.equal(transitions.length, 0);
  assert.equal(events.some(event => ["dismiss", "decision", "schedule"].includes(event[0])), false);
  assert.equal(events.some(event => event[0] === "history"), false);
  assert.deepEqual(events.findLast(event => event[0] === "busy"), ["busy", null]);
});

test("a previously liked post can reopen scheduling without replaying its review decision", async () => {
  for (const format of ["carousel", "hook_video", "wall_text", "reaction"]) {
    let advances = 0;
    const { api, events, lock, transitions } = fixture(format, {
      postHistory: { browsing: true, active: { decision: "liked" }, next: () => { advances++; return true; } },
    });
    assert.equal(api.requestCreativeDecision("accepted"), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(transitions.length, 1);
    transitions[0]();
    assert.equal(advances, 1);
    assert.equal(lock.current, false);
    assert.equal(events.some(event => ["decision", "dismiss", "history", "reconsider", "active"].includes(event[0])), false);
    assert.equal(events.filter(event => ["compose", "schedule"].includes(event[0])).length, 1);
    if (format === "wall_text") assert.equal(events.find(event => event[0] === "schedule")[1].assignmentId, "wall_text-assignment");
  }
});

test("a skipped post can be selected without appending history, replaying the outbox or retiring it twice", async () => {
  for (const format of ["carousel", "hook_video", "wall_text", "reaction"]) {
    const historyEvents = [];
    const { api, events, item, lock, transitions } = fixture(format, {
      postHistory: { browsing: true, active: { decision: "skipped" },
        markLiked: id => historyEvents.push(["liked", id]), next: () => historyEvents.push(["next"]) },
    });
    assert.equal(api.requestCreativeDecision("accepted"), true);
    assert.equal(api.requestCreativeDecision("accepted"), false);
    assert.equal(lock.current, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(transitions.length, 1);
    transitions[0]();
    assert.equal(lock.current, false);
    assert.deepEqual(historyEvents, [["liked", item.item.id], ["next"]]);
    assert.equal(events.filter(event => event[0] === "reconsider").length, 1);
    assert.equal(events.some(event => ["decision", "dismiss", "history", "active"].includes(event[0])), false);
    assert.equal(events.some(event => ["compose", "schedule"].includes(event[0])), true);
    if (format === "carousel") {
      assert.ok(events.findIndex(event => event[0] === "reconsider") < events.findIndex(event => event[0] === "save"));
      assert.equal(events.find(event => event[0] === "schedule")[1].libraryItemId, "saved-library-item");
    }
  }
});

test("a failed skipped-post selection or Carousel save leaves history retryable", async () => {
  for (const failure of ["reconsider", "save"]) {
    const { api, events, lock, transitions } = fixture("carousel", {
      postHistory: { browsing: true, active: { decision: "skipped" }, markLiked: () => assert.fail("History must stay skipped"), next: () => assert.fail("Must not advance") },
      ...(failure === "reconsider" ? { reconsiderSkippedCandidate: async () => { throw new Error("Offline"); } }
        : { saveCarouselToLibrary: async () => { throw new Error("Save failed"); } }),
    });
    assert.equal(api.requestCreativeDecision("accepted"), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(lock.current, false);
    assert.equal(transitions.length, 0);
    assert.equal(events.some(event => ["schedule", "decision", "dismiss"].includes(event[0])), false);
    assert.deepEqual(events.findLast(event => event[0] === "busy"), ["busy", null]);
  }
});

test("revisited Hooks retain the edit snapshot after the deck remounts", async () => {
  const edit = { revision: 3 };
  const item = { ...candidate("hook_video"), reviewedEdit: edit };
  const { api, events, transitions } = fixture("hook_video", {
    activeCandidate: item,
    postHistory: { browsing: true, active: { decision: "skipped" }, markLiked() {}, next() {} },
  });
  api.requestCreativeDecision("accepted");
  await new Promise(resolve => setImmediate(resolve));
  transitions[0]();
  assert.deepEqual(events.find(event => event[0] === "compose"), ["compose", item.item, edit]);
});

test("Text and Reaction likes open their existing scheduler with the exact accepted assignment", () => {
  for (const format of ["wall_text", "reaction"]) {
    const { api, events, item, transitions } = fixture(format);
    assert.equal(api.requestCreativeDecision("accepted"), true);
    transitions[0]();
    const schedule = events.find(event => event[0] === "schedule")[1];
    assert.equal(schedule.contentType, format);
    assert.equal(schedule.assignmentId, item.item.assignmentId);
    assert.equal(events.some(event => event[0] === "save"), false);
  }
});

test("a Hook like preserves the required composition step and the saved edit", () => {
  const edit = { revision: 2 };
  const { api, events, item, transitions } = fixture("hook_video", { editByCreativeId: { "hook_video-creative": edit } });
  api.requestCreativeDecision("accepted"); transitions[0]();
  assert.deepEqual(events.find(event => event[0] === "compose"), ["compose", item.item, edit]);
  assert.equal(events.find(event => event[0] === "history")[1].value.reviewedEdit, edit);
  assert.equal(events.some(event => event[0] === "schedule"), false);
});

test("a skip retires one post through the existing outbox and never opens scheduling", () => {
  const { api, events, transitions } = fixture("carousel");
  assert.equal(api.requestCreativeDecision("rejected"), true);
  assert.equal(api.requestCreativeDecision("rejected"), false);
  transitions[0]();
  assert.equal(events.filter(event => event[0] === "decision").length, 1);
  assert.equal(events.find(event => event[0] === "decision")[1].decision, "rejected");
  assert.equal(events.some(event => ["save", "schedule", "compose"].includes(event[0])), false);
});

test("unready content, tutorial acknowledgement and an open scheduler cannot trigger a like", () => {
  const cases = [
    ["hook_video", { activeHookPreviewStatus: "loading" }],
    ["carousel", { editByCreativeId: { "carousel-creative": { renderState: "rendering" } } }],
    ["carousel", { editByCreativeId: { "carousel-creative": { renderState: "failed" } } }],
    ["reaction", { activeCandidate: { ...candidate("reaction"), item: { ...candidate("reaction").item, creative: { textEditState: "preparing" } } } }],
    ["wall_text", { dismissSwipeGuide: () => true }],
    ["wall_text", { scheduleContext: { assignmentId: "another-post" } }],
  ];
  for (const [format, overrides] of cases) {
    const { api, events, lock, transitions } = fixture(format, overrides);
    assert.equal(api.requestCreativeDecision("accepted"), false);
    assert.equal(lock.current, false);
    assert.equal(transitions.length, 0);
    assert.equal(events.some(event => ["save", "dismiss", "schedule"].includes(event[0])), false);
  }
});
