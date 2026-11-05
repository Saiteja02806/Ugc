# Local app worker

This opt-in mode runs starting frames, AI Studio images and videos, and AI
character jobs from the current checkout. The verified
`vtu19403@veltech.edu.in` Firebase account signs in as usual. Local Supabase owns
test jobs, credits and media records. Production library and credit records live
in the production database. The hosted recovery scheduler can redispatch stalled
production jobs, so the local mode requires a separate local database.

1. Provision a local Supabase instance at `http://127.0.0.1:54321` with the
   application schema. Use test media and a test credit balance for the Firebase UID.
2. Set these values in the ignored `.env.development.local` file. Keep the
   existing Firebase configuration. Use dedicated test storage credentials and
   buckets, and a provider key suitable for real test generation.

   ```dotenv
   LOCAL_APP_WORKER=true
   LOCAL_APP_WORKER_OWNER_ID=<Firebase UID for the verified tester>
   LOCAL_STARTING_FRAME_WORKER_SECRET=<64 lowercase hex characters>
   APP_BASE_URL=https://localhost:3000
   UGC_INTERNAL_APP_URL=https://localhost:3000
   DODO_PAYMENTS_ENVIRONMENT=test_mode
   SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_SERVICE_ROLE_KEY=<local service role key>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>
   ENABLE_HOOK_STARTING_FRAME_PREPARATION=true
   ```

   Generate the shared secret with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. Start Next.js in development on loopback. In a separate PowerShell terminal
   at the repo root, run the worker directly from the current TypeScript sources.

   ```powershell
   $env:NODE_ENV = "development"
   node --env-file=.env.development.local --experimental-transform-types --import ./scripts/worker-source-test-loader.mjs worker/src/index.ts
   ```

4. Open the app, sign in, select the test media and generate an image, video,
   character, or starting frame.
   Real provider calls may incur charges. The app checks the loopback receiver
   before reserving credits. If delivery fails after a job is saved, restart the
   worker and reopen the saved request to redeliver the same queued job.

For scheduling, link dedicated social test accounts in the test database and
configure their provider credentials and callbacks. Set
`LOCAL_APP_WORKER_PUBLISH=true` in both processes only when you intend to
enable real publication on those accounts. The local worker polls the existing
durable due-job query, checks local target registration and invokes the existing
publisher after the due time. Keep the worker running while scheduled jobs are
due. For render callbacks to your local HTTPS server, configure Node to trust
the local server certificate via `NODE_EXTRA_CA_CERTS`.

This mode accepts image, video, avatar, supported rendering and opted-in social
publish jobs. Other job families require their own local integration.
A process killed mid-execution
can leave a job waiting for lease recovery in the test database. Inspect that job
and its provider checkpoint before creating a replacement. Keep the local
database and worker configuration together when testing. To return to normal
development, remove the local mode flag and restore the prior database settings.
