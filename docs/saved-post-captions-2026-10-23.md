# Saved post captions

Implemented locally on 23 October 2026. Migration and website deployment remain
pending under the existing release pause. No production data was changed.

## Behavior

- Save caption stores the current exact caption in the signed-in account's shared
  library. Users can keep up to twenty captions, each within 5,000 characters.
  Duplicate text is not saved again. URLs, line breaks, hashtags, emoji and spaces
  remain intact.
- The first saved caption becomes the default. Saved captions offers Use caption,
  Make default, a selected Default toggle to unset it, and Delete. The full text
  is shown in a compact scrollable list without opening another modal.
- Defaults populate untouched empty new-post forms. Existing caption text and
  intentional blanks take precedence. Clearing with × affects only the current
  post; workflow persistence keeps the intentional-blank marker across reloads.
  Explicit Use caption replaces the field. Changing or deleting a saved caption
  never mutates an already scheduled post or accepted scheduling receipt.
- Save caption / Saved captions sit beside the caption label. The clear control
  is inside the textarea. Actions wrap on phones, with keyboard focus, accessible
  labels, a character count and visible status/error messages.

## Shared surfaces

Trending's PlatformSelectionModal covers Carousel, Wall of Text and Reaction posts
and the Library surfaces using that modal. The Hook Video schedule drawer uses the
same control. Explore's WorkflowSchedulingPanel covers Hook, Wall of Text,
Slideshow, Talking Head + Demo and the existing Phone workflow form, including
background scheduling preparation. Local source-only previews do not read/write
account caption storage. Existing Schedule-page edit forms are unchanged.

The default is loaded during Trending account selection, before the Details step,
so moving between Details and Review cannot reapply a cleared caption. Workflow
defaults wait for draft and scheduling receipt recovery and are disabled for an
existing immutable receipt. Manual captions remain available if library loading
fails. Library access is optional and does not block publishing-account checks.

## Storage and failure recovery

`/api/account/saved-captions` authenticates via Firebase, uses only the verified
UID, strictly validates its input, and returns private no-store responses. The
service-only table `user_saved_captions` stores a bounded caption array, nullable
default ID and revision. An absent row reads as an empty library without writes.
RLS is enabled; public, anon and authenticated have no direct table privileges.

Updates compare the loaded revision; initial creation uses a unique user key.
Conflicts return 409 instead of overwriting another tab's changes. The client
shares owner-scoped query data across surfaces, bounds token/HTTP reads and saves,
and never automatically repeats PUT. After an ambiguous failure it reads the
current revision and requires explicit Retry before another change. Existing post
text stays visible throughout. Late owner tokens cannot send a cancelled request,
and account changes immediately hide previous-account caption state.

No AI model, media worker, publishing API contract, entitlement, generation cost
or existing scheduling receipt changes. Saved caption data is not provided to
generation services. No emails, posts or provider calls were sent for validation.

## Local evidence

- 158 focused API/model/local-database/draft/session/scheduling regressions passed,
  plus two authenticated-client cancellation/cache tests and an inactive-tab save
  recovery regression (161 tests total). The local PGlite test
  executes the migration and checks RLS/privileges, unique ownership, default
  validity and revision fencing.
- `scripts/saved-captions.browser.cjs` uses the actual caption control, stylesheet,
  query hook and client against fixture accounts/HTTP at 1280×900, 390×844 and
  320×568. Covers multiple saves, default reuse, intentional clear, existing text,
  deletion, account isolation, failed writes, ambiguous committed responses,
  concurrent-tab conflicts, delayed defaults and horizontal overflow. Inspected
  screenshots and receipt: `.tmp/saved-captions-browser/` (ignored artifacts).
- `scripts/trending-publishing-preferences.browser.cjs` exercises the actual
  Trending modal and Hook drawer: default loads, save/clear/reuse reach the local
  schedule submission, publishing settings remain intact, and desktop/mobile
  rendering has no horizontal overflow. HTTP/auth/OAuth use fixtures; no hosted
  publication is possible. Settings and the eighteen existing publishing cases
  also passed. Screenshots: `.tmp/trending-publishing-preferences-browser/`.
- Application TypeScript and scoped ESLint passed. No worker files changed.

## Release acceptance

Apply the additive migration before deploying the website. Then verify under a
signed-in production account at getugcpilot.com: save from Trending, reuse from an
Explore workflow, change default, clear/reopen a workflow draft, delete a default,
and confirm an existing schedule's caption is unchanged. These hosted checks
remain pending; local fixtures do not establish production acceptance.
