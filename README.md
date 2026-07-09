# UGC

UGC is a Next.js app for generating reusable AI creator avatars for short-form UGC ad hooks.

## Current Slice

The current working screen is a simple image generation tester:

- `/image-test`
- `POST /api/image-test/generate`
- `GET /api/image-test/status?runId=...`

The frontend only calls internal API routes. The generate route starts a Trigger.dev task, the task calls OpenAI image generation, uploads the PNG to S3, and returns the CloudFront URL through the status route.

The original foundation includes:

- Next.js App Router with TypeScript
- Tailwind CSS theme tokens for the warm creator-tool UI
- Base routes for dashboard, project setup, and avatar generation
- Supabase client dependency and public environment shape
- Project name set to UGC

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000/dashboard`.

On Windows PowerShell environments that block `npm.ps1`, run:

```bat
cmd /c npm run dev
```

or use:

```bat
scripts\dev.cmd
```

## Supabase

The project URL is configured as:

```txt
https://kltxwijhluawgveykfbt.supabase.co
```

Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` before calling Supabase from the browser. Do not store Supabase management tokens in app files.

## Image Generation Test

Set these server-side values in `.env.local`, then restart Next.js and Trigger.dev:

```txt
OPENAI_API_KEY=sk-...
TRIGGER_SECRET_KEY=tr_...
AWS_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
CLOUDFRONT_DOMAIN=...
```

Run both local processes:

```bash
npm run dev
npm run trigger:dev
```

The test route accepts:

```json
{
  "prompt": "image prompt"
}
```

The browser polls the Trigger.dev run status until a CloudFront image URL is available.
