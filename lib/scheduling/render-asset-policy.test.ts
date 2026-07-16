import assert from "node:assert/strict";
import test from "node:test";

import {
  hasMeaningfulDraftEdits,
  isDemoRenderCurrent,
  isOpeningRenderCurrent,
} from "./render-asset-policy.ts";

const editedDraft = {
  textOverlays: [
    {
      id: "overlay-1",
      position: "top",
      style: "clean",
      text: "Edited headline",
    },
  ],
  trimEndSeconds: null,
  trimStartSeconds: 0,
  updatedAt: "2026-07-16T10:00:00.000Z",
};

test("recognizes direct and nested edited drafts", () => {
  assert.equal(hasMeaningfulDraftEdits(editedDraft), true);
  assert.equal(hasMeaningfulDraftEdits({ draft: editedDraft }), true);
  assert.equal(
    hasMeaningfulDraftEdits({
      textOverlays: [],
      trimEndSeconds: null,
      trimStartSeconds: 0,
    }),
    false,
  );
});

test("allows the original opening video when there are no edits", () => {
  assert.equal(
    isOpeningRenderCurrent({
      draftSources: [{ textOverlays: [], trimStartSeconds: 0 }],
      outputUpdatedAt: "not-a-date",
    }),
    true,
  );
});

test("requires an opening export at or after every edited draft", () => {
  assert.equal(
    isOpeningRenderCurrent({
      draftSources: [editedDraft],
      outputUpdatedAt: "2026-07-16T10:00:00.000Z",
    }),
    true,
  );
  assert.equal(
    isOpeningRenderCurrent({
      draftSources: [editedDraft],
      outputUpdatedAt: "2026-07-16T09:59:59.999Z",
    }),
    false,
  );
});

test("rejects an edited opening draft without a verifiable timestamp", () => {
  assert.equal(
    isOpeningRenderCurrent({
      draftSources: [{ ...editedDraft, updatedAt: undefined }],
      outputUpdatedAt: "2026-07-16T11:00:00.000Z",
    }),
    false,
  );
});

test("requires the demo export to match the latest edited render", () => {
  assert.equal(
    isDemoRenderCurrent({
      latestRenderId: "render-current",
      outputSourceRecordId: "render-current",
    }),
    true,
  );
  assert.equal(
    isDemoRenderCurrent({
      latestRenderId: "render-current",
      outputSourceRecordId: "render-old",
    }),
    false,
  );
  assert.equal(
    isDemoRenderCurrent({
      latestRenderId: null,
      outputSourceRecordId: "render-unknown",
    }),
    false,
  );
});

test("rejects a rendered demo without verifiable render provenance", () => {
  assert.equal(
    isDemoRenderCurrent({
      latestRenderId: null,
      outputSourceRecordId: null,
    }),
    false,
  );
});
