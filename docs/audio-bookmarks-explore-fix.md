# Audio bookmarks and Explore fix — October 5, 2026

The complete fix is in the isolated checkout:

`C:\Users\chund\OneDrive\Desktop\UGC\.tmp\audio-bookmarks-explore-fix`

Branch: `codex/fix-audio-bookmarks-explore`.

Base: deployed release `codex/deploy-trending-explore-audio-20261005` at `8207241`.

The primary checkout contains older, unrelated changes. The fix uses the deployed release as its base to preserve the current connected Explore workflows and audio submission recovery. Its source changes have not been copied onto the older primary checkout.

## Behavior

- A bootstrap revision race no longer rejects a valid restored Firebase session as signed out. A 401 refreshes the token once.
- Bookmark controls recover after an initial read failure. Only a voice currently being saved is temporarily disabled.
- Use It saves the latest chosen voice independently of bookmarks and preserves the editor draft.
- Explore's Main voice reference shows the chosen voice first, then bookmarked voices, with previews and an explicit Use sample action.
- Choose saved audio offers eligible owned recordings. Audio attachment remains separate from generating speech or submitting a video.
- Existing Free/Starter/Growth generation gates and private media ownership checks are preserved.
- Audio generation and Explore now share an account-scoped in-memory cache. Returning within the same session keeps voices visible while stale data refreshes in the background, including after five minutes. First visits and full browser reloads still perform an initial load.
- A failed refresh retains browsing and the current draft while generation remains locked. Cached navigation still checks saved generation requests against live history without automatically replaying them.

## Verification and release

The combined suite now passes 103 targeted tests. Browser fixtures verified bookmark retry, selection persistence, Free locking, Explore sample/recording selection, mobile layout, repeated Audio–Explore navigation, a simulated five-minute return, background refresh failure/retry and saved-request recovery. No speech was generated during verification. TypeScript, targeted lint and the full Next.js production build passed after the final loading change. Builds use synthetic configuration for validation and must not be deployed as prebuilt artifacts.

The new database migration and web deployment remain pending:

`supabase/migrations/20261005090038_audio_voice_selection.sql`

Apply that migration from the fix checkout, deploy the complete fix on the release base, and verify signed-in behavior on `https://www.getugcpilot.com`. Local synthetic fixtures are not production acceptance. Automatic approval review blocked the attempted production check with a session cookie; no production data was changed.

Full implementation and release notes are in the fix checkout's `docs/audio-ugc-native-plan.md`, under **October 5 signed-in bookmark and Explore fix**.
