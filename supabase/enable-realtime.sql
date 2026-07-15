-- Enable Supabase Realtime replication for issues and milestones so that
-- INSERT/UPDATE/DELETE done by one user is pushed instantly to all active
-- clients (see the postgres_changes subscription in src/lib/issues-context.tsx).
-- Safe to run once in the Supabase SQL Editor. If a table is already part of the
-- publication, remove it from the list to avoid a "already member" error.
alter publication supabase_realtime add table public.issues;
alter publication supabase_realtime add table public.milestones;
alter publication supabase_realtime add table public.timeline_entries;
