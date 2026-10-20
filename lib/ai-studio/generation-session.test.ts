import assert from "node:assert/strict";
import test from "node:test";
import { appendAIStudioSessionResultIds, getAIStudioSessionResults, isAIStudioSessionCompletion } from "./generation-session.ts";

test("three consecutive generations append to one session in submission order", () => {
  const history = [
    { id: "third", prompt: "Third prompt" },
    { id: "second", prompt: "Second prompt" },
    { id: "first", prompt: "First prompt" },
    { id: "older", prompt: "An earlier visit" },
  ];
  let session: string[] = [];
  for (const id of ["first", "second", "third"]) {
    session = appendAIStudioSessionResultIds(session, id);
  }
  assert.deepEqual(getAIStudioSessionResults(history, session), [history[2], history[1], history[0]]);
  assert.deepEqual(appendAIStudioSessionResultIds(session, "second"), session, "reconciliation cannot duplicate a result");
  assert.deepEqual(getAIStudioSessionResults(history, []), [], "starting a new session leaves history saved");
  assert.equal(history.length, 4);
});

test("History is a temporary view and returning restores every result in the session", () => {
  const history = [{ id: "old" }, { id: "image-2" }, { id: "image-1" }];
  const session = ["image-1", "image-2"];
  assert.deepEqual(getAIStudioSessionResults(history, session, "old"), [history[0]]);
  assert.deepEqual(getAIStudioSessionResults(history, session), [history[2], history[1]]);
  assert.deepEqual(session, ["image-1", "image-2"]);
  assert.deepEqual(getAIStudioSessionResults(history, session, "missing"), []);
});

test("missing media can catch up without removing or duplicating session membership", () => {
  assert.deepEqual(getAIStudioSessionResults([{ id: "first" }], ["first", "second", "first"]), [{ id: "first" }]);
  assert.deepEqual(getAIStudioSessionResults([{ id: "second" }, { id: "first" }], ["first", "second"]), [{ id: "first" }, { id: "second" }]);
});

test("late completion stays eligible across submissions and is invalidated only by a new session", () => {
  const jobs = new Set(["first-job", "second-job"]);
  assert.equal(isAIStudioSessionCompletion("first-job", 1, 1, jobs), true);
  assert.equal(isAIStudioSessionCompletion("second-job", 1, 1, jobs), true);
  assert.equal(isAIStudioSessionCompletion("first-job", 1, 2, jobs), false);
  assert.equal(isAIStudioSessionCompletion("unrelated-job", 1, 1, jobs), false);
});
