# Dedicated MCP business logo candidate

Unreleased branch `codex/mcp-business-media`, based on onboarding PR #53 source
`17824a3a0d185ed4cfe3c47ca1b21e451f199610`. Full application access remains unfinished. This candidate completes
the dedicated logo reservation/IDE transfer/verification adapter; actual hosted
acceptance, screenshots and other remaining parity areas are still required.

## Behavior

Six tools read limits, reserve a supplied local logo, recover/discover pending
uploads, renew a create-only link and confirm actual image bytes. Writes require
`brand:write`, additive schema and `MCP_BUSINESS_MEDIA_WRITES_ENABLED=true`;
unset/false denies before storage. No bucket, IAM, worker or customer-media
migration is part of this change. The owning business identity is attached
separately through the existing intended onboarding action.

Persist request UUID/file name/MIME/size/SHA-256 before signing. Exact replay
returns one owner-bound reservation; changed input fails. Links last ten minutes,
use GCS create-only generation preconditions and exact byte/MIME headers, and
can be renewed on the same pending reservation within 24 hours. Existing bytes
must be confirmed rather than transferred again. Twenty pending reservations
per 24 hours limit abandoned reservation growth; older saved bytes remain
confirmable. Reads never issue links or alter the logo.

The existing logo probe is shared between website and MCP. It now fully decodes
PNG/JPEG/WebP within the 2 MB and 64–4096 limits and optionally verifies the
reserved checksum/size/MIME. Invalid bytes fail as a permanent mismatch;
uncertain storage/probe failures preserve the same reservation for recovery.
Reservation identity and ready metadata are protected against later mutation.

A shared database attachment guard covers website and MCP profile/draft
identity writers: a key issued by the MCP reservation must be ready and match
its verified owned descriptor before attachment. Older website-issued keys
retain their existing inspected-key flow; no historical logo row is rewritten.

The new packaged local helper saves an exclusive synced intent before creating
a server reservation, and a separate exclusive synced transfer binding before
PUT. It verifies file identity, GCS destination, create-only headers and expiry.
Signed URLs remain in stdin/memory, never command arguments or saved receipts.
A timeout or 412 requires confirmation of the same ID. The original generic
visual/audio helpers and connection configuration are preserved.

## Evidence

- Full local `npm run test:mcp` passed with all registered tools.
- 12 actual SDK/canonical SQL/decoded-image logo cases passed, including lost
  responses, exact replay, owner isolation, ready immutability, attachment
  guards, pending quota, invalid bytes and expiry/renewal.
- 4 dedicated local transfer cases passed, including interruption, file changes,
  invalid destinations, 412 recovery and durable no-secret receipts.
- Configured Next.js 16.3.8 build passed (155 routes); type/lint passed.
- 19 existing onboarding SQL/enrollment cases and migration guard passed.
- 7 package validation cases and 6 deterministic ZIP/extracted-helper cases
  passed. The new helper actually prepared a logo intent from extracted bytes.
- Two additional independent PostgreSQL reservation/confirmation race cases
  are in the Linux suite; Docker is unavailable locally. Exact-source Linux
  validation remains required before release readiness.
- Host skill evaluations remain unmeasured; a package test is not host parity.

## Artifacts and release dependency

- Migration: `20261013165323_mcp_business_media_uploads.sql`.
- Canonical LF SQL SHA-256: `0ca7f2eecddd2d63a08a4fa68f4316fbe3f2c2147353239e59f752755c841b63`.
- Plugin 0.1.15: 16 skills, 45 allowlisted files, 134339 ZIP bytes.
- ZIP SHA-256: `204c618dfde1752592b77dfa8f8c6680486c5024698dbbef91db925022b0f0ca`.
- Source: 96 tool registrations; last released native count: 79.
- All 29 preceding tracked download artifacts are preserved byte-for-byte
  after canonical text normalization, as are both existing connection configs
  and both generic visual/audio transfer helpers.

Dependencies are the unreleased PR #51 Business Context and PR #53 onboarding
schema/source. New guarded logo keys cannot attach without this additive schema.
No migration has been applied, write gate enabled or production promoted here.
The reviewed candidate needs Linux checks, hosted stages and separate production
authorization before release. No real customer file was uploaded for connectivity.

## Still unfinished

Dedicated app-screenshot uploads/list/archive, website reanalysis, old-logo
object cleanup and real Codex/Claude logo acceptance remain. This does not
establish advanced generation, slideshow backend rendering, full Trending/
Carousel actions, social publishing, analytics or complete application parity.
The first Codex hook/demo/download acceptance is separate existing evidence.
