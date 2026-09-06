import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReactionContent,
  ReactionContentError,
} from "./content.ts";
import { selectReactionMatch } from "./matcher.ts";
import { buildReactionRenderPlan } from "./render-plan.ts";
import type { ReactionContent } from "./taxonomy.ts";

const reliefContent: ReactionContent = {
  caption: "POV: Monday arrives and your posts are already scheduled",
  emotion: "relief",
  languageFormat: "pov",
  lines: ["POV: Monday arrives", "and your posts are already scheduled"],
  semantic: {
    payoff: "your posts are already scheduled",
    situation: "Monday arrives",
    structure: "situation_payoff",
  },
  visualContextTags: ["outdoor", "calm"],
  visualTreatment: "outlined_text",
};

test("accepts short human reaction copy with semantic beats", () => {
  const normalized = assertReactionContent(reliefContent);
  assert.equal(normalized.caption, reliefContent.caption);
  assert.deepEqual(normalized.lines, reliefContent.lines);
});

test("rejects product-description copy even when it fits visually", () => {
  assert.throws(
    () =>
      assertReactionContent({
        ...reliefContent,
        caption: "Our AI automatically schedules your posts for you today",
        lines: ["Our AI automatically schedules", "your posts for you today"],
      }),
    ReactionContentError,
  );
});

test("matches active alpha assets by reaction, background context, and placement", () => {
  const match = selectReactionMatch({
    backgrounds: [
      {
        contextTags: ["outdoor", "calm"],
        foregroundPlacement: "bottom_center",
        id: "background-outdoor",
        status: "active",
      },
      {
        contextTags: ["outdoor"],
        foregroundPlacement: "bottom_left",
        id: "background-wrong-anchor",
        status: "active",
      },
    ],
    clips: [
      {
        composition: "bust",
        hasAlpha: true,
        id: "clip-relief",
        placement: { anchor: "bottom_center", heightPercent: 0.68 },
        reactions: ["relief"],
        status: "active",
        subjectCount: "one",
      },
      {
        composition: "bust",
        hasAlpha: false,
        id: "clip-without-alpha",
        placement: { anchor: "bottom_center", heightPercent: 0.68 },
        reactions: ["relief"],
        status: "active",
        subjectCount: "one",
      },
      {
        composition: "bust",
        hasAlpha: true,
        id: "clip-frustration",
        placement: { anchor: "bottom_center", heightPercent: 0.68 },
        reactions: ["facepalm"],
        status: "active",
        subjectCount: "one",
      },
    ],
    content: reliefContent,
    seed: "daily-feed:2026-09-05:0",
  });

  assert.equal(match?.clip.id, "clip-relief");
  assert.equal(match?.background.id, "background-outdoor");
});

test("keeps role labels in the generated creative, not the asset catalog", () => {
  const content: ReactionContent = {
    caption: "my client asking for one more change",
    emotion: "frustration",
    languageFormat: "direct_statement",
    lines: ["my client asking", "for one more change"],
    semantic: {
      caption: "my client asking for one more change",
      roles: ["client", "me"],
      structure: "role_contrast",
    },
    visualContextTags: ["work"],
    visualTreatment: "caption_with_labels",
  };
  const match = selectReactionMatch({
    backgrounds: [
      {
        contextTags: ["work"],
        foregroundPlacement: "bottom_center",
        id: "background",
        status: "active",
      },
    ],
    clips: [
      {
        composition: "bust",
        hasAlpha: true,
        id: "clip-facepalm",
        placement: { anchor: "bottom_center", heightPercent: 0.62 },
        reactions: ["facepalm"],
        status: "active",
        subjectCount: "one",
      },
    ],
    content,
    seed: "role-contrast",
  });

  assert.equal(match?.clip.id, "clip-facepalm");
  assert.deepEqual(buildReactionRenderPlan({ content, match: match! }).labels, [
    "client",
    "me",
  ]);
});
