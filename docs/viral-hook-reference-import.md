# Viral Hook Video reference import

This is an operator-only command for importing Instagram Reel references into
the new Viral workspace. It does not add an admin frontend, does not download
Reel videos, and does not connect references to generation or replication.

## Before the first import

1. Apply `supabase/migrations/20260812112037_create_viral_hook_data_foundation.sql`.
2. Keep `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` only. Never expose it through
   a `NEXT_PUBLIC_` variable or client-side code.
3. Copy `scripts/data/viral-hook-reels.example.txt` to a private working file and
   add one direct, public Instagram Reel URL per line.

## Dry run

```powershell
npm run viral:import -- --file scripts/data/viral-hook-reels.txt
```

The dry run normalizes URLs, checks database duplicates, asks Meta for official
embed HTML only for new URLs, removes Meta's SDK script tag, and prints the
records that are ready. It performs no database writes.

## Execute

After reviewing the dry-run output:

```powershell
npm run viral:import -- --file scripts/data/viral-hook-reels.txt --execute --yes
```

New rows are created in `viral_references` with section `hook_video` and status
`pending_review`. Duplicate rows are skipped. Rejected entries are reported with
their input line and reason.
