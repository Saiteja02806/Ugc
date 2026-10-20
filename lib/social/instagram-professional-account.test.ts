import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED_ERROR,
  isInstagramProfessionalAccountProviderError,
  isInstagramProfessionalAccountType,
  requiresInstagramProfessionalAccount,
} from "./instagram-professional-account.ts";

test("accepts only Instagram account types that support publishing", () => {
  assert.equal(isInstagramProfessionalAccountType("BUSINESS"), true);
  assert.equal(isInstagramProfessionalAccountType("MEDIA_CREATOR"), true);
  assert.equal(isInstagramProfessionalAccountType("media_creator"), true);
  assert.equal(isInstagramProfessionalAccountType("PERSONAL"), false);
  assert.equal(isInstagramProfessionalAccountType(null), false);
});

test("recognizes current and legacy unverified Instagram connections", () => {
  assert.equal(
    requiresInstagramProfessionalAccount({
      lastErrorCode: INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED_ERROR,
    }),
    true,
  );
  assert.equal(
    requiresInstagramProfessionalAccount({
      metadata: { profileLookupFailed: true },
    }),
    true,
  );
  assert.equal(
    requiresInstagramProfessionalAccount({
      metadata: { professionalAccountRequired: true },
    }),
    true,
  );
  assert.equal(
    requiresInstagramProfessionalAccount({
      metadata: { accountType: "PERSONAL" },
    }),
    true,
  );
  assert.equal(
    requiresInstagramProfessionalAccount({
      metadata: { accountType: "MEDIA_CREATOR" },
    }),
    false,
  );
  assert.equal(
    requiresInstagramProfessionalAccount({ metadata: {} }),
    false,
  );
});

test("recognizes Meta's unsupported Instagram professional API response", () => {
  assert.equal(
    isInstagramProfessionalAccountProviderError({
      error: {
        code: 100,
        message: "Unsupported request - method type: get",
        type: "IGApiException",
      },
    }),
    true,
  );
  assert.equal(
    isInstagramProfessionalAccountProviderError({
      error: { code: 2, message: "Service temporarily unavailable" },
    }),
    false,
  );
});

test("OAuth never saves an unverified Instagram profile", () => {
  const oauthSource = readFileSync(
    new URL("./oauth.ts", import.meta.url),
    "utf8",
  );
  const instagramExchangeSource = oauthSource.slice(
    oauthSource.indexOf("async function exchangeInstagramCode"),
    oauthSource.indexOf("async function exchangeInstagramLongLivedToken"),
  );

  assert.match(
    instagramExchangeSource,
    /const tokenData = await exchangeInstagramLongLivedToken\(/,
  );
  assert.doesNotMatch(instagramExchangeSource, /const longData/);
  assert.doesNotMatch(oauthSource, /profileLookupFailed:\s*true/);
  assert.match(oauthSource, /isInstagramProfessionalAccountType\(payload\.account_type\)/);
  assert.match(oauthSource, /status: "error" as const/);
  assert.match(oauthSource, /professionalAccountRequired: true/);
  assert.match(oauthSource, /professionalAccountRequirementRecorded/);
  assert.match(oauthSource, /storedAccountTypeRequiresProfessional/);
  assert.match(oauthSource, /INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED_ERROR/);
});

test("the recovery UI explains the Instagram conversion path", () => {
  const guideSource = readFileSync(
    new URL(
      "../../components/social/instagram-professional-account-guide.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(guideSource, /Switch to a Creator account/);
  assert.match(guideSource, /Account type and tools/);
  assert.match(guideSource, /Switch to professional account/);
  assert.match(guideSource, /Creator accounts are public/);
  assert.doesNotMatch(guideSource, /Creator or Business/);
  assert.match(guideSource, /aria-live="polite"/);
  assert.match(guideSource, /focus-visible:ring-2/);
  assert.match(guideSource, /bg-card/);
  assert.doesNotMatch(guideSource, /rgba\(255,247,251/);

  const settingsSource = readFileSync(
    new URL(
      "../../components/settings/instagram-account-manager.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(settingsSource, /Creator account required/);
});
