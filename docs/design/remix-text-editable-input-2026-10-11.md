# Editable Remix Text — 11 October 2026

Implemented locally following the user's clarification: an empty starting box accepts their own details, and generation combines those details with the signed-in account's saved business context. It does not generate from an empty box.

## Design and behavior

- Remix text stays an optional, collapsed 44px row. Opening it shows a small editable **Reference text** box, with prepared reference copy when available. The thumbnail and reference title such as “Hook 01” are removed.
- Users can revise that copy or supply their own idea. Additional instructions stay in a disclosure. Business context shows only the saved business name/readiness and a Settings link.
- Generate produces a separate editable suggestion. **Apply to this clip** changes the selected opening's text overlays; it retains trim, audio, styling and existing block timing. New overlays scale source timing to the selected clip. It does not change spoken dialogue or the scheduling caption.
- The demo uses independent manual text controls. Hook reference metadata is no longer passed into its editor, and the Talking Head demo disables Remix. Its trim, text, crop, sound and existing save/composition behavior remain available.
- Generated and reviewed suggestions, including temporarily empty fields, survive reloads. Draft storage is scoped by account, workflow, clip and source. Input stays locked while a generation result is uncertain.
- Trim is a compact disclosure in the shared video editor. The starting box is three rows, with a subdued scrollbar. At 1280×720, Generate and the clip-only scope statement fit inside the editor above the footer.

## API and safety

The API accepts bounded, editable `referenceBlocks` and an optional workflow format. It still validates catalogue reference/slide identity and retrieves business facts on the server. No client business context is accepted. Missing or unreviewed extraction is not automatically prefilled; user-written copy can be used instead.

The edited copy is part of the immutable request hash and saved receipt. Existing requests without the new fields retain their original hash. Existing owner-scoped storage, atomic claims, quota and disabled SDK retries remain in place. Recovery checks the same request UUID and text; it cannot automatically submit a second provider call. Existing JSON receipt fields hold the effective source; no new migration is needed.

## Local verification

- 119 targeted tests passed: request validation, saved private business context, edits and custom details, source/account association, receipt recovery/concurrency, catalogue/storage contracts, video/demo/slideshow editing, workflow finishing, and nine rendering tests.
- Root TypeScript and scoped ESLint passed.
- CUA checked the actual app at 1280×720, 1366×768, and 1920×1080: no horizontal overflow. The actual demo has manual text controls and zero Remix panels.
- CUA checked the real Remix component with mock APIs: edited starting copy, custom details with no reference, review without mutating existing text, reviewed-draft reloads, account/clip isolation, and applying to the selected slide while preserving its layout.
- A simulated lost reply recovered after reload with two HTTP requests, one mocked provider call, the same UUID and identical input.
- A real FFmpeg export rendered remixed text on the opening at 0.5s and 2.8s; the appended demo had no hook text at 3.1s or 4.5s.

Actual app screenshots: `.tmp/remix-text-browser/remix-hook-laptop-1280.png`, `remix-hook-laptop-1366.png`, and `remix-hook-desktop-1920.png` in the same directory. Physical laptop size depends on display scaling; these checks use representative CSS viewport sizes.

The user requested local checks. Production generation, saving and publishing were not exercised. No paid AI call, production data change or deployment was performed. The existing Remix rollout flag remains unchanged; authenticated deployed verification is still required for production acceptance.
