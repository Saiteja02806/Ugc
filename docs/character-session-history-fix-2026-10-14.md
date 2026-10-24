# AI influencer session and History repair — October 14, 2026

The Explore AI character workspace was restoring every durable job receipt into
the visible workspace. This reopened completed images after refresh or route
re-entry, even though the documented behavior placed earlier images in History.
Existing session tests incorrectly required completed images to survive those
new visits.

`useCharacterBuilder` now keeps foreground job membership in state belonging to
the mounted workspace. New generations accumulate during that visit. Restored
jobs enter its foreground only when observed unfinished; jobs already completed
at their first recovery check remain in History. Completed siblings in a mixed
batch stay in History while unfinished siblings recover. An image that finishes
during the visit stays visible until refresh, re-entry or the existing ten-minute
idle reset. Users can still explicitly open an image from History and return to
the current workspace.

Durable receipts, account isolation, original request keys, selected references,
status retry controls and automatic saving to My influencers are preserved.
The change requires no database migration, worker change or regeneration.

The second screenshot's icon matches Edge's browser-provided Visual Search
overlay. There is no external image-search control or link in the character
result markup. Generated portraits, inline workspace images, saved influencer
cards and History thumbnails now use `pointer-events: none` on the image layer;
their existing buttons still handle pointer and keyboard selection. This is
scoped to character images and preserves accessible text and the original media.
It does not change browser preferences or block context menus.
References: [Microsoft Edge Visual Search](https://www.microsoft.com/en-us/edge/features/visual-search)
and [MDN pointer-events](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/pointer-events).

Validation:

- 65 focused character session, hook, reference, History, saved identity and
  progress tests passed. Coverage includes immediate reload/re-entry, mixed
  completed/unfinished batches, failed recovery checks, uncertain requests,
  accumulated generations and ten-minute idle expiration.
- Full application TypeScript and scoped ESLint passed.
- The real-component browser fixture verifies cached re-entry, refresh, four
  saved images remaining in History, explicit History preview and Back to session,
  existing upload/uncertain-request recovery, idle reset and mobile overflow.
  It uses local fixture endpoints with no production writes or paid generation.
- Edge fixture checks verify the image layer is excluded from pointer hit
  testing, clicks reach the selection button, Enter still selects an influencer,
  and selection opens no external tab or navigation. Saved cards and History
  thumbnails retain the same image-layer suppression.

| Boundary | Evidence |
| --- | --- |
| UI renders | Real workspace bundled in Edge at desktop and 390px mobile widths |
| Client → API | Fixture records selection job IDs and the exact recovered request key |
| API → data → response | Owned History and identity contract tests pass; fixture retains all four images |
| Response → UI | Re-entry/refresh clear completed results; explicit History opens an image; Back to session restores the clean canvas |

The fix is local and has not been pushed or deployed. Read-only navigation to
`https://www.getugcpilot.com/explore/build-character` redirects to sign-in in the
available browser, so authenticated production acceptance remains pending after
deployment. The existing unrelated worktree changes are outside this repair.
