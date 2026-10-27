# Production onboarding and account-change investigation — 26 October 2026

## Outcome

Production email signup/verification and GCP task delivery worked for the user-supplied test account. URL onboarding failed its application quality gate; completion is FAILED, not verified. No evidence attributes this failure to the Google Cloud owner change. Google OAuth login and completed onboarding remain NOT VERIFIED in this investigation.

## Exact onboarding attempt

- Firebase user `VxyK4ZebskN8ETVelq1b0A8j1HL2`: password provider, emailVerified=true.
- Draft `b1014463-60f6-4972-b363-cae097d3d263`, website `https://cal.com/`, streamlined experience, revision/source revision 1.
- Source job `2a48f820-fe86-45f7-af7d-73c2ce50bfbd` created 2026-10-26 12:03:20 UTC (17:33:20 India time).
- GCP AI worker `45bf657be7624aa2b0de6f95f3d19cb049feddd0` claimed it, invoked the signed application analysis route and failed at 12:03:48 and 12:04:50 UTC. Two attempts; final status failed.
- Production Vercel logs on deployment `dpl_EQWnJEiXsvFEdWh9T4W2SoeRm5aq` confirm WebsiteAnalysisError, status 422, at both timestamps. This is not a queue permission or service-unavailable response.
- No saved website analysis, attached analysis ID, finalization job or business profile for this account.

## Confirmed validator defect and diagnostic limit

`lib/website-analysis/onboarding-quality.ts:getMissingUrlBusinessContext` treats a business name equal to the source hostname as missing. The same code is present at worker release 45bf657b. Supplying businessName=Cal.com, a complete scheduling-product summary and a nonempty audience reproduces businessName=true/productSummary=false/targetAudience=false and the exact HTTP 422 error message.

The extractor's rejected output is not persisted. Therefore the exact missing/rejected field in these two production attempts cannot be proven retrospectively. The domain-brand rejection is a confirmed code defect and a strong explanation for this URL, not a claim to have inspected the actual rejected model response. A fix should distinguish an evidenced domain-shaped brand from a hostname guessed in place of a name, and retain all other fact/quality checks.

The current frontend polls every three seconds while incomplete and contains failed-job/manual-entry fallback handling. The supplied screenshot shows an analysis waiting state, but does not establish how long it persisted or prove the fallback failed. Current browser inspection was blocked when an unrelated private X tab was active; the user was asked to foreground the onboarding tab. No authenticated tokens were extracted or authentication bypassed.

## Carousel failures

Read-only production queries show 15 failed parent batches in the original 24–25 October window, with 24 failed candidate records. Candidate diagnostics are planning/quality failures after isolated repair:

- Invalid slide number: 10.
- Unsupported/prohibited claim alone or combined with a multi-statement hook: 7.
- Duplicate/similar hook or visible copy: 6.
- Human-subject language in an object-only image direction: 1.

These are application content-validation outcomes, not GCP billing/credentials/delivery failures. Successful candidates in partially failed batches are preserved. No paid retry was submitted.

## Hook image failures — misleading error text

Jobs `6de5153c-d7b7-4f09-9bfa-59555ff75981` and `f7b320e7-1403-4706-bd6d-f6b83330156e`, created 24 October at 15:15:57 and 15:17:26 UTC, both use receipt version 3 and model gemini_3_pro, reference creator-account-1-01, source frame 1.7 seconds. The deployed worker is 5f7b7747.

At that exact Git revision, `worker/src/lib/gemini-image.ts:verifiedHookImageLabels` rejects any non-version-2 receipt unless the model is nano_banana_2. Thus version 3 + gemini_3_pro deterministically triggers the broad error saying the downloaded scene does not match its verified opening frame. The error is not proof that the downloaded PNG bytes differed: model compatibility alone is sufficient. No image-generation provider request was sent. This is a receipt/model compatibility defect in that deployed revision, not an account-transfer failure. No repair or rollout is claimed here.

## Account-change evidence

- The new Google Cloud account has Owner access to the existing ugcsaas project.
- Firebase email and Google provider enabled; production www/apex domains authorized.
- Audit log shows the previous owner's role removal at 2026-10-25 20:04:01 UTC. Both Hook failures and the investigated Carousel batches predate that removal. That timestamp alone is not a complete account-transfer history.
- Fresh onboarding after the change reached Firebase, Supabase, Cloud Tasks, Cloud Run and the signed application callback, then returned application HTTP 422.

## Checks and limits

- Production Firebase account/config lookup, Supabase read-only queries, GCP worker/audit logs and Vercel runtime logs: evidence above.
- Existing onboarding-quality suite: 3/3 pass; it lacks a legitimate domain-brand acceptance case.
- Direct actual-function Cal.com reproduction: confirmed rejection with otherwise complete facts.
- Historical model/receipt branch reproduction: version 3 + gemini_3_pro rejected.
- Initial tsx invocation could not run because tsx is not installed; rerun succeeded using the repository's existing test loader. No dependency installed.
- No application edits, configuration changes, user-data repairs, paid generation, publication or deployments performed.
- Signup and email verification: VERIFIED for this supplied account. Google OAuth completion: NOT VERIFIED. URL onboarding completion: FAILED. Manual fallback visible state and manual completion: NOT VERIFIED. Schedule/UI/source contracts: not changed; end-to-end regression NOT TESTED by this read-only investigation.

Incident tracking: UGC-OPS-007 (onboarding quality rejection) and UGC-VID-017 (historical receipt/model rejection), both OPEN. Future regression cases should accept an explicitly evidenced Cal.com brand while rejecting unsupported hostname placeholders, and accept valid version-3 Gemini 3 Pro inputs while continuing to reject wrong frame bytes/roles.
