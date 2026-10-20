import assert from "node:assert/strict";
import test from "node:test";

import { getStreamlinedSavedBusinessName } from "./onboarding-draft-contract.ts";

test("the saved name comes from the current source after a source switch", () => {
  assert.equal(getStreamlinedSavedBusinessName({
    businessName: "Old Manual Brand",
    sourceInput: { intakeType: "website", websiteUrl: "https://apps.apple.com/in/app/new-app/id123456789" },
    suggestedName: "New App",
  }), "New App");

  assert.equal(getStreamlinedSavedBusinessName({
    businessName: "Old URL Brand",
    sourceInput: { intakeType: "manual", businessName: "New Manual Brand" },
    suggestedName: "Old URL Brand",
  }), "New Manual Brand");

  assert.equal(getStreamlinedSavedBusinessName({
    businessName: "Old Manual Brand",
    sourceInput: { intakeType: "website", websiteUrl: "https://play.google.com/store/apps/details?id=com.example.app" },
    suggestedName: null,
  }), "");
});
