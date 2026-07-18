# UGC

UGC is a Next.js app for generating reusable AI creator avatars for short-form UGC ad hooks.

## Current Slice

The app uses Next.js API routes to create durable `background_jobs` rows and
enqueue worker messages. AWS SQS/ECS and S3/CloudFront remain the production
defaults while GCP Pub/Sub, Cloud Run worker canary tooling, and GCS storage are
available as dark-launch paths.

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

## Worker-Backed Generation

Set these server-side values in `.env.local`, then restart Next.js:

```txt
OPENAI_API_KEY=sk-...
AWS_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
CLOUDFRONT_DOMAIN=...
```

Run both local processes:

```bash
npm run dev
```

Worker-backed debug routes enqueue durable jobs and poll `background_jobs`:

- `POST /api/debug/test-generate-avatar`
- `GET /api/debug/avatar-run-status?jobId=...`
- `POST /api/debug/test-generate-hook-video`
- `GET /api/debug/hook-video-run-status?jobId=...`
