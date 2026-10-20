# Explore Slideshows: versions, context and reopening — 15 October 2026

## What was wrong

Selecting five reference images supplied five context images to one generation.
Quantity two created two individual outputs. It did not create two five-slide
sets. Business context was also absent from the slideshow image queue path.
Image/Video generation History was hidden in Explore, including empty sessions.
The editor restored only its current browser draft; saved Library slide sets had
no Edit slides action. The earlier naming-only audit documented that old behavior
and is superseded by this implementation for these requirements.

## Implemented locally

| User task | Result |
| --- | --- |
| Select references | Bounded 64px preview, title alongside it, 48×64 selectable thumbnails, compact upload/remove. Removed Use all/Choose images, repeated guidance and misleading Creating slide text. All retained actions stay available. |
| Generate | Selected reference count × Versions. Five × two queues ten images, with one durable job per slide/version and an honest total credit estimate. |
| Choose a model | GPT Image 2.5 Flare is the slideshow default; Sunburst and Nano Banana remain available. Existing Sunburst job IDs retain their meaning. |
| Apply business context | Server reads the authenticated owner's applied Settings context. Missing/incomplete/unavailable context blocks before billing. Frozen whitelisted facts reach the actual worker/provider prompt. The browser cannot choose another owner's profile; visible prompt text stays separate. |
| See results | Explicit Version/Slide positions and complete-version actions. Completion order cannot scramble slide order or mix versions. Failed/partial groups do not enable a complete-version action. |
| Edit slides | The first completed version fills only an empty editor. Edit version opens every image in that version. Existing drafts are preserved when other generation finishes. |
| Return later | History is visible with no current-session results. New grouped generations reopen a whole version; older images remain individually reusable. |
| Switch between edited sets | The current draft is archived before switching. Earlier drafts on this device reopens up to twenty snapshots; active text/appearance still restore after reload. An unreadable archive cannot hide the valid active draft. |
| Reopen a saved slideshow | Saved slideshows → Creative Assets/Saved → Edit slides. Owner-bound Library lookup restores source image IDs and editable text from new saves. Re-saving creates a new Library item, preserving the earlier rendered output. |
| Use older saved sets | Existing retained owned image IDs can reopen. Text already baked into rendered images remains pixel text; the UI states this limitation. Missing/deleted original assets remain explicit rather than substituting references. |

The Generate action is content-sized and 36px high on desktop, retaining a 44px
coarse-pointer target. Reference strip selection, preview, upload, remove, busy
state and keyboard pressed states were preserved.

## Generation and recovery contract

`slideshowSlideCount` is explicit for a new full-version request; `quantity`
remains 1–4 versions. Full-version source selections support 1–10 slides, with
saved output sequences still requiring 2–10. Additional instruction image
attachments remain separate from layout references. Recreating a single slide
uses the existing regeneration contract.

Every new deck job freezes batch key, version index/count and slide index/count.
Child keys use version-major order. Lost acknowledgments and discovery use the
original count and GET-only recovery; late children remain discoverable without
submitting replacement work. The five-by-two recovery test loses the original
response, discovers six children, reloads, then recovers all ten without a new
paid POST. Maximum forty-output recovery is also tested. Older requests without
the slide-count field retain their original count and do not gain invented jobs.

The API preserves the user's prompt and freezes the approved business snapshot
separately. The worker combines that snapshot, output position and reference roles
into the provider prompt. Provider operation fingerprints include the snapshot
and slot, while older queued jobs keep their previous fingerprints. Each new
slide's Remix source resolves its own reference rather than always slide one.

## Saved editing contract

New saves retain original source media IDs, stable positions and validated text
designs in the existing Library JSON metadata. Rendered image IDs still drive
publishing. The save API validates ownership/readiness of both source and rendered
media, rejects changed/mismatched positions and includes the editable snapshot in
the new save fingerprint. Existing saves without the snapshot keep their old
fingerprint. No schema migration or mutation of existing Library rows is needed.

The Library detail route authenticates the exact item lookup. Only Explore
slideshow items receive the Edit slides link; ordinary Carousel cards keep their
existing actions. Automated Carousel generation/matching/rendering is unchanged.

## Other workflows checked

- Hook and Wall: existing generated-video History is now visible in Create with
  an empty current session, and its drawer opens in the active live workflow.
- Talking Head + Demo: uses Saved drafts at `/explore/create-hook?drafts=1` and
  Creative Assets reuse. It still lacks the same in-workflow full generation
  History drawer. This audit does not certify restoration of every historical
  composition or every edit across devices.
- Draft snapshots on this device are not account-wide cloud draft history.
  Saved Library editable snapshots are the server-owned reopening path.

## Verification and deployment limits

**249 application tests passed** in `outputs/explore-slideshow-versions-tests.log`.
They execute request parsing/queue payloads, recovery, reference ownership,
presentation callbacks, version grouping, actual editor callbacks, save/reload,
Library reopening, scheduling input validation and adjacent Hook/Wall behavior.
**20 worker/provider tests passed**, with outgoing model request builders and
provider inputs inspected using stubs; no paid image calls were made. TypeScript,
worker compilation, targeted ESLint and scoped whitespace checks passed.

The reference-picker browser fixture compiled. Its Edge launch failed due to
sandbox profile/named-pipe errors; the MCP browser could not reach that local
fixture server. No fresh screenshot or 1280×720/1366×768/1536×864 scroll/zoom
acceptance is claimed. The production browser session redirected to sign-in in
the preceding audit. The final navigation retry reported that the browser profile
was already in use; it was not closed or reset. Signed-in production generation,
saving and real provider quality remain unverified. These changes are not deployed.

A release needs both worker and website support for Flare and the new grouped
job payload. Do not release only the dropdown against an old worker. Existing
two-image jobs are not retroactively turned into ten images; no paid backfill
was submitted during this work.

Model identities were checked against the official [Flare model page](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare)
and [Sunburst model page](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst).
