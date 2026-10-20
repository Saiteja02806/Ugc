# Kling 3.0 through Runway

This release replaces the AI Studio Seedance 2.5 selector and default with
Kling 3.0 Standard, using the existing Runway account and worker secret.
Google Omni, existing media history, billing credit rates, and recovery of
already submitted Seedance jobs retain their existing behavior.

New requests use Runway model `kling3.0_standard` on `/v1/text_to_video` or
`/v1/image_to_video`, with native audio enabled. Supported controls are
720p, portrait or landscape, durations from 3 through 15 seconds, and a
prompt of 2–2,500 characters. One image supplies the first frame; a second
supplies the last frame. Audio and video references are rejected before
customer credits are reserved.

Runway's live API exposed Kling before the published model catalog and
SDK 4.20.1 generated model unions were updated. Its authenticated request
validators confirmed the exact model ID, dimensions, duration bounds,
prompt bounds, audio field, and first/last image positions on 2026-10-01.
The integration uses the SDK's public `post` transport instead of casting
an incompatible generated request type. SDK automatic retries remain off.

The existing Runway daily spending guard applies before new requests;
Kling Standard with audio is estimated at 13 provider credits per second.
Accepted task IDs are persisted before polling. Recovery polls that same
task or downloads its recorded output without another paid submission.
Provider failures retain the existing durable failure and credit handling.

Validation: production Next.js build; AI Studio regression suite (71
tests); worker provider, budget, Kling and legacy Seedance suite (32
tests); lint and diff checks; desktop/mobile controls. A three-second
Runway canary completed with a valid 720×1280 MP4, 3.042-second duration,
and audio. The earlier Higgsfield trial failed due to its account balance;
new Kling jobs use Runway exclusively.

Deploy the AI generation worker first, then the web release. The worker
retains the earlier Runway and Higgsfield Seedance recovery adapters so
the previous web release can continue to operate during the transition.
No database migration or secret change is required.

Scope: only this model replacement. Landing-page clipping, image History,
seven-day trials, content imports, and other pending checkout changes are
excluded from this release at the user's explicit direction. This release
is based on production commit `687bb141609c6c44170caec84d56459ac4aa7c10`.

References:
- [Runway model pricing](https://academy.runwayml.com/models-pricing)
- [Runway API reference](https://docs.dev.runwayml.com/api/)
- [Runway SDK public transport](https://github.com/runwayml/sdk-node)
