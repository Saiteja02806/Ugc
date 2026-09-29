# Higgsfield Seedance 2.5 video generation

The Video Generation screen defaults to Seedance 2.5. A prompt alone uses Text to Video; one image uses Image to Video; multiple images use Reference to Video; and a video with optional images uses Video Edit. The Seedance playground offers up to 30 image/video references, so UGC Pilot allows 30 images, or 29 images plus one video. Seedance accepts reference clips up to 30 seconds. Google Omni Flash 1.1 accepts up to six image references in UGC Pilot; its official prompt guide demonstrates six but does not state a hard model maximum. A single Omni output is limited to 10 seconds. Longer Omni videos would require multiple paid extension requests, so UGC Pilot does not present a misleading 30-second single-request option. Video references in this screen use Seedance.

Seedance runs in the AI generation worker and stores the finished MP4 through the existing video job pipeline. The worker saves each provider request ID as soon as submission succeeds so polling can resume without making another billable request.

## Local credential and smoke test

Add `HF_CREDENTIALS=key-id:key-secret` to the ignored root `.env.local` file. Keep the value out of source control, chat, and logs. The local worker already loads this file during development.

Run `npm run higgsfield:example` from the repository root. This makes one billable, five-second 720p Seedance request and prints the generated video URL only after a completed result. Failed or moderated results exit unsuccessfully.

## Hosted worker

Apply `supabase/migrations/20260929120000_allow_higgsfield_generation_provider.sql` before enabling Seedance jobs. Store the credential in Google Secret Manager, grant the AI generation worker access, and set `higgsfield_credentials_secret_id` to that secret's ID when applying the `infra/gcp/ai-generation-worker` Terraform module. Deploy the updated worker and web app together. The secret value must remain in Secret Manager; Terraform takes only its ID.

Official references: [TypeScript SDK](https://docs.higgsfield.ai/docs/how-to/sdk), [Text to Video](https://open.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/api-reference), [Image to Video](https://open.higgsfield.ai/models/bytedance/seedance-2.5/image-to-video/api-reference), [Reference to Video](https://open.higgsfield.ai/models/bytedance/seedance-2.5/reference-to-video/api-reference), [Video Edit](https://open.higgsfield.ai/models/bytedance/seedance-2.5/video-edit/api-reference), [Omni model card](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash), and [Omni guide](https://ai.google.dev/gemini-api/docs/omni).
