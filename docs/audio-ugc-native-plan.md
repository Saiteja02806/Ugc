# UGC Pilot native audio experience

Status: Studio implemented locally October 2, 2026; UGC subscription access updated October 3, 2026; explicit voice selection and account bookmarks added October 5, 2026. Production rollout and live provider acceptance are pending.

## Product direction

Keep Audio generation between Explore and Trending. Build its main experience around creating a voiceover for a social post: choose the content purpose, preview a suitable voice, write the script, generate and save. Use UGC Pilot's existing typography, orange accent, spacing and text actions. Preserve the open layout requested by the user.

Add Voiceover Studio as the default tab ahead of the existing Voice library, Text to speech, My voices and My audio tabs. The Studio follows the approved sketch: a small voice selection above the speech editor, a next/previous arrow for another small group and a separate View all voices action. Preserve the library's original search toolbar, category row, three-column featured voices and More voices to explore. Text to speech stays available as a separate editor with voice/model/speed settings. Keep the app's existing palette and typography.

Social media is the default Studio purpose and library focus. Social media, UGC ads and Product demos lead both experiences. The library also offers All voices and the existing broad voice styles. A library focus promotes suitable voices without hiding other catalogue records. Preserve the full provider names, descriptions, previews, accent, voice type and sample language there. Studio rows use the provider's shorter name and style subtitle for quick selection; their title attributes retain the full metadata.

| UGC Pilot purpose | Prioritized provider metadata | Script guidance |
| --- | --- | --- |
| Social media (default) | `social_media`, then conversational | Hook → main idea → closing line |
| UGC ads | Advertisement, then conversational and social media | Hook → product benefit → call to action |
| Product demos | Informative/educational, then conversational | Introduce → show the steps → explain the result |
| Storytelling | Narrative/story, then conversational | Opening → story → takeaway |

These are suitability recommendations, not measured conversion or popularity rankings. A conversational voice can be recommended for several purposes. The same selected provider ID and existing generation API are used for all four purposes.

## Default experience

- Social media is selected on a fresh visit. Switching tabs or clearing search filters preserves the selected content purpose.
- Social media voices appear first. In the locally verified public demo catalogue, Laura, Liam, Brian and Adam have the provider's `social_media` tag. These are candidates, not a promise of authenticated generation access.
- Show at most six recommended preset voices at a time in Studio, in three columns on desktop and two on small screens. Offer at most one further group with bounded next/previous controls. View all voices opens the complete original library.
- Choosing a Studio voice stays on the same screen and updates the selected-voice line above the editor. Paging or changing purpose never silently changes that voice. A voice selected in the library or My voices returns to the most recently used editor, Studio or Text to speech, with the draft intact.
- Narration remains a library focus and standalone editor purpose. Returning from it to Studio restores Social media recommendations while preserving the manually selected narration voice and script.
- Keep six promoted voices in the library's original featured section and every remaining catalogue entry in More voices to explore. The library structure is preserved.
- Social media, UGC ads and Product demos lead the focus controls. All voices, Conversational, Narration, Advertisement and Characters stay available. Narration uses the storytelling suitability mapping.
- Use Recommended voices in Studio and headings such as Social media picks in the library. Library rows retain provider descriptions rather than replacing them with generated recommendation copy.
- My voices and My audio retain their original names and positions. Reference upload, original recording upload and voice cloning keep their distinct purposes and plan gates.

## Recommendation rules

Apply the sample-language/voice-type filters and name/accent/style search to the shared catalogue. Rank account-available voices ahead of previews, then rank by the active focus. Focus choices reorder rather than remove records; only explicit search/language/voice-type filters narrow the results. Unavailable records remain explicitly marked Preview only. A disconnected catalogue can recommend samples for listening; those records never authorize generation.

Rank voices using:

1. Structured provider tags mapped to the selected purpose, including advertising for UGC ads and informative/educational for product demos.
2. Relevant conversational, promotional or educational tags as supporting suggestions.
3. Description-based suggestions only when structured use-case metadata is absent, with an explicit lower-confidence reason.
4. Name and provider ID as deterministic tie-breakers, so provider reordering does not shuffle equal matches.

Allow multiple tags per voice. A conversational voice can also suit a product demonstration. Do not infer suitability or popularity from a name, portrait, gender or fabricated engagement statistics. Keep original provider descriptions in the library; the featured heading indicates suitability recommendations rather than claiming every displayed voice has the exact provider tag.

The Studio shortlist requires structured purpose or strong supporting metadata, excludes private voices and caps the result at twelve. Social accepts social, conversational and advertisement tags; UGC ads accepts advertising, conversational and social tags; Product demos accepts educational and conversational tags. Weak description-only suggestions and unrelated styles remain in the full library. If any preset is usable by the account, Studio excludes inaccessible presets. If every preset is preview-only, Studio may show matching samples while generation remains disabled. An empty shortlist has an explicit library/My voices suggestion. Private owner voices can still be selected in My voices and used in the Studio editor. Refreshes clamp the displayed page when the shortlist shrinks.

If there is no eligible voice, retain previews and explain how generation becomes available. A library focus update must never replace a voice the user has already chosen for their script.

Language controls must distinguish the language of a provider's example from the speech model's supported output languages. An English example alone does not establish that a multilingual voice can only speak English.

## Voiceover editor

Studio places Text to speech below the recommendations, with the chosen voice, audio name, bordered script field, character/duration information and Generate audio action. Voice settings expand inline for model and speed. Keep the existing standalone Text to speech layout: script on the left, selected voice/model/speed settings on the right, stacked on mobile. Both views render the same speech editor component and use the same draft, selected voice, model, speed and generation handler. Change voice returns to the library. Core focus choices update the example template and script placeholder. Try an example is disabled while the draft contains text. Focus changes, tab navigation and refreshes preserve the draft and existing selected voice. Templates contain editable placeholders and do not invent personal testimonials or product performance claims. Selecting a template does not consume allowance. Duration is a rough word-count estimate adjusted for speed. Keep generation allowance, Free noncommercial status, selected voice, playback and download clear.

The header shows the page title and Refresh voices action. Provider plan names and remaining provider allowance are not displayed to users. The backend still reads the live subscription and allowance for eligibility, quotas and plan restrictions. The primary action stays Generate audio. Preserve saved Free-output attribution and plan limitations.

## UGC subscription access

Free users can see every existing screen, browse the voice library, select voices, edit a draft and listen to available samples. Generate audio stays disabled in both Studio and Text to speech, with a Starter/Growth explanation and View plans link. Only active UGC Pilot Starter and Growth entitlements permit new audio creation. Free-trial credits, the application's development mode and tester invitations do not bypass this requirement. Uploading recordings and creating private voices use the same creation gate; owners retain playback, download, history and cleanup access to earlier recordings.

The web API uses the existing strict server-side subscription lookup, including active complimentary plan grants, before speech, clone, upload and request replay. A billing lookup outage leaves browsing available but prevents generation. The worker independently rechecks active billing or unexpired/unrevoked complimentary access before starting a new provider operation. Queued jobs without entitlement fail before submission; temporary billing outages defer the job. Already generated output can still finish saving, and uncertain submissions cannot be retried automatically. No new table or migration is needed for subscription gating itself.

UGC subscription access is separate from the application's ElevenLabs provider subscription. Provider capabilities, private voice ownership, quotas, credit reservations and release flags still apply. An active UGC plan cannot turn an unavailable provider preview into a generatable voice. The existing rollout flags control when paid access is released; they never authorize UGC Free generation.

## Voice selection and bookmarks

Every voice row in Studio, the complete library, My voices and Bookmarks has a visible **Use It** button and a separate bookmark icon. The button is a rounded rectangle with a 14px radius, a 44px minimum height, clear 13px text and a solid contrasting fill. An arrow indicates selection; the selected voice uses a solid UGC orange fill and checkmark. Mobile Studio controls retain both columns and fit within each voice row. Use It selects that provider voice ID for the shared editor, stops sample playback and returns to the last editor used with its name, script, model and speed intact. Studio selections stay on the same screen. A checkmark and pressed state identify the selected voice. The existing name/title action remains a selection shortcut. Preview-only voices can be selected but never enable generation, and selection never submits TTS.

The new **Bookmarks** tab between Voice library and Text to speech shows account-saved picks using the same voice rows and controls. Bookmarks are available on Free, Starter and Growth, independently of the creation entitlement and provider configuration. Bookmarking does not change the script or selected voice, play a sample, consume credits or submit a provider request. Private-voice removal remains a distinct control.

`GET /api/audio/bookmarks` and idempotent `PUT /api/audio/bookmarks` store only provider IDs in `audio_voice_bookmarks`, scoped to the verified Firebase user. The browser never supplies an owner. Direct public/authenticated database clients have no privileges, RLS is enabled, and only the service role has SELECT/INSERT/DELETE. Bookmarks are loaded independently of audio bootstrap, so a bookmark outage or a missing migration does not block existing browsing or speech. Save errors keep the previous bookmark state; reload and retry controls remain available. Per-voice pending guards prevent repeated clicks from reversing or duplicating an in-flight save.

Saved IDs are resolved against the owner's current catalogue, preserving private-voice visibility and availability rules. Records absent from the catalogue are shown only as unavailable saved voices, with a removal action; their names, URLs and private metadata are never fabricated or loaded through the bookmark API. They stay saved if the catalogue later makes them available again. Account storage persists across reloads and devices; client query caches are keyed by UID. The original bookmark schema is defined in `supabase/migrations/20261005042533_audio_voice_bookmarks.sql`; its existing production table and permissions were confirmed during the October 5 fix. The new selected-voice migration below still needs application before release.

## Implementation sequence

First release: preserve the library and existing tools, add the default Studio tab and pure shortlist/ranking helpers, default to Social media and update the ordering and relevant examples/copy. Reuse existing audio APIs, private storage, limits, ownership checks, idempotency and worker behavior. No new database migration or provider generation call is needed merely to rank voices or add the Studio.

Explore's connected workflows now accept owner-scoped audio files as voice references. The October 5 fix below adds selected and bookmarked voice samples to the existing reference picker. This selection remains separate from speech generation and from the product-demo recording track.

## Acceptance criteria

- A fresh screen selects Social media and prioritizes its tagged voices rather than provider list order.
- All catalogue entries remain visible for every focus unless explicit search/language/voice-type filters narrow them; unavailable voices are clearly marked.
- Search and explicit filters work with ranking; multi-use voices remain discoverable.
- Studio is the new default tab, with six or fewer voices at a time and text to speech beneath. The original four tools, full provider metadata, three-column library and separate speech editor are preserved, with responsive mobile layouts.
- Shortlist paging changes neither draft nor selection and never generates audio. Browsing the full library returns to the last editor used after selection.
- A refresh does not replace a manual voice choice or discard a script.
- Browsing, selecting templates and previews do not submit a TTS request.
- Free users retain browsing and preview playback but cannot submit speech, cloning or uploads. Active Starter/Growth users can generate once enabled; inactive plans and unavailable billing fail closed.
- Free/Starter gates, private audio ownership, duplicate prevention and cleanup recovery continue to pass their existing checks.

## Local verification

The Next.js production build, including TypeScript validation, and targeted ESLint passed after the final UI changes.

Twelve recommendation tests cover niche priority, exact metadata, eligibility, deterministic ordering, selection preservation, multi-use voices, complete-catalogue retention and Studio shortlist limits, weak-match exclusion, private boundaries and preview-only behavior. The existing 58 audio/API/provider/media/worker tests passed earlier on October 2, 2026. Browser/provider fixtures are not production acceptance and consume no ElevenLabs generation allowance.

The Studio browser checks passed on October 2, 2026: new default and five tabs, six voices per page with bounded navigation, actual social-media tags first, ad/demo priority, same-screen selection, and all 21 fixture catalogue names/descriptions retained in the preserved three-column library for every focus. Checks also covered search/type/sample-language filters, the shared and standalone editors, narration-to-Studio return, safe example insertion, draft/voice/model/speed preservation, shortlist shrinkage, one submission on double click, saved playback/download, private voice selection, Free/Starter gates, empty-shortlist fallback, preview-only blocking and cleanup recovery. Dark/light desktop and 320/390px mobile layouts passed without page errors or horizontal overflow, including a long private voice name.

October 3 subscription checks: API/worker tests cover UGC Free with a paid provider account, invite/development bypass attempts, active Starter/Growth, unknown/inactive plans, strict billing outages, queued replay after downgrade, worker grant expiry/revocation and finalization after downgrade. Browser fixtures verify all 21 available samples can be played by Free users without generation, both editors remain locked, Starter/Growth submit once, downgrade preserves drafts/history, billing outages and public previews stay locked, the header hides provider balance, and dark/light desktop plus 320/390px mobile have no page errors or horizontal overflow. These remain local checks; deploy the web and worker together and perform production acceptance before release.

October 5 bookmark checks: 52 API, database and recommendation tests passed, including verified-owner isolation, Free access without provider or billing calls, strict request validation, duplicate writes/removals, direct-client privilege denial, schema constraints and independent bookmark failures. The production build, TypeScript and targeted ESLint passed. Browser fixtures verified Use It into both editors with draft preservation, account persistence across reload/new browser sessions, bookmark/unbookmark and repeated-click guards, save/read error recovery, unavailable-ID cleanup, correct selected voice in one paid generation, Free/preview-only gates, the preserved full catalogue and Studio flows, and dark/light desktop plus 320/390px mobile without page errors or horizontal overflow. Provider audio and writes were mocked; production acceptance remains pending deployment.

## October 5 signed-in bookmark and Explore fix

The deployed release at `8207241` included a client session revision check in its audio API helper. React Query could start reading bookmarks before the bootstrap effect advanced that revision. A valid Firebase token then returned after the revision changed and was incorrectly rejected with “Sign in to use audio generation.” The bookmark controls also required a successful first read, leaving every icon disabled after this error.

The shared audio client now waits for Firebase restoration, verifies the expected user before and after token lookup, and retries one HTTP 401 with a refreshed token. Loading authentication has its own loading state. Bootstrap revisions still discard obsolete screen updates, but they no longer determine whether an authenticated request is valid. A failed initial bookmark read can be retried by clicking a bookmark or Reload bookmarks; only an individual save temporarily disables its own icon. Failed reads or writes never fabricate success.

Use It now persists the latest provider voice ID independently of bookmarks through `GET/PUT /api/audio/selection`. Requests derive ownership exclusively from the verified Firebase token. Writes are serialized so an earlier, slower click cannot replace the latest selection. A late saved-preference read cannot replace a manual choice in the editor. Scripts, model, speed, generation recovery and Free/Starter/Growth gates retain their existing behavior.

When Main voice reference opens in Explore, it displays the saved Use It voice first, followed by bookmarked voices. A voice appearing in both is displayed once. Stored IDs resolve only against the current owner's catalogue; unavailable IDs never reveal another user's private metadata. Preview plays the existing sample, while **Use sample** explicitly attaches that existing file as a reference without creating speech. There is no automatic generation or audio attachment merely from opening the picker.

`GET /api/audio/voices/[voiceId]/sample` validates authentication and catalogue membership, requires the connected provider account's paid sample eligibility, and fetches only approved ElevenLabs preview hosts. It accepts no caller-supplied URL, sends no Firebase/provider credential to the preview host, rejects redirects and non-audio responses, and enforces an upstream byte limit. The browser verifies the decoded reference is at most 30 seconds. Provider preview-only voices remain listenable but cannot be attached as commercial workflow references.

Below the upload action, Choose saved audio lists the owner's ready generated audio and original recordings suitable for Explore, with the same 30-second limit. Free-test output and private cloning/reference uploads remain excluded. The existing `forExplore=1` server validation remains authoritative. The product-demo audio picker is unchanged. Files stay local until the user submits the connected video workflow.

### Release requirements

This fix is isolated on `codex/fix-audio-bookmarks-explore`, based on the deployed `codex/deploy-trending-explore-audio-20261005` release at `8207241`. The primary checkout contains older, unrelated work and must not be used as this fix's release source without deliberate reconciliation.

1. Apply `supabase/migrations/20261005090038_audio_voice_selection.sql` before releasing the web changes. It creates the owner-scoped `audio_voice_preferences` table with RLS and service-role-only SELECT/INSERT/UPDATE. The existing production `audio_voice_bookmarks` table and its service role permissions were confirmed with a read-only check; do not recreate it.
2. Deploy the web application from the release branch containing this complete fix, with the existing production Firebase, Supabase and ElevenLabs configuration. No additional API key, worker change or paid generation call is required. Do not deploy a locally built artifact that used synthetic verification configuration.
3. On `https://www.getugcpilot.com`, sign in with a real account, bookmark/unbookmark a voice, reload, choose Use It and open Explore's Main voice reference. Verify the chosen voice and saved picks, sample attachment and eligible saved recording attachment. Confirm Free remains unable to generate and Starter/Growth keep their existing access. Repeat with a second owner to verify isolation.

The new migration, deployment and authenticated production acceptance remain pending. Automatic approval review rejected the attempted production JavaScript request with a session cookie. No production data was changed and no workaround session-bearing request was sent.

### Fix verification evidence

The combined suite passed **87 tests** covering API/owner isolation, database privileges and constraints, Firebase restoration/refresh, bookmark retry, sample URL and size restrictions, subscription gates, private media and workflow composition. TypeScript, targeted ESLint and the full Next.js production build passed using the matching production dependency versions. The build used synthetic environment configuration with E2E authentication and generation disabled; it is compile validation only and must not be deployed as a prebuilt artifact.

The browser regression passed initial 401/token refresh, bookmark saving, failed-read recovery, Use It persistence after reload, draft preservation, Free generation locking, Explore's selected/bookmarked ordering, explicit sample attachment, eligible owned recording selection, and 390px mobile layout without horizontal overflow or page errors. Provider samples and API writes used synthetic fixtures; the test submitted no audio generation. These checks establish local behavior, not authenticated production acceptance.

## October 5 repeated Audio loading fix

Previously Audio generation stored its bootstrap response in page-local state and unconditionally fetched it on mount. Navigating to Explore discarded that state. Every return began with an empty voice catalogue and a loading message, even for the same authenticated owner.

Audio generation and Explore's Main voice reference now share the UID-scoped `audio-library` query in the existing account query provider. The provider lives in the root layout and survives ordinary app navigation. A fresh response is reused without an additional bootstrap request. Responses become stale after 30 seconds and are retained in memory for up to one hour without an observer; a later return renders the existing voices immediately while refreshing availability, history and catalogue data in the background. The header shows a small Updating voices indicator; the voice lists remain available. First visits, full browser reloads and visits after cache collection still require a first load. No private catalogue or recording metadata is persisted to browser storage, and an account change recreates the application query provider.

Paid generation, uploads and cloning wait while availability is refreshing and remain disabled if that refresh fails. Server authorization remains authoritative. A read failure preserves existing voices, the selected voice and the current editor draft, exposes the error and supports manual Refresh voices. Refresh after a mutation bypasses the freshness window and cancels an older pending bootstrap so a deleted asset or voice cannot be restored by an obsolete response. Active history polling updates the shared snapshot without extending the age of its plan check.

Saved submission recovery is independent of catalogue caching. On mount it still reads the owner-scoped browser receipt and checks live request-key history. An uncertain request remains blocked and is never replayed automatically. A terminal live response clears only the matching receipt. This loading change adds no migration, provider generation call or worker change beyond the separately pending selected-voice migration.

The combined targeted suite now passes **103 tests**, including six cache cases for shared request deduplication, fresh return, five-minute background refresh, failed refresh, forced mutation refresh, cancellation and account isolation. Browser fixtures additionally verified actual sidebar navigation, cached voice visibility while the delayed refresh was pending, action locking/recovery, preserved selection and draft during refresh, and live uncertain-request recovery without resubmission. The earlier bookmark/Explore sample and owned-recording browser regression still passes. Targeted ESLint, standalone TypeScript and the full Next.js production build passed after the final loading changes. These checks used synthetic data and made no speech generation calls; authenticated production acceptance remains pending release. Do not deploy the synthetic validation build artifact.
