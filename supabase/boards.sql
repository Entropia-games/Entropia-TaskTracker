-- Boards table for the collaborative whiteboard (Desk feature).
-- Run this in the Supabase SQL editor (or via the Supabase CLI).

create table if not exists public.boards (
  id          text primary key,
  name        text not null default 'Untitled board',
  data        jsonb not null default '{"strokes":[],"cards":[]}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create index if not exists boards_updated_at_idx on public.boards (updated_at desc);

alter table public.boards enable row level security;

-- NOTE: this board is shared project-wide, so we allow the anon key to read/write.
-- Tighten these policies (e.g. require auth.uid()) if you need per-user access.
drop policy if exists "boards_anon_read"  on public.boards;
drop policy if exists "boards_anon_write" on public.boards;
drop policy if exists "boards_anon_update" on public.boards;

create policy "boards_anon_read"
  on public.boards for select
  using (true);

create policy "boards_anon_write"
  on public.boards for insert
  with check (true);

create policy "boards_anon_update"
  on public.boards for update
  using (true);

create policy "boards_anon_delete"
  on public.boards for delete
  using (true);
