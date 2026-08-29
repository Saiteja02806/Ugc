# Migration reconciliation lock

Database migration releases are temporarily frozen while the local migration
history is reconciled with the linked production Supabase project's history.

Do not add, rename, remove, apply, repair, or deploy migrations until all of
the following are complete:

1. A current, recoverable schema snapshot or approved backup point exists.
2. The canonical `supabase/migrations` history has been reconstructed from
   verified production records.
3. That history has reset successfully in an isolated database and the
   relevant application flows have passed.
4. A reviewer has approved removal of this lock and the nested
   `supabase/supabase/migrations` evidence directory has been handled as part
   of the verified reconciliation.

Application-only releases may continue when they do not depend on a database
schema change.
