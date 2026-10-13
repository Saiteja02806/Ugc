# Upload a supplied business logo

Discover `get_business_logo_upload_capabilities`; it is a read using
`brand:read`. Reads and package installation do not deploy schema or enable the
separate business-media write gate. A logo is not a generic image asset or an
app screenshot. Use PNG/JPEG/WebP, at most 2 MB, with 64–4096 pixel dimensions.

Use the packaged `scripts/transfer-business-logo.mjs` from this skill directory
in a supported local IDE. A web-only connector cannot read the user's local
path; use a supported file bridge without pretending the remote MCP sees it.

Prepare the exact selected file before requesting a reservation:

```powershell
node transfer-business-logo.mjs prepare --file "C:/path/brand-logo.png" --receipt "C:/path/logo-intent.json"
```

The helper saves a new UUID, absolute local path, MIME, byte count and SHA-256
with a durable receipt. Keep it private to the workspace. Pass its
`create_business_logo_upload` object unchanged to that tool. New reservations
require `brand:write`, deployed schema and an enabled write gate. A successful
reservation returns no URL and does not attach the logo.

Recover with `get_business_logo_upload` using request UUID or upload ID, or
discover interrupted reservations with `list_business_logo_uploads`. Preserve
the reservation rather than creating a duplicate. `renew_business_logo_upload`
issues the same pending reservation's ten-minute create-only PUT link within
24 hours of reservation. If bytes already exist, confirm them before any other
transfer. Twenty pending reservations are allowed per 24 hours; an older
reservation can still confirm existing bytes but cannot issue another link.

For transfer, provide JSON containing `upload` from reservation/recovery and
`lease` from renewal through stdin to:

```powershell
node transfer-business-logo.mjs upload --receipt "C:/path/logo-intent.json"
```

Do not place a signed link or token in the command, logs or receipt. The helper
checks exact file identity, destination, signed headers and expiry. Its separate
`.transfer.json` file binds the upload ID durably before PUT without overwriting
the original intent. Preserve both records after interruption.

Call `confirm_business_logo_upload` for that exact upload ID. The server decodes
the image and verifies checksum, MIME, bytes and dimensions. A timeout or 412
transfer response is not a reason to reserve or upload another file; confirm
the same ID. Invalid bytes remain unconfirmed and do not become a usable logo.

Only after `status: ready`, use `upload.logo.storageKey` for the user's intended
onboarding identity change, using its separate current revision fence and UUID.
Preserve the name and other answers the user did not ask to change. Confirming
an upload does not change the active logo or finish onboarding. Generic visual
upload IDs cannot substitute for the inspected business-logo key.

Report reserved, transferred/unconfirmed, verified and attached separately.
Screenshots and old-object cleanup are separate operations; this workflow
neither deletes a previous logo nor rewrites existing customer media.
